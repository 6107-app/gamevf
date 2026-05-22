import { ethers } from "ethers";
import { ROD_CONFIG, UPGRADE_FEES_ETH, getUpgradeFeeLocal, sampleUpgradeResult, type RodData } from "./rod";

export const FISHING_ROD_ADDRESS = process.env.NEXT_PUBLIC_ROD_ADDRESS || "0x0000000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const FISHING_ROD_ABI = [
  "function mintRod(uint8 rodType) payable returns (uint256)",
  "function repairFull(uint256 tokenId) payable",
  "function repairPartial(uint256 tokenId, uint16 restoreDurability) payable",
  "function upgrade(uint256 tokenId) payable returns (uint256)",
  "function getRodBonus(uint256 tokenId) view returns (uint256 speedBonus, uint256 weightBonus, uint256 luckBonus)",
  "function getRod(uint256 tokenId) view returns (uint8 rodType, uint8 rarity, uint8 level, uint16 durability, uint16 maxDurability, uint16 speedBps, uint16 weightBps, uint16 luckBps, uint16 stabilityBps)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintPriceWei(uint8 rodType) view returns (uint256)",
  "function upgradeFeeWei(uint8 currentLevel) view returns (uint256)",
  "function fullRepairCost(uint256 tokenId) view returns (uint256)",
  "function partialRepairCost(uint256 tokenId, uint16 restoreDurability) view returns (uint256)",
] as const;

// Add commonly used read-only items and event fragments so ethers can subscribe correctly
export const FISHING_ROD_ABI_EXTENDED = [
  ...FISHING_ROD_ABI,
  "function pendingUpgradeRequestId(uint256 tokenId) view returns (uint256)",
  "function repairToken() view returns (address)",
  "event RodMinted(uint256 indexed tokenId, address indexed owner, uint8 rodType, uint8 rarity)",
  "event UpgradeResolved(uint256 indexed tokenId, bool success, uint8 newLevel, uint8 attr, uint16 deltaBps)",
] as const;

export function getFishingRodContract(signerOrProvider: ethers.Signer | ethers.Provider) {
  // Use extended ABI so event fragments and extra view functions are available
  return new ethers.Contract(FISHING_ROD_ADDRESS, FISHING_ROD_ABI_EXTENDED, signerOrProvider as any);
}

export async function getPendingUpgradeRequestId(tokenId: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  try {
    return await c.pendingUpgradeRequestId(tokenId);
  } catch (e) {
    return 0;
  }
}

export async function getRepairTokenAddress(provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  try {
    return await c.repairToken();
  } catch (e) {
    return '0x0000000000000000000000000000000000000000';
  }
}

async function resolveToSigner(signerOrProvider: any): Promise<ethers.Signer> {
  // If it's already a signer (has getAddress/sendTransaction), return it.
  if (!signerOrProvider) {
    // Fallback: create signer from window.ethereum
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const bp = new ethers.BrowserProvider((window as any).ethereum);
      return bp.getSigner();
    }
    throw new Error('No signer or provider available');
  }

  // ethers v6 Signer has getAddress function
  if (typeof signerOrProvider.getAddress === 'function') {
    return signerOrProvider as ethers.Signer;
  }

  // If it's a provider with getSigner(), call it
  if (typeof signerOrProvider.getSigner === 'function') {
    const s = await signerOrProvider.getSigner();
    return s as ethers.Signer;
  }

  // If it's a BrowserProvider-like object, try to construct BrowserProvider
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    const bp = new ethers.BrowserProvider((window as any).ethereum);
    return bp.getSigner();
  }

  throw new Error('Unable to resolve signer from provided argument');
}

export async function getMintPrice(rodType: number, provider: ethers.Provider) {
  // If provider is a read-only provider, try on-chain call; otherwise fallback to frontend config
  try {
    const c = getFishingRodContract(provider);
    return await c.mintPriceWei(rodType);
  } catch (e) {
    const keys = Object.keys(ROD_CONFIG) as Array<keyof typeof ROD_CONFIG>;
    const key = keys[rodType] ?? keys[0];
    const priceEth = ROD_CONFIG[key].basePriceEth;
    return ethers.parseEther(String(priceEth));
  }
}

