/**
 * 鱼竿系统数据模型与常量
 */

export type RodType = "Standard" | "Speed" | "Heavy" | "Lucky";
export type Rarity = "Common" | "Rare" | "SuperRare" | "Epic" | "Legendary";

export interface RodData {
  tokenId: number;
  type: RodType;
  rarity: Rarity;
  level: number;  // +0 ~ +5
  durability: number;  // 0 ~ 100
  maxDurability: number;
  owner: string;
  purchasedAt: number;
  upgradedAt?: number;
  attributes: {
    speedBonus: number;  // 百分比 (e.g., -15 means 15% faster)
    weightBonus: number;  // 百分比 (e.g., +20 means 20% heavier)
    luckBonus: number;  // 百分比 (e.g., +10 means 10% rarity boost)
  };
}

export const ROD_TYPES: Record<RodType, {
  name: string;
  icon: string;
  description: string;
  basePrice?: number;
  rarity: Rarity;
}> = {
  Standard: {
    name: "标准竿",
    icon: "🎣",
    description: "新手入门，无特殊加成，初始有10次免费使用机会",
    basePrice: 0,
    rarity: "Common",
  },
  Speed: {
    name: "速度竿",
    icon: "⚡",
    description: "钓鱼时间 -15%，时间系数加成更高",
    basePrice: 0.05,
    rarity: "Rare",
  },
  Heavy: {
    name: "重量竿",
    icon: "💪",
    description: "钓上鱼的重量区间整体 +20%",
    basePrice: 0.05,
    rarity: "Rare",
  },
  Lucky: {
    name: "幸运竿",
    icon: "✨",
    description: "稀有度概率整体提升一档，空杆概率 -30%",
    basePrice: 0.2,
    rarity: "Legendary",
  },
};

export const ROD_RARITY_COLORS: Record<Rarity, string> = {
  Common: "#A8A8A8",
  Rare: "#1E90FF",
  SuperRare: "#9932CC",
  Epic: "#FFD700",
  Legendary: "#FF69B4",
};

export const ROD_MAX_LEVEL = 5;
export const ROD_USE_BEFORE_REPAIR = 10;  // 10次使用后需要维护

export const REPAIR_FEES: Record<number, number> = {
  0: 0.01,   // +0 级：0.01 ETH
  1: 0.02,   // +1 级：0.02 ETH
  2: 0.03,   // +2 级：0.03 ETH
  3: 0.05,   // +3 级：0.05 ETH
  4: 0.08,   // +4 级：0.08 ETH
  5: 0.15,   // +5 级：0.15 ETH
};

export const UPGRADE_FEES: Record<number, number> = {
  0: 0.02,   // +0 → +1：0.02 ETH
  1: 0.03,   // +1 → +2：0.03 ETH
  2: 0.05,   // +2 → +3：0.05 ETH
  3: 0.08,   // +3 → +4：0.08 ETH
  4: 0.15,   // +4 → +5：0.15 ETH
};

/**
 * 根据等级返回升级成功率（百分比）
 */
export function getUpgradeSuccessRate(currentLevel: number): number {
  const rates: Record<number, number> = {
    0: 80,  // +0 → +1: 80%
    1: 75,  // +1 → +2: 75%
    2: 70,  // +2 → +3: 70%
    3: 60,  // +3 → +4: 60%
    4: 50,  // +4 → +5: 50%
  };
  return rates[currentLevel] || 0;
}

/**
 * 根据鱼竿数据计算当前属性
 */
export function calculateRodAttributes(rod: RodData) {
  const base = rod.attributes;
  const levelBonus = rod.level * 2;  // 每升一级，属性提升2%

  return {
    speedBonus: base.speedBonus - (levelBonus * 0.5),
    weightBonus: base.weightBonus + (levelBonus * 0.3),
    luckBonus: base.luckBonus + (levelBonus * 0.2),
  };
}

/**
 * 获取鱼竿的状态信息
 */
export function getRodStatus(rod: RodData): "healthy" | "warning" | "critical" {
  const durabilityPercent = (rod.durability / rod.maxDurability) * 100;
  if (durabilityPercent > 50) return "healthy";
  if (durabilityPercent > 20) return "warning";
  return "critical";
}

/**
 * 生成 Mock 鱼竿数据
 */
export function generateMockRods(): RodData[] {
  const now = Date.now();
  return [
    {
      tokenId: 1,
      type: "Standard",
      rarity: "Common",
      level: 0,
      durability: 80,
      maxDurability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 7 * 24 * 60 * 60 * 1000,  // 7 days ago
      attributes: {
        speedBonus: 0,
        weightBonus: 0,
        luckBonus: 0,
      },
    },
    {
      tokenId: 2,
      type: "Speed",
      rarity: "Rare",
      level: 2,
      durability: 45,
      maxDurability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 3 * 24 * 60 * 60 * 1000,  // 3 days ago
      upgradedAt: now - 1 * 24 * 60 * 60 * 1000,   // 1 day ago
      attributes: {
        speedBonus: -15,
        weightBonus: 0,
        luckBonus: 0,
      },
    },
    {
      tokenId: 3,
      type: "Heavy",
      rarity: "Rare",
      level: 1,
      durability: 92,
      maxDurability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 2 * 24 * 60 * 60 * 1000,  // 2 days ago
      attributes: {
        speedBonus: 0,
        weightBonus: 20,
        luckBonus: 0,
      },
    },
    {
      tokenId: 4,
      type: "Lucky",
      rarity: "Legendary",
      level: 3,
      durability: 15,
      maxDurability: 100,
      owner: "0x1234...5678",
      purchasedAt: now - 10 * 24 * 60 * 60 * 1000,  // 10 days ago
      upgradedAt: now - 2 * 24 * 60 * 60 * 1000,   // 2 days ago
      attributes: {
        speedBonus: 0,
        weightBonus: 0,
        luckBonus: 10,
      },
    },
  ];
}
