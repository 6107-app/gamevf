// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";

contract FishingGame is VRFConsumerBaseV2Plus, ReentrancyGuard {

    // ─── Enums ──────────────────────────────────────────
    enum RoomStatus { Waiting, Active, Finished }
    enum RoomTier   { Bronze, Silver, Gold, Diamond }
    enum PlayerStatus { Fishing, LockedIn, Recast }
    enum Rarity { Common, Rare, SuperRare, Epic, Legendary }

    // ─── Structs ────────────────────────────────────────
    struct FishResult {
        Rarity rarity;
        uint256 weight;
        uint256 fishingTime;
        uint256 score;
    }

    struct Player {
        address addr;
        PlayerStatus status;
        FishResult currentFish;
        uint256 recastCount;
        uint256 totalBet;
        uint256 skillModifier;
    }

    struct Room {
        uint256 roomId;
        RoomTier tier;
        RoomStatus status;
        address[4] players;
        uint8 playerCount;
        uint256 entryFee;
        uint256 recastFee;
        uint256 totalPot;
        bool isPublic;
        bool isLivestream;
        address host;
        uint256 createdAt;
        uint256 gameStartedAt;
        uint256 lockedInCount;
        mapping(uint256 => Player) playerData;
        mapping(address => uint256) playerIndex;
        mapping(address => bool) isPlayer;
    }

    // ─── NFT Rod Interface ─────────────────────────────
    interface IFishingRod {
        function getRodBonus(uint256 tokenId) external view returns (
            uint256 speedBonus,   // time reduction in bps (e.g. 1500 = -15%)
            uint256 weightBonus,  // weight increase in bps (e.g. 2000 = +20%)
            uint256 luckBonus     // rarity boost in bps (e.g. 1000 = +10%)
        );
    }

    // ─── Constants ──────────────────────────────────────
    uint256 public constant MAX_PLAYERS = 4;
    uint256 public constant MAX_RECAST = 3;
    uint256 public constant PLATFORM_FEE_BPS = 500;
    uint256 public constant RECAST_FLOOR_BPS = 7000;  // recast guarantees >= 70% of previous score
    uint256 public constant GAME_TIMEOUT = 180;        // 180 seconds auto lock-in

    uint256[5] public RARITY_SCORES = [1, 2, 4, 8, 16];
    uint256[4] public TIME_THRESHOLDS = [60, 90, 120, type(uint256).max];
    uint256[4] public TIME_COEFFICIENTS = [12000, 10000, 8500, 7000];
    uint256[4] public RECAST_COEFFICIENTS = [10000, 10500, 11000, 11500];
    uint256[3] public PRIZE_SHARES = [6000, 2500, 1000];

    // ─── State ──────────────────────────────────────────
    IVRFCoordinatorV2Plus private immutable i_vrfCoordinator;
    bytes32 public s_keyHash;
    uint256 public s_subscriptionId;
    uint16  public constant REQUEST_CONFIRMATIONS = 3;
    uint32  public constant CALLBACK_GAS_LIMIT = 300_000;

    uint256 public roomCount;
    mapping(uint256 => Room) public rooms;

    struct VRFRequest {
        uint256 roomId;
        uint256 playerIndex;
        bool isRecast;
    }
    mapping(uint256 => VRFRequest) public vrfRequests;

    mapping(RoomTier => uint256) public entryFees;
    mapping(RoomTier => uint256) public recastFees;

    address public owner;
    IFishingRod public rodContract;

    // ─── Custom Errors ──────────────────────────────────
    error InvalidTier();
    error IncorrectFee();
    error RoomNotWaiting();
    error RoomNotActive();
    error RoomFull();
    error AlreadyInRoom();
    error NotHost();
    error NotEnoughPlayers();
    error NotInRoom();
    error NotFishing();
    error MaxRecastReached();
    error NoFishCaught();
    error GameNotTimedOut();
    error PlayerAlreadyLockedIn();

    // ─── Events ─────────────────────────────────────────
    event RoomCreated(uint256 indexed roomId, address indexed host, RoomTier tier, bool isPublic, uint256 entryFee, uint256 timestamp);
    event PlayerJoined(uint256 indexed roomId, address indexed player, uint256 playerIndex);
    event GameStarted(uint256 indexed roomId, uint256 timestamp);
    event CastRequested(uint256 indexed roomId, address player, uint256 requestId);
    event FishCaught(uint256 indexed roomId, address player, uint8 rarity, uint256 weight, uint256 score, uint256 timestamp);
    event PlayerLockedIn(uint256 indexed roomId, address player, uint256 finalScore);
    event RecastStarted(uint256 indexed roomId, address player, uint256 recastNumber);
    event DiceRolled(uint256 indexed roomId, address player, int256 diceModifier);
    event GameSettled(uint256 indexed roomId, address[3] winners, uint256[3] prizes, uint256[4] finalScores);

    // ─── Constructor ────────────────────────────────────
    constructor(
        address vrfCoordinator,
        bytes32 keyHash,
        uint256 subscriptionId
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        s_keyHash = keyHash;
        s_subscriptionId = subscriptionId;

        entryFees[RoomTier.Bronze]  = 0.01 ether;
        entryFees[RoomTier.Silver]  = 0.05 ether;
        entryFees[RoomTier.Gold]    = 0.1 ether;
        entryFees[RoomTier.Diamond] = 0.5 ether;

        recastFees[RoomTier.Bronze]  = 0.01 ether;
        recastFees[RoomTier.Silver]  = 0.05 ether;
        recastFees[RoomTier.Gold]    = 0.1 ether;
        recastFees[RoomTier.Diamond] = 0.5 ether;
    }

    // ─── Room Management ────────────────────────────────

    function createRoom(
        RoomTier tier,
        bool isPublic,
        bool isLivestream
    ) external payable nonReentrant returns (uint256 roomId) {
        if (msg.value != entryFees[tier]) revert IncorrectFee();

        roomId = roomCount++;
        Room storage room = rooms[roomId];
        room.roomId = roomId;
        room.tier = tier;
        room.status = RoomStatus.Waiting;
        room.entryFee = entryFees[tier];
        room.recastFee = recastFees[tier];
        room.isPublic = isPublic;
        room.isLivestream = isLivestream;
        room.host = msg.sender;
        room.createdAt = block.timestamp;

        room.players[0] = msg.sender;
        room.playerCount = 1;
        room.totalPot = msg.value;
        room.isPlayer[msg.sender] = true;
        room.playerIndex[msg.sender] = 0;

        room.playerData[0] = Player({
            addr: msg.sender,
            status: PlayerStatus.Fishing,
            currentFish: FishResult(Rarity.Common, 0, 0, 0),
            recastCount: 0,
            totalBet: msg.value,
            skillModifier: 10000
        });

        emit RoomCreated(roomId, msg.sender, tier, isPublic, entryFees[tier], block.timestamp);
        emit PlayerJoined(roomId, msg.sender, 0);
    }

    function joinRoom(uint256 roomId) external payable nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Waiting) revert RoomNotWaiting();
        if (room.playerCount >= 4) revert RoomFull();
        if (msg.value != room.entryFee) revert IncorrectFee();
        if (room.isPlayer[msg.sender]) revert AlreadyInRoom();

        uint8 idx = room.playerCount;
        room.players[idx] = msg.sender;
        room.playerCount++;
        room.totalPot += msg.value;
        room.isPlayer[msg.sender] = true;
        room.playerIndex[msg.sender] = idx;

        room.playerData[idx] = Player({
            addr: msg.sender,
            status: PlayerStatus.Fishing,
            currentFish: FishResult(Rarity.Common, 0, 0, 0),
            recastCount: 0,
            totalBet: msg.value,
            skillModifier: 10000
        });

        emit PlayerJoined(roomId, msg.sender, idx);
    }

    function startGame(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (msg.sender != room.host) revert NotHost();
        if (room.status != RoomStatus.Waiting) revert RoomNotWaiting();
        if (room.playerCount < 2) revert NotEnoughPlayers();

        room.status = RoomStatus.Active;
        room.gameStartedAt = block.timestamp;
        emit GameStarted(roomId, block.timestamp);
    }

    // ─── Fishing Actions ────────────────────────────────

    function cast(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (!room.isPlayer[msg.sender]) revert NotInRoom();
        uint256 idx = room.playerIndex[msg.sender];
        Player storage player = room.playerData[idx];
        if (player.status != PlayerStatus.Fishing) revert NotFishing();

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 3,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        vrfRequests[requestId] = VRFRequest(roomId, idx, false);
        emit CastRequested(roomId, msg.sender, requestId);
    }

    function lockIn(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (!room.isPlayer[msg.sender]) revert NotInRoom();
        uint256 idx = room.playerIndex[msg.sender];
        Player storage player = room.playerData[idx];
        if (player.status != PlayerStatus.Fishing) revert NotFishing();
        if (player.currentFish.weight == 0) revert NoFishCaught();

        player.currentFish.score = _calculateScore(player);
        player.status = PlayerStatus.LockedIn;
        room.lockedInCount++;

        emit PlayerLockedIn(roomId, msg.sender, player.currentFish.score);

        if (room.lockedInCount == room.playerCount) {
            _settleGame(roomId);
        }
    }

    function recast(uint256 roomId) external payable nonReentrant {
        Room storage room = rooms[roomId];
        if (!room.isPlayer[msg.sender]) revert NotInRoom();
        uint256 idx = room.playerIndex[msg.sender];
        Player storage player = room.playerData[idx];
        if (player.status != PlayerStatus.Fishing) revert NotFishing();
        if (player.recastCount >= MAX_RECAST) revert MaxRecastReached();
        if (msg.value != room.recastFee) revert IncorrectFee();

        player.recastCount++;
        player.totalBet += msg.value;
        room.totalPot += msg.value;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 5,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        vrfRequests[requestId] = VRFRequest(roomId, idx, true);
        emit RecastStarted(roomId, msg.sender, player.recastCount);
    }

    // ─── VRF Callback ───────────────────────────────────

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        VRFRequest memory req = vrfRequests[requestId];
        Room storage room = rooms[req.roomId];
        Player storage player = room.playerData[req.playerIndex];

        uint256 previousScore = player.currentFish.score;

        uint8 rarityRoll = uint8(randomWords[0] % 100);
        Rarity rarity = _rollRarity(rarityRoll, player.skillModifier);
        uint256 baseWeight = _rollWeight(randomWords[1], rarity);
        uint256 timeVariation = 60 + (randomWords[2] % 61);

        player.currentFish = FishResult({
            rarity: rarity,
            weight: baseWeight,
            fishingTime: timeVariation,
            score: 0
        });

        if (req.isRecast && randomWords.length >= 5) {
            int256 diceModifier = _rollDice(randomWords[3], randomWords[4], player.recastCount);
            if (diceModifier > 0) {
                player.skillModifier = player.skillModifier * (10000 + uint256(diceModifier)) / 10000;
            } else {
                uint256 reduction = uint256(-diceModifier);
                player.skillModifier = player.skillModifier * (10000 - reduction) / 10000;
            }
            emit DiceRolled(req.roomId, player.addr, diceModifier);
        }

        player.currentFish.score = _calculateScore(player);

        // Recast floor: new score must be >= 70% of previous score
        if (req.isRecast && previousScore > 0) {
            uint256 floor = (previousScore * RECAST_FLOOR_BPS) / 10000;
            if (player.currentFish.score < floor) {
                player.currentFish.score = floor;
            }
        }

        emit FishCaught(
            req.roomId, player.addr,
            uint8(rarity), baseWeight,
            player.currentFish.score,
            block.timestamp
        );
    }

    // ─── Scoring ────────────────────────────────────────

    function _calculateScore(Player storage player) internal view returns (uint256) {
        uint256 rarityScore = RARITY_SCORES[uint256(player.currentFish.rarity)];
        uint256 weightScore = player.currentFish.weight * rarityScore;
        uint256 timeCoeff = _getTimeCoefficient(player.currentFish.fishingTime);
        uint256 recastCoeff = RECAST_COEFFICIENTS[player.recastCount];
        return (weightScore * timeCoeff * recastCoeff * player.skillModifier) / (10000 * 10000 * 10000);
    }

    // ─── Settlement ─────────────────────────────────────

    function _settleGame(uint256 roomId) internal {
        Room storage room = rooms[roomId];
        room.status = RoomStatus.Finished;

        uint256 pc = room.playerCount;
        uint256[] memory scores = new uint256[](pc);
        uint256[] memory indices = new uint256[](pc);

        for (uint256 i = 0; i < pc; i++) {
            scores[i] = room.playerData[i].currentFish.score;
            indices[i] = i;
        }

        for (uint256 i = 1; i < pc; i++) {
            uint256 key = scores[i];
            uint256 keyIdx = indices[i];
            int256 j = int256(i) - 1;
            while (j >= 0 && scores[uint256(j)] < key) {
                scores[uint256(j) + 1] = scores[uint256(j)];
                indices[uint256(j) + 1] = indices[uint256(j)];
                j--;
            }
            scores[uint256(j + 1)] = key;
            indices[uint256(j + 1)] = keyIdx;
        }

        uint256 platformFee = (room.totalPot * PLATFORM_FEE_BPS) / 10000;
        uint256 prizePool = room.totalPot - platformFee;

        address[3] memory winners;
        uint256[3] memory prizes;
        uint256 winnerCount = pc < 3 ? pc : 3;

        for (uint256 i = 0; i < winnerCount; i++) {
            winners[i] = room.playerData[indices[i]].addr;
            prizes[i] = (prizePool * PRIZE_SHARES[i]) / 10000;
            payable(winners[i]).transfer(prizes[i]);
        }

        payable(owner()).transfer(platformFee);

        uint256[4] memory finalScores;
        for (uint256 i = 0; i < pc; i++) {
            finalScores[i] = room.playerData[i].currentFish.score;
        }

        emit GameSettled(roomId, winners, prizes, finalScores);
    }

    // ─── Timeout ────────────────────────────────────────

    function forceComplete(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (block.timestamp < room.gameStartedAt + GAME_TIMEOUT) revert GameNotTimedOut();

        for (uint256 i = 0; i < room.playerCount; i++) {
            Player storage player = room.playerData[i];
            if (player.status == PlayerStatus.Fishing) {
                if (player.currentFish.weight > 0) {
                    player.currentFish.score = _calculateScore(player);
                }
                player.status = PlayerStatus.LockedIn;
                room.lockedInCount++;
                emit PlayerLockedIn(roomId, player.addr, player.currentFish.score);
            }
        }

        if (room.lockedInCount == room.playerCount) {
            _settleGame(roomId);
        }
    }

    // ─── Rod Contract ───────────────────────────────────

    function setRodContract(address _rodContract) external {
        require(msg.sender == owner, "Only owner");
        rodContract = IFishingRod(_rodContract);
    }

    // ─── Internal Helpers ───────────────────────────────

    function _rollRarity(uint8 roll, uint256 skillMod) internal pure returns (Rarity) {
        // Probabilities: Common 55%, Rare 25%, SuperRare 13%, Epic 6%, Legendary 1%
        uint256 adjusted = uint256(roll) * 10000 / skillMod;
        if (adjusted >= 99) return Rarity.Legendary;   // 1%
        if (adjusted >= 93) return Rarity.Epic;         // 6%
        if (adjusted >= 80) return Rarity.SuperRare;    // 13%
        if (adjusted >= 55) return Rarity.Rare;         // 25%
        return Rarity.Common;                           // 55%
    }

    function _rollWeight(uint256 rand, Rarity rarity) internal pure returns (uint256) {
        // Weight ranges match Notion fish database (in grams)
        if (rarity == Rarity.Common)    return 50 + (rand % 1450);      // 0.05 - 1.5 kg
        if (rarity == Rarity.Rare)      return 300 + (rand % 3700);     // 0.3 - 4.0 kg
        if (rarity == Rarity.SuperRare) return 1500 + (rand % 6500);    // 1.5 - 8.0 kg
        if (rarity == Rarity.Epic)      return 4000 + (rand % 16000);   // 4.0 - 20.0 kg
        return 6000 + (rand % 19000);                                    // 6.0 - 25.0 kg (Legendary)
    }

    function _rollDice(uint256 rand1, uint256 rand2, uint256 recastNumber) internal pure returns (int256) {
        if (recastNumber == 1) {
            return int256(rand1 % 3000) - 1500;
        } else if (recastNumber == 2) {
            return int256(rand1 % 5000) - 2500;
        } else {
            if (rand2 % 2 == 0) {
                return int256(3000 + (rand1 % 2000));
            } else {
                return -int256(3000 + (rand1 % 2000));
            }
        }
    }

    function _getTimeCoefficient(uint256 time) internal view returns (uint256) {
        for (uint256 i = 0; i < 4; i++) {
            if (time <= TIME_THRESHOLDS[i]) return TIME_COEFFICIENTS[i];
        }
        return TIME_COEFFICIENTS[3];
    }

    // ─── View Functions ─────────────────────────────────

    function getRoomInfo(uint256 roomId) external view returns (
        uint256 id, RoomTier tier, RoomStatus status, uint8 playerCount,
        uint256 entryFee, uint256 totalPot, bool isPublic, bool isLivestream, address host
    ) {
        Room storage room = rooms[roomId];
        return (room.roomId, room.tier, room.status, room.playerCount,
                room.entryFee, room.totalPot, room.isPublic, room.isLivestream, room.host);
    }

    function getPlayerInfo(uint256 roomId, uint256 playerIdx) external view returns (
        address addr, PlayerStatus status, uint8 rarity, uint256 weight,
        uint256 fishingTime, uint256 score, uint256 recastCount, uint256 totalBet
    ) {
        Player storage p = rooms[roomId].playerData[playerIdx];
        return (p.addr, p.status, uint8(p.currentFish.rarity), p.currentFish.weight,
                p.currentFish.fishingTime, p.currentFish.score, p.recastCount, p.totalBet);
    }
}
