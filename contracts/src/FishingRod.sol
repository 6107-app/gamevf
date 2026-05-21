// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";

contract FishingRod is ERC721, ReentrancyGuard, VRFConsumerBaseV2Plus {
    // ─── Enums ──────────────────────────────────────────
    enum RodType { Driftwood, Tidebreaker, Leviathan, AbyssWhisper }
    enum RodRarity { Common, Rare, SuperRare, Epic, Legendary }
    enum UpgradeAttr { Speed, Weight, Luck, Stability }

    // ─── Rod Data ───────────────────────────────────────
    struct Rod {
        RodType rodType;
        RodRarity rarity;
        uint8 level;
        uint16 durability;
        uint16 maxDurability;
        uint16 speedBps;
        uint16 weightBps;
        uint16 luckBps;
        uint16 stabilityBps;
    }

    // ─── VRF Config ─────────────────────────────────────
    IVRFCoordinatorV2Plus private immutable i_vrfCoordinator;
    bytes32 public s_keyHash;
    uint256 public s_subscriptionId;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant CALLBACK_GAS_LIMIT = 300_000;

    // ─── NFT Storage ────────────────────────────────────
    uint256 private _nextTokenId;
    mapping(uint256 => Rod) private _rods;

    // ─── Game Hook & Repair Payment ─────────────────────
    address public gameContract;
    IERC20 public repairToken;

    // ─── Upgrade Requests (VRF) ─────────────────────────
    struct UpgradeRequest {
        uint256 tokenId;
        address requester;
    }

    mapping(uint256 => UpgradeRequest) public upgradeRequests;
    mapping(uint256 => uint256) public pendingUpgradeRequestId;

    // ─── Events ─────────────────────────────────────────
    event RodMinted(uint256 indexed tokenId, address indexed owner, uint8 rodType, uint8 rarity);
    event DurabilityConsumed(uint256 indexed tokenId, uint16 amount, uint16 remaining);
    event RodRepaired(uint256 indexed tokenId, uint16 restoredTo, uint256 cost);
    event UpgradeRequested(uint256 indexed tokenId, uint256 indexed requestId, address indexed requester, uint8 fromLevel);
    event UpgradeResolved(uint256 indexed tokenId, bool success, uint8 newLevel, uint8 attr, uint16 deltaBps);
    event GameContractSet(address indexed gameContract);
    event RepairTokenSet(address indexed token);

    // ─── Errors ─────────────────────────────────────────
    error NotTokenOwner();
    error InvalidToken();
    error IncorrectPayment();
    error Unauthorized();
    error RodBroken();
    error UpgradeInProgress();
    error MaxLevelReached();
    error InvalidRepairAmount();

    // ─── Constructor ────────────────────────────────────
    constructor(
        address vrfCoordinator,
        bytes32 keyHash,
        uint256 subscriptionId
    ) ERC721("Fishing Rod", "ROD") VRFConsumerBaseV2Plus(vrfCoordinator) {
        i_vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinator);
        s_keyHash = keyHash;
        s_subscriptionId = subscriptionId;
        _nextTokenId = 1;
    }

    // ─── Admin ──────────────────────────────────────────
    function setGameContract(address _gameContract) external onlyOwner {
        gameContract = _gameContract;
        emit GameContractSet(_gameContract);
    }

    function setRepairToken(address token) external onlyOwner {
        repairToken = IERC20(token);
        emit RepairTokenSet(token);
    }

    // ─── Mint ───────────────────────────────────────────
    function mintRod(RodType rodType) external payable nonReentrant returns (uint256 tokenId) {
        uint256 price = mintPriceWei(rodType);
        _collectEth(price);

        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        (RodRarity rarity, uint16 speedBps, uint16 weightBps, uint16 luckBps, uint16 stabilityBps) = _initialStats(rodType);

        _rods[tokenId] = Rod({
            rodType: rodType,
            rarity: rarity,
            level: 0,
            durability: 100,
            maxDurability: 100,
            speedBps: speedBps,
            weightBps: weightBps,
            luckBps: luckBps,
            stabilityBps: stabilityBps
        });

        emit RodMinted(tokenId, msg.sender, uint8(rodType), uint8(rarity));
    }

    // ─── Durability (only FishingGame) ──────────────────
    function consumeDurability(uint256 tokenId, uint16 amount) external {
        if (msg.sender != gameContract) revert Unauthorized();
        if (!_tokenExists(tokenId)) revert InvalidToken();

        Rod storage r = _rods[tokenId];
        if (r.durability == 0) revert RodBroken();
        if (amount >= r.durability) {
            r.durability = 0;
        } else {
            r.durability -= amount;
        }

        emit DurabilityConsumed(tokenId, amount, r.durability);
    }

    // ─── Repair ─────────────────────────────────────────
    function repairFull(uint256 tokenId) external payable nonReentrant {
        _repair(tokenId, type(uint16).max);
    }

    function repairPartial(uint256 tokenId, uint16 restoreDurability) external payable nonReentrant {
        if (restoreDurability != 10 && restoreDurability != 25 && restoreDurability != 50) revert InvalidRepairAmount();
        _repair(tokenId, restoreDurability);
    }

    // ─── Upgrade (VRF) ──────────────────────────────────
    function upgrade(uint256 tokenId) external payable nonReentrant returns (uint256 requestId) {
        if (!_tokenExists(tokenId)) revert InvalidToken();
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        Rod storage r = _rods[tokenId];
        if (r.level >= 5) revert MaxLevelReached();
        if (r.durability == 0) revert RodBroken();
        if (pendingUpgradeRequestId[tokenId] != 0) revert UpgradeInProgress();

        uint256 fee = upgradeFeeWei(r.level);
        _collectEth(fee);

        requestId = i_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: s_keyHash,
                subId: s_subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: 3,
                extraArgs: VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: false}))
            })
        );

        if (upgradeRequests[requestId].tokenId != 0) revert UpgradeInProgress();
        upgradeRequests[requestId] = UpgradeRequest({ tokenId: tokenId, requester: msg.sender });
        pendingUpgradeRequestId[tokenId] = requestId;

        emit UpgradeRequested(tokenId, requestId, msg.sender, r.level);
    }

    // ─── VRF Callback ───────────────────────────────────
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        UpgradeRequest memory req = upgradeRequests[requestId];
        if (req.tokenId == 0) return;

        delete upgradeRequests[requestId];
        if (pendingUpgradeRequestId[req.tokenId] == requestId) pendingUpgradeRequestId[req.tokenId] = 0;
        if (!_tokenExists(req.tokenId)) return;

        Rod storage r = _rods[req.tokenId];
        if (r.level >= 5) {
            emit UpgradeResolved(req.tokenId, false, r.level, 0, 0);
            return;
        }

        uint16 successBps = _upgradeSuccessBps(r.level);
        uint256 roll = randomWords[0] % 10000;
        bool success = roll < successBps;
        if (!success) {
            emit UpgradeResolved(req.tokenId, false, r.level, 0, 0);
            return;
        }

        UpgradeAttr attr = _pickAttr(uint16(randomWords[1] % 10000));
        uint16 delta = _pickUpgradeDeltaBps(r.level, uint16(randomWords[2] % 10000));

        if (attr == UpgradeAttr.Speed) r.speedBps = _addBps(r.speedBps, delta);
        else if (attr == UpgradeAttr.Weight) r.weightBps = _addBps(r.weightBps, delta);
        else if (attr == UpgradeAttr.Luck) r.luckBps = _addBps(r.luckBps, delta);
        else r.stabilityBps = _addBps(r.stabilityBps, delta);

        r.level += 1;

        emit UpgradeResolved(req.tokenId, true, r.level, uint8(attr), delta);
    }

    // ─── Views ──────────────────────────────────────────
    function getRodBonus(uint256 tokenId) external view returns (uint256 speedBonus, uint256 weightBonus, uint256 luckBonus) {
        if (!_tokenExists(tokenId)) return (0, 0, 0);
        Rod storage r = _rods[tokenId];
        return (r.speedBps, r.weightBps, r.luckBps);
    }

    function getRod(uint256 tokenId) external view returns (Rod memory) {
        if (!_tokenExists(tokenId)) revert InvalidToken();
        return _rods[tokenId];
    }

    // ─── Pricing ────────────────────────────────────────
    function mintPriceWei(RodType rodType) public pure returns (uint256) {
        if (rodType == RodType.Driftwood) return 0.01 ether;
        if (rodType == RodType.Tidebreaker) return 0.05 ether;
        if (rodType == RodType.Leviathan) return 0.08 ether;
        return 0.15 ether;
    }

    function upgradeFeeWei(uint8 currentLevel) public pure returns (uint256) {
        if (currentLevel == 0) return 0.01 ether;
        if (currentLevel == 1) return 0.03 ether;
        if (currentLevel == 2) return 0.06 ether;
        if (currentLevel == 3) return 0.12 ether;
        if (currentLevel == 4) return 0.25 ether;
        return type(uint256).max;
    }

    function fullRepairCost(uint256 tokenId) public view returns (uint256) {
        if (!_tokenExists(tokenId)) revert InvalidToken();
        Rod storage r = _rods[tokenId];
        uint256 base = _baseRepairCostTokens18(r.rodType);
        uint256 multBps = _repairMultiplierBps(r.level);
        return (base * multBps) / 10000;
    }

    function partialRepairCost(uint256 tokenId, uint16 restoreDurability) public view returns (uint256) {
        uint256 full = fullRepairCost(tokenId);
        if (restoreDurability == 10) return (full * 15) / 100;
        if (restoreDurability == 25) return (full * 35) / 100;
        if (restoreDurability == 50) return (full * 60) / 100;
        revert InvalidRepairAmount();
    }

    // ─── Internal: Repair ───────────────────────────────
    function _repair(uint256 tokenId, uint16 restoreDurability) internal {
        if (!_tokenExists(tokenId)) revert InvalidToken();
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        Rod storage r = _rods[tokenId];
        uint16 beforeDurability = r.durability;
        if (beforeDurability >= r.maxDurability) {
            emit RodRepaired(tokenId, r.maxDurability, 0);
            return;
        }

        uint256 cost;
        if (restoreDurability == type(uint16).max) {
            cost = fullRepairCost(tokenId);
            r.durability = r.maxDurability;
        } else {
            cost = partialRepairCost(tokenId, restoreDurability);
            uint256 afterDurability = uint256(beforeDurability) + uint256(restoreDurability);
            r.durability = afterDurability >= r.maxDurability ? r.maxDurability : uint16(afterDurability);
        }

        _collectRepairPayment(cost);
        emit RodRepaired(tokenId, r.durability, cost);
    }

    // ─── Admin: Withdraw ────────────────────────────────
    function withdrawEth(address payable to, uint256 amount) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "withdraw failed");
    }

    function withdrawRepairToken(address to, uint256 amount) external onlyOwner {
        IERC20 token = repairToken;
        bool ok = token.transfer(to, amount);
        require(ok, "transfer failed");
    }

    // ─── Internal: Payment Collection ───────────────────
    function _collectEth(uint256 amount) internal {
        if (msg.value != amount) revert IncorrectPayment();
    }

    function _collectRepairPayment(uint256 amount) internal {
        IERC20 token = repairToken;
        if (address(token) == address(0)) {
            if (msg.value != amount) revert IncorrectPayment();
            return;
        }
        if (msg.value != 0) revert IncorrectPayment();
        bool ok = token.transferFrom(msg.sender, address(this), amount);
        require(ok, "transferFrom failed");
    }

    // ─── Internal: Base Stats & RNG Tables ──────────────
    function _initialStats(RodType rodType) internal pure returns (
        RodRarity rarity,
        uint16 speedBps,
        uint16 weightBps,
        uint16 luckBps,
        uint16 stabilityBps
    ) {
        if (rodType == RodType.Driftwood) {
            return (RodRarity.Common, 300, 300, 0, 0);
        }
        if (rodType == RodType.Tidebreaker) {
            return (RodRarity.Rare, 1000, 200, 0, 0);
        }
        if (rodType == RodType.Leviathan) {
            return (RodRarity.SuperRare, 0, 0, 500, 200);
        }
        return (RodRarity.Epic, 0, 0, 1000, 500);
    }

    function _upgradeSuccessBps(uint8 currentLevel) internal pure returns (uint16) {
        if (currentLevel == 0) return 10000;
        if (currentLevel == 1) return 8500;
        if (currentLevel == 2) return 6500;
        if (currentLevel == 3) return 4500;
        if (currentLevel == 4) return 2500;
        return 0;
    }

    function _pickAttr(uint16 roll) internal pure returns (UpgradeAttr) {
        if (roll < 2500) return UpgradeAttr.Speed;
        if (roll < 5000) return UpgradeAttr.Weight;
        if (roll < 7000) return UpgradeAttr.Luck;
        return UpgradeAttr.Stability;
    }

    function _pickUpgradeDeltaBps(uint8 currentLevel, uint16 roll) internal pure returns (uint16) {
        if (currentLevel == 0) {
            if (roll < 5000) return 500;
            if (roll < 7500) return 600;
            if (roll < 9000) return 700;
            if (roll < 9800) return 800;
            return 1000;
        }
        if (currentLevel == 1) {
            if (roll < 4000) return 500;
            if (roll < 7000) return 600;
            if (roll < 8500) return 700;
            if (roll < 9500) return 900;
            return 1200;
        }
        if (currentLevel == 2) {
            if (roll < 3500) return 500;
            if (roll < 6500) return 700;
            if (roll < 8500) return 900;
            if (roll < 9500) return 1200;
            return 1500;
        }
        if (currentLevel == 3) {
            if (roll < 5000) return 500;
            if (roll < 7500) return 800;
            if (roll < 9000) return 1000;
            if (roll < 9800) return 1200;
            return 1500;
        }
        if (currentLevel == 4) {
            if (roll < 6500) return 500;
            if (roll < 8500) return 700;
            if (roll < 9500) return 1000;
            return 1500;
        }
        return 0;
    }

    function _baseRepairCostTokens18(RodType rodType) internal pure returns (uint256) {
        if (rodType == RodType.Driftwood) return 20 ether;
        if (rodType == RodType.Tidebreaker) return 45 ether;
        if (rodType == RodType.Leviathan) return 70 ether;
        return 120 ether;
    }

    function _repairMultiplierBps(uint8 level) internal pure returns (uint256) {
        if (level == 0) return 10000;
        if (level == 1) return 13000;
        if (level == 2) return 17000;
        if (level == 3) return 23000;
        if (level == 4) return 32000;
        if (level == 5) return 45000;
        return 10000;
    }

    function _addBps(uint16 base, uint16 delta) internal pure returns (uint16) {
        uint256 v = uint256(base) + uint256(delta);
        if (v > type(uint16).max) return type(uint16).max;
        return uint16(v);
    }

    // ─── Internal: ERC721 Existence ─────────────────────
    function _tokenExists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