export async function getRod(tokenId: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  return await c.getRod(tokenId);
}

// Return a frontend-friendly RodData mapped from on-chain tuple
export async function getRodOnChain(tokenId: number, provider: ethers.Provider): Promise<RodData | null> {
  try {
    const c = getFishingRodContract(provider);
    const r = await c.getRod(tokenId);
    // r: [rodType, rarity, level, durability, maxDurability, speedBps, weightBps, luckBps, stabilityBps]
    const typeKey = Object.keys(ROD_CONFIG)[Number(r[0]) || 0] as keyof typeof ROD_CONFIG;
    const speedBps = Number(r[5] || 0);
    const weightBps = Number(r[6] || 0);
    const luckBps = Number(r[7] || 0);
    const stabilityBps = Number(r[8] || 0);
    const mapped: RodData = {
      tokenId: Number(tokenId),
      type: typeKey as any,
      rarity: "Common",
      level: Number(r[2] || 0),
      durability: Number(r[3] || 0),
      maxDurability: Number(r[4] || 0),
      owner: "",
      purchasedAt: Date.now(),
      attributes: {
        speedBps,
        weightBps,
        luckBps,
        stabilityBps,
        speedBonus: Math.round(speedBps / 100),
        weightBonus: Math.round(weightBps / 100),
        luckBonus: Math.round(luckBps / 100),
      } as any,
    } as RodData;
    return mapped;
  } catch (e) {
    return null;
  }
}

export async function getOwnerOf(tokenId: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  return await c.ownerOf(tokenId);
}

// Fetch rods owned by `owner` by scanning token IDs from 1..maxToken (view-only).
export async function fetchRodsForOwner(
  owner: string,
  provider: ethers.Provider,
  maxToken = 200
): Promise<RodData[]> {
  const c = getFishingRodContract(provider);
  const found: RodData[] = [];

  // ── 优先走事件日志（快，不产生大量 revert）──────────────
  try {
    const filter = (c as any).filters?.RodMinted?.(null, owner);
    if (filter) {
      const logs = await (c as any).queryFilter(filter, 0, "latest");
      const tokenIds: number[] = Array.from(
        new Set<number>(
          logs
            .map((l: any) => Number(l?.args?.tokenId ?? l?.args?.[0]))
            .filter((n: number) => Number.isFinite(n) && n > 0)
        )
      ).sort((a, b) => a - b);

      if (tokenIds.length > 0) {
        for (const tokenId of tokenIds) {
          try {
            const ownerAddr = await c.ownerOf(tokenId);
            if (ownerAddr.toLowerCase() !== owner.toLowerCase()) continue;
            const mapped = await getRodOnChain(tokenId, provider);
            if (mapped) {
              mapped.owner = ownerAddr;
              found.push(mapped);
            }
          } catch {
            // 单个 token 失败不影响其他
          }
        }
        return found;
      }
    }
  } catch {
    // 事件查询失败，fallback 到扫描
  }

  // ── Fallback：顺序扫描，遇到连续 5 个不存在的 token 就停止 ──
  let consecutiveMissing = 0;
  for (let id = 1; id <= maxToken; id++) {
    try {
      const ownerAddr = await c.ownerOf(id);
      consecutiveMissing = 0; // 重置计数
      if (ownerAddr.toLowerCase() === owner.toLowerCase()) {
        const mapped = await getRodOnChain(id, provider);
        if (mapped) {
          mapped.owner = ownerAddr;
          found.push(mapped);
        }
      }
    } catch {
      consecutiveMissing++;
      // ERC721 tokenId 是连续的，连续 5 个不存在说明已到末尾
      if (consecutiveMissing >= 5) break;
    }
  }

  return found;
}

