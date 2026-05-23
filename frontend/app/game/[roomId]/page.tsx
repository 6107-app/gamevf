"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { useContract } from "@/lib/ethereum";
import { FISHING_GAME_ADDRESS, TIER_ENTRY_FEES, TIER_NAMES, RARITY_NAMES, PLAYER_STATUS, requiredRodLevelForTier, type RoomTier } from "@/lib/contract";
import { ethers } from "ethers";
import { fetchRodsForOwner } from "@/lib/fishingRod";
import { type RodData, ROD_TYPES, generateMockRods } from "@/lib/rod";

// ── Game state enum ──────────────────────────────────────
type GamePhase =
  | "waiting_cast"   // Waiting to cast
  | "waiting_vrf"    // Waiting for VRF
  | "reeling"        // Reeling bar
  | "fish_result"    // Fish result
  | "decision"       // Decision: lock in / recast
  | "dice_roll"      // Dice animation
  | "locked"         // Locked

type Rarity = "Common" | "Rare" | "SuperRare" | "Epic" | "Legendary";

interface FishResult {
  name: string;
  rarity: Rarity;
  weight: number;
  score: number;
  emoji: string;
}

interface OtherPlayer {
  ens: string;
  status: "waiting" | "fishing" | "caught" | "locked";
  score: number;
}

// ── Fish database (Mock) ─────────────────────────────────
const FISH_DB: Record<Rarity, { names: string[]; emoji: string }> = {
  Common:   { names: ["Small Crucian", "Common Carp", "Grass Fish"],      emoji: "🐟" },
  Rare:     { names: ["Golden Carp", "Bass", "Mandarin Fish"],            emoji: "🐠" },
  SuperRare:{ names: ["Koi", "Sunfish", "Butterfly Goldfish"],        emoji: "🐡" },
  Epic:     { names: ["Dragon Koi", "Ancient Sturgeon", "Giant Catfish"],  emoji: "🦈" },
  Legendary:{ names: ["Koi King", "Mythical Carp", "Dragon Fish"],    emoji: "🐉" },
};

const RARITY_COLORS: Record<Rarity, string> = {
  Common:    "#9E9E9E",
  Rare:      "#2196F3",
  SuperRare: "#9C27B0",
  Epic:      "#FF6F00",
  Legendary: "#FFD700",
};

const RARITY_BG: Record<Rarity, string> = {
  Common:    "#F5F5F5",
  Rare:      "#E3F2FD",
  SuperRare: "#F3E5F5",
  Epic:      "#FFF3E0",
  Legendary: "#FFFDE7",
};

const STATUS_EMOJI: Record<OtherPlayer["status"], string> = {
  waiting: "😴",
  fishing: "😤",
  caught:  "😍",
  locked:  "✅",
};

// ── Mock other players ───────────────────────────────────
const MOCK_OTHERS: OtherPlayer[] = [
  { ens: "vitalik.eth", status: "fishing", score: 0 },
  { ens: "sakura.eth",  status: "caught",  score: 1240 },
  { ens: "moon.eth",    status: "locked",  score: 3870 },
];

// ── Utility functions ────────────────────────────────────
function randomFish(): FishResult {
  const rarities: Rarity[] = ["Common","Common","Common","Rare","Rare","SuperRare","Epic","Legendary"];
  const rarity = rarities[Math.floor(Math.random() * rarities.length)];
  const db = FISH_DB[rarity];
  const name = db.names[Math.floor(Math.random() * db.names.length)];
  const weight = Math.round((0.5 + Math.random() * 15) * 10) / 10;
  const score = Math.round(weight * { Common:10, Rare:25, SuperRare:60, Epic:120, Legendary:300 }[rarity]);
  return { name, rarity, weight, score, emoji: db.emoji };
}

