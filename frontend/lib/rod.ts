/**
 * 鱼竿系统数据模型与常量
 */
export type RodType = "Driftwood" | "Tidebreaker" | "Leviathan" | "AbyssWhisper";
export type Rarity = "Common" | "Rare" | "SuperRare" | "Epic" | "Legendary";

export interface RodData {
  tokenId: number;
  type: RodType;
  rarity: Rarity;
  level: number; // 0..5
  durability: number; // 0..maxDurability
  maxDurability: number;
  owner: string;
  purchasedAt: number;
  upgradedAt?: number;
  attributes: {
    speedBps: number;
    weightBps: number;
    luckBps: number;
    stabilityBps?: number;
    // Percent-style UI bonuses (derived from bps on-chain)
    speedBonus?: number;
    weightBonus?: number;
    luckBonus?: number;
  };
}

export const ROD_TYPES: Record<RodType, { name: string; icon: string; description: string }> = {
  Driftwood: {
    name: "Driftwood Rod（流木竿）",
    icon: "🎣",
    description: "common 级鱼竿，起始价格 0.01 ETH，初始属性为 Speed +3% / Weight +3%",
  },
  Tidebreaker: {
    name: "Tidebreaker Rod（破潮竿）",
    icon: "⚡",
    description: "rare 级鱼竿，起始价格 0.05 ETH，初始属性为 Speed +10% / Weight +2%",
  },
  Leviathan: {
    name: "Leviathan Rod（海兽竿）",
    icon: "💪",
    description: "super rare 级鱼竿，起始价格 0.08 ETH，初始属性为 Luck +5% / Stability +2%",
  },
  AbyssWhisper: {
    name: "Abyss Whisper Rod（深渊低语）",
    icon: "✨",
    description: "epic 级鱼竿，起始价格 0.15 ETH，初始属性为 Luck +10% / Stability +5%",
  },
};

// Frontend-specific rod configs: initial prices (ETH) and base repair tables per level
export const ROD_CONFIG: Record<RodType, { basePriceEth: number; baseRepairCosts: number[]; initialAttributes: { speed?: number; weight?: number; luck?: number; stability?: number } }> = {
  Driftwood: { basePriceEth: 0.01, baseRepairCosts: [20, 26, 34, 46, 64, 90], initialAttributes: { speed: 3, weight: 3 } },
  Tidebreaker: { basePriceEth: 0.05, baseRepairCosts: [45, 59, 77, 104, 144, 203], initialAttributes: { speed: 10, weight: 2 } },
  Leviathan: { basePriceEth: 0.08, baseRepairCosts: [70, 91, 119, 161, 224, 315], initialAttributes: { luck: 5, stability: 2 } },
  AbyssWhisper: { basePriceEth: 0.15, baseRepairCosts: [120, 156, 204, 276, 384, 540], initialAttributes: { luck: 10, stability: 5 } },
};

// Upgrade fee table (ETH) for levels +0->+1 ... +4->+5
export const UPGRADE_FEES_ETH = [0.01, 0.03, 0.06, 0.12, 0.25];

// Attribute appearance probabilities (percent)
export const ATTRIBUTE_PROBABILITIES: Record<string, number> = {
  Speed: 25,
  Weight: 25,
  Luck: 20,
  Stability: 30,
};

// Increment probability tables per upgrade step (values are percent increases)
export const INCREMENT_TABLES: Record<number, Array<{ value: number; weight: number }>> = {
  // +0 -> +1
  0: [ { value: 5, weight: 50 }, { value: 6, weight: 25 }, { value: 7, weight: 15 }, { value: 8, weight: 8 }, { value: 10, weight: 2 } ],
  // +1 -> +2
  1: [ { value: 5, weight: 40 }, { value: 6, weight: 30 }, { value: 7, weight: 15 }, { value: 9, weight: 10 }, { value: 12, weight: 5 } ],
  // +2 -> +3
  2: [ { value: 5, weight: 35 }, { value: 7, weight: 30 }, { value: 9, weight: 20 }, { value: 12, weight: 10 }, { value: 15, weight: 5 } ],
  // +3 -> +4
  3: [ { value: 5, weight: 50 }, { value: 8, weight: 25 }, { value: 10, weight: 15 }, { value: 12, weight: 8 }, { value: 15, weight: 2 } ],
  // +4 -> +5
  4: [ { value: 5, weight: 65 }, { value: 7, weight: 20 }, { value: 10, weight: 10 }, { value: 15, weight: 5 } ],
};