export async function getUpgradeFee(level: number, provider: ethers.Provider) {
  try {
    const c = getFishingRodContract(provider);
    return await c.upgradeFeeWei(level);
  } catch (e) {
    const fee = getUpgradeFeeLocal(level);
    return fee ? ethers.parseEther(String(fee)) : ethers.parseEther('0');
  }
}

export async function getFullRepairCost(tokenId: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  return await c.fullRepairCost(tokenId);
}

export async function getPartialRepairCost(tokenId: number, restore: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  return await c.partialRepairCost(tokenId, restore);
}

export async function mintRodOnChain(rodType: number, signer: ethers.Signer) {
  const s = await resolveToSigner(signer);
  const c = getFishingRodContract(s);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
  const readProvider = new ethers.JsonRpcProvider(rpcUrl);
  const price = await getMintPrice(rodType, readProvider);
  const from = await s.getAddress();
  const nonce = await readProvider.getTransactionCount(from, "latest");
  const feeData = await readProvider.getFeeData();
  let gasLimit: bigint | undefined;
  try {
    const gasEstimate = await (c as any).getFunction("mintRod").estimateGas(rodType, { value: price });
    gasLimit = (BigInt(gasEstimate.toString()) * BigInt(12)) / BigInt(10);
  } catch {
    gasLimit = undefined;
  }
  const overrides: any = { value: price, nonce, gasLimit };
  if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
    overrides.maxFeePerGas = feeData.maxFeePerGas;
    overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  } else if (feeData.gasPrice != null) {
    overrides.gasPrice = feeData.gasPrice;
  }
  const tx = await c.mintRod(rodType, overrides);
  return tx;
}

export async function repairFullOnChain(tokenId: number, signer: ethers.Signer, value?: ethers.BigNumberish) {
  const s = await resolveToSigner(signer);
  const c = getFishingRodContract(s);
  if (value) return await c.repairFull(tokenId, { value });
  return await c.repairFull(tokenId);
}

export async function repairPartialOnChain(tokenId: number, restore: number, signer: ethers.Signer, value?: ethers.BigNumberish) {
  const s = await resolveToSigner(signer);
  const c = getFishingRodContract(s);
  if (value) return await c.repairPartial(tokenId, restore, { value });
  return await c.repairPartial(tokenId, restore);
}

export async function upgradeOnChain(tokenId: number, signer: ethers.Signer, value?: ethers.BigNumberish) {
  const s = await resolveToSigner(signer);
  const c = getFishingRodContract(s);
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
  const readProvider = new ethers.JsonRpcProvider(rpcUrl);
  const from = await s.getAddress();
  const nonce = await readProvider.getTransactionCount(from, "latest");
  const feeData = await readProvider.getFeeData();
  const overrides: any = { nonce };
  if (value) overrides.value = value;
  if (feeData.maxFeePerGas != null && feeData.maxPriorityFeePerGas != null) {
    overrides.maxFeePerGas = feeData.maxFeePerGas;
    overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
  } else if (feeData.gasPrice != null) {
    overrides.gasPrice = feeData.gasPrice;
  }
  try {
    const gasEstimate = await (c as any).getFunction("upgrade").estimateGas(tokenId, overrides);
    overrides.gasLimit = (BigInt(gasEstimate.toString()) * BigInt(12)) / BigInt(10);
  } catch {
  }
  return await c.upgrade(tokenId, overrides);
}

// --- Simulation helpers (no tx sent) ---
export async function simulateMint(rodType: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  const price = await c.mintPriceWei(rodType);
  let gasEstimate: any = null;
  try {
    gasEstimate = await (c.estimateGas as any).mintRod(rodType, { value: price });
  } catch (e) {
    // ignore
  }
  let callResult: any = null;
  try {
    callResult = await (c.callStatic as any).mintRod(rodType, { value: price });
  } catch (e) {
    // callStatic may revert; ignore
  }
  return { price, gasEstimate, callResult };
}

