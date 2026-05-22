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

        // 让 FishingGame 知道 FishingRod 的地址
        game.setRodContract(address(rod));

        console.log("VRF:", address(vrf));
        console.log("FishingGame:", address(game));
        console.log("FishingRod:", address(rod));

        vm.stopBroadcast();
    }
}
