// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";

// ─── Mock FishingGame ────────────────────────────────────────────────────────
// Lightweight stand-in for FishingGame; state is set directly by test helpers.
// No VRF needed — PredictionMarket only calls getRoomInfo() and getPlayerInfo().
contract MockFishingGame {
    struct MockRoom {
        uint8 status;       // 0=Waiting  1=Active  2=Finished
        uint8 playerCount;
    }

    struct MockPlayer {
        address addr;
        uint256 score;
    }

    mapping(uint256 => MockRoom)       public rooms;
    mapping(uint256 => MockPlayer[4])  public players;

    // ── Helpers called by test setUp ─────────────────────────────────────────
    function setRoom(uint256 roomId, uint8 status, uint8 playerCount) external {
        rooms[roomId] = MockRoom(status, playerCount);
    }

    function setPlayer(uint256 roomId, uint8 idx, address addr, uint256 score) external {
        players[roomId][idx] = MockPlayer(addr, score);
    }

    // ── IFishingGame interface ────────────────────────────────────────────────
    function getRoomInfo(uint256 roomId) external view returns (
        uint256, uint8, uint8, uint8, uint256, uint256, bool, bool, address
    ) {
        MockRoom storage r = rooms[roomId];
        return (roomId, 0, r.status, r.playerCount, 0, 0, true, true, address(0));
    }

    function getPlayerInfo(uint256 roomId, uint256 idx) external view returns (
        address, uint8, uint8, uint256, uint256, uint256, uint256, uint256
    ) {
        MockPlayer storage p = players[roomId][idx];
        return (p.addr, 0, 0, 0, 0, p.score, 0, 0);
    }
}

