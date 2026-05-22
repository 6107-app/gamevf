// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/FishingGame.sol";
import "../src/FishingRod.sol";
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

        FishingRod rod = new FishingRod(
            address(vrf),
            bytes32(uint256(1)),
            1
        );

        game.setRodContract(address(rod));

        // ===== 正确生成 JSON =====

        string memory root = vm.projectRoot();

        string memory path = string.concat(
            root,
            "/deployments/localhost.json"
        );

        string memory json;

        json = vm.serializeAddress(
            "deployment",
            "GAME_ADDRESS",
            address(game)
        );

        json = vm.serializeAddress(
            "deployment",
            "ROD_ADDRESS",
            address(rod)
        );

        json = vm.serializeAddress(
            "deployment",
            "VRF_ADDRESS",
            address(vrf)
        );

        vm.writeJson(json, path);

        console.log("Deployment saved:");
        console.log(path);

        vm.stopBroadcast();
    }
}