function contractStatusToDisplay(status: number): OtherPlayer["status"] {
  // PLAYER_STATUS = ["Fishing", "LockedIn", "Recast"]
  switch (status) {
    case 0: return "fishing";
    case 1: return "locked";
    case 2: return "fishing"; // Recast maps to fishing visually
    default: return "waiting";
  }
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Main component ──────────────────────────────────────
export default function GameScreenPage() {
  return (
    <Suspense>
      <GameScreen />
    </Suspense>
  );
}

function GameScreen() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const { wallet, getReadContract, getRpcReadContract, getWriteContract } = useContract();
  const isContractReady = wallet.address && FISHING_GAME_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const [phase, setPhase] = useState<GamePhase>("waiting_cast");
  const [fish, setFish] = useState<FishResult | null>(null);
  const [castCount, setCastCount] = useState(0);
  const [totalPot, setTotalPot] = useState(0.038);
  const [timeLeft, setTimeLeft] = useState(180);
  const [buffs, setBuffs] = useState<string[]>([]);
  const [diceResult, setDiceResult] = useState<{ text: string; isBuff: boolean } | null>(null);
  const [others, setOthers] = useState<OtherPlayer[]>(MOCK_OTHERS);
  const [recastFee, setRecastFee] = useState("0.01");
  const [roomTier, setRoomTier] = useState<RoomTier>("Bronze");
  const [requiredRodLevel, setRequiredRodLevel] = useState<number>(0);
  const [txPending, setTxPending] = useState(false);
  const [ownedRods, setOwnedRods] = useState<RodData[]>([]);
  const [selectedRodId, setSelectedRodId] = useState<number>(0);
  const [rodSource, setRodSource] = useState<"wallet" | "demo">("demo");
  const activeRods = rodSource === "wallet" ? ownedRods : generateMockRods();
  const usableRods = activeRods.filter(rod => rod.durability > 0);
  const eligibleRods = rodSource === "wallet"
  ? usableRods.filter(rod => rod.level >= requiredRodLevel)
  : usableRods; // All demo rods are available
  const selectedRod = eligibleRods.find(rod => rod.tokenId === selectedRodId) ?? null;
  const isDemoFishing = rodSource === "demo";
  const canStartFishing = selectedRod !== null || (isDemoFishing && usableRods.length > 0);
  

  // Fetch room data from contract (pot, recast fee, other players)
  const fetchGameData = useCallback(async () => {
    if (!isContractReady || !roomId) return;
    const contract = getReadContract();
    if (!contract) return;

    try {
      const info = await contract.getRoomInfo(Number(roomId));
      const pot = ethers.formatEther(info.totalPot);
      setTotalPot(parseFloat(pot));

      // Determine recast fee from tier
      const tierIndex = Number(info.tier);
      const tierName = TIER_NAMES[tierIndex];
      if (tierName) {
        setRoomTier(tierName as RoomTier);
        setRequiredRodLevel(requiredRodLevelForTier(tierName as RoomTier));
      }
      if (tierName && tierName in TIER_ENTRY_FEES) {
        setRecastFee(TIER_ENTRY_FEES[tierName as keyof typeof TIER_ENTRY_FEES]);
      }

      // Fetch other players
      const pCount = Number(info.playerCount);
      const otherPlayers: OtherPlayer[] = [];
      for (let i = 0; i < pCount; i++) {
        try {
          const pInfo = await contract.getPlayerInfo(Number(roomId), i);
          if (pInfo.addr.toLowerCase() === wallet.address!.toLowerCase()) continue;
          otherPlayers.push({
            ens: shortenAddress(pInfo.addr),
            status: Number(pInfo.score) > 0 && Number(pInfo.status) === 1
              ? "locked"
              : Number(pInfo.score) > 0
              ? "caught"
              : contractStatusToDisplay(Number(pInfo.status)),
            score: Number(pInfo.score),
          });
        } catch {
          // Skip
        }
      }
      if (otherPlayers.length > 0) {
        setOthers(otherPlayers);
      }
    } catch {
      // Keep mock data
    }
  }, [isContractReady, roomId, getReadContract, wallet.address]);

  useEffect(() => {
    fetchGameData();
  }, [fetchGameData]);

  // useEffect for loadOwnedRods, unified handling at setRodSource("demo")
  useEffect(() => {
    const loadOwnedRods = async () => {
      if (!wallet.address) {
        setOwnedRods([]);
        setRodSource("demo");
        const mockRods = generateMockRods();
        setSelectedRodId(mockRods[0]?.tokenId ?? 1); // Ensure a default value
        return;
      }

      try {
        const provider = wallet.provider
          ? wallet.provider
          : new ethers.JsonRpcProvider(
              process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545"
            );
        const rods = await fetchRodsForOwner(wallet.address, provider, 200);
        setOwnedRods(rods);
        const usable = rods.filter(rod => rod.durability > 0);

        if (usable.length > 0) {
          setRodSource("wallet");
          setSelectedRodId(prev => {
            if (prev && usable.some(rod => rod.tokenId === prev)) return prev;
            return usable[0]!.tokenId;
          });
        } else {
          // No usable rods in wallet, fallback to demo
          setRodSource("demo");
          const mockRods = generateMockRods();
          setSelectedRodId(mockRods[0]?.tokenId ?? 1);
        }
      } catch {
        setRodSource("demo");
        const mockRods = generateMockRods();
        setSelectedRodId(mockRods[0]?.tokenId ?? 1);
      }
    };

    loadOwnedRods();
  }, [wallet.address, wallet.provider]);

  useEffect(() => {
    if (eligibleRods.length === 0) {
      if (selectedRodId !== 0) setSelectedRodId(0);
      return;
    }
    if (!eligibleRods.some(r => r.tokenId === selectedRodId)) {
      setSelectedRodId(eligibleRods[0]!.tokenId);
    }
  }, [eligibleRods, selectedRodId]);

  // Listen for contract events
  useEffect(() => {
    if (!isContractReady || !roomId) return;
    const contract = getRpcReadContract();
    if (!contract) return;

    const roomIdNum = Number(roomId);

    const onFishCaught = (eventRoomId: bigint, _player: string, rarity: number, weight: bigint, score: bigint) => {
      if (Number(eventRoomId) !== roomIdNum) return;
      if (_player.toLowerCase() === wallet.address!.toLowerCase()) {
        const rarityName = RARITY_NAMES[rarity] as Rarity;
        const db = FISH_DB[rarityName] || FISH_DB.Common;
        const fishName = db.names[Math.floor(Math.random() * db.names.length)];
        const w = Number(weight) / 10;
        const newFish = {
          name: fishName,
          rarity: rarityName,
          weight: w,
          score: Number(score),
          emoji: db.emoji,
        };
        setFish(newFish);
        setPhase(prev => {
          if (prev === "dice_roll" || prev === "waiting_vrf" || prev === "reeling") return prev;
          setTimeout(() => setPhase("decision"), 1200);
          return "fish_result";
        });
      } else {
        fetchGameData();
      }
    };

    const onPlayerLockedIn = (eventRoomId: bigint) => {
      if (Number(eventRoomId) === roomIdNum) {
        fetchGameData();
      }
    };

    const onDiceRolled = (eventRoomId: bigint, player: string, diceModifier: bigint) => {
      if (Number(eventRoomId) !== roomIdNum) return;
      if (player.toLowerCase() === wallet.address!.toLowerCase()) {
        const mod = Number(diceModifier);
        const isBuff = mod >= 0;
        setDiceResult({
          text: isBuff ? `Buff +${mod}%` : `Debuff ${mod}%`,
          isBuff,
        });
        setBuffs(prev => [...prev, isBuff ? "⬆️" : "⬇️"]);
        setCastCount(c => c + 1);
        setTimeout(() => {
          setDiceResult(null);
          setPhase("fish_result");
          setTimeout(() => setPhase("decision"), 1200);
        }, 2500);
      }
    };

    const onGameSettled = (eventRoomId: bigint) => {
      if (Number(eventRoomId) === roomIdNum) {
        router.push(`/settlement?roomId=${roomId}`);
      }
    };

    contract.on("FishCaught", onFishCaught);
    contract.on("PlayerLockedIn", onPlayerLockedIn);
    contract.on("DiceRolled", onDiceRolled);
    contract.on("GameSettled", onGameSettled);

    return () => {
      contract.off("FishCaught", onFishCaught);
      contract.off("PlayerLockedIn", onPlayerLockedIn);
      contract.off("DiceRolled", onDiceRolled);
      contract.off("GameSettled", onGameSettled);
    };
  }, [isContractReady, roomId, getReadContract, wallet.address, fetchGameData, router]);

  // Countdown
  useEffect(() => {
    if (phase === "locked") return;
    const t = setInterval(() => setTimeLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Cast
  const handleCast = useCallback(async () => {
    if (phase !== "waiting_cast" || txPending) return;

    // Demo mode or contract address not configured: go straight to mock flow, no rod check needed
    if (!isContractReady || !roomId || isDemoFishing) {
      setPhase("waiting_vrf");
      setTimeout(() => setPhase("reeling"), 1500);
      return;
    }

    // Contract mode: must have a real rod
    if (!canStartFishing) {
      alert("Please select a rod first.");
      return;
    }

    const contract = getWriteContract();
    if (!contract) return;

    const rodIdToPass = rodSource === "wallet" ? (selectedRodId ?? 0) : 0;

    setTxPending(true);
    setPhase("waiting_vrf");
    try {
      const tx = await contract.cast(Number(roomId), rodIdToPass);
      await tx.wait();
      setTimeout(() => {
        setPhase(prev => (prev === "waiting_vrf" ? "reeling" : prev));
      }, 5000);
    } catch (e: unknown) {
      console.error("cast error:", e);
      alert(e instanceof Error ? e.message : "Cast failed");
      setPhase("waiting_cast");
    } finally {
      setTxPending(false);
    }
  }, [phase, txPending, isContractReady, roomId, getWriteContract,
      selectedRodId, canStartFishing, isDemoFishing, rodSource]);

  // Reel result (mock fallback for when contract events handle it)
  const handleReel = useCallback((result: "perfect" | "good" | "ok" | "miss") => {
    if (result === "miss") {
      setPhase("waiting_cast");
      return;
    }
    // In contract mode, FishCaught event sets the fish.
    // In mock mode, generate random fish.
    if (!isContractReady) {
      const f = randomFish();
      setFish(f);
      setPhase("fish_result");
      setTimeout(() => setPhase("decision"), 1200);
    } else {
      setPhase("fish_result");
      setTimeout(() => setPhase("decision"), 1200);
    }
  }, [isContractReady]);

  // Lock in
  const handleLockIn = async () => {
    if (!isContractReady || !roomId) {
      setPhase("locked");
      setTimeout(() => router.push("/settlement"), 2000);
      return;
    }

    const contract = getWriteContract();
    if (!contract) return;

    setTxPending(true);
    try {
      const tx = await contract.lockIn(Number(roomId));
      await tx.wait();
      setPhase("locked");
      // GameSettled event will navigate to settlement
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lock-in failed";
      alert(msg);
    } finally {
      setTxPending(false);
    }
  };

  // Recast
  const handleRecast = useCallback(async () => {
    if (castCount >= 3) return;

    if (!canStartFishing) {
      alert("Please select a rod first.");
      return;
    }

    if (!isContractReady || !roomId || isDemoFishing) {
      setPhase("dice_roll");
      return;
    }

    const contract = getWriteContract();
    if (!contract) return;

    setTxPending(true);
    try {
      const tx = await contract.recast(Number(roomId), selectedRodId || 0, {
        value: ethers.parseEther(recastFee),
      });
      await tx.wait();
      setPhase("dice_roll");
      // DiceRolled event will update the dice result
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Recast failed";
      alert(msg);
    } finally {
      setTxPending(false);
    }
  }, [castCount, isContractReady, roomId, getWriteContract, recastFee, selectedRodId, canStartFishing, isDemoFishing]);

  // Dice result (mock fallback)
  const handleDiceFinish = (buff: { text: string; isBuff: boolean }) => {
    if (!isContractReady) {
      setDiceResult(buff);
      setBuffs(prev => [...prev, buff.isBuff ? "⬆️" : "⬇️"]);
      setCastCount(c => c + 1);
      setTimeout(() => {
        setDiceResult(null);
        setPhase("waiting_cast");
      }, 2500);
    }
    // In contract mode, DiceRolled event handles this
  };

  return (
    <div style={{
      width: "100vw", height: "100vh",
      overflow: "hidden", position: "relative",
      background: "linear-gradient(180deg, #87CEEB 0%, #B8E4F9 35%, #4A9DB5 60%, #2E6B8A 100%)",
    }}
    onClick={undefined}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {/* Background */}
      <GameBackground />

      {/* Top status bar */}
      <TopBar
        castCount={castCount}
        totalPot={totalPot}
        timeLeft={timeLeft}
      />

      {/* Player status */}
      <PlayerSidebar players={others} />

      {/* Rod selection */}
      {phase === "waiting_cast" && (
        <RodSelectionPanel
          rods={eligibleRods}
          selectedRodId={selectedRodId}
          canStartFishing={canStartFishing}
          isDemoFishing={isDemoFishing}
          hasWalletRods={ownedRods.length > 0}
          totalUsableRods={usableRods.length}
          roomTier={roomTier}
          requiredRodLevel={requiredRodLevel}
          onSelect={setSelectedRodId}
          onStart={handleCast}
        />
      )}

      {/* Buff area */}
      {buffs.length > 0 && <BuffArea buffs={buffs} />}

      {/* Game area */}
      <CentralArea
        phase={phase}
        fish={fish}
        onReel={handleReel}
        onLockIn={handleLockIn}
        onRecast={handleRecast}
        castCount={castCount}
        recastFee={recastFee}
        txPending={txPending}
      />

      {/* Dice modal */}
      {phase === "dice_roll" && !isContractReady && (
        <DiceModal onFinish={handleDiceFinish} recastNumber={castCount + 1} />
      )}
      {phase === "dice_roll" && isContractReady && (
        <DiceModalContract diceResult={diceResult} recastNumber={castCount + 1} />
      )}
    </div>
  );
}

// ── Background component ────────────────────────────────
function GameBackground() {
  return (
    <>
      {/* Mountains */}
      <div style={{
        position: "absolute", bottom: "38%", left: 0, right: 0,
        height: "100px",
        background: "linear-gradient(180deg, #A8C5A0, #7AAD70)",
        clipPath: "ellipse(55% 100% at 45% 100%)",
        opacity: 0.5,
      }}/>
      <div style={{
        position: "absolute", bottom: "36%", left: "20%", right: "-10%",
        height: "80px",
        background: "linear-gradient(180deg, #B8D4B0, #8ABD80)",
        clipPath: "ellipse(50% 100% at 55% 100%)",
        opacity: 0.4,
      }}/>
      {/* Water */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "38%",
        background: "linear-gradient(180deg, #4A9DB5 0%, #1E5F7A 100%)",
      }}/>
      {/* Dock */}
      <div style={{
        position: "absolute",
        bottom: "38%", left: "50%",
        transform: "translateX(-50%)",
        width: "120px", height: "24px",
        background: "#8B6355",
        borderRadius: "4px 4px 0 0",
      }}/>
      {/* Fishing line */}
      <div style={{
        position: "absolute",
        bottom: "38%", left: "50%",
        width: "2px", height: "80px",
        background: "rgba(255,255,255,0.5)",
        transformOrigin: "top center",
      }}/>
    </>
  );
}

// ── Top status bar ──────────────────────────────────────
function TopBar({ castCount, totalPot, timeLeft }: {
  castCount: number; totalPot: number; timeLeft: number;
}) {
  const isUrgent = timeLeft <= 20;
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      height: "64px",
      background: "rgba(255,255,255,0.15)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(255,255,255,0.2)",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px", zIndex: 50,
    }}>
      {/* Round */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "white", opacity: 0.8 }}>
          Round {castCount + 1}
        </span>
        <div style={{ display: "flex", gap: "5px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: i < castCount ? "white"
                : i === castCount ? "var(--coral)"
                : "rgba(255,255,255,0.3)",
              boxShadow: i === castCount ? "0 0 6px var(--coral)" : "none",
              animation: i === castCount ? "pulse-glow 1.5s ease-in-out infinite" : "none",
            }}/>
          ))}
        </div>
      </div>

      {/* Prize Pool */}
      <div style={{
        background: "var(--yellow-soft)",
        borderRadius: "20px", padding: "6px 16px",
        display: "flex", alignItems: "center", gap: "6px",
        border: "1px solid #F0E06A",
      }}>
        <span style={{ fontSize: "14px", animation: "spin 4s linear infinite" }}>🪙</span>
        <span style={{ fontWeight: 900, fontSize: "16px", color: "var(--brown)" }}>
          {totalPot.toFixed(3)} ETH
        </span>
      </div>

      {/* Countdown */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        color: isUrgent ? "var(--coral)" : "white",
        transition: "color 0.3s ease",
      }}>
        <span style={{
          fontSize: "18px",
          animation: isUrgent ? "wiggle 0.5s ease-in-out infinite" : "none",
        }}>⏳</span>
        <span style={{ fontWeight: 800, fontSize: "16px", fontVariantNumeric: "tabular-nums" }}>
          {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

// ── Player status sidebar ───────────────────────────────
function PlayerSidebar({ players }: { players: OtherPlayer[] }) {
  return (
    <div style={{
      position: "absolute", top: "80px", right: "16px",
      display: "flex", flexDirection: "column", gap: "8px",
      zIndex: 40, width: "160px",
    }}>
      {players.map((p, i) => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(6px)",
          borderRadius: "16px", padding: "10px 12px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <div style={{
              width: "32px", height: "32px",
              background: "linear-gradient(135deg, #B2DFDB, #80CBC4)",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", flexShrink: 0,
            }}>🐡</div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: "11px", fontWeight: 800,
                color: "var(--brown)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{p.ens}</div>
              <div style={{ fontSize: "14px" }}>
                {STATUS_EMOJI[p.status]}
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{
            height: "4px", background: "#EEE", borderRadius: "2px", overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: p.status === "locked" ? "90%" : p.status === "caught" ? "60%" : "30%",
              background: p.status === "locked"
                ? "var(--mint-dark)" : "var(--coral-light)",
              borderRadius: "2px",
              transition: "width 0.5s ease",
            }}/>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Buff area ────────────────────────────────────────────
function BuffArea({ buffs }: { buffs: string[] }) {
  return (
    <div style={{
      position: "absolute", top: "80px", left: "16px",
      zIndex: 40,
    }}>
      <div style={{
        fontSize: "10px", fontWeight: 700,
        color: "rgba(255,255,255,0.7)",
        marginBottom: "6px",
      }}>Buffs</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {buffs.map((b, i) => (
          <div key={i} style={{
            width: "32px", height: "32px",
            background: "rgba(255,255,255,0.85)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>{b}</div>
        ))}
      </div>
    </div>
  );
}

function RodSelectionPanel({ rods, selectedRodId, canStartFishing, isDemoFishing, hasWalletRods, totalUsableRods, roomTier, requiredRodLevel, onSelect, onStart }: {
  rods: RodData[];
  selectedRodId: number;
  canStartFishing: boolean;
  isDemoFishing: boolean;
  hasWalletRods: boolean;
  totalUsableRods: number;
  roomTier: RoomTier;
  requiredRodLevel: number;
  onSelect: (tokenId: number) => void;
  onStart: () => void;
}) {
  const selectedRod = rods.find(rod => rod.tokenId === selectedRodId) ?? null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 90,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(18, 55, 74, 0.22)",
      backdropFilter: "blur(5px)",
      padding: "24px",
    }}>
      <div style={{
        width: "min(1040px, 100%)",
        borderRadius: "30px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,244,236,0.98))",
        boxShadow: "0 28px 90px rgba(12, 32, 48, 0.30)",
        border: "1px solid rgba(139,99,85,0.16)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "22px 24px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(139,99,85,0.10)",
        }}>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--brown)", marginBottom: "6px" }}>My Rods</div>
            <div style={{ fontSize: "14px", color: "var(--brown-light)" }}>
              Select a rod, then click to start fishing
            </div>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--brown-light)", fontWeight: 600 }}>
              {requiredRodLevel <= 0
                ? `This room (${roomTier}) requires at least one rod`
                : `This room (${roomTier}) only shows Lv.${requiredRodLevel}+ rods`}
            </div>
          </div>
          <div style={{ fontSize: "30px" }}>🎣</div>
        </div>

        <div style={{ padding: "20px 24px 24px" }}>
          {rods.length === 0 ? (
            <div style={{
              padding: "18px 16px",
              borderRadius: "18px",
              background: "var(--cream)",
              color: "var(--brown-light)",
              fontSize: "14px",
              lineHeight: 1.7,
            }}>
              {totalUsableRods > 0
                ? requiredRodLevel <= 0
                  ? "No rods available."
                  : `No rods meet the level requirement (Lv.${requiredRodLevel}+).`
                : "No rods available. Demo rods will be provided to try the fishing experience."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
              {rods.map(rod => {
                const info = ROD_TYPES[rod.type];
                const isSelected = rod.tokenId === selectedRodId;
                const effectTags = [
                  `Speed ${rod.attributes.speedBonus ?? 0}%`,
                  `Weight ${rod.attributes.weightBonus ?? 0}%`,
                  `Luck ${rod.attributes.luckBonus ?? 0}%`,
                  `Stability ${Math.round((rod.attributes.stabilityBps ?? 0) / 100)}%`,
                ];
                return (
                  <button
                    key={rod.tokenId}
                    onClick={() => onSelect(rod.tokenId)}
                    style={{
                      textAlign: "left",
                      width: "100%",
                      border: `1px solid ${isSelected ? "var(--coral)" : "rgba(139,99,85,0.12)"}`,
                      background: isSelected ? "linear-gradient(180deg, rgba(255,123,107,0.12), rgba(255,255,255,0.98))" : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,248,243,0.98))",
                      borderRadius: "20px",
                      padding: "16px",
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 14px 30px rgba(255,123,107,0.14)" : "0 8px 20px rgba(12, 32, 48, 0.06)",
                      minHeight: "190px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <div style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "16px",
                          background: isSelected ? "linear-gradient(135deg, rgba(255,123,107,0.18), rgba(255,223,126,0.22))" : "var(--cream)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "30px",
                          flexShrink: 0,
                        }}>{info.icon}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--brown)" }}>
                            #{rod.tokenId} · {info.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--brown-light)", marginTop: "4px" }}>
                            Lv.{rod.level} · HP {rod.durability}/{rod.maxDurability}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        color: isSelected ? "var(--coral)" : "var(--brown-light)",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: isSelected ? "rgba(255,123,107,0.12)" : "rgba(139,99,85,0.07)",
                      }}>
                        {isSelected ? "Selected" : "Select"}
                      </div>
                    </div>

                    <div style={{ marginTop: "14px", fontSize: "12px", color: "var(--brown)", fontWeight: 700 }}>
                      Affects this game
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                      {effectTags.map(tag => (
                        <span key={tag} style={{
                          padding: "5px 9px",
                          borderRadius: "999px",
                          background: "rgba(139,99,85,0.06)",
                          fontSize: "11px",
                          color: "var(--brown)",
                        }}>{tag}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedRod && (
            <div style={{
              marginTop: "16px",
              padding: "14px 16px",
              borderRadius: "18px",
              background: isDemoFishing ? "linear-gradient(135deg, rgba(37,99,235,0.10), rgba(14,165,233,0.12))" : "linear-gradient(135deg, rgba(255,123,107,0.10), rgba(255,223,126,0.14))",
              fontSize: "13px",
              color: "var(--brown)",
              lineHeight: 1.7,
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "center",
            }}>
              <div>
                Currently using rod #{selectedRod.tokenId}.
                {isDemoFishing && <div style={{ fontSize: "12px", color: "var(--brown-light)" }}>This is a demo rod for the full fishing experience.</div>}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 800 }}>
                {canStartFishing ? "Ready" : "Unavailable"}
              </div>
            </div>
          )}

          <div style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}>
            <div style={{ fontSize: "12px", color: "var(--brown-light)" }}>
              {hasWalletRods ? "Wallet rods loaded" : "Using demo rod data"}
            </div>
            // Start fishing button
            <button
              className="btn-primary"
              onClick={() => {
                console.log("Start Fishing clicked, canStartFishing:", canStartFishing);
                onStart();          // This calls handleCast
              }}
              disabled={!canStartFishing}
              style={{
                minWidth: "160px",
                opacity: canStartFishing ? 1 : 0.5,
                cursor: canStartFishing ? "pointer" : "not-allowed",
              }}
            >
              Start Fishing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Game area ───────────────────────────────────────────
function CentralArea({ phase, fish, onReel, onLockIn, onRecast, castCount, recastFee, txPending }: {
  phase: GamePhase;
  fish: FishResult | null;
  onReel: (r: "perfect" | "good" | "ok" | "miss") => void;
  onLockIn: () => void;
  onRecast: () => void;
  castCount: number;
  recastFee: string;
  txPending: boolean;
}) {
  return (
    <div style={{
      position: "absolute",
      top: "64px", left: 0, right: "192px", bottom: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {phase === "waiting_cast" && <WaitingCastUI txPending={txPending} />}
      {phase === "waiting_vrf"  && <WaitingVRFUI />}
      {phase === "reeling"      && <ReelingBar onResult={onReel} />}
      {(phase === "fish_result" || phase === "decision") && fish && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <FishCard fish={fish} />
          {phase === "decision" && (
            <DecisionButtons
              onLockIn={onLockIn}
              onRecast={onRecast}
              castCount={castCount}
              recastFee={recastFee}
              txPending={txPending}
            />
          )}
        </div>
      )}
      {phase === "locked" && (
        <div style={{
          background: "rgba(255,255,255,0.9)",
          borderRadius: "24px", padding: "32px 48px",
          textAlign: "center",
          animation: "bounce-in 0.4s ease forwards",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>✅</div>
          <div style={{ fontWeight: 800, fontSize: "20px", color: "var(--brown)" }}>
            Result locked!
          </div>
          <div style={{ fontSize: "13px", color: "var(--brown-light)", marginTop: "4px" }}>
            Waiting for other players...
          </div>
        </div>
      )}
    </div>
  );
}

// ── Waiting to cast UI ──────────────────────────────────
function WaitingCastUI({ txPending }: { txPending: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* Fish shadow */}
      <div style={{
        position: "relative", width: "300px", height: "120px", marginBottom: "24px",
      }}>
        {[
          { size: 60, opacity: 0.25, x: 40, y: 20, delay: "0s" },
          { size: 90, opacity: 0.35, x: 130, y: 50, delay: "1.2s" },
          { size: 45, opacity: 0.2,  x: 220, y: 15, delay: "0.6s" },
        ].map((s, i) => (
          <div key={i} style={{
            position: "absolute",
            left: s.x, top: s.y,
            fontSize: s.size / 3,
            opacity: s.opacity,
            filter: "blur(1px) grayscale(1)",
            animation: `float 3s ease-in-out infinite`,
            animationDelay: s.delay,
          }}>🐟</div>
        ))}
      </div>

      {/* Cast button */}
      <div style={{
        width: "180px", height: "180px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.2)",
        border: "3px dashed rgba(255,123,107,0.6)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: txPending ? "wait" : "pointer",
        animation: "pulse-glow 2s ease-in-out infinite",
        backdropFilter: "blur(4px)",
        margin: "0 auto",
        opacity: txPending ? 0.6 : 1,
      }}>
        <span style={{ fontSize: "48px", marginBottom: "4px" }}>🎣</span>
        <span style={{
          fontWeight: 800, fontSize: "15px", color: "white",
          textShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}>{txPending ? "Sending..." : "Tap to Cast"}</span>
        <span style={{
          fontSize: "11px", color: "rgba(255,255,255,0.7)",
          marginTop: "2px",
        }}>{txPending ? "Waiting for tx confirmation" : "Tap anywhere"}</span>
      </div>
    </div>
  );
}

// ── Waiting for VRF UI ──────────────────────────────────
function WaitingVRFUI() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: "48px", marginBottom: "16px",
        animation: "float 1s ease-in-out infinite",
      }}>🎣</div>
      <div style={{
        background: "rgba(255,255,255,0.85)",
        borderRadius: "20px", padding: "16px 28px",
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          fontWeight: 700, fontSize: "15px", color: "var(--brown)",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>🐠</span>
          Fish are thinking...
        </div>
      </div>
    </div>
  );
}

// ── Reeling bar ─────────────────────────────────────────
function ReelingBar({ onResult }: {
  onResult: (r: "perfect" | "good" | "ok" | "miss") => void;
}) {
  const [pos, setPos] = useState(50); // 0-100
  const [dir, setDir] = useState(1);
  const [speed] = useState(1.2 + Math.random() * 0.8);
  const [feedback, setFeedback] = useState<string | null>(null);
  const posRef = useRef(50);
  const dirRef = useRef(1);
  const doneRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const animate = () => {
      if (doneRef.current) return;
      posRef.current += dirRef.current * speed;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0)   { posRef.current = 0;   dirRef.current = 1; }
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed]);

  const handleHit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const p = posRef.current;
    let result: "perfect" | "good" | "ok" | "miss";
    let fb: string;
    if (p >= 35 && p <= 65) { result = "perfect"; fb = "Perfect ✨"; }
    else if ((p >= 20 && p < 35) || (p > 65 && p <= 80)) { result = "good"; fb = "Nice! 👍"; }
    else if ((p >= 10 && p < 20) || (p > 80 && p <= 90)) { result = "ok";   fb = "Close call! 😅"; }
    else { result = "miss"; fb = "Missed! 💦"; }
    setFeedback(fb);
    setTimeout(() => onResult(result), 900);
  }, [onResult]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); handleHit(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleHit]);

  // Zone colors
  const getZoneColor = (p: number) => {
    if (p >= 35 && p <= 65) return "#4CAF50";
    if ((p >= 20 && p < 35) || (p > 65 && p <= 80)) return "#FFC107";
    return "#F44336";
  };

  return (
    <div
      onClick={handleHit}
      style={{
        background: "rgba(255,255,255,0.92)",
        borderRadius: "24px", padding: "24px 32px",
        width: "480px", textAlign: "center",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        cursor: "pointer",
        animation: "bounce-in 0.3s ease forwards",
      }}>
      <div style={{
        fontSize: "13px", fontWeight: 700,
        color: "var(--brown-light)", marginBottom: "12px",
      }}>
        Fish on! Press <kbd style={{
          background: "var(--cream)", borderRadius: "6px",
          padding: "2px 8px", border: "1px solid var(--cream-dark)",
          fontFamily: "monospace",
        }}>Space</kbd> or tap to reel in!
      </div>

      {/* Bar track */}
      <div style={{
        position: "relative", height: "52px",
        borderRadius: "26px", overflow: "hidden",
        background: "#F44336",
        marginBottom: "12px",
      }}>
        {/* Yellow zone */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: "20%", right: "20%",
          background: "#FFC107",
        }}/>
        {/* Green zone */}
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: "35%", right: "35%",
          background: "#4CAF50",
        }}/>

        {/* Bird pointer */}
        <div style={{
          position: "absolute", top: "50%",
          left: `${pos}%`,
          transform: "translate(-50%, -50%)",
          fontSize: "28px",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
          transition: "none",
          zIndex: 2,
        }}>🐦</div>
      </div>

      {/* Zone labels */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: "10px", color: "var(--brown-light)", fontWeight: 600,
        marginBottom: "8px", padding: "0 4px",
      }}>
        <span style={{ color: "#F44336" }}>Danger 50%</span>
        <span style={{ color: "#FFC107" }}>Normal 80%</span>
        <span style={{ color: "#4CAF50" }}>Perfect 100%</span>
        <span style={{ color: "#FFC107" }}>Normal 80%</span>
        <span style={{ color: "#F44336" }}>Danger 50%</span>
      </div>

      {/* Feedback */}
      {feedback && (
        <div style={{
          fontSize: "20px", fontWeight: 900,
          color: getZoneColor(posRef.current),
          animation: "bounce-in 0.3s ease forwards",
        }}>{feedback}</div>
      )}
    </div>
  );
}

