"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import RodCard from "@/components/rods/RodCard";
import { RodData, ROD_TYPES } from "@/lib/rod";
import { ethers } from "ethers";
import { getMintPrice, mintRodOnChain, fetchRodsForOwner, simulateMint } from "@/lib/fishingRod";
import { useContract } from "@/lib/ethereum";

type RoomTier = "Bronze" | "Silver" | "Gold" | "Diamond";

const TIER_REQUIRED_LEVELS: Record<RoomTier, number> = {
  "Bronze": 0,
  "Silver": 1,
  "Gold": 2,
  "Diamond": 3,
};

export default function RodsHallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requiredTier = searchParams.get("tier") as RoomTier | null;
  
  const { wallet } = useContract();
  const [rods, setRods] = useState<RodData[]>([]);
  const [filterType, setFilterType] = useState<"All" | keyof typeof ROD_TYPES>("All");
  const [mintPrices, setMintPrices] = useState<any[]>([]);

  useEffect(() => {
    const fetchMintPrices = async () => {
      try {
        const provider = typeof window !== 'undefined' && (window as any).ethereum
          ? new ethers.BrowserProvider((window as any).ethereum)
          : new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
        const prices = await Promise.all(Object.keys(ROD_TYPES).map((_, idx) => getMintPrice(idx as number, provider)));
        setMintPrices(prices);
      } catch (e) {
        // ignore
      }
    };
    fetchMintPrices();
  }, []);

  const SIMULATE = process.env.NEXT_PUBLIC_SIMULATE_TX === 'true';

  const loadOwnedRods = async () => {
    if (!wallet.address) {
      setRods([]);
      return;
    }
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
      const owned = await fetchRodsForOwner(wallet.address, provider, 200);
      setRods((owned ?? []).sort((a, b) => a.tokenId - b.tokenId));
    } catch (e) {
      setRods([]);
    }
  };

  useEffect(() => {
    void loadOwnedRods();
  }, [wallet.address, wallet.provider]);

  const filtered = rods.filter(rod => {
    if (filterType === "All") return true;
    return rod.type === filterType;
  });

  // Apply tier filter if specified
  const tierFiltered = requiredTier && TIER_REQUIRED_LEVELS[requiredTier] !== undefined
    ? filtered.filter(rod => rod.level >= TIER_REQUIRED_LEVELS[requiredTier])
    : filtered;

  const requiredLevel = requiredTier ? TIER_REQUIRED_LEVELS[requiredTier] : null;

  const handleRodClick = (tokenId: number) => {
    router.push(`/rods/${tokenId}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
      />

      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 24px 64px",
        marginTop: "64px",
      }}>
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{
              fontFamily: "var(--font-serif)",
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--brown)",
            }}>
              🎣 我的鱼竿库
            </div>
            <div>
              <button className="btn-secondary" onClick={() => window.location.href = '/'}>返回大厅</button>
            </div>
          </div>
          <p style={{
            fontSize: "14px",
            color: "var(--brown-light)",
            lineHeight: "1.6",
          }}>
            {requiredTier
              ? `${requiredTier} 房间需要等级 ${requiredLevel} 及以上的鱼竿。点击任意鱼竿进入房间。`
              : "展示你拥有的所有鱼竿。点击任意鱼竿查看详情、升级或维护它们。"}
          </p>
        </div>

        {/* Filter Buttons */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}>
          {(["All", ...Object.keys(ROD_TYPES)] as string[]).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              style={{
                background: filterType === type ? "var(--coral)" : "white",
                color: filterType === type ? "white" : "var(--brown)",
                border: `2px solid ${filterType === type ? "var(--coral)" : "var(--cream-dark)"}`,
                borderRadius: "20px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => {
                if (filterType !== type) {
                  (e.currentTarget as any).style.borderColor = "var(--coral)";
                }
              }}
              onMouseLeave={e => {
                if (filterType !== type) {
                  (e.currentTarget as any).style.borderColor = "var(--cream-dark)";
                }
              }}
            >
              {type === "All" ? "全部" : ROD_TYPES[type as keyof typeof ROD_TYPES].name}
            </button>
          ))}
        </div>

        {/* Rods Grid */}
        {tierFiltered.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--brown-light)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎣</div>
            <p style={{ fontSize: "15px", marginBottom: "16px" }}>
              {wallet.address ? requiredTier 
                ? `没有等级 ${requiredLevel} 以上的鱼竿` 
                : "暂无此类鱼竿" 
                : "请先连接钱包"}
            </p>
            <button className="btn-primary" onClick={() => setFilterType("All")}>
              查看所有鱼竿
            </button>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
          }}>
            {tierFiltered.map(rod => (
              <div key={rod.tokenId} onClick={() => handleRodClick(rod.tokenId)}>
                <RodCard rod={rod} onClick={() => handleRodClick(rod.tokenId)} />
              </div>
            ))}
          </div>
        )}

        {/* Purchase New Rod Section */}
        <div style={{
          marginTop: "48px",
          padding: "32px 24px",
          background: "white",
          borderRadius: "24px",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--brown)",
            marginBottom: "16px",
          }}>
            🛍️ 购买新鱼竿
          </div>
          <p style={{
            fontSize: "13px",
            color: "var(--brown-light)",
            marginBottom: "20px",
            lineHeight: "1.6",
          }}>
            你还没有其他类型的鱼竿？现在可以购买一把新的鱼竿来拓展你的收集。
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}>
            {Object.keys(ROD_TYPES).map((type, idx) => {
              const rodInfo = ROD_TYPES[type as keyof typeof ROD_TYPES];
              const hasRod = rods.some(r => r.type === type);
              return (
                <div
                  key={type}
                  style={{
                    background: "var(--cream)",
                    borderRadius: "16px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}>
                    <span style={{ fontSize: "32px" }}>{rodInfo.icon}</span>
                    <div>
                      <div style={{
                        fontWeight: 700,
                        fontSize: "14px",
                        color: "var(--brown)",
                      }}>
                        {rodInfo.name}
                      </div>
                      {/* rarity shown per-item on detail page */}
                    </div>
                  </div>
                  <p style={{
                    fontSize: "12px",
                    color: "var(--brown-light)",
                    lineHeight: "1.5",
                  }}>
                    {rodInfo.description}
                  </p>
                  {!hasRod && (
                    <button
                      className="btn-primary"
                      style={{
                        marginTop: "8px",
                        width: "100%",
                      }}
                          onClick={async () => {
                        try {
                              const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");
                          const provider = typeof window !== 'undefined' && (window as any).ethereum
                            ? new ethers.BrowserProvider((window as any).ethereum)
                            : new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
                          if (SIMULATE) {
                            const sim = await simulateMint(idx, provider);
                            alert(`模拟铸造：价格 ${ethers.formatEther(sim.price)} ETH，估算 gas ${sim.gasEstimate ? sim.gasEstimate.toString() : 'n/a'}`);
                            return;
                          }
                          if (!(window as any).ethereum) return alert('请安装钱包');
                          const web3 = new ethers.BrowserProvider((window as any).ethereum);
                          await web3.send('eth_requestAccounts', []);
                          const network = await web3.getNetwork();
                          if (Number(network.chainId) !== expectedChainId) {
                            await wallet.switchToLocalNetwork();
                            alert(`当前 MetaMask 网络不是 Anvil (${expectedChainId})，请切换后再试一次`);
                            return;
                          }
                          const signer = await web3.getSigner();
                          const signerAddress = await signer.getAddress();
                          const walletBalance = await web3.getBalance(signerAddress);
                          const rpcProvider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
                          const price = await getMintPrice(idx, rpcProvider);
                          if (walletBalance < price) {
                            alert(`当前钱包余额不足：${signerAddress} 余额 ${ethers.formatEther(walletBalance)} ETH，需要至少 ${ethers.formatEther(price)} ETH`);
                            return;
                          }
                          const tx = await mintRodOnChain(idx, signer);
                          alert('交易已发出，等待上链');
                          await tx.wait();
                          alert('铸造成功');
                          await loadOwnedRods();
                        } catch (e: any) {
                          console.error(e);
                          const code = e?.code || e?.error?.code;
                          if (code === 4001) {
                            alert('用户已拒绝交易签名');
                          } else if (code === 'INSUFFICIENT_MINT_BALANCE' || String(e?.message || '').includes('INSUFFICIENT_MINT_BALANCE') || String(e?.message || '').includes('insufficient funds')) {
                            alert('当前钱包余额不足。请切换到 Anvil 的 funded 账户，或先向当前地址转入至少 0.01 ETH 的测试币。');
                          } else {
                            alert(`交易失败：${e?.message || '未知错误'}`);
                          }
                        }
                      }}
                    >
                      购买 - {mintPrices[idx] ? `${ethers.formatEther(mintPrices[idx])} ETH` : '加载中...'}
                    </button>
                  )}
                  {hasRod && (
                    <div style={{
                      background: "#E8F5E9",
                      color: "#2E7D32",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      textAlign: "center",
                    }}>
                      ✓ 已拥有
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
