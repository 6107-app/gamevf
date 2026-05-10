// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FishingGame.sol";

// ─── Mock VRF Coordinator ───────────────────────────────
contract MockVRFCoordinator {
    uint256 private _reqId;
    mapping(uint256 => address) private _consumers;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
    ) external returns (uint256) {
        _reqId++;
        _consumers[_reqId] = msg.sender;
        return _reqId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        address consumer = _consumers[requestId];
        require(consumer != address(0), "request not found");
        (bool success,) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, "fulfillment failed");
    }
}

// ─── Tests ──────────────────────────────────────────────
contract FishingGameTest is Test {
    FishingGame public game;
    MockVRFCoordinator public mockVRF;

    address public host    = makeAddr("host");
    address public player2 = makeAddr("player2");
    address public player3 = makeAddr("player3");
    address public player4 = makeAddr("player4");

    uint256 constant BRONZE_FEE = 0.01 ether;

    function setUp() public {
        mockVRF = new MockVRFCoordinator();
        game = new FishingGame(
            address(mockVRF),
            bytes32(uint256(1)),
            1
        );

        vm.deal(host, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(player3, 10 ether);
        vm.deal(player4, 10 ether);
    }

    // ─── createRoom ─────────────────────────────────────

    function test_createRoom_success() public {
        vm.prank(host);
        uint256 roomId = game.createRoom{value: BRONZE_FEE}(
            FishingGame.RoomTier.Bronze, true, false
        );

        assertEq(roomId, 0);

        (
            uint256 id,
            FishingGame.RoomTier tier,
            FishingGame.RoomStatus status,
            uint8 playerCount,
            uint256 entryFee,
            uint256 totalPot,
            bool isPublic,
            ,
            address roomHost
        ) = game.getRoomInfo(0);

        assertEq(id, 0);
        assertEq(uint8(tier), uint8(FishingGame.RoomTier.Bronze));
        assertEq(uint8(status), uint8(FishingGame.RoomStatus.Waiting));
        assertEq(playerCount, 1);
        assertEq(entryFee, BRONZE_FEE);
        assertEq(totalPot, BRONZE_FEE);
        assertTrue(isPublic);
        assertEq(roomHost, host);
    }

    function test_createRoom_wrongFee_reverts() public {
        vm.prank(host);
        vm.expectRevert(FishingGame.IncorrectFee.selector);
        game.createRoom{value: 0.005 ether}(FishingGame.RoomTier.Bronze, true, false);
    }

    function test_createRoom_incrementsRoomCount() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        assertEq(game.roomCount(), 2);
    }

    // ─── joinRoom ───────────────────────────────────────

    function test_joinRoom_success() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.joinRoom{value: BRONZE_FEE}(0);

        (,,, uint8 playerCount,, uint256 totalPot,,,) = game.getRoomInfo(0);
        assertEq(playerCount, 2);
        assertEq(totalPot, BRONZE_FEE * 2);
    }

    function test_joinRoom_wrongFee_reverts() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        vm.expectRevert(FishingGame.IncorrectFee.selector);
        game.joinRoom{value: 0.005 ether}(0);
    }

    function test_joinRoom_alreadyInRoom_reverts() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(host);
        vm.expectRevert(FishingGame.AlreadyInRoom.selector);
        game.joinRoom{value: BRONZE_FEE}(0);
    }

    function test_joinRoom_roomFull_reverts() public {
        address p5 = makeAddr("player5");
        vm.deal(p5, 1 ether);

        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2); game.joinRoom{value: BRONZE_FEE}(0);
        vm.prank(player3); game.joinRoom{value: BRONZE_FEE}(0);
        vm.prank(player4); game.joinRoom{value: BRONZE_FEE}(0);

        vm.prank(p5);
        vm.expectRevert(FishingGame.RoomFull.selector);
        game.joinRoom{value: BRONZE_FEE}(0);
    }

    // ─── startGame ──────────────────────────────────────

    function test_startGame_success() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.joinRoom{value: BRONZE_FEE}(0);

        vm.prank(host);
        game.startGame(0);

        (,, FishingGame.RoomStatus status,,,,,,) = game.getRoomInfo(0);
        assertEq(uint8(status), uint8(FishingGame.RoomStatus.Active));
    }

    function test_startGame_notHost_reverts() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.joinRoom{value: BRONZE_FEE}(0);

        vm.prank(player2);
        vm.expectRevert(FishingGame.NotHost.selector);
        game.startGame(0);
    }

    function test_startGame_notEnoughPlayers_reverts() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(host);
        vm.expectRevert(FishingGame.NotEnoughPlayers.selector);
        game.startGame(0);
    }

    // ─── Fishing: cast + VRF ────────────────────────────

    function _setupActiveRoom() internal returns (uint256) {
        vm.prank(host);
        uint256 roomId = game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2); game.joinRoom{value: BRONZE_FEE}(roomId);
        vm.prank(player3); game.joinRoom{value: BRONZE_FEE}(roomId);
        vm.prank(player4); game.joinRoom{value: BRONZE_FEE}(roomId);

        vm.prank(host);
        game.startGame(roomId);

        return roomId;
    }

    function _makeRandomWords3() internal pure returns (uint256[] memory) {
        uint256[] memory rw = new uint256[](3);
        rw[0] = 42;
        rw[1] = 99999;
        rw[2] = 75;
        return rw;
    }

    function _makeRandomWords5() internal pure returns (uint256[] memory) {
        uint256[] memory rw = new uint256[](5);
        rw[0] = 50; rw[1] = 88888; rw[2] = 80; rw[3] = 12345; rw[4] = 67890;
        return rw;
    }

    function test_cast_success() public {
        uint256 roomId = _setupActiveRoom();
        vm.prank(host);
        game.cast(roomId);
    }

    function test_cast_notActive_reverts() public {
        vm.prank(host);
        game.createRoom{value: BRONZE_FEE}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(host);
        vm.expectRevert(FishingGame.RoomNotActive.selector);
        game.cast(0);
    }

    function test_castAndFulfill() public {
        uint256 roomId = _setupActiveRoom();

        vm.prank(host);
        game.cast(roomId);

        mockVRF.fulfillRandomWords(1, _makeRandomWords3());

        (,, uint8 rarity, uint256 weight,, uint256 score,,) = game.getPlayerInfo(roomId, 0);
        assertGt(weight, 0);
        assertGt(score, 0);
    }

    // ─── lockIn ─────────────────────────────────────────

    function test_lockIn() public {
        uint256 roomId = _setupActiveRoom();

        vm.prank(host);
        game.cast(roomId);
        mockVRF.fulfillRandomWords(1, _makeRandomWords3());

        vm.prank(host);
        game.lockIn(roomId);

        (,FishingGame.PlayerStatus status,,,,,,) = game.getPlayerInfo(roomId, 0);
        assertEq(uint8(status), 1); // LockedIn
    }

    function test_lockIn_noFish_reverts() public {
        uint256 roomId = _setupActiveRoom();

        vm.prank(host);
        vm.expectRevert(FishingGame.NoFishCaught.selector);
        game.lockIn(roomId);
    }

    // ─── recast ─────────────────────────────────────────

    function test_recast() public {
        uint256 roomId = _setupActiveRoom();

        vm.prank(host);
        game.cast(roomId);
        mockVRF.fulfillRandomWords(1, _makeRandomWords3());

        vm.prank(host);
        game.recast{value: BRONZE_FEE}(roomId);
        mockVRF.fulfillRandomWords(2, _makeRandomWords5());

        (,,,,, uint256 score, uint256 recastCount,) = game.getPlayerInfo(roomId, 0);
        assertEq(recastCount, 1);
        assertGt(score, 0);
    }

    function test_recast_maxReached_reverts() public {
        uint256 roomId = _setupActiveRoom();

        vm.prank(host);
        game.cast(roomId);
        mockVRF.fulfillRandomWords(1, _makeRandomWords3());

        for (uint256 i = 0; i < 3; i++) {
            vm.prank(host);
            game.recast{value: BRONZE_FEE}(roomId);
            mockVRF.fulfillRandomWords(i + 2, _makeRandomWords5());
        }

        vm.prank(host);
        vm.expectRevert(FishingGame.MaxRecastReached.selector);
        game.recast{value: BRONZE_FEE}(roomId);
    }

    // ─── Full game settlement ───────────────────────────

    function test_fullGameSettlement() public {
        uint256 roomId = _setupActiveRoom();
        uint256 reqId = 1;

        address[4] memory players = [host, player2, player3, player4];
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(players[i]);
            game.cast(roomId);

            uint256[] memory rw = new uint256[](3);
            rw[0] = 10 + i * 20;
            rw[1] = 50000 + i * 10000;
            rw[2] = 70 + i * 5;
            mockVRF.fulfillRandomWords(reqId++, rw);
        }

        for (uint256 i = 0; i < 4; i++) {
            vm.prank(players[i]);
            game.lockIn(roomId);
        }

        (,, FishingGame.RoomStatus status,,,,,,) = game.getRoomInfo(roomId);
        assertEq(uint8(status), uint8(FishingGame.RoomStatus.Finished));
    }
}
