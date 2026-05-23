"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import RodCard from "@/components/rods/RodCard";
import RodDurabilityBar from "@/components/rods/RodDurabilityBar";
import { generateMockRods, ROD_TYPES, ROD_MAX_LEVEL, ROD_USE_BEFORE_REPAIR, getUpgradeSuccessRate, getRodStatus, type RodData } from "@/lib/rod";
import { ethers } from "ethers";
import { getFullRepairCost, getPartialRepairCost, getUpgradeFee, repairFullOnChain, repairPartialOnChain, upgradeOnChain, simulateRepairFull, simulateUpgrade, getRodOnChain, watchUpgradeResolved, getPendingUpgradeRequestId, getOwnerOf } from "@/lib/fishingRod";
import { getFullRepairCostLocal, getUpgradeFeeLocal, ROD_CONFIG } from '@/lib/rod';
import { useContract } from "@/lib/ethereum";

const REPAIR_PLANS = [
  { restore: 10, label: "+10", ratioLabel: "15%", ratioPercent: 15 },
  { restore: 25, label: "+25", ratioLabel: "35%", ratioPercent: 35 },
  { restore: 50, label: "+50", ratioLabel: "60%", ratioPercent: 60 },
  { restore: 100, label: "Full Repair", ratioLabel: "100%", ratioPercent: 100 },
] as const;

