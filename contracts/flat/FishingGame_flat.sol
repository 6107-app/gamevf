// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/IOwnable.sol

interface IOwnable {
  function owner() external returns (address);

  function transferOwnership(address recipient) external;

  function acceptOwnership() external;
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vrf/dev/interfaces/IVRFMigratableConsumerV2Plus.sol

/// @notice The IVRFMigratableConsumerV2Plus interface defines the
/// @notice method required to be implemented by all V2Plus consumers.
/// @dev This interface is designed to be used in VRFConsumerBaseV2Plus.
interface IVRFMigratableConsumerV2Plus {
  event CoordinatorSet(address vrfCoordinator);

  /// @notice Sets the VRF Coordinator address
  /// @notice This method should only be callable by the coordinator or contract owner
  function setCoordinator(address vrfCoordinator) external;
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vrf/dev/interfaces/IVRFSubscriptionV2Plus.sol

/// @notice The IVRFSubscriptionV2Plus interface defines the subscription
/// @notice related methods implemented by the V2Plus coordinator.
interface IVRFSubscriptionV2Plus {
  /**
   * @notice Add a consumer to a VRF subscription.
   * @param subId - ID of the subscription
   * @param consumer - New consumer which can use the subscription
   */
  function addConsumer(uint256 subId, address consumer) external;

  /**
   * @notice Remove a consumer from a VRF subscription.
   * @param subId - ID of the subscription
   * @param consumer - Consumer to remove from the subscription
   */
  function removeConsumer(uint256 subId, address consumer) external;

  /**
   * @notice Cancel a subscription
   * @param subId - ID of the subscription
   * @param to - Where to send the remaining LINK to
   */
  function cancelSubscription(uint256 subId, address to) external;

  /**
   * @notice Accept subscription owner transfer.
   * @param subId - ID of the subscription
   * @dev will revert if original owner of subId has
   * not requested that msg.sender become the new owner.
   */
  function acceptSubscriptionOwnerTransfer(uint256 subId) external;

  /**
   * @notice Request subscription owner transfer.
   * @param subId - ID of the subscription
   * @param newOwner - proposed new owner of the subscription
   */
  function requestSubscriptionOwnerTransfer(uint256 subId, address newOwner) external;

  /**
   * @notice Create a VRF subscription.
   * @return subId - A unique subscription id.
   * @dev You can manage the consumer set dynamically with addConsumer/removeConsumer.
   * @dev Note to fund the subscription with LINK, use transferAndCall. For example
   * @dev  LINKTOKEN.transferAndCall(
   * @dev    address(COORDINATOR),
   * @dev    amount,
   * @dev    abi.encode(subId));
   * @dev Note to fund the subscription with Native, use fundSubscriptionWithNative. Be sure
   * @dev  to send Native with the call, for example:
   * @dev COORDINATOR.fundSubscriptionWithNative{value: amount}(subId);
   */
  function createSubscription() external returns (uint256 subId);

  /**
   * @notice Get a VRF subscription.
   * @param subId - ID of the subscription
   * @return balance - LINK balance of the subscription in juels.
   * @return nativeBalance - native balance of the subscription in wei.
   * @return reqCount - Requests count of subscription.
   * @return owner - owner of the subscription.
   * @return consumers - list of consumer address which are able to use this subscription.
   */
  function getSubscription(
    uint256 subId
  )
    external
    view
    returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] memory consumers);

  /*
   * @notice Check to see if there exists a request commitment consumers
   * for all consumers and keyhashes for a given sub.
   * @param subId - ID of the subscription
   * @return true if there exists at least one unfulfilled request for the subscription, false
   * otherwise.
   */
  function pendingRequestExists(uint256 subId) external view returns (bool);

  /**
   * @notice Paginate through all active VRF subscriptions.
   * @param startIndex index of the subscription to start from
   * @param maxCount maximum number of subscriptions to return, 0 to return all
   * @dev the order of IDs in the list is **not guaranteed**, therefore, if making successive calls, one
   * @dev should consider keeping the blockheight constant to ensure a holistic picture of the contract state
   */
  function getActiveSubscriptionIds(uint256 startIndex, uint256 maxCount) external view returns (uint256[] memory);

  /**
   * @notice Fund a subscription with native.
   * @param subId - ID of the subscription
   * @notice This method expects msg.value to be greater than or equal to 0.
   */
  function fundSubscriptionWithNative(uint256 subId) external payable;
}

// lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol

// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}

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

// lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/access/ConfirmedOwnerWithProposal.sol

