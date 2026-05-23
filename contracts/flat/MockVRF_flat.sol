// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20 ^0.8.4;

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol

// End consumer library.
library VRFV2PlusClient {
  // extraArgs will evolve to support new features
  bytes4 public constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));
  struct ExtraArgsV1 {
    bool nativePayment;
  }

  struct RandomWordsRequest {
    bytes32 keyHash;
    uint256 subId;
    uint16 requestConfirmations;
    uint32 callbackGasLimit;
    uint32 numWords;
    bytes extraArgs;
  }

  function _argsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
    return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, extraArgs);
  }
}

// script/MockVRFLocal.sol

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
