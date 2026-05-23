// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockVRFCoordinatorLocal {
    uint256 private _reqId;
    mapping(uint256 => address) public consumers;
    mapping(uint256 => uint32) public requestedNumWords;

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    function requestRandomWords(
        RandomWordsRequest calldata req
    ) external returns (uint256) {
        _reqId++;
        uint256 reqId = _reqId;
        address consumer = msg.sender;

        uint32 n = req.numWords;
        if (n == 0) n = 5;

        uint256[] memory words = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            words[i] = uint256(keccak256(abi.encode(reqId, block.timestamp, i, block.prevrandao)));
        }

        (bool ok, ) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", reqId, words)
        );
        require(ok, "fulfillment failed");

        return reqId;
    }
}