/// @title The ConfirmedOwner contract
/// @notice A contract with helpers for basic contract ownership.
contract ConfirmedOwnerWithProposal is IOwnable {
  address private s_owner;
  address private s_pendingOwner;

  event OwnershipTransferRequested(address indexed from, address indexed to);
  event OwnershipTransferred(address indexed from, address indexed to);

  constructor(address newOwner, address pendingOwner) {
    // solhint-disable-next-line gas-custom-errors
    require(newOwner != address(0), "Cannot set owner to zero");

    s_owner = newOwner;
    if (pendingOwner != address(0)) {
      _transferOwnership(pendingOwner);
    }
  }

  /// @notice Allows an owner to begin transferring ownership to a new address.
  function transferOwnership(address to) public override onlyOwner {
    _transferOwnership(to);
  }

  /// @notice Allows an ownership transfer to be completed by the recipient.
  function acceptOwnership() external override {
    // solhint-disable-next-line gas-custom-errors
    require(msg.sender == s_pendingOwner, "Must be proposed owner");

    address oldOwner = s_owner;
    s_owner = msg.sender;
    s_pendingOwner = address(0);

    emit OwnershipTransferred(oldOwner, msg.sender);
  }

  /// @notice Get the current owner
  function owner() public view override returns (address) {
    return s_owner;
  }

  /// @notice validate, transfer ownership, and emit relevant events
  function _transferOwnership(address to) private {
    // solhint-disable-next-line gas-custom-errors
    require(to != msg.sender, "Cannot transfer to self");

    s_pendingOwner = to;

    emit OwnershipTransferRequested(s_owner, to);
  }

  /// @notice validate access
  function _validateOwnership() internal view {
    // solhint-disable-next-line gas-custom-errors
    require(msg.sender == s_owner, "Only callable by owner");
  }

  /// @notice Reverts if called by anyone other than the contract owner.
  modifier onlyOwner() {
    _validateOwnership();
    _;
  }
}

// lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/access/ConfirmedOwner.sol

/// @title The ConfirmedOwner contract
/// @notice A contract with helpers for basic contract ownership.
contract ConfirmedOwner is ConfirmedOwnerWithProposal {
  constructor(address newOwner) ConfirmedOwnerWithProposal(newOwner, address(0)) {}
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol

// Interface that enables consumers of VRFCoordinatorV2Plus to be future-proof for upgrades
// This interface is supported by subsequent versions of VRFCoordinatorV2Plus
interface IVRFCoordinatorV2Plus is IVRFSubscriptionV2Plus {
  /**
   * @notice Request a set of random words.
   * @param req - a struct containing following fields for randomness request:
   * keyHash - Corresponds to a particular oracle job which uses
   * that key for generating the VRF proof. Different keyHash's have different gas price
   * ceilings, so you can select a specific one to bound your maximum per request cost.
   * subId  - The ID of the VRF subscription. Must be funded
   * with the minimum subscription balance required for the selected keyHash.
   * requestConfirmations - How many blocks you'd like the
   * oracle to wait before responding to the request. See SECURITY CONSIDERATIONS
   * for why you may want to request more. The acceptable range is
   * [minimumRequestBlockConfirmations, 200].
   * callbackGasLimit - How much gas you'd like to receive in your
   * fulfillRandomWords callback. Note that gasleft() inside fulfillRandomWords
   * may be slightly less than this amount because of gas used calling the function
   * (argument decoding etc.), so you may need to request slightly more than you expect
   * to have inside fulfillRandomWords. The acceptable range is
   * [0, maxGasLimit]
   * numWords - The number of uint256 random values you'd like to receive
   * in your fulfillRandomWords callback. Note these numbers are expanded in a
   * secure way by the VRFCoordinator from a single random value supplied by the oracle.
   * extraArgs - abi-encoded extra args
   * @return requestId - A unique identifier of the request. Can be used to match
   * a request to a response in fulfillRandomWords.
   */
  function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId);
}

// lib/chainlink-brownie-contracts/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol

