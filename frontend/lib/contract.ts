import { ethers } from "ethers";

// Deploy后填入实际地址（Sepolia测试网）
export const FISHING_GAME_ADDRESS = 
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 
  "0x0000000000000000000000000000000000000000";

export const FISHING_GAME_ABI = [
  "function roomCount() view returns (uint256)",
  "function entryFees(uint8 tier) view returns (uint256)",
  "function recastFees(uint8 tier) view returns (uint256)",

  "function getRoomInfo(uint256 roomId) view returns (uint256 id, uint8 tier, uint8 status, uint8 playerCount, uint256 entryFee, uint256 totalPot, bool isPublic, bool isLivestream, address host)",
  "function getPlayerInfo(uint256 roomId, uint256 playerIdx) view returns (address addr, uint8 status, uint8 rarity, uint256 weight, uint256 fishingTime, uint256 score, uint256 recastCount, uint256 totalBet)",

  "function createRoom(uint8 tier, bool isPublic, bool isLivestream) payable returns (uint256 roomId)",
  "function joinRoom(uint256 roomId) payable",
  "function startGame(uint256 roomId)",
  "function cast(uint256 roomId, uint256 rodTokenId)",
  "function lockIn(uint256 roomId)",
  "function recast(uint256 roomId, uint256 rodTokenId) payable",
  "function forceComplete(uint256 roomId)",

  "event RoomCreated(uint256 indexed roomId, address indexed host, uint8 tier, bool isPublic, uint256 entryFee, uint256 timestamp)",
  "event PlayerJoined(uint256 indexed roomId, address indexed player, uint256 playerIndex)",
  "event GameStarted(uint256 indexed roomId, uint256 timestamp)",
  "event CastRequested(uint256 indexed roomId, address player, uint256 requestId)",
  "event FishCaught(uint256 indexed roomId, address player, uint8 rarity, uint256 weight, uint256 score, uint256 timestamp)",
  "event PlayerLockedIn(uint256 indexed roomId, address player, uint256 finalScore)",
  "event RecastStarted(uint256 indexed roomId, address player, uint256 recastNumber)",
  "event DiceRolled(uint256 indexed roomId, address player, int256 diceModifier)",
  "event GameSettled(uint256 indexed roomId, address[3] winners, uint256[3] prizes, uint256[4] finalScores)",
] as const;

export const TIER_NAMES = ["Bronze", "Silver", "Gold", "Diamond"] as const;
export type RoomTier = (typeof TIER_NAMES)[number];
export const TIER_ENTRY_FEES: Record<RoomTier, string> = {
  Bronze: "0.01",
  Silver: "0.05",
  Gold: "0.10",
  Diamond: "0.50",
};

export const ROOM_STATUS = ["Waiting", "Active", "Finished"] as const;
export const PLAYER_STATUS = ["Fishing", "LockedIn", "Recast"] as const;
export const RARITY_NAMES = ["Common", "Rare", "SuperRare", "Epic", "Legendary"] as const;

export function requiredRodLevelForTier(tier: RoomTier): number {
  if (tier === "Bronze") return 0;
  if (tier === "Silver") return 1;
  if (tier === "Gold") return 2;
  return 3;
}

export function getContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(FISHING_GAME_ADDRESS, FISHING_GAME_ABI, signerOrProvider);
}