export default function RodDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tokenId = parseInt(params.tokenId as string);
  const allRods = generateMockRods();
  const initial = allRods.find(r => r.tokenId === tokenId) ?? null;
  const { wallet } = useContract();

  const [rod, setRod] = useState<RodData | null>(initial as RodData | null);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [repairQuotes, setRepairQuotes] = useState<Record<number, string>>({});

  if (!rod) {
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
          padding: "64px 24px",
          marginTop: "64px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎣</div>
          <p style={{ fontSize: "16px", color: "var(--brown-light)", marginBottom: "24px" }}>
            Rod not found
          </p>
          <button className="btn-primary" onClick={() => router.push("/rods")}>
            Back to Rod Collection
          </button>
        </div>
      </div>
    );
  }

  // Fetch on-chain rod data and subscribe to upgrade events
  useEffect(() => {
    let unsub: (() => void) | null = null;
    const fetch = async () => {
      try {
        // Prefer a read-only RPC provider (faster and doesn't depend on MetaMask)
        const provider = process.env.NEXT_PUBLIC_RPC_URL
          ? new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
          : (typeof window !== 'undefined' && (window as any).ethereum
            ? new ethers.BrowserProvider((window as any).ethereum)
            : new ethers.JsonRpcProvider('http://127.0.0.1:8545'));
        const onChain = await getRodOnChain(tokenId, provider);
        if (onChain) setRod(onChain);
        // subscribe to upgrade events to refresh on result
        unsub = watchUpgradeResolved(provider, async (tid, success) => {
          if (tid === tokenId) {
            const updated = await getRodOnChain(tokenId, provider);
            if (updated) setRod(updated);
          }
        });
      } catch (e) {
        // ignore
      }
    };
    fetch();
    return () => { if (unsub) unsub(); };
  }, [tokenId]);

  const rodType = ROD_TYPES[rod.type];
  const canUpgrade = rod.level < ROD_MAX_LEVEL;
  const needsRepair = getRodStatus(rod) !== "healthy";
  const [repairFee, setRepairFee] = useState<string | null>(null);
  const [upgradeFee, setUpgradeFee] = useState<string | null>(null);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        // Prefer read-only RPC provider to avoid MetaMask latency when just showing fees
        const provider = process.env.NEXT_PUBLIC_RPC_URL
          ? new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
          : (typeof window !== 'undefined' && (window as any).ethereum
            ? new ethers.BrowserProvider((window as any).ethereum)
            : new ethers.JsonRpcProvider('http://127.0.0.1:8545'));
        let full: any = null;
        let up: any = null;
        try {
          full = await getFullRepairCost(rod.tokenId, provider);
        } catch (e) {
          full = null;
        }
        try {
          up = await getUpgradeFee(rod.level, provider);
        } catch (e) {
          up = null;
        }

        const partials: Record<number, string> = {};
        for (const plan of REPAIR_PLANS) {
          try {
            const partialCost = plan.restore === 100
              ? full
              : await getPartialRepairCost(rod.tokenId, plan.restore, provider);
            if (partialCost && partialCost.toString && partialCost.toString() !== '0') {
              partials[plan.restore] = ethers.formatEther(partialCost);
            } else {
              partials[plan.restore] = plan.restore === 100
                ? String(getFullRepairCostLocal(rod.type as any, rod.level))
                : String(Math.round((getFullRepairCostLocal(rod.type as any, rod.level) * plan.ratioPercent) / 100));
            }
          } catch (e) {
            partials[plan.restore] = plan.restore === 100
              ? String(getFullRepairCostLocal(rod.type as any, rod.level))
              : String(Math.round((getFullRepairCostLocal(rod.type as any, rod.level) * plan.ratioPercent) / 100));
          }
        }

        // If chain didn't return a cost, fall back to local config for display
        if (full && full.toString && full.toString() !== '0') {
          setRepairFee(ethers.formatEther(full));
        } else {
          // assume token cost units (not ETH) - display token amount
          const local = getFullRepairCostLocal(rod.type as any, rod.level);
          setRepairFee(String(local));
        }

        if (up && up.toString && up.toString() !== '0') {
          setUpgradeFee(ethers.formatEther(up));
        } else {
          const u = getUpgradeFeeLocal(rod.level) ?? null;
          setUpgradeFee(u ? String(u) : null);
        }

        setRepairQuotes(partials);
      } catch (e) {
        // ignore
      }
    };
    fetchFees();
  }, [rod.tokenId, rod.level]);

  const handleRepair = async () => {
    const SIMULATE = process.env.NEXT_PUBLIC_SIMULATE_TX === 'true';
    setIsProcessing(true);
    try {
      const provider = process.env.NEXT_PUBLIC_RPC_URL
        ? new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
        : (typeof window !== 'undefined' && (window as any).ethereum
          ? new ethers.BrowserProvider((window as any).ethereum)
          : new ethers.JsonRpcProvider('http://127.0.0.1:8545'));
      if (SIMULATE) {
        const sim = await simulateRepairFull(rod.tokenId, provider);
        alert(`Simulate repair: cost ${sim.price && sim.price.toString && sim.price.toString() !== '0' ? ethers.formatEther(sim.price) + ' ETH' : getFullRepairCostLocal(rod.type as any, rod.level) + ' tokens'}, est. gas ${sim.gasEstimate ? sim.gasEstimate.toString() : 'n/a'}`);
        setIsProcessing(false);
        setShowRepairModal(false);
        return;
      }
      if (!(window as any).ethereum) return alert('Please install a wallet');
      const web3 = new ethers.BrowserProvider((window as any).ethereum);
      await web3.send('eth_requestAccounts', []);
      const signer = await web3.getSigner();

      // guard: check signer owns this token to avoid immediate revert NotTokenOwner
      try {
        const signerAddr = await signer.getAddress();
        const ownerOnChain = await getOwnerOf(rod.tokenId, web3);
        if (ownerOnChain && ownerOnChain.toLowerCase() !== signerAddr.toLowerCase()) {
          alert('You are not the owner of this rod and cannot repair it');
          setIsProcessing(false);
          setShowRepairModal(false);
          return;
        }
      } catch (e) {
        // best-effort; continue
      }

      // fetch on-chain fee and pass as value so MetaMask shows correct amount
      let price: any = null;
      try {
        price = await getFullRepairCost(rod.tokenId, web3);
      } catch (e) {
        price = null;
      }
      const tx = price ? await repairFullOnChain(rod.tokenId, signer, price) : await repairFullOnChain(rod.tokenId, signer);
      alert('Transaction sent, waiting for confirmation');
      await tx.wait();
      alert('Rod repair successful!');
    } catch (e: any) {
      console.error(e);
      const code = e?.code || e?.error?.code;
      if (code === 4001) alert('Transaction signature rejected by user');
      else alert('Repair failed');
    }
    setIsProcessing(false);
    setShowRepairModal(false);
  };

  const handlePartialRepair = async (restore: number) => {
    const SIMULATE = process.env.NEXT_PUBLIC_SIMULATE_TX === 'true';
    setIsProcessing(true);
    try {
      const quoted = repairQuotes[restore] ?? '0';
      if (SIMULATE) {
        alert(`Simulate partial repair: restore +${restore} durability, cost ${quoted} ETH`);
        setIsProcessing(false);
        return;
      }
      if (!(window as any).ethereum) return alert('Please install a wallet');
      const web3 = new ethers.BrowserProvider((window as any).ethereum);
      await web3.send('eth_requestAccounts', []);
      const signer = await web3.getSigner();

      // guard ownership
      try {
        const signerAddr = await signer.getAddress();
        const ownerOnChain = await getOwnerOf(rod.tokenId, web3);
        if (ownerOnChain && ownerOnChain.toLowerCase() !== signerAddr.toLowerCase()) {
          alert('You are not the owner of this rod and cannot repair it');
          setIsProcessing(false);
          setShowRepairModal(false);
          return;
        }
      } catch (e) {}

      let price: any = null;
      try {
        price = restore === 100 ? await getFullRepairCost(rod.tokenId, web3) : await getPartialRepairCost(rod.tokenId, restore, web3);
      } catch (e) {
        price = null;
      }
      const tx = restore === 100
        ? (price ? await repairFullOnChain(rod.tokenId, signer, price) : await repairFullOnChain(rod.tokenId, signer))
        : (price ? await repairPartialOnChain(rod.tokenId, restore, signer, price) : await repairPartialOnChain(rod.tokenId, restore, signer));
      alert('Transaction sent, waiting for confirmation');
      await tx.wait();
      alert(restore === 100 ? 'Full repair successful!' : 'Partial repair successful!');
    } catch (e: any) {
      console.error(e);
      const code = e?.code || e?.error?.code;
      if (code === 4001) alert('Transaction signature rejected by user');
      else alert('Repair failed');
    }
    setIsProcessing(false);
    setShowRepairModal(false);
  };

  const handleUpgrade = async () => {
    const SIMULATE = process.env.NEXT_PUBLIC_SIMULATE_TX === 'true';
    setIsProcessing(true);
    try {
      const provider = process.env.NEXT_PUBLIC_RPC_URL
        ? new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL)
        : (typeof window !== 'undefined' && (window as any).ethereum
          ? new ethers.BrowserProvider((window as any).ethereum)
          : new ethers.JsonRpcProvider('http://127.0.0.1:8545'));
      if (SIMULATE) {
        const sim = await simulateUpgrade(rod.tokenId, rod.level, provider);
        const simPriceStr = sim.price && sim.price.toString && sim.price.toString() !== '0' ? ethers.formatEther(sim.price) + ' ETH' : (getUpgradeFeeLocal(rod.level) ?? '0') + ' tokens';
        const simulated = (sim as any).simulated;
        alert(`Simulate upgrade: cost ${simPriceStr}, est. gas ${sim.gasEstimate ? sim.gasEstimate.toString() : 'n/a'}, possible attribute: ${simulated.attribute} +${simulated.incrementPercent}%`);
        setIsProcessing(false);
        setShowUpgradeModal(false);
        return;
      }
      if (!(window as any).ethereum) return alert('Please install a wallet');
      const web3 = new ethers.BrowserProvider((window as any).ethereum);
      await web3.send('eth_requestAccounts', []);
      const signer = await web3.getSigner();

      // guard ownership and pending request
      try {
        const signerAddr = await signer.getAddress();
        const ownerOnChain = await getOwnerOf(rod.tokenId, web3);
        if (ownerOnChain && ownerOnChain.toLowerCase() !== signerAddr.toLowerCase()) {
          alert('You are not the owner of this rod and cannot upgrade it');
          setIsProcessing(false);
          setShowUpgradeModal(false);
          return;
        }
        const pending = await getPendingUpgradeRequestId(rod.tokenId, web3);
        if (pending && pending.toString && pending.toString() !== '0') {
          alert('This rod already has a pending upgrade request. Please try again later.');
          setIsProcessing(false);
          setShowUpgradeModal(false);
          return;
        }
      } catch (e) {
        // continue; best-effort
      }

      // fetch upgrade fee and pass as value so MetaMask shows correct amount
      let price: any = null;
      try {
        price = await getUpgradeFee(rod.level, web3);
      } catch (e) {
        price = null;
      }
      const tx = price ? await upgradeOnChain(rod.tokenId, signer, price) : await upgradeOnChain(rod.tokenId, signer);
      alert('Transaction sent, waiting for confirmation');
      await tx.wait();
      alert('Upgrade transaction complete. Result will be determined by on-chain event.');
    } catch (e: any) {
      console.error(e);
      const code = e?.code || e?.error?.code;
      if (code === 4001) alert('Transaction signature rejected by user');
      else alert('Upgrade failed');
    }
    setIsProcessing(false);
    setShowUpgradeModal(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
      />

      <div style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "32px 24px 64px",
        marginTop: "64px",
      }}>
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--coral)",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "24px",
            padding: 0,
          }}
        >
          ← Back
        </button>

        {/* Main Content Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "32px",
        }}>
          {/* Left: Rod Card */}
          <div>
            <RodCard rod={rod} />
          </div>

          {/* Right: Details & Actions */}
          <div>
            {/* Status Section */}
            <div
              className="card"
              style={{
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              <div style={{
                fontWeight: 700,
                fontSize: "14px",
                color: "var(--brown)",
                marginBottom: "16px",
              }}>
                Rod Status
              </div>

              {/* Level Info */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
              }}>
                <div style={{
                  background: "var(--cream)",
                  borderRadius: "12px",
                  padding: "12px",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: "var(--brown-light)",
                    marginBottom: "4px",
                  }}>
                    Current Level
                  </div>
                  <div style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "var(--coral)",
                  }}>
                    +{rod.level}
                  </div>
                </div>
                <div style={{
                  background: "var(--cream)",
                  borderRadius: "12px",
                  padding: "12px",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: "var(--brown-light)",
                    marginBottom: "4px",
                  }}>
                    Max Level
                  </div>
                  <div style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "var(--brown)",
                  }}>
                    +{ROD_MAX_LEVEL}
                  </div>
                </div>
              </div>

              {/* Durability Status */}
              <div style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "16px",
              }}>
                <div style={{
                  fontSize: "11px",
                  color: "var(--brown-light)",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}>
                  Durability
                </div>
                <RodDurabilityBar rod={rod} showLabel={true} size="large" />
              </div>

              {/* Status Badge */}
              <div style={{
                textAlign: "center",
                padding: "12px",
                borderRadius: "8px",
                background:
                  getRodStatus(rod) === "healthy"
                    ? "#E8F5E9"
                    : getRodStatus(rod) === "warning"
                      ? "#FFF9C4"
                      : "#FFEBEE",
                color:
                  getRodStatus(rod) === "healthy"
                    ? "#2E7D32"
                    : getRodStatus(rod) === "warning"
                      ? "#F57F17"
                      : "#C62828",
                fontSize: "12px",
                fontWeight: 600,
              }}>
                {getRodStatus(rod) === "healthy"
                  ? "✓ Healthy"
                  : getRodStatus(rod) === "warning"
                    ? "Warning: Durability Low"
                    : "Critical: Needs Urgent Repair"}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Repair Button */}
              <button
                className="btn-primary"
                disabled={!needsRepair || isProcessing}
                onClick={() => setShowRepairModal(true)}
                style={{
                  width: "100%",
                  opacity: !needsRepair ? 0.5 : 1,
                  cursor: !needsRepair ? "not-allowed" : "pointer",
                }}
              >
                {isProcessing
                  ? "Repairing..."
                  : `Repair Options (${repairFee ? (repairFee.match(/^\d+$/) ? repairFee + ' tokens' : repairFee + ' ETH') : 'Loading...'})`}
              </button>

              {/* Upgrade Button */}
              <button
                className="btn-primary"
                disabled={!canUpgrade || isProcessing}
                onClick={() => setShowUpgradeModal(true)}
                style={{
                  width: "100%",
                  opacity: !canUpgrade ? 0.5 : 1,
                  cursor: !canUpgrade ? "not-allowed" : "pointer",
                }}
              >
                {isProcessing
                  ? "Upgrading..."
                  : canUpgrade
                    ? `Upgrade to +${rod.level + 1} (${upgradeFee ? upgradeFee + ' ETH' : 'Loading...'})`
                    : "✓ Max Level Reached"}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div
          className="card"
          style={{
            padding: "20px",
          }}
        >
          <div style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--brown)",
            marginBottom: "16px",
          }}>
            Rod Details
          </div>

          <div style={{
            display: "grid",
            gap: "16px",
          }}>
            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                Rod Type
              </div>
              <p style={{
                fontSize: "13px",
                color: "var(--brown)",
                lineHeight: "1.6",
              }}>
                {rodType.description}
              </p>
            </div>

            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                Attributes
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "10px",
              }}>
                {[
                  { label: "Speed", value: `${rod.attributes.speedBonus ?? Math.round(rod.attributes.speedBps / 100)}%`, hint: "Reduces time cost" },
                  { label: "Weight", value: `${rod.attributes.weightBonus ?? Math.round(rod.attributes.weightBps / 100)}%`, hint: "Increases fish weight range" },
                  { label: "Luck", value: `${rod.attributes.luckBonus ?? Math.round(rod.attributes.luckBps / 100)}%`, hint: "Increases rarity chance" },
                  { label: "Stability", value: `${Math.round((rod.attributes.stabilityBps ?? 0) / 100)}%`, hint: "Reduces miss/debuff impact" },
                ].map(attr => (
                  <div key={attr.label} style={{ background: "var(--cream)", borderRadius: "12px", padding: "10px 12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--brown)", marginBottom: "2px" }}>{attr.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--brown-light)", marginBottom: "4px" }}>{attr.hint}</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--coral)" }}>{attr.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                Upgrade Rules
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{ fontSize: "13px", color: "var(--brown)", lineHeight: "1.7" }}>
                  Rods can be upgraded up to +5. A successful upgrade randomly boosts one of Speed / Weight / Luck / Stability.
                </div>
                <div style={{ fontSize: "13px", color: "var(--brown)", lineHeight: "1.7" }}>
                  Success rates by level: 100% / 85% / 65% / 45% / 25%. Failure does not downgrade, but fees are not refunded.
                </div>
                <div style={{ fontSize: "13px", color: "var(--brown)", lineHeight: "1.7" }}>
                  The stat increase varies by level, with different random ranges for +0 through +5.
                </div>
              </div>
            </div>

            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                Repair Options
              </div>
              <div style={{
                display: "grid",
                gap: "10px",
              }}>
                {REPAIR_PLANS.map(plan => (
                  <button
                    key={plan.restore}
                    className="card"
                    onClick={() => handlePartialRepair(plan.restore)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      background: "var(--cream)",
                      border: "1px solid var(--cream-dark)",
                      cursor: isProcessing ? "not-allowed" : "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--brown)" }}>{plan.label}</div>
                        <div style={{ fontSize: "11px", color: "var(--brown-light)" }}>{plan.ratioLabel} of full repair cost</div>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--coral)" }}>
                        {repairQuotes[plan.restore] ? `${repairQuotes[plan.restore]} ETH` : 'Loading...'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Repair Modal */}
      {showRepairModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !isProcessing && setShowRepairModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "420px",
              width: "90%",
              padding: "32px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontSize: "32px",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              🔧
            </div>

            <div style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--brown)",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              Confirm Repair
            </div>

            <p style={{
              fontSize: "14px",
              color: "var(--brown-light)",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: "1.6",
            }}>
              Restore <strong>{rodType.name}</strong> to full durability.
            </p>

            <div
              style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              <div style={{
                fontSize: "12px",
                color: "var(--brown-light)",
                marginBottom: "8px",
              }}>
                Full Repair Cost
              </div>
              <div style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--coral)",
              }}>
                {repairFee ? repairFee + ' ETH' : 'Loading...'}
              </div>
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
            }}>
              <button
                className="btn-secondary"
                disabled={isProcessing}
                onClick={() => setShowRepairModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={handleRepair}
                style={{ flex: 1 }}
              >
                {isProcessing ? "Repairing..." : "Confirm Repair"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !isProcessing && setShowUpgradeModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "420px",
              width: "90%",
              padding: "32px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontSize: "32px",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              ⬆️
            </div>

            <div style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--brown)",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              Confirm Upgrade
            </div>

            <p style={{
              fontSize: "14px",
              color: "var(--brown-light)",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: "1.6",
            }}>
              Upgrade <strong>{rodType.name}</strong> from <strong>+{rod.level}</strong> to <strong>+{rod.level + 1}</strong>. Only one of four attributes will be randomly boosted.
            </p>

            <div
              style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px",
              }}
            >
              <div style={{
                display: "grid",
                gap: "12px",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}>
                  <span style={{ color: "var(--brown-light)" }}>Upgrade Fee</span>
                  <span style={{ fontWeight: 700, color: "var(--brown)" }}>
                    {upgradeFee} ETH
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}>
                  <span style={{ color: "var(--brown-light)" }}>Success Rate</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#FFB74D",
                    }}
                  >
                    {getUpgradeSuccessRate(rod.level)}%
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#FFF9C4",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "24px",
                fontSize: "12px",
                color: "#F57F17",
                lineHeight: "1.6",
              }}
            >
              Failure will not reduce the level, but the upgrade fee will not be refunded.
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
            }}>
              <button
                className="btn-secondary"
                disabled={isProcessing}
                onClick={() => setShowUpgradeModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={handleUpgrade}
                style={{ flex: 1 }}
              >
                {isProcessing ? "Upgrading..." : "Confirm Upgrade"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