/** ****************************************************************************
 * @notice Interface for contracts using VRF randomness
 * *****************************************************************************
 * @dev PURPOSE
 *
 * @dev Reggie the Random Oracle (not his real job) wants to provide randomness
 * @dev to Vera the verifier in such a way that Vera can be sure he's not
 * @dev making his output up to suit himself. Reggie provides Vera a public key
 * @dev to which he knows the secret key. Each time Vera provides a seed to
 * @dev Reggie, he gives back a value which is computed completely
 * @dev deterministically from the seed and the secret key.
 *
 * @dev Reggie provides a proof by which Vera can verify that the output was
 * @dev correctly computed once Reggie tells it to her, but without that proof,
 * @dev the output is indistinguishable to her from a uniform random sample
 * @dev from the output space.
 *
 * @dev The purpose of this contract is to make it easy for unrelated contracts
 * @dev to talk to Vera the verifier about the work Reggie is doing, to provide
 * @dev simple access to a verifiable source of randomness. It ensures 2 things:
 * @dev 1. The fulfillment came from the VRFCoordinatorV2Plus.
 * @dev 2. The consumer contract implements fulfillRandomWords.
 * *****************************************************************************
 * @dev USAGE
 *
 * @dev Calling contracts must inherit from VRFConsumerBaseV2Plus, and can
 * @dev initialize VRFConsumerBaseV2Plus's attributes in their constructor as
 * @dev shown:
 *
 * @dev   contract VRFConsumerV2Plus is VRFConsumerBaseV2Plus {
 * @dev     constructor(<other arguments>, address _vrfCoordinator, address _subOwner)
 * @dev       VRFConsumerBaseV2Plus(_vrfCoordinator, _subOwner) public {
 * @dev         <initialization with other arguments goes here>
 * @dev       }
 * @dev   }
 *
 * @dev The oracle will have given you an ID for the VRF keypair they have
 * @dev committed to (let's call it keyHash). Create a subscription, fund it
 * @dev and your consumer contract as a consumer of it (see VRFCoordinatorInterface
 * @dev subscription management functions).
 * @dev Call requestRandomWords(keyHash, subId, minimumRequestConfirmations,
 * @dev callbackGasLimit, numWords, extraArgs),
 * @dev see (IVRFCoordinatorV2Plus for a description of the arguments).
 *
 * @dev Once the VRFCoordinatorV2Plus has received and validated the oracle's response
 * @dev to your request, it will call your contract's fulfillRandomWords method.
 *
 * @dev The randomness argument to fulfillRandomWords is a set of random words
 * @dev generated from your requestId and the blockHash of the request.
 *
 * @dev If your contract could have concurrent requests open, you can use the
 * @dev requestId returned from requestRandomWords to track which response is associated
 * @dev with which randomness request.
 * @dev See "SECURITY CONSIDERATIONS" for principles to keep in mind,
 * @dev if your contract could have multiple requests in flight simultaneously.
 *
 * @dev Colliding `requestId`s are cryptographically impossible as long as seeds
 * @dev differ.
 *
 * *****************************************************************************
 * @dev SECURITY CONSIDERATIONS
 *
 * @dev A method with the ability to call your fulfillRandomness method directly
 * @dev could spoof a VRF response with any random value, so it's critical that
 * @dev it cannot be directly called by anything other than this base contract
 * @dev (specifically, by the VRFConsumerBaseV2Plus.rawFulfillRandomness method).
 *
 * @dev For your users to trust that your contract's random behavior is free
 * @dev from malicious interference, it's best if you can write it so that all
 * @dev behaviors implied by a VRF response are executed *during* your
 * @dev fulfillRandomness method. If your contract must store the response (or
 * @dev anything derived from it) and use it later, you must ensure that any
 * @dev user-significant behavior which depends on that stored value cannot be
 * @dev manipulated by a subsequent VRF request.
 *
 * @dev Similarly, both miners and the VRF oracle itself have some influence
 * @dev over the order in which VRF responses appear on the blockchain, so if
 * @dev your contract could have multiple VRF requests in flight simultaneously,
 * @dev you must ensure that the order in which the VRF responses arrive cannot
 * @dev be used to manipulate your contract's user-significant behavior.
 *
 * @dev Since the block hash of the block which contains the requestRandomness
 * @dev call is mixed into the input to the VRF *last*, a sufficiently powerful
 * @dev miner could, in principle, fork the blockchain to evict the block
 * @dev containing the request, forcing the request to be included in a
 * @dev different block with a different hash, and therefore a different input
 * @dev to the VRF. However, such an attack would incur a substantial economic
 * @dev cost. This cost scales with the number of blocks the VRF oracle waits
 * @dev until it calls responds to a request. It is for this reason that
 * @dev that you can signal to an oracle you'd like them to wait longer before
 * @dev responding to the request (however this is not enforced in the contract
 * @dev and so remains effective only in the case of unmodified oracle software).
 */
abstract contract VRFConsumerBaseV2Plus is IVRFMigratableConsumerV2Plus, ConfirmedOwner {
  error OnlyCoordinatorCanFulfill(address have, address want);
  error OnlyOwnerOrCoordinator(address have, address owner, address coordinator);
  error ZeroAddress();

  // s_vrfCoordinator should be used by consumers to make requests to vrfCoordinator
  // so that coordinator reference is updated after migration
  IVRFCoordinatorV2Plus public s_vrfCoordinator;

  /**
   * @param _vrfCoordinator address of VRFCoordinator contract
   */
  constructor(address _vrfCoordinator) ConfirmedOwner(msg.sender) {
    if (_vrfCoordinator == address(0)) {
      revert ZeroAddress();
    }
    s_vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
  }

  /**
   * @notice fulfillRandomness handles the VRF response. Your contract must
   * @notice implement it. See "SECURITY CONSIDERATIONS" above for important
   * @notice principles to keep in mind when implementing your fulfillRandomness
   * @notice method.
   *
   * @dev VRFConsumerBaseV2Plus expects its subcontracts to have a method with this
   * @dev signature, and will call it once it has verified the proof
   * @dev associated with the randomness. (It is triggered via a call to
   * @dev rawFulfillRandomness, below.)
   *
   * @param requestId The Id initially returned by requestRandomness
   * @param randomWords the VRF output expanded to the requested number of words
   */
  // solhint-disable-next-line chainlink-solidity/prefix-internal-functions-with-underscore
  function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal virtual;

  // rawFulfillRandomness is called by VRFCoordinator when it receives a valid VRF
  // proof. rawFulfillRandomness then calls fulfillRandomness, after validating
  // the origin of the call
  function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
    if (msg.sender != address(s_vrfCoordinator)) {
      revert OnlyCoordinatorCanFulfill(msg.sender, address(s_vrfCoordinator));
    }
    fulfillRandomWords(requestId, randomWords);
  }

  /**
   * @inheritdoc IVRFMigratableConsumerV2Plus
   */
  function setCoordinator(address _vrfCoordinator) external override onlyOwnerOrCoordinator {
    if (_vrfCoordinator == address(0)) {
      revert ZeroAddress();
    }
    s_vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);

    emit CoordinatorSet(_vrfCoordinator);
  }

  modifier onlyOwnerOrCoordinator() {
    if (msg.sender != owner() && msg.sender != address(s_vrfCoordinator)) {
      revert OnlyOwnerOrCoordinator(msg.sender, owner(), address(s_vrfCoordinator));
    }
    _;
  }
}

