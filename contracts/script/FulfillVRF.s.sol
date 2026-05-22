// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "./MockVRFLocal.sol";

contract FulfillVRF is Script {
    function run() external {
        address vrfAddress = vm.envAddress("VRF_ADDRESS");
        uint256 reqId = vm.envUint("REQ_ID");

        vm.startBroadcast();
        MockVRFCoordinatorLocal(vrfAddress).fulfill(reqId);
        vm.stopBroadcast();
    }
}
