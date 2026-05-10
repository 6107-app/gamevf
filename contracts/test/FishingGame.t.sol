// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FishingGame.sol";

// ─── Mock VRF Coordinator（测试用假合约）────────────────
contract MockVRFCoordinator {
    uint256 private _reqId;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
    ) external returns (uint256) {
        return ++_reqId;
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
        game = new FishingGame(address(mockVRF));

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
}