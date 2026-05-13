// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// ─── FishingGame Interface ───────────────────────────────────────────────────
// Only the two view functions PredictionMarket needs.
// Enums are ABI-compatible with their underlying uint8.
interface IFishingGame {
    // status: 0=Waiting  1=Active  2=Finished
    function getRoomInfo(uint256 roomId) external view returns (
        uint256 id,
        uint8   tier,
        uint8   status,
        uint8   playerCount,
        uint256 entryFee,
        uint256 totalPot,
        bool    isPublic,
        bool    isLivestream,
        address host
    );

    function getPlayerInfo(uint256 roomId, uint256 playerIdx) external view returns (
        address addr,
        uint8   pStatus,
        uint8   rarity,
        uint256 weight,
        uint256 fishingTime,
        uint256 score,
        uint256 recastCount,
        uint256 totalBet
    );
}

/**
 * @title  PredictionMarket
 * @author Module 3 — jiayi
 * @notice Spectators bet Sepolia ETH on which player wins a FishingGame match.
 *
 *         Key mechanics
 *         ─────────────
 *         • Bet earlier  →  higher time-weight  →  larger share of prize pool
 *         • 5 % platform fee deducted from total pool before distribution
 *         • Settlement is permissionless: anyone calls settleBets() once the
 *           FishingGame room status flips to Finished (2)
 *         • Winner is read directly from FishingGame — no trusted party needed
 *
 * @dev    Security: ReentrancyGuard + Checks-Effects-Interactions throughout.
 *         Emergency pause (Pausable) covers all state-changing functions.
 */
