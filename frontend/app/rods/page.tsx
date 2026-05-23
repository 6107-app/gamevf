"use client";

import { useState, useEffect, Suspense } from "react";
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

export default function RodsHallPageWrapper() {
  return (
    <Suspense>
      <RodsHallPage />
    </Suspense>
  );
}

function RodsHallPage() {
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
              My Rod Collection
            </div>
            <div>
              <button className="btn-secondary" onClick={() => window.location.href = '/'}>Back to Lobby</button>
            </div>
          </div>
          <p style={{
            fontSize: "14px",
            color: "var(--brown-light)",
            lineHeight: "1.6",
          }}>
            {requiredTier
              ? `${requiredTier} rooms require a rod at level ${requiredLevel} or above. Click any rod to enter the room.`
              : "View all your rods. Click any rod to see details, upgrade, or repair."}
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
              {type === "All" ? "All" : ROD_TYPES[type as keyof typeof ROD_TYPES].name}
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
                ? `No rods at level ${requiredLevel} or above`
                : "No rods of this type"
                : "Please connect your wallet first"}
            </p>
            <button className="btn-primary" onClick={() => setFilterType("All")}>
              View All Rods
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
            Purchase New Rod
          </div>
          <p style={{
            fontSize: "13px",
            color: "var(--brown-light)",
            marginBottom: "20px",
            lineHeight: "1.6",
          }}>
            Don't have other rod types yet? Purchase a new rod to expand your collection.
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
                          const provider = typeof window !== 'undefined' && (window as any).ethereum
                            ? new ethers.BrowserProvider((window as any).ethereum)
                            : new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
                          if (SIMULATE) {
                            const sim = await simulateMint(idx, provider);
                            alert(`Simulate mint: price ${ethers.formatEther(sim.price)} ETH, est. gas ${sim.gasEstimate ? sim.gasEstimate.toString() : 'n/a'}`);
                            return;
                          }
                          if (!(window as any).ethereum) return alert('Please install a wallet');
                          const web3 = new ethers.BrowserProvider((window as any).ethereum);
                          await web3.send('eth_requestAccounts', []);
                          const signer = await web3.getSigner();
                          const tx = await mintRodOnChain(idx, signer);
                          alert('Transaction sent, waiting for confirmation');
                          await tx.wait();
                          alert('Minting successful');
                          await loadOwnedRods();
                        } catch (e: any) {
                          console.error(e);
                          const code = e?.code || e?.error?.code;
                          if (code === 4001) {
                            alert('Transaction signature rejected by user');
                          } else {
                            alert('Transaction failed');
                          }
                        }
                      }}
                    >
                      Buy - {mintPrices[idx] ? `${ethers.formatEther(mintPrices[idx])} ETH` : 'Loading...'}
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
                      ✓ Owned
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
