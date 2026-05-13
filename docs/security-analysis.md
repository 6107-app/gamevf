# Security Analysis

## Overview

This document covers the security design and threat model for the DeepCast smart contract system, consisting of `FishingGame.sol` (Module 1) and `PredictionMarket.sol` (Module 3).

---

## FishingGame.sol

### Randomness Manipulation
All random outcomes (fish rarity, weight, fishing time, dice skills, rod upgrades) are sourced exclusively from **Chainlink VRF v2.5**. VRF provides cryptographically verifiable randomness that cannot be predicted or manipulated by players, the house, or miners before the request is fulfilled. The VRF request ID is stored on-chain and matched to the correct room and player index in the callback, preventing request hijacking.

### Reentrancy
The contract inherits OpenZeppelin's `ReentrancyGuard` and applies the `nonReentrant` modifier to all ETH-transferring functions (`createRoom`, `joinRoom`, `recast`). Settlement in `_settleGame` uses `transfer()` for prize payouts, which forwards only 2300 gas and prevents reentrancy from winner callbacks.

### Access Control
- `startGame` is restricted to the room host via explicit `msg.sender == room.host` check.
- `setRodContract` is restricted to the contract owner via `owner()` from Chainlink's `ConfirmedOwner`.
- `forceComplete` is permissionless by design — any caller can trigger a timeout after 180 seconds, preventing griefing by unresponsive players.

### Front-Running
Player actions (cast, recast, lockIn) do not reveal information that could be exploited by front-runners, because the fish outcome is determined by VRF after the transaction is mined. A front-runner who sees a `cast()` transaction in the mempool gains no advantage — the fish result is not known until VRF responds.

### Integer Overflow / Underflow
Solidity 0.8.x has built-in overflow/underflow protection. All arithmetic reverts automatically on overflow.

### Known Limitations
- `block.timestamp` is used for the 180-second game timeout (`forceComplete`). Validators can manipulate timestamp by up to ~12 seconds, which is acceptable for a 180-second window and does not affect game fairness.

---

## PredictionMarket.sol

### Reentrancy
All ETH-transferring functions (`settleBets`, `claimPrize`, `withdrawUnclaimed`) use:
1. OpenZeppelin `ReentrancyGuard` (`nonReentrant` modifier)
2. **Checks-Effects-Interactions** pattern strictly — state is updated before any `.call{value}()` transfer

Example from `claimPrize`:
```solidity
// Effects — update state BEFORE interaction
hasClaimed[roomId][msg.sender] = true;

// Interaction — send ETH after state is committed
(bool ok, ) = msg.sender.call{value: payout}("");
if (!ok) revert TransferFailed();
```

This ensures that even if the recipient is a malicious contract that re-enters `claimPrize`, the `hasClaimed` flag is already set and the second call will revert with `AlreadyClaimed`.

### Oracle / Winner Manipulation
`PredictionMarket` reads the winner directly from `FishingGame` by calling `getPlayerInfo()` for all players and finding the highest score. This is trustless — no oracle, no admin, and no off-chain relay is required. The winner is determined by the same on-chain state that governs the game itself.

The settlement function (`settleBets`) is permissionless: any address can call it once the `FishingGame` room status is `Finished (2)`. This prevents the platform from withholding settlement to manipulate outcomes.

### Double-Claim Prevention
Each bettor's claim status is tracked in `hasClaimed[roomId][bettor]`. Attempting a second claim reverts with `AlreadyClaimed` before any ETH is transferred.

### Invalid Player Bets
`placeBet` calls `_isPlayerInRoom()`, which iterates over all players in the room via `fishingGame.getPlayerInfo()` and verifies that the predicted winner address is a genuine participant. Bets on non-participant addresses revert with `InvalidPlayer`.

### Minimum Bet Enforcement
A `MIN_BET` of 0.001 ETH prevents dust attacks and spam bets that could bloat the weighted-bet mappings with negligible amounts.

### Emergency Pause
The contract inherits OpenZeppelin `Pausable`. The owner can call `pause()` to immediately halt `openBetting`, `placeBet`, `settleBets`, and `claimPrize` in the event of a critical vulnerability or market manipulation incident. Only `withdrawUnclaimed` (owner-only) remains available during pause for fund recovery.

### Claim Window
`claimPrize` enforces a 30-day claim window after settlement (`CLAIM_WINDOW = 30 days`). After expiry, `withdrawUnclaimed()` (owner-only) allows recovery of abandoned funds. This prevents ETH from being permanently locked in the contract.

### Time-Weight Manipulation
The time-weight formula uses `block.timestamp - market.openedAt`. A validator could theoretically manipulate timestamp by ~12 seconds to gain a marginally higher weight. Given that the weight formula produces integer values between 10 and 100 over a 180-second window, a 12-second manipulation shifts weight by at most `(12 × 90) / 180 = 6 points`, which is an acceptable risk for a prediction market context.

### Unclaimed Funds Lock
If no bettor correctly predicted the winner, `totalWeightedBetsOnPlayer[roomId][winner]` is zero. In this case, `claimPrize` reverts for everyone (`NothingToClaim`). The entire pool (minus platform fee) remains in the contract and can be recovered by the owner via `withdrawUnclaimed()` after the claim window expires.

---

## General Security Practices

| Practice | Applied In |
|---|---|
| Checks-Effects-Interactions | `PredictionMarket`: `settleBets`, `claimPrize` |
| ReentrancyGuard | Both contracts |
| Custom errors (gas-efficient reverts) | Both contracts |
| Emergency pause | `PredictionMarket` |
| Chainlink VRF for randomness | `FishingGame` |
| OpenZeppelin Contracts 5.x | Both contracts |
| Solidity 0.8.x (built-in overflow protection) | Both contracts |

---

## Static Analysis

Slither should be run against both contracts prior to deployment:

```bash
pip install slither-analyzer
slither contracts/src/FishingGame.sol
slither contracts/src/PredictionMarket.sol
```

Known acceptable warnings:
- `block.timestamp` usage — reviewed and accepted (see above)
- Unsafe typecasts in `FishingGame` sorting loop — safe by construction (bounded loop index)
