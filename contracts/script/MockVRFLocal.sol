// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract MockVRFCoordinatorLocal {
    uint256 private _reqId;
    mapping(uint256 => address) public consumers;
    mapping(uint256 => uint32) public requestedNumWords;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256) {
        _reqId++;
        consumers[_reqId] = msg.sender;
        requestedNumWords[_reqId] = req.numWords;
        return _reqId;
    }

    function fulfill(uint256 reqId) external {
        address consumer = consumers[reqId];
        require(consumer != address(0), "request not found");

        uint32 n = requestedNumWords[reqId];
        if (n == 0) n = 5;

        uint256[] memory words = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            words[i] = uint256(keccak256(abi.encode(reqId, block.timestamp, i)));
        }

        (bool ok, ) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", reqId, words)
        );
        require(ok, "fulfillment failed");

        delete consumers[reqId];
        delete requestedNumWords[reqId];
    }
}
