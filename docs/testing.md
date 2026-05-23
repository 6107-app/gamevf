# Testing Documentation

## Overview

The project uses [Foundry](https://book.getfoundry.sh/) for smart contract testing. All tests are written in Solidity using the `forge-std` testing framework.

**Total: 75 tests | 3 test suites | All passing**

---

## Test Suites

### 1. FishingGame Tests (`test/FishingGame.t.sol`)

Tests the core game contract covering room management, gameplay mechanics, VRF integration, and settlement.

| Test | Description | Gas |
|------|-------------|-----|
| `test_createRoom_success` | Creates a Bronze room with correct entry fee, verifies room state | 364,970 |
| `test_createRoom_incrementsRoomCount` | Room count increments after creation | 696,550 |
| `test_createRoom_wrongFee_reverts` | Reverts with `IncorrectFee` when sending wrong ETH amount | 46,954 |
| `test_joinRoom_success` | Player joins an existing room, player count increases | 572,856 |
| `test_joinRoom_wrongFee_reverts` | Reverts when joining with incorrect fee | 390,735 |
| `test_joinRoom_alreadyInRoom_reverts` | Reverts with `AlreadyInRoom` for duplicate joins | 390,859 |
| `test_joinRoom_roomFull_reverts` | Reverts with `RoomFull` when 4 players already joined | 1,029,617 |
| `test_startGame_success` | Host starts the game, status transitions to Active | 645,421 |
| `test_startGame_notHost_reverts` | Reverts with `NotHost` when non-host tries to start | 583,109 |
| `test_startGame_notEnoughPlayers_reverts` | Reverts with `NotEnoughPlayers` for single-player start | 376,901 |
| `test_cast_success` | Player casts a line, VRF request is sent | 1,158,909 |
| `test_cast_notActive_reverts` | Reverts when casting in non-active room | 372,748 |
| `test_castAndFulfill` | Full cast + VRF fulfillment flow, fish result is stored | 1,310,162 |
| `test_castWithRodImprovesScore` | Rod bonuses improve the fishing score | 2,757,485 |
| `test_lockIn` | Player locks in their catch | 1,392,915 |
| `test_lockIn_noFish_reverts` | Reverts with `NoFishCaught` when locking without a fish | 1,093,242 |
| `test_recast` | Player recasts with fee, gets dice modifier | 1,537,944 |
| `test_recast_maxReached_reverts` | Reverts with `MaxRecastReached` after 3 recasts | 1,997,889 |
| `test_fullGameSettlement` | Complete 4-player game from creation to settlement with prize distribution | - |

### 2. FishingRod Tests (`test/FishingRod.t.sol`)

Tests the NFT rod contract covering minting, durability, repair, and upgrade mechanics.

| Test | Description | Gas |
|------|-------------|-----|
| `test_mintRod_success` | Mints a Driftwood rod, verifies initial attributes (Speed 300bps, Weight 300bps) | 139,924 |
| `test_mintRod_tidebreaker` | Mints a Tidebreaker rod with correct type and stats | 129,914 |
| `test_mintRod_leviathan` | Mints a Leviathan rod with correct type | 129,929 |
| `test_mintRod_abyssWhisper` | Mints an AbyssWhisper rod with correct type | 129,953 |
| `test_mintRod_wrongPayment_reverts` | Reverts with `IncorrectPayment` for wrong mint price | 49,857 |
| `test_consumeDurability_onlyGameContract` | Only the game contract can consume durability | 191,591 |
| `test_consumeDurability_toZero` | Durability can be consumed to zero | 165,974 |
| `test_repairPartial_invalidAmount_reverts` | Reverts with `InvalidRepairAmount` for invalid amounts | 150,435 |
| `test_repairPartial_usesRepairToken` | Partial repair deducts ERC20 tokens and restores durability | 274,676 |
| `test_repairFull` | Full repair restores durability to max | 236,741 |
| `test_getRodBonus` | Returns correct speed, weight, luck bonuses | - |
| `test_mintPriceWei` | Higher tier rods cost more | - |
| `test_upgradeFeeWei` | Higher level upgrades cost more | - |
| `test_upgrade_notOwner_reverts` | Reverts with `NotTokenOwner` when non-owner upgrades | 169,298 |
| `test_upgrade_setsPendingRequest` | Upgrade sends VRF request and stores pending state | 303,026 |
| `test_upgrade_inProgress_reverts` | Reverts with `UpgradeInProgress` for duplicate upgrades | 329,764 |
| `test_upgrade_fulfill_success_increasesLevelAndStat` | Successful upgrade increases level and a random stat | 356,047 |
| `test_upgrade_fulfill_failure_keepsLevel` | Failed upgrade keeps level and stats unchanged | 540,296 |

### 3. PredictionMarket Tests (`test/PredictionMarket.t.sol`)

Tests the spectator betting system covering bet placement, settlement, and claim mechanics.

**38 tests covering:** bet placement, time-weighted odds, multi-player scenarios, claim windows, pause/unpause, edge cases.

---

## Test Coverage

| Contract | Lines | Statements | Branches | Functions |
|----------|-------|------------|----------|-----------|
| **FishingGame.sol** | 90.53% (239/264) | 82.44% (277/336) | 44.12% (30/68) | 95.65% (22/23) |
| **FishingRod.sol** | 68.29% (140/205) | 56.32% (156/277) | 27.84% (27/97) | 92.86% (26/28) |
| **PredictionMarket.sol** | 88.04% (81/92) | 88.33% (106/120) | 80.95% (17/21) | 86.67% (13/15) |
| **Total (src/)** | 77.54% | 70.05% | 36.82% | 85.88% |

---

## Gas Report

### FishingGame Contract

| Function | Min | Avg | Median | Max |
|----------|-----|-----|--------|-----|
| `createRoom` | 29,431 | 319,123 | 333,167 | 339,181 |
| `joinRoom` | 31,055 | 192,143 | 206,884 | 210,110 |
| `startGame` | 23,765 | 64,097 | 71,731 | 71,743 |
| `cast` | 23,953 | 95,939 | 96,498 | 153,935 |
| `recast` | 35,612 | 107,739 | 117,221 | 134,321 |
| `lockIn` | 30,394 | 77,275 | 73,234 | 140,322 |
| `getRoomInfo` | 13,612 | 13,612 | 13,612 | 13,612 |
| `getPlayerInfo` | 15,799 | 15,799 | 15,799 | 15,799 |

**Deployment Cost:** 3,797,567 gas (15,250 bytes)

### Estimated Full Game Cost (4 players)

| Action | Gas |
|--------|-----|
| createRoom | ~333,000 |
| joinRoom x3 | ~630,000 |
| startGame | ~72,000 |
| cast x4 | ~384,000 |
| lockIn x4 | ~292,000 |
| **Total** | **~1,711,000** |

At 2.5 gwei gas price: ~0.004 ETH per full game.

---

## Gas Optimizations Applied

1. **Custom Errors** - Used throughout instead of `require` strings, saving ~50% on revert gas costs
2. **Immutable Variables** - `i_vrfCoordinator` declared as `immutable`, saving ~2,100 gas per read vs storage
3. **Constants** - `MAX_PLAYERS`, `MAX_RECAST`, `PLATFORM_FEE_BPS`, etc. are `constant`, zero storage reads
4. **Storage Packing** - `Player` struct packs four `uint16` rod bonus fields into a single storage slot
5. **ReentrancyGuard** - OpenZeppelin's optimized implementation for reentrancy protection
6. **View Functions** - `getRoomInfo` and `getPlayerInfo` are `view` functions (no gas cost for off-chain calls)

---

## Running Tests

```bash
# Run all tests
forge test

# Run with gas report
forge test --gas-report

# Run coverage (requires --ir-minimum for stack-deep contracts)
forge coverage --ir-minimum

# Run specific test suite
forge test --match-contract FishingGameTest
```
