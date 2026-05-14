// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "../src/FishingGame.sol";

contract MockVRFCoordinatorLocal {
    uint256 private _reqId;
    mapping(uint256 => address) public consumers;

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
    ) external returns (uint256) {
        _reqId++;
        consumers[_reqId] = msg.sender;
        return _reqId;
    }

    function fulfill(address game, uint256 reqId) external {
        uint256[] memory words = new uint256[](5);
        words[0] = uint256(keccak256(abi.encode(reqId, block.timestamp, 0)));
        words[1] = uint256(keccak256(abi.encode(reqId, block.timestamp, 1)));
        words[2] = uint256(keccak256(abi.encode(reqId, block.timestamp, 2)));
        words[3] = uint256(keccak256(abi.encode(reqId, block.timestamp, 3)));
        words[4] = uint256(keccak256(abi.encode(reqId, block.timestamp, 4)));
        FishingGame(game).rawFulfillRandomWords(reqId, words);
    }
}