// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/FishingRod.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mocks ──────────────────────────────────────────────
// 该测试文件里包含两个 Mock：
// 1) MockRepairToken：用于模拟修理时的 ERC20 支付
// 2) MockVRFCoordinator：用于模拟 VRF coordinator 的 request/fulfill 流程，从而手动触发 rawFulfillRandomWords 回调
contract MockRepairToken is ERC20 {
    constructor() ERC20("Repair Token", "RPR") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockVRFCoordinator {
    uint256 private _reqId;
    mapping(uint256 => address) private _consumers;

    // 模拟 VRF coordinator：返回递增的 requestId，并记录 consumer 合约地址
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata
    ) external returns (uint256) {
        _reqId++;
        _consumers[_reqId] = msg.sender;
        return _reqId;
    }

    // 手动触发 VRF 回调：调用 consumer 的 rawFulfillRandomWords
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        address consumer = _consumers[requestId];
        require(consumer != address(0), "request not found");
        (bool success,) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, "fulfillment failed");
    }
}

// ─── Tests ──────────────────────────────────────────────
// 覆盖范围：
// - mint：价格校验、mint 后 rod 初始属性
// - consumeDurability：仅允许 gameContract 调用
// - repair：部分修理参数限制 + 通过 ERC20 扣费
// - upgrade：请求落库 / 防重复 / fulfill 成功与失败路径
contract FishingRodTest is Test {
    FishingRod public rod;
    MockVRFCoordinator public mockVRF;
    MockRepairToken public repairToken;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public game  = makeAddr("game");

    receive() external payable {}

    // ─── Setup ──────────────────────────────────────────
    // 以 owner 部署 FishingRod，并配置 gameContract + repairToken；
    // 给 alice 发 ETH 和 repairToken，且提前 approve 让合约可以扣费
    function setUp() public {
        vm.deal(owner, 100 ether);
        vm.deal(alice, 100 ether);

        vm.startPrank(owner);
        mockVRF = new MockVRFCoordinator();
        rod = new FishingRod(address(mockVRF), bytes32(uint256(1)), 1);
        repairToken = new MockRepairToken();
        rod.setGameContract(game);
        rod.setRepairToken(address(repairToken));
        vm.stopPrank();

        repairToken.mint(alice, 1_000_000 ether);
        vm.prank(alice);
        repairToken.approve(address(rod), type(uint256).max);
    }

    // ─── Helpers ────────────────────────────────────────
    // _mintRodAsAlice：按合约定价 mint 指定 rodType
    function _mintRodAsAlice(FishingRod.RodType rodType) internal returns (uint256 tokenId) {
        uint256 price = rod.mintPriceWei(rodType);
        vm.prank(alice);
        tokenId = rod.mintRod{value: price}(rodType);
    }

    // _randomWords3：生成 3 个随机词，匹配 upgrade() 的 numWords=3
    function _randomWords3(uint256 w0, uint256 w1, uint256 w2) internal pure returns (uint256[] memory rw) {
        rw = new uint256[](3);
        rw[0] = w0;
        rw[1] = w1;
        rw[2] = w2;
    }

    // ─── Mint ───────────────────────────────────────────
    function test_mintRod_success() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);
        assertEq(tokenId, 1);
        assertEq(rod.ownerOf(tokenId), alice);

        FishingRod.Rod memory r = rod.getRod(tokenId);
        assertEq(uint8(r.rodType), uint8(FishingRod.RodType.Driftwood));
        assertEq(r.level, 0);
        assertEq(r.durability, 100);
        assertEq(r.maxDurability, 100);
        assertEq(r.speedBps, 300);
        assertEq(r.weightBps, 300);
    }

    function test_mintRod_wrongPayment_reverts() public {
        uint256 price = rod.mintPriceWei(FishingRod.RodType.Driftwood);
        vm.prank(alice);
        vm.expectRevert(FishingRod.IncorrectPayment.selector);
        rod.mintRod{value: price - 1}(FishingRod.RodType.Driftwood);
    }

    // ─── Durability ─────────────────────────────────────
    function test_consumeDurability_onlyGameContract() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        vm.prank(alice);
        vm.expectRevert(FishingRod.Unauthorized.selector);
        rod.consumeDurability(tokenId, 10);

        vm.prank(game);
        rod.consumeDurability(tokenId, 10);

        FishingRod.Rod memory r = rod.getRod(tokenId);
        assertEq(r.durability, 90);
    }

    // ─── Repair ─────────────────────────────────────────
    function test_repairPartial_invalidAmount_reverts() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        vm.prank(alice);
        vm.expectRevert(FishingRod.InvalidRepairAmount.selector);
        rod.repairPartial(tokenId, 11);
    }

    function test_repairPartial_usesRepairToken() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        vm.prank(game);
        rod.consumeDurability(tokenId, 60);

        uint256 cost = rod.partialRepairCost(tokenId, 25);
        uint256 balanceBefore = repairToken.balanceOf(alice);

        vm.prank(alice);
        rod.repairPartial(tokenId, 25);

        uint256 balanceAfter = repairToken.balanceOf(alice);
        assertEq(balanceBefore - balanceAfter, cost);

        FishingRod.Rod memory r = rod.getRod(tokenId);
        assertEq(r.durability, 65);
    }

    // ─── Upgrade (request) ──────────────────────────────
    function test_upgrade_setsPendingRequest() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        uint256 fee = rod.upgradeFeeWei(0);
        vm.prank(alice);
        uint256 requestId = rod.upgrade{value: fee}(tokenId);

        assertEq(requestId, 1);
        assertEq(rod.pendingUpgradeRequestId(tokenId), requestId);

        (uint256 reqTokenId, address requester) = rod.upgradeRequests(requestId);
        assertEq(reqTokenId, tokenId);
        assertEq(requester, alice);
    }

    function test_upgrade_inProgress_reverts() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        uint256 fee = rod.upgradeFeeWei(0);
        vm.prank(alice);
        rod.upgrade{value: fee}(tokenId);

        vm.prank(alice);
        vm.expectRevert(FishingRod.UpgradeInProgress.selector);
        rod.upgrade{value: fee}(tokenId);
    }

    // ─── Upgrade (fulfill) ──────────────────────────────
    // level=0 的成功率是 100%，因此通过 randomWords[0]=0 保证成功；
    // randomWords[1] 选中 Speed（<2500），randomWords[2] 选中 delta=600（level=0 时 5000~7499）
    function test_upgrade_fulfill_success_increasesLevelAndStat() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        uint256 fee = rod.upgradeFeeWei(0);
        vm.prank(alice);
        uint256 requestId = rod.upgrade{value: fee}(tokenId);

        FishingRod.Rod memory beforeRod = rod.getRod(tokenId);
        assertEq(beforeRod.level, 0);

        mockVRF.fulfillRandomWords(requestId, _randomWords3(0, 1000, 5000));

        FishingRod.Rod memory afterRod = rod.getRod(tokenId);
        assertEq(afterRod.level, 1);
        assertEq(afterRod.speedBps, beforeRod.speedBps + 600);
        assertEq(rod.pendingUpgradeRequestId(tokenId), 0);
    }

    // 先升到 level=1（用必成功的 level=0 升级），再测试 level=1 的失败路径：
    // randomWords[0]=9000，level=1 成功率 8500 bps，因此会失败且保持等级/属性不变
    function test_upgrade_fulfill_failure_keepsLevel() public {
        uint256 tokenId = _mintRodAsAlice(FishingRod.RodType.Driftwood);

        uint256 fee0 = rod.upgradeFeeWei(0);
        vm.prank(alice);
        uint256 requestId1 = rod.upgrade{value: fee0}(tokenId);
        mockVRF.fulfillRandomWords(requestId1, _randomWords3(0, 1000, 5000));

        FishingRod.Rod memory beforeRod = rod.getRod(tokenId);
        assertEq(beforeRod.level, 1);

        uint256 fee1 = rod.upgradeFeeWei(1);
        vm.prank(alice);
        uint256 requestId2 = rod.upgrade{value: fee1}(tokenId);

        mockVRF.fulfillRandomWords(requestId2, _randomWords3(9000, 1000, 5000));

        FishingRod.Rod memory afterRod = rod.getRod(tokenId);
        assertEq(afterRod.level, 1);
        assertEq(afterRod.speedBps, beforeRod.speedBps);
        assertEq(rod.pendingUpgradeRequestId(tokenId), 0);
    }
}