// ─── Test Suite ──────────────────────────────────────────────────────────────
contract PredictionMarketTest is Test {
    PredictionMarket public pm;
    MockFishingGame  public mockGame;

    // Named addresses — easier to read in failure traces
    address public PLAYER_A = makeAddr("playerA");
    address public PLAYER_B = makeAddr("playerB");
    address public PLAYER_C = makeAddr("playerC");
    address public PLAYER_D = makeAddr("playerD");

    address public BETTOR_1 = makeAddr("bettor1");
    address public BETTOR_2 = makeAddr("bettor2");
    address public BETTOR_3 = makeAddr("bettor3");

    uint256 constant ROOM_ID = 0;

    // Allow the test contract to receive ETH (platform fee forwarded to owner)
    receive() external payable {}

    // ─── setUp ───────────────────────────────────────────────────────────────
    function setUp() public {
        mockGame = new MockFishingGame();
        pm       = new PredictionMarket(address(mockGame));

        // Fund bettors
        vm.deal(BETTOR_1, 10 ether);
        vm.deal(BETTOR_2, 10 ether);
        vm.deal(BETTOR_3, 10 ether);

        // Default: 4-player room in Active state
        _setActiveRoom();
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function _setActiveRoom() internal {
        mockGame.setRoom(ROOM_ID, 1, 4);  // Active
        mockGame.setPlayer(ROOM_ID, 0, PLAYER_A, 0);
        mockGame.setPlayer(ROOM_ID, 1, PLAYER_B, 0);
        mockGame.setPlayer(ROOM_ID, 2, PLAYER_C, 0);
        mockGame.setPlayer(ROOM_ID, 3, PLAYER_D, 0);
    }

    function _setFinishedRoom(address winner, uint256 winnerScore) internal {
        mockGame.setRoom(ROOM_ID, 2, 4);  // Finished
        mockGame.setPlayer(ROOM_ID, 0, PLAYER_A, PLAYER_A == winner ? winnerScore : 100);
        mockGame.setPlayer(ROOM_ID, 1, PLAYER_B, PLAYER_B == winner ? winnerScore : 200);
        mockGame.setPlayer(ROOM_ID, 2, PLAYER_C, PLAYER_C == winner ? winnerScore : 150);
        mockGame.setPlayer(ROOM_ID, 3, PLAYER_D, PLAYER_D == winner ? winnerScore : 50);
    }

    function _openAndBet(address bettor, address player, uint256 amount) internal {
        pm.openBetting(ROOM_ID);
        vm.prank(bettor);
        pm.placeBet{value: amount}(ROOM_ID, player);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  openBetting
    // ─────────────────────────────────────────────────────────────────────────

    function test_openBetting_success() public {
        pm.openBetting(ROOM_ID);

        PredictionMarket.MarketInfo memory info = pm.getMarketInfo(ROOM_ID);
        assertTrue(info.bettingOpen);
        assertEq(info.playerCount, 4);
        assertEq(info.openedAt, block.timestamp);
        assertEq(info.totalPool, 0);
    }

    function test_openBetting_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.BettingOpened(ROOM_ID, block.timestamp, 4);
        pm.openBetting(ROOM_ID);
    }

    function test_openBetting_reverts_if_game_not_active() public {
        mockGame.setRoom(ROOM_ID, 0, 4);  // Waiting
        vm.expectRevert(PredictionMarket.GameNotActive.selector);
        pm.openBetting(ROOM_ID);
    }

    function test_openBetting_reverts_if_already_open() public {
        pm.openBetting(ROOM_ID);
        vm.expectRevert(PredictionMarket.BettingAlreadyOpen.selector);
        pm.openBetting(ROOM_ID);
    }

    function test_openBetting_reverts_if_already_settled() public {
        _openAndBet(BETTOR_1, PLAYER_A, 0.1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        vm.expectRevert(PredictionMarket.AlreadySettled.selector);
        pm.openBetting(ROOM_ID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  placeBet
    // ─────────────────────────────────────────────────────────────────────────

    function test_placeBet_success() public {
        pm.openBetting(ROOM_ID);
        vm.prank(BETTOR_1);
        pm.placeBet{value: 0.1 ether}(ROOM_ID, PLAYER_A);

        PredictionMarket.MarketInfo memory info = pm.getMarketInfo(ROOM_ID);
        assertEq(info.totalPool, 0.1 ether);
    }

    function test_placeBet_weighted_amount_stored() public {
        pm.openBetting(ROOM_ID);

        // Bet at t=0 → weight = 100 → weightedAmt = 0.1 ether * 100 / 100
        vm.prank(BETTOR_1);
        pm.placeBet{value: 0.1 ether}(ROOM_ID, PLAYER_A);

        uint256 w = pm.weightedBets(ROOM_ID, BETTOR_1, PLAYER_A);
        assertEq(w, 0.1 ether); // weight=100 at t=0
    }

    function test_placeBet_reverts_if_betting_not_open() public {
        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.BettingNotOpen.selector);
        pm.placeBet{value: 0.1 ether}(ROOM_ID, PLAYER_A);
    }

    function test_placeBet_reverts_if_bet_too_small() public {
        pm.openBetting(ROOM_ID);
        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.BetTooSmall.selector);
        pm.placeBet{value: 0.0001 ether}(ROOM_ID, PLAYER_A);
    }

    function test_placeBet_reverts_if_invalid_player() public {
        pm.openBetting(ROOM_ID);
        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.InvalidPlayer.selector);
        pm.placeBet{value: 0.1 ether}(ROOM_ID, address(0xDEAD));
    }

    function test_placeBet_reverts_if_already_settled() public {
        _openAndBet(BETTOR_1, PLAYER_A, 0.1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        vm.prank(BETTOR_2);
        vm.expectRevert(PredictionMarket.AlreadySettled.selector);
        pm.placeBet{value: 0.1 ether}(ROOM_ID, PLAYER_B);
    }

    function test_placeBet_multiple_bettors_accumulates_pool() public {
        pm.openBetting(ROOM_ID);

        vm.prank(BETTOR_1);
        pm.placeBet{value: 0.1 ether}(ROOM_ID, PLAYER_A);
        vm.prank(BETTOR_2);
        pm.placeBet{value: 0.2 ether}(ROOM_ID, PLAYER_B);
        vm.prank(BETTOR_3);
        pm.placeBet{value: 0.3 ether}(ROOM_ID, PLAYER_A);

        PredictionMarket.MarketInfo memory info = pm.getMarketInfo(ROOM_ID);
        assertEq(info.totalPool, 0.6 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Time-weight
    // ─────────────────────────────────────────────────────────────────────────

    function test_timeWeight_early_bet_higher_than_late() public {
        pm.openBetting(ROOM_ID);

        // BETTOR_1 bets at t=0 (weight = 100)
        vm.prank(BETTOR_1);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);
        uint256 earlyWeighted = pm.weightedBets(ROOM_ID, BETTOR_1, PLAYER_A);

        // BETTOR_2 bets at t=90s (weight = 55)
        vm.warp(block.timestamp + 90);
        vm.prank(BETTOR_2);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);
        uint256 lateWeighted = pm.weightedBets(ROOM_ID, BETTOR_2, PLAYER_A);

        assertGt(earlyWeighted, lateWeighted, "Early bet must have higher weight");
    }

    function test_timeWeight_at_max_duration_uses_min_weight() public {
        pm.openBetting(ROOM_ID);
        vm.warp(block.timestamp + 180); // MAX_GAME_DURATION

        uint256 w = pm.calcTimeWeight(180);
        assertEq(w, pm.MIN_TIME_WEIGHT());
    }

    function test_timeWeight_at_zero_uses_max_weight() public view {
        uint256 w = pm.calcTimeWeight(0);
        assertEq(w, pm.MAX_TIME_WEIGHT());
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  settleBets
    // ─────────────────────────────────────────────────────────────────────────

    function test_settleBets_success_finds_winner() public {
        _openAndBet(BETTOR_1, PLAYER_B, 0.1 ether);
        _setFinishedRoom(PLAYER_B, 9999); // PLAYER_B wins

        pm.settleBets(ROOM_ID);

        PredictionMarket.MarketInfo memory info = pm.getMarketInfo(ROOM_ID);
        assertEq(info.winner, PLAYER_B);
        assertFalse(info.bettingOpen);
        assertGt(info.settledAt, 0);
    }

    function test_settleBets_sends_platform_fee_to_owner() public {
        _openAndBet(BETTOR_1, PLAYER_A, 1 ether);
        _setFinishedRoom(PLAYER_A, 9999);

        address ownerAddr   = pm.owner();
        uint256 balBefore   = ownerAddr.balance;
        pm.settleBets(ROOM_ID);
        uint256 balAfter    = ownerAddr.balance;

        // 5 % of 1 ETH = 0.05 ETH
        assertEq(balAfter - balBefore, 0.05 ether);
    }

    function test_settleBets_emits_event() public {
        _openAndBet(BETTOR_1, PLAYER_A, 1 ether);
        _setFinishedRoom(PLAYER_A, 9999);

        vm.expectEmit(true, false, false, true);
        emit PredictionMarket.MarketSettled(ROOM_ID, PLAYER_A, 1 ether, 0.05 ether);
        pm.settleBets(ROOM_ID);
    }

    function test_settleBets_reverts_if_game_not_finished() public {
        pm.openBetting(ROOM_ID);
        // Room is still Active
        vm.expectRevert(PredictionMarket.GameNotFinished.selector);
        pm.settleBets(ROOM_ID);
    }

    function test_settleBets_reverts_if_betting_not_open() public {
        vm.expectRevert(PredictionMarket.BettingNotOpen.selector);
        pm.settleBets(ROOM_ID);
    }

    function test_settleBets_reverts_if_already_settled() public {
        _openAndBet(BETTOR_1, PLAYER_A, 0.1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        vm.expectRevert(PredictionMarket.AlreadySettled.selector);
        pm.settleBets(ROOM_ID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  claimPrize
    // ─────────────────────────────────────────────────────────────────────────

    function test_claimPrize_sole_winner_bettor_gets_95_percent() public {
        _openAndBet(BETTOR_1, PLAYER_A, 1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        uint256 before = BETTOR_1.balance;
        vm.prank(BETTOR_1);
        pm.claimPrize(ROOM_ID);
        uint256 prize = BETTOR_1.balance - before;

        // prizePool = 1 ETH * 95% = 0.95 ETH
        assertApproxEqAbs(prize, 0.95 ether, 0.001 ether);
    }

    function test_claimPrize_proportional_split_between_two_winner_bettors() public {
        pm.openBetting(ROOM_ID);

        // Both bet on PLAYER_A (same time → same weight → equal share)
        vm.prank(BETTOR_1);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);
        vm.prank(BETTOR_2);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);
        // BETTOR_3 bets on wrong player
        vm.prank(BETTOR_3);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_B);

        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        // Total pool = 3 ETH, prizePool = 2.85 ETH
        // BETTOR_1 and BETTOR_2 each have equal weighted bets → each gets 1.425 ETH

        uint256 b1Before = BETTOR_1.balance;
        vm.prank(BETTOR_1);
        pm.claimPrize(ROOM_ID);
        uint256 prize1 = BETTOR_1.balance - b1Before;

        uint256 b2Before = BETTOR_2.balance;
        vm.prank(BETTOR_2);
        pm.claimPrize(ROOM_ID);
        uint256 prize2 = BETTOR_2.balance - b2Before;

        assertApproxEqAbs(prize1, 1.425 ether, 0.001 ether);
        assertApproxEqAbs(prize2, 1.425 ether, 0.001 ether);
        assertApproxEqAbs(prize1, prize2,       0.001 ether);
    }

    function test_claimPrize_early_bettor_gets_larger_share() public {
        pm.openBetting(ROOM_ID);

        // BETTOR_1 bets at t=0 → weight=100
        vm.prank(BETTOR_1);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);

        // BETTOR_2 bets at t=90 → weight=55
        vm.warp(block.timestamp + 90);
        vm.prank(BETTOR_2);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);

        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        uint256 b1Before = BETTOR_1.balance;
        vm.prank(BETTOR_1);
        pm.claimPrize(ROOM_ID);
        uint256 prize1 = BETTOR_1.balance - b1Before;

        uint256 b2Before = BETTOR_2.balance;
        vm.prank(BETTOR_2);
        pm.claimPrize(ROOM_ID);
        uint256 prize2 = BETTOR_2.balance - b2Before;

        assertGt(prize1, prize2, "Earlier bettor should receive a larger prize share");
    }

    function test_claimPrize_reverts_if_not_winner() public {
        _openAndBet(BETTOR_1, PLAYER_B, 1 ether); // PLAYER_B loses
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.NothingToClaim.selector);
        pm.claimPrize(ROOM_ID);
    }

    function test_claimPrize_reverts_double_claim() public {
        _openAndBet(BETTOR_1, PLAYER_A, 1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        vm.prank(BETTOR_1);
        pm.claimPrize(ROOM_ID);

        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        pm.claimPrize(ROOM_ID);
    }

    function test_claimPrize_reverts_if_not_settled() public {
        pm.openBetting(ROOM_ID);
        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.NotSettled.selector);
        pm.claimPrize(ROOM_ID);
    }

    function test_claimPrize_reverts_after_claim_window() public {
        _openAndBet(BETTOR_1, PLAYER_A, 1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.settleBets(ROOM_ID);

        vm.warp(block.timestamp + 31 days); // past CLAIM_WINDOW

        vm.prank(BETTOR_1);
        vm.expectRevert(PredictionMarket.ClaimWindowExpired.selector);
        pm.claimPrize(ROOM_ID);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  getOdds
    // ─────────────────────────────────────────────────────────────────────────

    function test_getOdds_50_50_split() public {
        pm.openBetting(ROOM_ID);
        vm.prank(BETTOR_1);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_A);
        vm.prank(BETTOR_2);
        pm.placeBet{value: 1 ether}(ROOM_ID, PLAYER_B);

        (, , uint256 oddsA) = pm.getOdds(ROOM_ID, PLAYER_A);
        (, , uint256 oddsB) = pm.getOdds(ROOM_ID, PLAYER_B);

        assertApproxEqAbs(oddsA, 5000, 10); // ~50 %
        assertApproxEqAbs(oddsB, 5000, 10); // ~50 %
    }

    function test_getOdds_zero_bets_returns_zero() public {
        pm.openBetting(ROOM_ID);
        (, , uint256 odds) = pm.getOdds(ROOM_ID, PLAYER_A);
        assertEq(odds, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Emergency pause
    // ─────────────────────────────────────────────────────────────────────────

    function test_pause_blocks_openBetting() public {
        pm.pause();
        vm.expectRevert();
        pm.openBetting(ROOM_ID);
    }

    function test_pause_blocks_placeBet() public {
        pm.openBetting(ROOM_ID);
        pm.pause();
        vm.prank(BETTOR_1);
        vm.expectRevert();
        pm.placeBet{value: 0.1 ether}(ROOM_ID, PLAYER_A);
    }

    function test_pause_blocks_settleBets() public {
        _openAndBet(BETTOR_1, PLAYER_A, 0.1 ether);
        _setFinishedRoom(PLAYER_A, 9999);
        pm.pause();
        vm.expectRevert();
        pm.settleBets(ROOM_ID);
    }

    function test_unpause_restores_functionality() public {
        pm.pause();
        pm.unpause();
        pm.openBetting(ROOM_ID); // should not revert
    }

    function test_only_owner_can_pause() public {
        vm.prank(BETTOR_1);
        vm.expectRevert();
        pm.pause();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Time weight must always stay within [MIN_TIME_WEIGHT, MAX_TIME_WEIGHT]
    function testFuzz_calcTimeWeight_always_in_range(uint256 elapsed) public view {
        elapsed = bound(elapsed, 0, 500);
        uint256 w = pm.calcTimeWeight(elapsed);
        assertGe(w, pm.MIN_TIME_WEIGHT());
        assertLe(w, pm.MAX_TIME_WEIGHT());
    }

    /// @dev Any valid bet amount should be accepted and stored correctly
    function testFuzz_placeBet_valid_amount(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount);
        vm.assume(amount >= 0.001 ether && amount <= 5 ether);

        pm.openBetting(ROOM_ID);
        vm.deal(BETTOR_1, amount);
        vm.prank(BETTOR_1);
        pm.placeBet{value: amount}(ROOM_ID, PLAYER_A);

        PredictionMarket.MarketInfo memory info = pm.getMarketInfo(ROOM_ID);
        assertEq(info.totalPool, amount);
    }

    /// @dev Platform fee must always equal exactly 5 % of the total pool
    function testFuzz_platform_fee_exactly_5_percent(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount);
        vm.assume(amount >= 0.001 ether && amount <= 5 ether);

        pm.openBetting(ROOM_ID);
        vm.deal(BETTOR_1, amount);
        vm.prank(BETTOR_1);
        pm.placeBet{value: amount}(ROOM_ID, PLAYER_A);

        _setFinishedRoom(PLAYER_A, 9999);

        address ownerAddr  = pm.owner();
        uint256 balBefore  = ownerAddr.balance;
        pm.settleBets(ROOM_ID);
        uint256 fee = ownerAddr.balance - balBefore;

        assertEq(fee, amount * 500 / 10000);
    }
}
