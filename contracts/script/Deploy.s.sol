// 部署脚本
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FishingGame.sol";
import "./MockVRFLocal.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        MockVRFCoordinatorLocal vrf = new MockVRFCoordinatorLocal();
        FishingGame game = new FishingGame(
            address(vrf),
            bytes32(uint256(1)),
            1
        );

        console.log("VRF:", address(vrf));
        console.log("FishingGame:", address(game));

        vm.stopBroadcast();
    }
}