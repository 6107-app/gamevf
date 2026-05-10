# Fishing Module (Module 1) — Interface Specification

For the Prediction Market module (Module 3) to integrate with our Fishing Game contract.

---

## Events You Can Listen To

### RoomCreated
```solidity
event RoomCreated(
    uint256 indexed roomId,    // unique room ID (uint256)
    address indexed host,      // room creator
    RoomTier tier,             // Bronze/Silver/Gold/Diamond
    bool isPublic,             // true = open room
    uint256 entryFee,          // entry fee in wei
    uint256 timestamp          // block.timestamp when created
);
```

### GameStarted
```solidity
event GameStarted(
    uint256 indexed roomId,
    uint256 timestamp          // block.timestamp when game starts
);
```
Emitted when the host calls `startGame()`. Requires at least 2 players.

### FishCaught
```solidity
event FishCaught(
    uint256 indexed roomId,
    address player,            // who caught it
    uint8 rarity,              // 0=Common, 1=Rare, 2=SuperRare, 3=Epic, 4=Legendary
    uint256 weight,            // in grams (e.g. 1500 = 1.5kg)
    uint256 score,             // calculated score
    uint256 timestamp
);
```
Emitted every time a player catches a fish (initial cast or re-cast).

### PlayerLockedIn
```solidity
event PlayerLockedIn(
    uint256 indexed roomId,
    address player,
    uint256 finalScore         // player's final locked-in score
);
```

### GameSettled
```solidity
event GameSettled(
    uint256 indexed roomId,
    address[3] winners,        // top 3 players by score
    uint256[3] prizes,         // prize amounts in wei
    uint256[4] finalScores     // all 4 players' scores (by player index)
);
```
Emitted when all players lock in. This is your settlement trigger.

---

## Key Data Types

| Field | Type | Notes |
|-------|------|-------|
| roomId | `uint256` | Auto-incrementing, starts from 0 |
| RoomTier | `enum` | 0=Bronze, 1=Silver, 2=Gold, 3=Diamond |
| RoomStatus | `enum` | 0=Waiting, 1=Active, 2=Finished |
| Rarity | `enum` | 0=Common, 1=Rare, 2=SuperRare, 3=Epic, 4=Legendary |

## Entry Fees by Tier

| Tier | Entry Fee | Re-cast Fee |
|------|-----------|-------------|
| Bronze | 0.01 ETH | 0.01 ETH |
| Silver | 0.05 ETH | 0.05 ETH |
| Gold | 0.1 ETH | 0.1 ETH |
| Diamond | 0.5 ETH | 0.5 ETH |

---

## View Functions You Can Call

### getRoomInfo
```solidity
function getRoomInfo(uint256 roomId) external view returns (
    uint256 id,
    RoomTier tier,
    RoomStatus status,
    uint8 playerCount,
    uint256 entryFee,
    uint256 totalPot,
    bool isPublic,
    bool isLivestream,
    address host
);
```

### getPlayerInfo
```solidity
function getPlayerInfo(uint256 roomId, uint256 playerIdx) external view returns (
    address addr,
    PlayerStatus status,
    uint8 rarity,
    uint256 weight,
    uint256 fishingTime,
    uint256 score,
    uint256 recastCount,
    uint256 totalBet
);
```

---

## Game Flow (for your reference)

1. Host calls `createRoom(tier, isPublic, isLivestream)` → **RoomCreated**
2. Players call `joinRoom(roomId)` → **PlayerJoined**
3. Host calls `startGame(roomId)` → **GameStarted** (your prediction market can open bets here)
4. Players call `cast(roomId)` → VRF request → **FishCaught** (live score updates)
5. Players can `recast(roomId)` up to 3 times → new **FishCaught** with updated score
6. Players call `lockIn(roomId)` → **PlayerLockedIn**
7. When all players lock in → **GameSettled** (your prediction market settles here)

---

## Prize Distribution

| Place | Share |
|-------|-------|
| 1st | 60% |
| 2nd | 25% |
| 3rd | 10% |
| Platform | 5% |

Last place gets nothing.