contract PredictionMarket is ReentrancyGuard, Ownable, Pausable {

    // ─── Constants ───────────────────────────────────────────────────────────
    uint256 public constant PLATFORM_FEE_BPS  = 500;  ///< 5 % in basis points
    uint256 public constant MAX_TIME_WEIGHT   = 100;  ///< weight when bet placed at t = 0
    uint256 public constant MIN_TIME_WEIGHT   = 10;   ///< weight when bet placed at MAX_GAME_DURATION
    uint256 public constant MAX_GAME_DURATION = 180;  ///< seconds — matches FishingGame GAME_TIMEOUT
    uint256 public constant MIN_BET           = 0.001 ether;
    uint256 public constant CLAIM_WINDOW      = 30 days; ///< after this, owner may withdraw unclaimed funds

    // ─── FishingGame reference ────────────────────────────────────────────────
    IFishingGame public immutable fishingGame;

    // ─── Per-room market state ────────────────────────────────────────────────
    struct MarketInfo {
        uint256 openedAt;    ///< block.timestamp when openBetting() was called
        uint256 totalPool;   ///< total ETH (wei) deposited by all bettors
        uint256 settledAt;   ///< 0 until settleBets() is called
        address winner;      ///< winning player address — set on settlement
        bool    bettingOpen;
        uint8   playerCount;
    }

    /// roomId → MarketInfo
    mapping(uint256 => MarketInfo) public markets;

    /// roomId → bettor → predictedPlayer → weighted bet amount
    /// weightedAmount = rawAmount * timeWeight / 100
    mapping(uint256 => mapping(address => mapping(address => uint256))) public weightedBets;

    /// roomId → player → Σ weighted bets placed on that player
    mapping(uint256 => mapping(address => uint256)) public totalWeightedBetsOnPlayer;

    /// roomId → bettor → has claimed prize
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // ─── Custom errors ────────────────────────────────────────────────────────
    error BettingNotOpen();
    error BettingAlreadyOpen();
    error AlreadySettled();
    error NotSettled();
    error GameNotFinished();
    error GameNotActive();
    error BetTooSmall();
    error InvalidPlayer();
    error AlreadyClaimed();
    error NothingToClaim();
    error ClaimWindowExpired();
    error TransferFailed();

    // ─── Events ───────────────────────────────────────────────────────────────
    event BettingOpened(
        uint256 indexed roomId,
        uint256         timestamp,
        uint8           playerCount
    );
    event BetPlaced(
        uint256 indexed roomId,
        address indexed bettor,
        address indexed predictedWinner,
        uint256         amount,
        uint256         timeWeight,
        uint256         weightedAmount
    );
    event MarketSettled(
        uint256 indexed roomId,
        address         winner,
        uint256         totalPool,
        uint256         platformFee
    );
    event PrizeClaimed(
        uint256 indexed roomId,
        address indexed bettor,
        uint256         amount
    );
    event UnclaimedFundsWithdrawn(uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address _fishingGame) Ownable(msg.sender) {
        fishingGame = IFishingGame(_fishingGame);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Core actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Open the prediction market for a FishingGame room.
     *         Anyone can call this once the game has started (status == Active).
     * @param  roomId  The FishingGame room to open betting for.
     */
    function openBetting(uint256 roomId) external whenNotPaused {
        MarketInfo storage market = markets[roomId];

        // Checks
        if (market.bettingOpen)    revert BettingAlreadyOpen();
        if (market.settledAt != 0) revert AlreadySettled();

        (, , uint8 status, uint8 playerCount, , , , , ) = fishingGame.getRoomInfo(roomId);
        if (status != 1) revert GameNotActive(); // 1 = Active

        // Effects
        market.openedAt    = block.timestamp;
        market.bettingOpen = true;
        market.playerCount = playerCount;

        emit BettingOpened(roomId, block.timestamp, playerCount);
    }

    /**
     * @notice Bet ETH on a player to win.
     * @param  roomId           The FishingGame room.
     * @param  predictedWinner  Address of the player you think will win.
     */
    function placeBet(uint256 roomId, address predictedWinner)
        external payable nonReentrant whenNotPaused
    {
        MarketInfo storage market = markets[roomId];

        // Checks
        if (market.settledAt != 0) revert AlreadySettled();
        if (!market.bettingOpen)   revert BettingNotOpen();
        if (msg.value < MIN_BET)   revert BetTooSmall();
        if (!_isPlayerInRoom(roomId, predictedWinner, market.playerCount))
            revert InvalidPlayer();

        // Time-weight: 100 at t=0  →  10 at t=MAX_GAME_DURATION
        uint256 elapsed      = block.timestamp - market.openedAt;
        uint256 timeWeight   = calcTimeWeight(elapsed);
        uint256 weightedAmt  = (msg.value * timeWeight) / 100;

        // Effects (before any interaction)
        market.totalPool                                     += msg.value;
        weightedBets[roomId][msg.sender][predictedWinner]   += weightedAmt;
        totalWeightedBetsOnPlayer[roomId][predictedWinner]  += weightedAmt;

        emit BetPlaced(roomId, msg.sender, predictedWinner, msg.value, timeWeight, weightedAmt);
    }

    /**
     * @notice Settle the market after the FishingGame room is Finished.
     *         Permissionless — any account may call this.
     *         Reads the winner directly from FishingGame; no oracle required.
     * @param  roomId  The FishingGame room to settle.
     */
    function settleBets(uint256 roomId) external nonReentrant whenNotPaused {
        MarketInfo storage market = markets[roomId];

        // Checks
        if (market.settledAt != 0) revert AlreadySettled();
        if (!market.bettingOpen)   revert BettingNotOpen();

        (, , uint8 status, uint8 playerCount, , , , , ) = fishingGame.getRoomInfo(roomId);
        if (status != 2) revert GameNotFinished(); // 2 = Finished

        address winner      = _findWinner(roomId, playerCount);
        uint256 platformFee = (market.totalPool * PLATFORM_FEE_BPS) / 10000;

        // Effects — update state BEFORE external call (CEI pattern)
        market.settledAt   = block.timestamp;
        market.winner      = winner;
        market.bettingOpen = false;

        // Interaction — send platform fee to owner
        (bool ok, ) = owner().call{value: platformFee}("");
        if (!ok) revert TransferFailed();

        emit MarketSettled(roomId, winner, market.totalPool, platformFee);
    }

    /**
     * @notice Winning bettors call this to receive their ETH prize.
     *         Payout is proportional to each winner-bettor's weighted bet.
     * @param  roomId  The settled FishingGame room.
     */
    function claimPrize(uint256 roomId) external nonReentrant whenNotPaused {
        MarketInfo storage market = markets[roomId];

        // Checks
        if (market.settledAt == 0)                              revert NotSettled();
        if (hasClaimed[roomId][msg.sender])                     revert AlreadyClaimed();
        if (block.timestamp > market.settledAt + CLAIM_WINDOW)  revert ClaimWindowExpired();

        address winner        = market.winner;
        uint256 myWeighted    = weightedBets[roomId][msg.sender][winner];
        if (myWeighted == 0)  revert NothingToClaim();

        uint256 totalWeighted = totalWeightedBetsOnPlayer[roomId][winner];
        uint256 prizePool     = market.totalPool
                                - (market.totalPool * PLATFORM_FEE_BPS / 10000);
        uint256 payout        = (prizePool * myWeighted) / totalWeighted;

        // Effects before interaction
        hasClaimed[roomId][msg.sender] = true;

        // Interaction
        (bool ok, ) = msg.sender.call{value: payout}("");
        if (!ok) revert TransferFailed();

        emit PrizeClaimed(roomId, msg.sender, payout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Owner may withdraw any ETH left in the contract after all claim
     *         windows have expired (unclaimed prizes).
     */
    function withdrawUnclaimed() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal == 0) revert NothingToClaim();
        (bool ok, ) = owner().call{value: bal}("");
        if (!ok) revert TransferFailed();
        emit UnclaimedFundsWithdrawn(bal);
    }

    /// @notice Emergency pause — stops all state-changing actions.
    function pause()   external onlyOwner { _pause(); }
    /// @notice Resume normal operations.
    function unpause() external onlyOwner { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    //  View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full market snapshot for a room.
     */
    function getMarketInfo(uint256 roomId) external view returns (MarketInfo memory) {
        return markets[roomId];
    }

    /**
     * @notice Implied probability (in bps) of a player winning based on
     *         current weighted bets.  e.g. 3000 = 30 %.
     */
    function getOdds(uint256 roomId, address player)
        external view
        returns (
            uint256 playerWeighted,
            uint256 totalWeighted,
            uint256 impliedOddsBps
        )
    {
        MarketInfo storage m = markets[roomId];
        playerWeighted = totalWeightedBetsOnPlayer[roomId][player];
        totalWeighted  = _getTotalWeightedBets(roomId, m.playerCount);
        impliedOddsBps = totalWeighted == 0
            ? 0
            : (playerWeighted * 10000) / totalWeighted;
    }

    /**
     * @notice My weighted bet on a specific player in a room.
     */
    function getMyBet(uint256 roomId, address bettor, address player)
        external view returns (uint256)
    {
        return weightedBets[roomId][bettor][player];
    }

    /**
     * @notice Compute time-weight for a given elapsed time (public for testing
     *         and front-end countdown display).
     * @param  elapsed  Seconds since betting opened.
     * @return weight   Between MIN_TIME_WEIGHT (10) and MAX_TIME_WEIGHT (100).
     */
    function calcTimeWeight(uint256 elapsed) public pure returns (uint256) {
        if (elapsed >= MAX_GAME_DURATION) return MIN_TIME_WEIGHT;
        uint256 drop = (elapsed * (MAX_TIME_WEIGHT - MIN_TIME_WEIGHT)) / MAX_GAME_DURATION;
        return MAX_TIME_WEIGHT - drop;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Verifies that `player` is one of the participants in `roomId`.
    function _isPlayerInRoom(uint256 roomId, address player, uint8 playerCount)
        internal view returns (bool)
    {
        for (uint8 i = 0; i < playerCount; i++) {
            (address addr, , , , , , , ) = fishingGame.getPlayerInfo(roomId, i);
            if (addr == player) return true;
        }
        return false;
    }

    /// @dev Returns the player address with the highest score in the room.
    function _findWinner(uint256 roomId, uint8 playerCount)
        internal view returns (address winner)
    {
        uint256 highestScore;
        for (uint8 i = 0; i < playerCount; i++) {
            (address addr, , , , , uint256 score, , ) = fishingGame.getPlayerInfo(roomId, i);
            if (score > highestScore) {
                highestScore = score;
                winner       = addr;
            }
        }
    }

    /// @dev Sums weighted bets across all players (used for odds calculation).
    function _getTotalWeightedBets(uint256 roomId, uint8 playerCount)
        internal view returns (uint256 total)
    {
        for (uint8 i = 0; i < playerCount; i++) {
            (address addr, , , , , , , ) = fishingGame.getPlayerInfo(roomId, i);
            total += totalWeightedBetsOnPlayer[roomId][addr];
        }
    }
}