export function getUpgradeFeeLocal(level: number) {
  return UPGRADE_FEES_ETH[level] ?? null;
}

export function getFullRepairCostLocal(type: RodType, level: number) {
  const cfg = ROD_CONFIG[type];
  return cfg.baseRepairCosts[level] ?? cfg.baseRepairCosts[0];
}

// Sample an attribute according to probabilities and increment table for the target level
export function sampleUpgradeResult(currentLevel: number) {
  // Pick attribute by weighted probability
  const attrs = Object.keys(ATTRIBUTE_PROBABILITIES);
  const total = attrs.reduce((s, a) => s + ATTRIBUTE_PROBABILITIES[a], 0);
  let pick = Math.random() * total;
  let chosen = attrs[0];
  for (const a of attrs) {
    pick -= ATTRIBUTE_PROBABILITIES[a];
    if (pick <= 0) { chosen = a; break; }
  }

  // Sample increment based on current level -> next
  const table = INCREMENT_TABLES[currentLevel] || INCREMENT_TABLES[0];
  const wtTotal = table.reduce((s, e) => s + e.weight, 0);
  let p = Math.random() * wtTotal;
  let chosenValue = table[0].value;
  for (const e of table) {
    p -= e.weight;
    if (p <= 0) { chosenValue = e.value; break; }
  }

  return { attribute: chosen, incrementPercent: chosenValue };
}

export const ROD_RARITY_COLORS: Record<Rarity, string> = {
  Common: "#A8A8A8",
  Rare: "#1E90FF",
  SuperRare: "#9932CC",
  Epic: "#FFD700",
  Legendary: "#FF69B4",
};

export const ROD_MAX_LEVEL = 5;
export const ROD_USE_BEFORE_REPAIR = 10; // standard uses before full repair is needed

/**
 * Local approximation of on-chain upgrade success for UI display (contract uses bps table)
 */
export function getUpgradeSuccessRate(currentLevel: number): number {
  const map = { 0: 100, 1: 85, 2: 65, 3: 45, 4: 25 } as Record<number, number>;
  return map[currentLevel] ?? 0;
}

export function calculateRodAttributes(rod: RodData) {
  return {
    speedBps: rod.attributes.speedBps,
    weightBps: rod.attributes.weightBps,
    luckBps: rod.attributes.luckBps,
    stabilityBps: rod.attributes.stabilityBps ?? 0,
  };
}

export function getRodStatus(rod: RodData): "healthy" | "warning" | "critical" {
  const durabilityPercent = (rod.durability / rod.maxDurability) * 100;
  if (durabilityPercent > 50) return "healthy";
  if (durabilityPercent > 20) return "warning";
  return "critical";
}

export function generateMockRods(): RodData[] {
  const now = Date.now();
  return [
    {
      tokenId: 1,
      type: "Driftwood",
      rarity: "Common",
      level: 0,
      maxDurability: 100,
      durability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 7 * 86400000,
      attributes: { speedBps: 300, weightBps: 300, luckBps: 0, stabilityBps: 0, speedBonus: 3, weightBonus: 3, luckBonus: 0 },
    },
    {
      tokenId: 2,
      type: "Tidebreaker",
      rarity: "Rare",
      level: 2,
      maxDurability: 100,
      durability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 3 * 86400000,
      upgradedAt: now - 1 * 86400000,
      attributes: { speedBps: 1000, weightBps: 200, luckBps: 0, stabilityBps: 0, speedBonus: 10, weightBonus: 2, luckBonus: 0 },
    },
    {
      tokenId: 3,
      type: "Leviathan",
      rarity: "Rare",
      level: 1,
      maxDurability: 100,
      durability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 2 * 86400000,
      attributes: { speedBps: 0, weightBps: 500, luckBps: 0, stabilityBps: 200, speedBonus: 0, weightBonus: 5, luckBonus: 0 },
    },
    {
      tokenId: 4,
      type: "AbyssWhisper",
      rarity: "Legendary",
      level: 3,
      maxDurability: 100,
      durability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 10 * 86400000,
      upgradedAt: now - 2 * 86400000,
      attributes: { speedBps: 0, weightBps: 0, luckBps: 1000, stabilityBps: 500, speedBonus: 0, weightBonus: 0, luckBonus: 10 },
    },
  ];
}
