// 钓鱼游戏测试文档
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FishingGame.sol";

// ─── Mock VRF Coordinator ────────────────────────────
contract MockVRFCoordinator {
    uint256 private _reqId;
    
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
    ) external returns (uint256) {
        return ++_reqId;
    }

    // 模拟VRF回调：手动触发 fulfillRandomWords
    function fulfillRandomWords(
        address gameContract,
        uint256 requestId,
        uint256[] memory randomWords
    ) external {
        FishingGame(gameContract).rawFulfillRandomWords(requestId, randomWords);
    }
}

// ─── 测试合约 ────────────────────────────────────────────
contract FishingGameTest is Test {
    FishingGame public game;
    MockVRFCoordinator public mockVRF;

    address public host   = makeAddr("host");
    address public player2 = makeAddr("player2");

    function setUp() public {
        mockVRF = new MockVRFCoordinator();
        game = new FishingGame(
        address(mockVRF),
        bytes32(0), // keyHash（测试用假值）
        1           // subscriptionId（测试用假值）
        );

        // 给测试账户一些 ETH
        vm.deal(host, 10 ether);
        vm.deal(player2, 10 ether);
    }

    // ─── createRoom 测试 ─────────────────────────────────

    function test_createRoom_success() public {
        vm.prank(host);
        uint256 roomId = game.createRoom{value: 0.01 ether}(
            FishingGame.RoomTier.Bronze,
            true,
            false
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
        assertEq(entryFee, 0.01 ether);
        assertEq(totalPot, 0.01 ether);
        assertTrue(isPublic);
        assertEq(roomHost, host);
    }

    function test_createRoom_wrongFee_reverts() public {
        vm.prank(host);
        vm.expectRevert(FishingGame.IncorrectEntryFee.selector);
        game.createRoom{value: 0.005 ether}(
            FishingGame.RoomTier.Bronze,
            true,
            false
        );
    }

    function test_createRoom_incrementsRoomCount() public {
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        assertEq(game.roomCount(), 2);
    }

    // ─── joinRoom 测试 ───────────────────────────────────

    function test_joinRoom_success() public {
        // 房主创建房间
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        // player2 加入
        vm.prank(player2);
        game.joinRoom{value: 0.01 ether}(0);

        (, , , uint8 playerCount, , uint256 totalPot, , ,) = game.getRoomInfo(0);

        assertEq(playerCount, 2);
        assertEq(totalPot, 0.02 ether);
    }

    function test_joinRoom_wrongFee_reverts() public {
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        vm.expectRevert(FishingGame.IncorrectEntryFee.selector);
        game.joinRoom{value: 0.005 ether}(0);
    }

    function test_joinRoom_alreadyInRoom_reverts() public {
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        // host 再次尝试加入同一房间
        vm.prank(host);
        vm.expectRevert(FishingGame.AlreadyInRoom.selector);
        game.joinRoom{value: 0.01 ether}(0);
    }

    function test_joinRoom_roomFull_reverts() public {
        address p3 = makeAddr("player3");
        address p4 = makeAddr("player4");
        address p5 = makeAddr("player5");
        vm.deal(p3, 1 ether);
        vm.deal(p4, 1 ether);
        vm.deal(p5, 1 ether);

        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2); game.joinRoom{value: 0.01 ether}(0);
        vm.prank(p3);      game.joinRoom{value: 0.01 ether}(0);
        vm.prank(p4);      game.joinRoom{value: 0.01 ether}(0);

        // 第5个人加入应该失败
        vm.prank(p5);
        vm.expectRevert(FishingGame.RoomFull.selector);
        game.joinRoom{value: 0.01 ether}(0);
    }

    // ─── startGame 测试 ──────────────────────────────────

    function test_startGame_success() public {
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.joinRoom{value: 0.01 ether}(0);

        vm.prank(host);
        game.startGame(0);

        (, , FishingGame.RoomStatus status, , , , , ,) = game.getRoomInfo(0);
        assertEq(uint8(status), uint8(FishingGame.RoomStatus.Active));
    }

    function test_startGame_notHost_reverts() public {
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(player2);
        game.joinRoom{value: 0.01 ether}(0);

        // player2 不是房主，不能开始
        vm.prank(player2);
        vm.expectRevert(FishingGame.NotHost.selector);
        game.startGame(0);
    }

    function test_startGame_notEnoughPlayers_reverts() public {
        // 只有1人（房主），不能开始
        vm.prank(host);
        game.createRoom{value: 0.01 ether}(FishingGame.RoomTier.Bronze, true, false);

        vm.prank(host);
        vm.expectRevert(FishingGame.NotEnoughPlayers.selector);
        game.startGame(0);
    }

    // ─── 辅助函数：创建并开始游戏 ───────────────────────
    function _setupActiveRoom() internal returns (uint256 roomId) {
        vm.prank(host);
        roomId = game.createRoom{value: 0.01 ether}(
            FishingGame.RoomTier.Bronze, true, false
        );
        vm.prank(player2);
        game.joinRoom{value: 0.01 ether}(roomId);
        vm.prank(host);
        game.startGame(roomId);
    }

    // ─── castRod 测试 ────────────────────────────────────

    function test_castRod_firstCast_success() public {
        uint256 roomId = _setupActiveRoom();

        // 第一次抛竿不需要额外付费
        vm.prank(host);
        game.castRod{value: 0}(roomId);

        // 检查 playerState
        (uint8 castCount, bool lockedIn, uint256 pendingReqId) = 
            game.playerStates(roomId, host);

        assertEq(castCount, 1);
        assertFalse(lockedIn);
        assertEq(pendingReqId, 1); // 第一个requestId
    }

    function test_castRod_gameNotActive_reverts() public {
        // 房间还在Waiting状态
        vm.prank(host);
        uint256 roomId = game.createRoom{value: 0.01 ether}(
            FishingGame.RoomTier.Bronze, true, false
        );
        vm.prank(player2);
        game.joinRoom{value: 0.01 ether}(roomId);

        vm.prank(host);
        vm.expectRevert(FishingGame.GameNotActive.selector);
        game.castRod{value: 0}(roomId);
    }

    function test_castRod_notInRoom_reverts() public {
        uint256 roomId = _setupActiveRoom();

        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(FishingGame.NotInRoom.selector);
        game.castRod{value: 0}(roomId);
    }

    function test_castRod_recast_requiresFee() public {
        uint256 roomId = _setupActiveRoom();

        // 第一次抛竿
        vm.prank(host);
        game.castRod{value: 0}(roomId);

        // 模拟VRF回调
        uint256[] memory randomWords = new uint256[](3);
        randomWords[0] = 12345;
        randomWords[1] = 67890;
        randomWords[2] = 11111;
        mockVRF.fulfillRandomWords(address(game), 1, randomWords);

        // 第二次抛竿（re-cast）需要付费
        vm.prank(host);
        vm.expectRevert(FishingGame.IncorrectEntryFee.selector);
        game.castRod{value: 0}(roomId); // 没付钱，应该revert
    }


}