export async function simulateRepairFull(tokenId: number, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  let price: any = ethers.parseEther('0');
  try {
    price = await c.fullRepairCost(tokenId);
  } catch (e) {
    // fallback: cannot resolve token -> use caller provided via frontend mapping (best-effort)
    // Return price as 0 here; callers may use frontend's getFullRepairCostLocal with rod type and level
    price = ethers.parseEther('0');
  }
  let gasEstimate: any = null;
  try {
    gasEstimate = await (c.estimateGas as any).repairFull(tokenId, { value: price });
  } catch (e) {}
  let callResult: any = null;
  try {
    callResult = await (c.callStatic as any).repairFull(tokenId, { value: price });
  } catch (e) {}
  return { price, gasEstimate, callResult };
}

export async function simulateUpgrade(tokenId: number, level: number | null, provider: ethers.Provider) {
  const c = getFishingRodContract(provider);
  let price: any = ethers.parseEther('0');
  try {
    if (level !== null && level !== undefined) price = await c.upgradeFeeWei(level);
  } catch (e) {
    const fee = getUpgradeFeeLocal(level ?? 0);
    price = ethers.parseEther(String(fee ?? 0));
  }

  let gasEstimate: any = null;
  try {
    gasEstimate = await (c.estimateGas as any).upgrade(tokenId, { value: price });
  } catch (e) {}

  // Local simulated attribute outcome (frontend-only) so UI can preview
  const simulated = sampleUpgradeResult(level ?? 0);

  let callResult: any = null;
  try {
    callResult = await (c.callStatic as any).upgrade(tokenId, { value: price });
  } catch (e) {}
  return { price, gasEstimate, callResult, simulated };
}

// Watch for UpgradeResolved events and call callback(tokenId:number, success:boolean, newLevel:number, attr:number, delta:number)
export function watchUpgradeResolved(signerOrProvider: ethers.Signer | ethers.Provider, callback: (tokenId: number, success: boolean, newLevel: number, attr: number, delta: number) => void) {
  if (!FISHING_ROD_ADDRESS || FISHING_ROD_ADDRESS === ZERO_ADDRESS) {
    return () => {};
  }
  const c = getFishingRodContract(signerOrProvider as any);
  const handler = (tokenId: any, success: any, newLevel: any, attr: any, delta: any) => {
    try {
      const tid = Number(tokenId?.toString?.() ?? tokenId);
      callback(tid, Boolean(success), Number(newLevel?.toString?.() ?? newLevel), Number(attr?.toString?.() ?? attr), Number(delta?.toString?.() ?? delta));
    } catch (e) {
      // ignore
    }
  };
  c.on('UpgradeResolved', handler);
  return () => {
    try { c.off('UpgradeResolved', handler); } catch (e) {}
  };
}

// --- Room Tier Requirements ---
// Map tier name to required rod level
const TIER_REQUIRED_LEVELS: Record<string, number> = {
  "Bronze": 0,   // Any level
  "Silver": 1,   // Level 1+
  "Gold": 2,     // Level 2+
  "Diamond": 3,  // Level 3+
};

export async function getMaxRodLevel(owner: string, provider: ethers.Provider, maxToken = 200): Promise<number> {
  const c = getFishingRodContract(provider);
  let maxLevel = -1;

  try {
    for (let tokenId = 1; tokenId <= maxToken; tokenId++) {
      try {
        const ownerAddr = await c.ownerOf(tokenId);
        if (ownerAddr.toLowerCase() === owner.toLowerCase()) {
          const rod = await c.getRod(tokenId);
          const level = Number(rod[2] || 0); // rod.level is at index 2
          if (level > maxLevel) {
            maxLevel = level;
          }
        }
      } catch {
        // Token doesn't exist, continue
        continue;
      }
    }
  } catch (e) {
    // Ignore errors and return what we found
  }

  return maxLevel;
}

export async function hasRodForTier(owner: string, tierName: string, provider: ethers.Provider, maxToken = 200): Promise<boolean> {
  const requiredLevel = TIER_REQUIRED_LEVELS[tierName] ?? 0;
  const maxLevel = await getMaxRodLevel(owner, provider, maxToken);
  return maxLevel >= requiredLevel;
}