// src/FishingGame.sol

// ─── NFT Rod Interface ─────────────────────────────────
interface IFishingRod {
    function ownerOf(uint256 tokenId) external view returns (address);
    function getRod(uint256 tokenId) external view returns (
        uint8 rodType,
        uint8 rarity,
        uint8 level,
        uint16 durability,
        uint16 maxDurability,
        uint16 speedBps,
        uint16 weightBps,
        uint16 luckBps,
        uint16 stabilityBps
    );
    function consumeDurability(uint256 tokenId, uint16 amount) external;
    function getRodBonus(uint256 tokenId) external view returns (
        uint256 speedBonus,   // time reduction in bps (e.g. 1500 = -15%)
        uint256 weightBonus,  // weight increase in bps (e.g. 2000 = +20%)
        uint256 luckBonus     // rarity boost in bps (e.g. 1000 = +10%)
    );
}

contract FishingGame is VRFConsumerBaseV2Plus, ReentrancyGuard {

    // ─── Enums ──────────────────────────────────────────
    enum RoomStatus { Waiting, Active, Finished }
    enum RoomTier   { Bronze, Silver, Gold, Diamond }
    enum PlayerStatus { Fishing, LockedIn, Recast }
    enum Rarity { Common, Rare, SuperRare, Epic, Legendary }

    // ─── Structs ────────────────────────────────────────
    struct FishResult {
        Rarity rarity;
        uint256 weight;
        uint256 fishingTime;
        uint256 score;
    }

    struct Player {
        address addr;
        PlayerStatus status;
        FishResult currentFish;
        uint256 recastCount;
        uint256 totalBet;
        uint256 skillModifier;
        uint256 rodTokenId;
        uint16 rodSpeedBps;
        uint16 rodWeightBps;
        uint16 rodLuckBps;
        uint16 rodStabilityBps;
    }

    struct Room {
        uint256 roomId;
        RoomTier tier;
        RoomStatus status;
        address[4] players;
        uint8 playerCount;
        uint256 entryFee;
        uint256 recastFee;
        uint256 totalPot;
        bool isPublic;
        bool isLivestream;
        address host;
        uint256 createdAt;
        uint256 gameStartedAt;
        uint256 lockedInCount;
        mapping(uint256 => Player) playerData;
        mapping(address => uint256) playerIndex;
        mapping(address => bool) isPlayer;
    }

    // ─── Constants ──────────────────────────────────────
    uint256 public constant MAX_PLAYERS = 4;
    uint256 public constant MAX_RECAST = 3;
    uint256 public constant PLATFORM_FEE_BPS = 500;
    uint256 public constant RECAST_FLOOR_BPS = 7000;  // recast guarantees >= 70% of previous score
    uint256 public constant GAME_TIMEOUT = 180;        // 180 seconds auto lock-in

    uint256[5] public RARITY_SCORES = [1, 2, 4, 8, 16];
    uint256[4] public TIME_THRESHOLDS = [60, 90, 120, type(uint256).max];
    uint256[4] public TIME_COEFFICIENTS = [12000, 10000, 8500, 7000];
    uint256[4] public RECAST_COEFFICIENTS = [10000, 10500, 11000, 11500];
    uint256[3] public PRIZE_SHARES = [6000, 2500, 1000];

    // ─── State ──────────────────────────────────────────
    IVRFCoordinatorV2Plus private immutable i_vrfCoordinator;
    bytes32 public s_keyHash;
    uint256 public s_subscriptionId;
    uint16  public constant REQUEST_CONFIRMATIONS = 3;
    uint32  public constant CALLBACK_GAS_LIMIT = 300_000;

    uint256 public roomCount;
    mapping(uint256 => Room) public rooms;

    struct VRFRequest {
        uint256 roomId;
        uint256 playerIndex;
        bool isRecast;
    }
    mapping(uint256 => VRFRequest) public vrfRequests;

    mapping(RoomTier => uint256) public entryFees;
    mapping(RoomTier => uint256) public recastFees;

    IFishingRod public rodContract;

    // ─── Custom Errors ──────────────────────────────────
    error InvalidTier();
    error IncorrectFee();
    error RoomNotWaiting();
    error RoomNotActive();
    error RoomFull();
    error AlreadyInRoom();
    error NotHost();
    error NotEnoughPlayers();
    error NotInRoom();
    error NotFishing();
    error MaxRecastReached();
    error NoFishCaught();
    error GameNotTimedOut();
    error PlayerAlreadyLockedIn();
    error NotRodOwner();
    error InvalidRod();
    error InsufficientRodLevel();

    // ─── Events ─────────────────────────────────────────
    event RoomCreated(uint256 indexed roomId, address indexed host, RoomTier tier, bool isPublic, uint256 entryFee, uint256 timestamp);
    event PlayerJoined(uint256 indexed roomId, address indexed player, uint256 playerIndex);
    event GameStarted(uint256 indexed roomId, uint256 timestamp);
    event CastRequested(uint256 indexed roomId, address player, uint256 requestId);
    event FishCaught(uint256 indexed roomId, address player, uint8 rarity, uint256 weight, uint256 score, uint256 timestamp);
    event PlayerLockedIn(uint256 indexed roomId, address player, uint256 finalScore);
    event RecastStarted(uint256 indexed roomId, address player, uint256 recastNumber);
    event DiceRolled(uint256 indexed roomId, address player, int256 diceModifier);
    event GameSettled(uint256 indexed roomId, address[3] winners, uint256[3] prizes, uint256[4] finalScores);
    event RodUsed(uint256 indexed roomId, address indexed player, uint256 indexed tokenId, uint16 speedBps, uint16 weightBps, uint16 luckBps, uint16 stabilityBps);

    // ─── Constructor ────────────────────────────────────
    constructor(
        address vrfCoordinator,
        bytes32 keyHash,
        uint256 subscriptionId
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        s_keyHash = keyHash;
        s_subscriptionId = subscriptionId;

        entryFees[RoomTier.Bronze]  = 0.01 ether;
        entryFees[RoomTier.Silver]  = 0.05 ether;
        entryFees[RoomTier.Gold]    = 0.1 ether;
        entryFees[RoomTier.Diamond] = 0.5 ether;

        recastFees[RoomTier.Bronze]  = 0.01 ether;
        recastFees[RoomTier.Silver]  = 0.05 ether;
        recastFees[RoomTier.Gold]    = 0.1 ether;
        recastFees[RoomTier.Diamond] = 0.5 ether;
    }

    // ─── Room Management ────────────────────────────────

    function createRoom(
        RoomTier tier,
        bool isPublic,
        bool isLivestream
    ) external payable nonReentrant returns (uint256 roomId) {
        if (msg.value != entryFees[tier]) revert IncorrectFee();
        
        // Verify host has a rod with sufficient level for this room tier
        if (!_hasRodForTier(msg.sender, tier)) revert InsufficientRodLevel();

        roomId = roomCount++;
        Room storage room = rooms[roomId];
        room.roomId = roomId;
        room.tier = tier;
        room.status = RoomStatus.Waiting;
        room.entryFee = entryFees[tier];
        room.recastFee = recastFees[tier];
        room.isPublic = isPublic;
        room.isLivestream = isLivestream;
        room.host = msg.sender;
        room.createdAt = block.timestamp;

        room.players[0] = msg.sender;
        room.playerCount = 1;
        room.totalPot = msg.value;
        room.isPlayer[msg.sender] = true;
        room.playerIndex[msg.sender] = 0;

        room.playerData[0] = Player({
            addr: msg.sender,
            status: PlayerStatus.Fishing,
            currentFish: FishResult(Rarity.Common, 0, 0, 0),
            recastCount: 0,
            totalBet: msg.value,
            skillModifier: 10000,
            rodTokenId: 0,
            rodSpeedBps: 0,
            rodWeightBps: 0,
            rodLuckBps: 0,
            rodStabilityBps: 0
        });

        emit RoomCreated(roomId, msg.sender, tier, isPublic, entryFees[tier], block.timestamp);
        emit PlayerJoined(roomId, msg.sender, 0);
    }

    function joinRoom(uint256 roomId) external payable nonReentrant {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Waiting) revert RoomNotWaiting();
        if (room.playerCount >= 4) revert RoomFull();
        if (msg.value != room.entryFee) revert IncorrectFee();
        if (room.isPlayer[msg.sender]) revert AlreadyInRoom();
        
        // Verify player has a rod with sufficient level for this room tier
        if (!_hasRodForTier(msg.sender, room.tier)) revert InsufficientRodLevel();

        uint8 idx = room.playerCount;
        room.players[idx] = msg.sender;
        room.playerCount++;
        room.totalPot += msg.value;
        room.isPlayer[msg.sender] = true;
        room.playerIndex[msg.sender] = idx;

        room.playerData[idx] = Player({
            addr: msg.sender,
            status: PlayerStatus.Fishing,
            currentFish: FishResult(Rarity.Common, 0, 0, 0),
            recastCount: 0,
            totalBet: msg.value,
            skillModifier: 10000,
            rodTokenId: 0,
            rodSpeedBps: 0,
            rodWeightBps: 0,
            rodLuckBps: 0,
            rodStabilityBps: 0
        });

        emit PlayerJoined(roomId, msg.sender, idx);
    }

    function startGame(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (msg.sender != room.host) revert NotHost();
        if (room.status != RoomStatus.Waiting) revert RoomNotWaiting();
        if (room.playerCount < 2) revert NotEnoughPlayers();

        room.status = RoomStatus.Active;
        room.gameStartedAt = block.timestamp;
        emit GameStarted(roomId, block.timestamp);
    }

    // ─── Fishing Actions ────────────────────────────────

    function cast(uint256 roomId, uint256 rodTokenId) external {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (!room.isPlayer[msg.sender]) revert NotInRoom();
        uint256 idx = room.playerIndex[msg.sender];
        Player storage player = room.playerData[idx];
        if (player.status != PlayerStatus.Fishing) revert NotFishing();

        _syncRodSnapshot(roomId, player, msg.sender, rodTokenId);

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 3,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        vrfRequests[requestId] = VRFRequest(roomId, idx, false);
        _consumeEquippedRod(player.rodTokenId, 8);
        emit CastRequested(roomId, msg.sender, requestId);
    }

    function lockIn(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (!room.isPlayer[msg.sender]) revert NotInRoom();
        uint256 idx = room.playerIndex[msg.sender];
        Player storage player = room.playerData[idx];
        if (player.status != PlayerStatus.Fishing) revert NotFishing();
        if (player.currentFish.weight == 0) revert NoFishCaught();

        player.currentFish.score = _calculateScore(player);
        player.status = PlayerStatus.LockedIn;
        room.lockedInCount++;

        emit PlayerLockedIn(roomId, msg.sender, player.currentFish.score);

        if (room.lockedInCount == room.playerCount) {
            _settleGame(roomId);
        }
    }

    function recast(uint256 roomId, uint256 rodTokenId) external payable nonReentrant {
        Room storage room = rooms[roomId];
        if (!room.isPlayer[msg.sender]) revert NotInRoom();
        uint256 idx = room.playerIndex[msg.sender];
        Player storage player = room.playerData[idx];
        if (player.status != PlayerStatus.Fishing) revert NotFishing();
        if (player.recastCount >= MAX_RECAST) revert MaxRecastReached();
        if (msg.value != room.recastFee) revert IncorrectFee();

        _syncRodSnapshot(roomId, player, msg.sender, rodTokenId);

        player.recastCount++;
        player.totalBet += msg.value;
        room.totalPot += msg.value;

        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 5,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        vrfRequests[requestId] = VRFRequest(roomId, idx, true);
        _consumeEquippedRod(player.rodTokenId, 12);
        emit RecastStarted(roomId, msg.sender, player.recastCount);
    }

    // ─── VRF Callback ───────────────────────────────────

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        VRFRequest memory req = vrfRequests[requestId];
        Room storage room = rooms[req.roomId];
        Player storage player = room.playerData[req.playerIndex];

        uint256 previousScore = player.currentFish.score;
        uint256 effectiveSkillModifier = _effectiveSkillModifier(player.skillModifier, player.rodLuckBps);

        uint8 rarityRoll = uint8(randomWords[0] % 100);
        Rarity rarity = _rollRarity(rarityRoll, effectiveSkillModifier);
        uint256 baseWeight = _rollWeight(randomWords[1], rarity);
        if (player.rodWeightBps > 0) {
            baseWeight = (baseWeight * (10000 + uint256(player.rodWeightBps))) / 10000;
        }
        uint256 timeVariation = 60 + (randomWords[2] % 61);
        if (player.rodSpeedBps > 0) {
            uint256 speedReduction = uint256(player.rodSpeedBps);
            if (speedReduction > 9000) speedReduction = 9000;
            timeVariation = (timeVariation * (10000 - speedReduction)) / 10000;
            if (timeVariation < 30) timeVariation = 30;
        }

        player.currentFish = FishResult({
            rarity: rarity,
            weight: baseWeight,
            fishingTime: timeVariation,
            score: 0
        });

        if (req.isRecast && randomWords.length >= 5) {
            int256 diceModifier = _rollDice(randomWords[3], randomWords[4], player.recastCount);
            if (diceModifier > 0) {
                player.skillModifier = player.skillModifier * (10000 + uint256(diceModifier)) / 10000;
            } else {
                uint256 reduction = uint256(-diceModifier);
                player.skillModifier = player.skillModifier * (10000 - reduction) / 10000;
            }
            emit DiceRolled(req.roomId, player.addr, diceModifier);
        }

        player.currentFish.score = _calculateScore(player);

        // Recast floor: new score must be >= 70% of previous score
        if (req.isRecast && previousScore > 0) {
            uint256 floorBps = RECAST_FLOOR_BPS + uint256(player.rodStabilityBps) / 2;
            if (floorBps > 9500) floorBps = 9500;
            uint256 floor = (previousScore * floorBps) / 10000;
            if (player.currentFish.score < floor) {
                player.currentFish.score = floor;
            }
        }

        emit FishCaught(
            req.roomId, player.addr,
            uint8(rarity), baseWeight,
            player.currentFish.score,
            block.timestamp
        );
    }

    // ─── Scoring ────────────────────────────────────────

    function _calculateScore(Player storage player) internal view returns (uint256) {
        uint256 rarityScore = RARITY_SCORES[uint256(player.currentFish.rarity)];
        uint256 weightScore = player.currentFish.weight * rarityScore;
        uint256 timeCoeff = _getTimeCoefficient(player.currentFish.fishingTime);
        uint256 recastCoeff = RECAST_COEFFICIENTS[player.recastCount];
        return (weightScore * timeCoeff * recastCoeff * player.skillModifier) / (10000 * 10000 * 10000);
    }

    // ─── Settlement ─────────────────────────────────────

    function _settleGame(uint256 roomId) internal {
        Room storage room = rooms[roomId];
        room.status = RoomStatus.Finished;

        uint256 pc = room.playerCount;
        uint256[] memory scores = new uint256[](pc);
        uint256[] memory indices = new uint256[](pc);

        for (uint256 i = 0; i < pc; i++) {
            scores[i] = room.playerData[i].currentFish.score;
            indices[i] = i;
        }

        for (uint256 i = 1; i < pc; i++) {
            uint256 key = scores[i];
            uint256 keyIdx = indices[i];
            int256 j = int256(i) - 1;
            while (j >= 0 && scores[uint256(j)] < key) {
                scores[uint256(j) + 1] = scores[uint256(j)];
                indices[uint256(j) + 1] = indices[uint256(j)];
                j--;
            }
            scores[uint256(j + 1)] = key;
            indices[uint256(j + 1)] = keyIdx;
        }

        uint256 platformFee = (room.totalPot * PLATFORM_FEE_BPS) / 10000;
        uint256 prizePool = room.totalPot - platformFee;

        address[3] memory winners;
        uint256[3] memory prizes;
        uint256 winnerCount = pc < 3 ? pc : 3;

        for (uint256 i = 0; i < winnerCount; i++) {
            winners[i] = room.playerData[indices[i]].addr;
            prizes[i] = (prizePool * PRIZE_SHARES[i]) / 10000;
            payable(winners[i]).transfer(prizes[i]);
        }

        payable(owner()).transfer(platformFee);

        uint256[4] memory finalScores;
        for (uint256 i = 0; i < pc; i++) {
            finalScores[i] = room.playerData[i].currentFish.score;
        }

        emit GameSettled(roomId, winners, prizes, finalScores);
    }

    // ─── Timeout ────────────────────────────────────────

    function forceComplete(uint256 roomId) external {
        Room storage room = rooms[roomId];
        if (room.status != RoomStatus.Active) revert RoomNotActive();
        if (block.timestamp < room.gameStartedAt + GAME_TIMEOUT) revert GameNotTimedOut();

        for (uint256 i = 0; i < room.playerCount; i++) {
            Player storage player = room.playerData[i];
            if (player.status == PlayerStatus.Fishing) {
                if (player.currentFish.weight > 0) {
                    player.currentFish.score = _calculateScore(player);
                }
                player.status = PlayerStatus.LockedIn;
                room.lockedInCount++;
                emit PlayerLockedIn(roomId, player.addr, player.currentFish.score);
            }
        }

        if (room.lockedInCount == room.playerCount) {
            _settleGame(roomId);
        }
    }

    // ─── Rod Contract ───────────────────────────────────

    function setRodContract(address _rodContract) external {
        require(msg.sender == owner(), "Only owner");
        rodContract = IFishingRod(_rodContract);
    }

    // ─── Internal Helpers ───────────────────────────────

    function _rollRarity(uint8 roll, uint256 skillMod) internal pure returns (Rarity) {
        // Probabilities: Common 55%, Rare 25%, SuperRare 13%, Epic 6%, Legendary 1%
        uint256 adjusted = uint256(roll) * 10000 / skillMod;
        if (adjusted >= 99) return Rarity.Legendary;   // 1%
        if (adjusted >= 93) return Rarity.Epic;         // 6%
        if (adjusted >= 80) return Rarity.SuperRare;    // 13%
        if (adjusted >= 55) return Rarity.Rare;         // 25%
        return Rarity.Common;                           // 55%
    }

    function _rollWeight(uint256 rand, Rarity rarity) internal pure returns (uint256) {
        // Weight ranges match Notion fish database (in grams)
        if (rarity == Rarity.Common)    return 50 + (rand % 1450);      // 0.05 - 1.5 kg
        if (rarity == Rarity.Rare)      return 300 + (rand % 3700);     // 0.3 - 4.0 kg
        if (rarity == Rarity.SuperRare) return 1500 + (rand % 6500);    // 1.5 - 8.0 kg
        if (rarity == Rarity.Epic)      return 4000 + (rand % 16000);   // 4.0 - 20.0 kg
        return 6000 + (rand % 19000);                                    // 6.0 - 25.0 kg (Legendary)
    }

    function _rollDice(uint256 rand1, uint256 rand2, uint256 recastNumber) internal pure returns (int256) {
        if (recastNumber == 1) {
            return int256(rand1 % 3000) - 1500;
        } else if (recastNumber == 2) {
            return int256(rand1 % 5000) - 2500;
        } else {
            if (rand2 % 2 == 0) {
                return int256(3000 + (rand1 % 2000));
            } else {
                return -int256(3000 + (rand1 % 2000));
            }
        }
    }

    function _getTimeCoefficient(uint256 time) internal view returns (uint256) {
        for (uint256 i = 0; i < 4; i++) {
            if (time <= TIME_THRESHOLDS[i]) return TIME_COEFFICIENTS[i];
        }
        return TIME_COEFFICIENTS[3];
    }

    // ─── Rod Level Validation ───────────────────────────
    function _getRequiredRodLevel(RoomTier tier) internal pure returns (uint8) {
        if (tier == RoomTier.Bronze) return 0;   // Any level rod
        if (tier == RoomTier.Silver) return 1;   // Need level 1+
        if (tier == RoomTier.Gold) return 2;     // Need level 2+
        return 3;                                 // Diamond: Need level 3+
    }

    function _hasRodForTier(address player, RoomTier tier) internal view returns (bool) {
        if (address(rodContract) == address(0)) return true; // If rod contract not set, allow all
        
        uint8 requiredLevel = _getRequiredRodLevel(tier);
        uint256 maxTokenId = 200; // Scan up to 200 tokens
        
        for (uint256 tokenId = 1; tokenId <= maxTokenId; tokenId++) {
            try rodContract.ownerOf(tokenId) returns (address owner) {
                if (owner == player) {
                    // Get rod level
                    (, , uint8 level, , , , , , ) = rodContract.getRod(tokenId);
                    if (level >= requiredLevel) {
                        return true; // Found a rod with sufficient level
                    }
                }
            } catch {
                // Token doesn't exist, continue
                continue;
            }
        }
        
        return false; // No rod with sufficient level found
    }

    function _syncRodSnapshot(uint256 roomId, Player storage player, address playerAddr, uint256 rodTokenId) internal {
        player.rodTokenId = rodTokenId;
        player.rodSpeedBps = 0;
        player.rodWeightBps = 0;
        player.rodLuckBps = 0;
        player.rodStabilityBps = 0;

        if (rodTokenId == 0) {
            return;
        }
        if (address(rodContract) == address(0)) revert InvalidRod();

        address owner = rodContract.ownerOf(rodTokenId);
        if (owner != playerAddr) revert NotRodOwner();

        (
            ,
            ,
            ,
            ,
            ,
            uint16 speedBps,
            uint16 weightBps,
            uint16 luckBps,
            uint16 stabilityBps
        ) = rodContract.getRod(rodTokenId);

        player.rodSpeedBps = speedBps;
        player.rodWeightBps = weightBps;
        player.rodLuckBps = luckBps;
        player.rodStabilityBps = stabilityBps;

        emit RodUsed(roomId, playerAddr, rodTokenId, speedBps, weightBps, luckBps, stabilityBps);
    }

    function _consumeEquippedRod(uint256 rodTokenId, uint16 amount) internal {
        if (rodTokenId == 0) return;
        if (address(rodContract) == address(0)) revert InvalidRod();
        rodContract.consumeDurability(rodTokenId, amount);
    }

    function _effectiveSkillModifier(uint256 baseSkillModifier, uint16 luckBps) internal pure returns (uint256) {
        uint256 luckReduction = uint256(luckBps);
        if (luckReduction > 9000) luckReduction = 9000;
        uint256 effective = (baseSkillModifier * (10000 - luckReduction)) / 10000;
        if (effective < 1000) return 1000;
        return effective;
    }

    // ─── View Functions ─────────────────────────────────

    function getRoomInfo(uint256 roomId) external view returns (
        uint256 id, RoomTier tier, RoomStatus status, uint8 playerCount,
        uint256 entryFee, uint256 totalPot, bool isPublic, bool isLivestream, address host
    ) {
        Room storage room = rooms[roomId];
        return (room.roomId, room.tier, room.status, room.playerCount,
                room.entryFee, room.totalPot, room.isPublic, room.isLivestream, room.host);
    }

    function getPlayerInfo(uint256 roomId, uint256 playerIdx) external view returns (
        address addr, PlayerStatus status, uint8 rarity, uint256 weight,
        uint256 fishingTime, uint256 score, uint256 recastCount, uint256 totalBet
    ) {
        Player storage p = rooms[roomId].playerData[playerIdx];
        return (p.addr, p.status, uint8(p.currentFish.rarity), p.currentFish.weight,
                p.currentFish.fishingTime, p.currentFish.score, p.recastCount, p.totalBet);
    }
}
