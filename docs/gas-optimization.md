# Gas Optimization

## Overview

This document records gas costs for key operations across the DeepCast contract system and explains the optimization techniques applied.

---

## PredictionMarket.sol — Gas Report

Measured with `forge test --match-contract PredictionMarket --gas-report` (Solc 0.8.35, `via_ir = true`, `optimizer_runs = 200`).

### Deployment

| Metric | Value |
|---|---|
| Deployment Cost | 1,174,963 gas |
| Contract Size | 5,285 bytes (limit: 24,576 bytes) — **21% of limit** |

### Core Functions

| Function | Min | Avg | Median | Max | Notes |
|---|---|---|---|---|---|
| `openBetting` | 23,724 | 77,585 | 77,951 | 77,951 | Cold call reads FishingGame twice |
| `placeBet` | 29,392 | 110,358 | 111,332 | 116,952 | Writes 3 storage slots; first call more expensive |
| `settleBets` | 28,592 | 92,312 | 93,197 | 93,228 | Reads all 4 players from FishingGame; sends platform fee |
| `claimPrize` | 31,211 | 54,927 | 68,849 | 68,849 | Single storage write + ETH transfer |
| `getOdds` | 37,437 | 37,517 | 37,557 | 37,557 | View only — free off-chain |
| `getMarketInfo` | 9,249 | 9,249 | 9,249 | 9,249 | View only — free off-chain |
| `calcTimeWeight` | 320 | 357 | 320 | 409 | Pure function, minimal gas |
| `pause` / `unpause` | 23,630 | 26,994 | — | 27,835 | One storage slot flip |

### Cost in USD (estimate at 10 gwei, ETH = $3,000)

| Operation | Gas | Cost (USD) |
|---|---|---|
| Deploy contract | 1,174,963 | ~$0.035 |
| Open betting | 77,951 | ~$0.002 |
| Place a bet | 111,332 | ~$0.003 |
| Settle market | 93,197 | ~$0.003 |
| Claim prize | 68,849 | ~$0.002 |

All core user operations cost under **$0.01** at typical Sepolia/mainnet conditions.

---

## Optimization Techniques Applied

### 1. `via_ir` + Optimizer (200 runs)

Enabled in `foundry.toml`:
```toml
via_ir = true
optimizer = true
optimizer_runs = 200
```

`via_ir` compiles through the Yul intermediate representation, enabling more aggressive stack and memory optimizations. This resolves the "stack too deep" error in `FishingGame.sol` without any code restructuring, and produces tighter bytecode across both contracts.

`optimizer_runs = 200` is calibrated for contracts deployed once but called many times — it favors runtime gas over deployment gas.

### 2. Custom Errors Instead of Revert Strings

```solidity
// ❌ Expensive — stores and returns string
require(market.bettingOpen, "Betting is not open");

// ✅ Cheap — 4-byte selector only
if (!market.bettingOpen) revert BettingNotOpen();
```

Custom errors save approximately **200–500 gas per revert** compared to string messages, and improve ABI clarity for frontend error handling.

### 3. Storage Layout — Packed Struct

`MarketInfo` is designed to minimize storage slots:

```solidity
struct MarketInfo {
    uint256 openedAt;    // slot 0
    uint256 totalPool;   // slot 1
    uint256 settledAt;   // slot 2
    address winner;      // slot 3 (20 bytes)
    bool bettingOpen;    // slot 3 (1 byte, packed with winner)
    uint8 playerCount;   // slot 3 (1 byte, packed)
}
```

`winner` (address, 20 bytes), `bettingOpen` (bool, 1 byte), and `playerCount` (uint8, 1 byte) share a single 32-byte storage slot, saving 2 SSTORE operations on settlement.

### 4. `immutable` for FishingGame Address

```solidity
IFishingGame public immutable fishingGame;
```

`immutable` variables are baked into the contract bytecode at deployment. Reading `fishingGame` costs **~97 gas** (PUSH from bytecode) instead of **~2,100 gas** (SLOAD from cold storage), saving ~2,000 gas on every function that references the FishingGame contract.

### 5. Early Revert Ordering (Checks-Effects-Interactions)

Reverts are ordered from cheapest to most expensive:

```solidity
// Cheapest check first (local storage read)
if (market.settledAt != 0) revert AlreadySettled();
// Then slightly more expensive
if (!market.bettingOpen)   revert BettingNotOpen();
// External call last (most expensive)
if (status != 2) revert GameNotFinished();
```

Failed transactions from common errors (e.g., betting after settlement) pay minimal gas.

### 6. `uint8` for Loop Counters Over Players

Player counts are bounded at 4 (defined in FishingGame). Using `uint8` for loop counters (`for (uint8 i = 0; i < playerCount; i++)`) avoids unnecessary type conversions and keeps the loop lightweight. With `via_ir`, the optimizer further collapses these small loops.

### 7. View Functions Are Gas-Free Off-Chain

`getOdds`, `getMarketInfo`, and `calcTimeWeight` are `view` / `pure`. The frontend calls these off-chain via `eth_call`, which costs **0 gas** to the user. Only state-changing functions consume gas.

---

## FishingGame.sol — Key Gas Considerations

| Operation | Approx. Gas | Notes |
|---|---|---|
| `createRoom` | ~200,000 | Initializes full Room struct with mappings |
| `joinRoom` | ~60,000 | Writes player data to room mapping |
| `startGame` | ~30,000 | Single status flip |
| `cast` | ~90,000 | VRF request (includes Chainlink coordinator call) |
| `recast` | ~95,000 | VRF request + additional bet storage write |
| `lockIn` | ~50,000–400,000 | Higher when triggering `_settleGame` for 4 players |
| `forceComplete` | ~150,000–400,000 | Depends on how many players need auto lock-in |

VRF callback (`fulfillRandomWords`) is paid by the Chainlink subscription, not by the player.

---

## Summary

The PredictionMarket contract achieves low per-operation costs through custom errors, struct packing, `immutable` references, and `via_ir` optimization. All core spectator actions (bet, settle, claim) are under 120,000 gas, making the platform accessible even during moderate network congestion.