// ── Fish result card ────────────────────────────────────
function FishCard({ fish }: { fish: FishResult }) {
  const isLegendary = fish.rarity === "Legendary";
  return (
    <div style={{
      width: "260px",
      background: RARITY_BG[fish.rarity],
      borderRadius: "24px",
      padding: "24px",
      textAlign: "center",
      border: `2px solid ${RARITY_COLORS[fish.rarity]}40`,
      boxShadow: isLegendary
        ? `0 0 30px ${RARITY_COLORS[fish.rarity]}60, 0 8px 32px rgba(0,0,0,0.15)`
        : "0 8px 32px rgba(0,0,0,0.12)",
      animation: "bounce-in 0.5s ease forwards",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Legendary glow */}
      {isLegendary && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "300px", height: "300px",
          background: `radial-gradient(circle, ${RARITY_COLORS[fish.rarity]}20 0%, transparent 70%)`,
          animation: "spin 8s linear infinite",
          pointerEvents: "none",
        }}/>
      )}

      {/* Fish emoji */}
      <div style={{
        fontSize: "64px", marginBottom: "8px",
        animation: "float 2s ease-in-out infinite",
        position: "relative", zIndex: 1,
      }}>{fish.emoji}</div>

      {/* Rarity tag */}
      <div style={{
        display: "inline-block",
        background: `${RARITY_COLORS[fish.rarity]}20`,
        color: RARITY_COLORS[fish.rarity],
        borderRadius: "8px", padding: "3px 10px",
        fontSize: "11px", fontWeight: 800,
        marginBottom: "8px",
      }}>{fish.rarity}</div>

      {/* Fish name */}
      <div style={{
        fontFamily: "var(--font-serif)",
        fontSize: "22px", fontWeight: 700,
        color: "var(--brown)", marginBottom: "16px",
      }}>{fish.name}</div>

      {/* Stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: "8px",
      }}>
        {[
          { icon: "⚖️", label: "Weight", value: `${fish.weight} kg` },
          { icon: "⭐", label: "Est. Score", value: `${fish.score}` },
        ].map(item => (
          <div key={item.label} style={{
            background: "rgba(255,255,255,0.6)",
            borderRadius: "12px", padding: "10px 8px",
          }}>
            <div style={{ fontSize: "18px" }}>{item.icon}</div>
            <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
              {item.label}
            </div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--brown)" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Decision buttons ────────────────────────────────────
function DecisionButtons({ onLockIn, onRecast, castCount, recastFee, txPending }: {
  onLockIn: () => void;
  onRecast: () => void;
  castCount: number;
  recastFee: string;
  txPending: boolean;
}) {
  const canRecast = castCount < 3;
  return (
    <div style={{
      display: "flex", gap: "12px",
      animation: "bounce-in 0.4s ease forwards",
    }}>
      <button className="btn-primary" onClick={onLockIn} disabled={txPending} style={{
        background: "linear-gradient(135deg, #4CAF50, #388E3C)",
        boxShadow: "0 4px 12px rgba(76,175,80,0.4)",
        padding: "14px 24px", fontSize: "14px",
        borderRadius: "16px", minWidth: "140px",
        opacity: txPending ? 0.6 : 1,
      }}>
        {txPending ? "Confirming..." : "Keep this catch! ✨"}
      </button>

      {canRecast && (
        <button className="btn-primary" onClick={onRecast} disabled={txPending} style={{
          padding: "14px 24px", fontSize: "14px",
          borderRadius: "16px", minWidth: "140px",
          opacity: txPending ? 0.6 : 1,
        }}>
          <div>{txPending ? "Confirming..." : "Try again 🎣"}</div>
          <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "2px" }}>
            +{recastFee} ETH
          </div>
        </button>
      )}
    </div>
  );
}

// ── Dice modal (Mock fallback) ──────────────────────────
function DiceModal({ onFinish, recastNumber }: {
  onFinish: (buff: { text: string; isBuff: boolean }) => void;
  recastNumber: number;
}) {
  const [stage, setStage] = useState<"rolling" | "result">("rolling");
  const [result, setResult] = useState<{ text: string; isBuff: boolean } | null>(null);

  const BUFFS = [
    { text: "Rarity chance +20%", isBuff: true },
    { text: "Weight bonus +25%", isBuff: true },
    { text: "Time coefficient boost", isBuff: true },
    { text: "Guaranteed Rare+!", isBuff: true },
    { text: "Rarity downgrade", isBuff: false },
    { text: "Time penalty -10s", isBuff: false },
  ];

  useEffect(() => {
    const t = setTimeout(() => {
      const r = recastNumber >= 3
        ? (Math.random() > 0.5 ? BUFFS[3] : BUFFS[5])
        : BUFFS[Math.floor(Math.random() * BUFFS.length)];
      setResult(r);
      setStage("result");
      setTimeout(() => onFinish(r), 2000);
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "white", borderRadius: "32px",
        padding: "32px", width: "320px", textAlign: "center",
        animation: "bounce-in 0.4s ease forwards",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          fontSize: "13px", fontWeight: 700,
          color: "var(--brown-light)", marginBottom: "16px",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Recast Dice #{recastNumber}
        </div>

        {stage === "rolling" ? (
          <>
            <div style={{ fontSize: "72px", animation: "spin 0.3s linear infinite" }}>🎲</div>
            <div style={{
              marginTop: "16px", fontSize: "14px",
              color: "var(--brown-light)", fontWeight: 600,
            }}>Rolling the dice of fate...</div>
          </>
        ) : result ? (
          <>
            <div style={{
              fontSize: "64px", marginBottom: "12px",
              animation: "bounce-in 0.4s ease forwards",
            }}>{result.isBuff ? "🌟" : "💀"}</div>
            <div style={{
              fontSize: "20px", fontWeight: 900,
              color: result.isBuff ? "#4CAF50" : "#F44336",
              animation: "bounce-in 0.4s ease forwards",
            }}>{result.text}</div>
            <div style={{
              fontSize: "12px", color: "var(--brown-light)",
              marginTop: "8px",
            }}>
              {result.isBuff ? "Lucky break! ✨" : "Bad luck, but you can turn it around!"}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Dice modal (Contract mode - waits for DiceRolled event) ──
function DiceModalContract({ diceResult, recastNumber }: {
  diceResult: { text: string; isBuff: boolean } | null;
  recastNumber: number;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200,
    }}>
      <div style={{
        background: "white", borderRadius: "32px",
        padding: "32px", width: "320px", textAlign: "center",
        animation: "bounce-in 0.4s ease forwards",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          fontSize: "13px", fontWeight: 700,
          color: "var(--brown-light)", marginBottom: "16px",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Recast Dice #{recastNumber}
        </div>

        {!diceResult ? (
          <>
            <div style={{ fontSize: "72px", animation: "spin 0.3s linear infinite" }}>🎲</div>
            <div style={{
              marginTop: "16px", fontSize: "14px",
              color: "var(--brown-light)", fontWeight: 600,
            }}>Rolling the dice of fate...</div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: "64px", marginBottom: "12px",
              animation: "bounce-in 0.4s ease forwards",
            }}>{diceResult.isBuff ? "🌟" : "💀"}</div>
            <div style={{
              fontSize: "20px", fontWeight: 900,
              color: diceResult.isBuff ? "#4CAF50" : "#F44336",
              animation: "bounce-in 0.4s ease forwards",
            }}>{diceResult.text}</div>
            <div style={{
              fontSize: "12px", color: "var(--brown-light)",
              marginTop: "8px",
            }}>
              {diceResult.isBuff ? "Lucky break! ✨" : "Bad luck, but you can turn it around!"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
