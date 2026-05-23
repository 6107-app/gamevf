"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { useContract } from "@/lib/ethereum";
import { FISHING_GAME_ADDRESS, TIER_NAMES, ROOM_STATUS } from "@/lib/contract";
import { ethers } from "ethers";

type RoomTier = "Bronze" | "Silver" | "Gold" | "Diamond";

interface PlayerData {
  address: string;
  ens: string;
  rod: string;
  joined: boolean;
}

const MOCK_PLAYERS: PlayerData[] = [
  { address: "0xEf4b...3D2E", ens: "sakura.eth", rod: "Speed Rod +2", joined: true },
  { address: "0xEb0A...3324", ens: "vitalik.eth", rod: "Lucky Rod", joined: true },
  { address: "", ens: "", rod: "", joined: false },
  { address: "", ens: "", rod: "", joined: false },
];

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WaitingRoomPage() {
  return (
    <Suspense>
      <WaitingRoom />
    </Suspense>
  );
}

function WaitingRoom() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");

  const { wallet, getReadContract, getRpcReadContract, getWriteContract } = useContract();
  const isContractReady = wallet.address && FISHING_GAME_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const [players, setPlayers] = useState<PlayerData[]>(MOCK_PLAYERS);
  const [roomTier, setRoomTier] = useState<RoomTier>("Bronze");
  const [roomName, setRoomName] = useState("Reed Bay #3");
  const [pot, setPot] = useState(0.02);
  const [entryFee, setEntryFee] = useState(0.01);
  const [hostAddress, setHostAddress] = useState<string>("");
  const [isHost, setIsHost] = useState(true);
  const [loading, setLoading] = useState(false);

  // Fetch room data from contract
  const fetchRoomData = useCallback(async () => {
    if (!isContractReady || !roomId) return;
    const contract = getReadContract();
    if (!contract) return;

    try {
      const info = await contract.getRoomInfo(Number(roomId));
      const tierIndex = Number(info.tier);
      const tier = TIER_NAMES[tierIndex] as RoomTier;
      const pCount = Number(info.playerCount);
      const fee = ethers.formatEther(info.entryFee);
      const totalPot = ethers.formatEther(info.totalPot);

      setRoomTier(tier);
      setRoomName(`${tier} Room #${roomId}`);
      setPot(parseFloat(totalPot));
      setEntryFee(parseFloat(fee));
      setHostAddress(info.host);
      setIsHost(wallet.address?.toLowerCase() === info.host.toLowerCase());

      // Fetch player data
      const fetchedPlayers: PlayerData[] = [];
      for (let i = 0; i < 4; i++) {
        if (i < pCount) {
          try {
            const pInfo = await contract.getPlayerInfo(Number(roomId), i);
            fetchedPlayers.push({
              address: pInfo.addr,
              ens: shortenAddress(pInfo.addr),
              rod: "Standard Rod",
              joined: true,
            });
          } catch {
            fetchedPlayers.push({ address: "", ens: "", rod: "", joined: false });
          }
        } else {
          fetchedPlayers.push({ address: "", ens: "", rod: "", joined: false });
        }
      }
      setPlayers(fetchedPlayers);
    } catch {
      // Keep mock data on error
    }
  }, [isContractReady, roomId, getReadContract, wallet.address]);

  useEffect(() => {
    fetchRoomData();
  }, [fetchRoomData]);

  // Listen for PlayerJoined events
  useEffect(() => {
    if (!isContractReady || !roomId) return;
    const contract = getRpcReadContract();
    if (!contract) return;

    const roomIdNum = Number(roomId);
    const onPlayerJoined = (eventRoomId: bigint) => {
      if (Number(eventRoomId) === roomIdNum) {
        fetchRoomData();
      }
    };
    const onGameStarted = (eventRoomId: bigint) => {
      if (Number(eventRoomId) === roomIdNum) {
        router.push(`/game/${roomId}`);
      }
    };

    contract.on("PlayerJoined", onPlayerJoined);
    contract.on("GameStarted", onGameStarted);
    return () => {
      contract.off("PlayerJoined", onPlayerJoined);
      contract.off("GameStarted", onGameStarted);
    };
  }, [isContractReady, roomId, getReadContract, fetchRoomData, router]);

  const playerCount = players.filter(p => p.joined).length;
  const canStart = playerCount >= 2;

  // Start game handler
  const handleStartGame = async () => {
    if (!isContractReady || !roomId) {
      router.push("/game/0");
      return;
    }

    const contract = getWriteContract();
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.startGame(Number(roomId));
      await tx.wait();
      router.push(`/game/${roomId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to start";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // Water surface bubbles
  const [bubbles, setBubbles] = useState<{ id: number; x: number; delay: number }[]>([]);
  useEffect(() => {
    const interval = setInterval(() => {
      setBubbles(prev => [
        ...prev.slice(-8),
        { id: Date.now(), x: Math.random() * 100, delay: 0 },
      ]);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const TIER_BADGE_COLORS: Record<RoomTier, { bg: string; color: string }> = {
    Bronze:  { bg: "#FFF5EE", color: "#C8956C" },
    Silver:  { bg: "#F0F5FA", color: "#A8B8C8" },
    Gold:    { bg: "#FFFDE7", color: "#E8C547" },
    Diamond: { bg: "#F5F0FF", color: "#B39DDB" },
  };

  const maxPot = entryFee * 4 * 0.95;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #B8E4F9 0%, #7EC8E3 30%, #4A9DB5 60%, #2E7A96 100%)",
      position: "relative",
      overflow: "hidden",
    }}>
      <Navbar
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
      />

      {/* Background: distant mountains */}
      <div style={{
        position: "absolute", bottom: "30%", left: 0, right: 0,
        height: "120px",
        background: "linear-gradient(180deg, #A8C5A0 0%, #7AAD70 100%)",
        clipPath: "ellipse(60% 100% at 50% 100%)",
        opacity: 0.6,
      }}/>

      {/* Water surface */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "35%",
        background: "linear-gradient(180deg, #4A9DB5 0%, #2E6B8A 100%)",
        opacity: 0.85,
      }}/>

      {/* Bubbles */}
      {bubbles.map(b => (
        <div key={b.id} style={{
          position: "absolute",
          bottom: "35%",
          left: `${b.x}%`,
          width: "8px", height: "8px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.6)",
          animation: "bubbleRise 3s ease-out forwards",
        }}/>
      ))}

      {/* Main card */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "480px",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderRadius: "32px",
        padding: "32px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <button
          onClick={() => router.push("/")}
          style={{
            position: "absolute",
            top: "18px",
            left: "18px",
            background: "white",
            border: "1px solid var(--cream-dark)",
            borderRadius: "12px",
            padding: "8px 12px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--brown)",
          }}
        >
          ← Back to Lobby
        </button>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            fontSize: "24px", fontWeight: 800,
            color: "var(--brown)",
            fontFamily: "var(--font-serif)",
          }}>Waiting for Anglers 🎣</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "6px" }}>
            <span style={{ fontSize: "13px", color: "var(--brown-light)", fontWeight: 600 }}>
              {roomName}
            </span>
            <span style={{
              background: TIER_BADGE_COLORS[roomTier].bg,
              color: TIER_BADGE_COLORS[roomTier].color,
              borderRadius: "8px", padding: "2px 8px",
              fontSize: "11px", fontWeight: 700,
            }}>{roomTier}</span>
          </div>
        </div>

        {/* Player slots */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {players.map((player, i) => (
            <PlayerSlot
              key={i}
              player={player}
              index={i}
              isMe={!!wallet.address && player.address.toLowerCase() === wallet.address.toLowerCase()}
              isHostSlot={isContractReady ? player.address.toLowerCase() === hostAddress.toLowerCase() : i === 0}
            />
          ))}
        </div>

        {/* Divider + prize pool */}
        <div style={{
          height: "1px", background: "var(--cream-dark)", margin: "4px 0 16px",
        }}/>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "8px", marginBottom: "20px",
        }}>
          <span style={{ fontSize: "13px", color: "var(--brown-light)", fontWeight: 600 }}>
            Current Prize Pool
          </span>
          <span style={{
            background: "var(--yellow-soft)",
            border: "1px solid #F0E06A",
            borderRadius: "10px",
            padding: "4px 12px",
            fontSize: "16px", fontWeight: 900,
            color: "var(--brown)",
          }}>
            💰 {pot.toFixed(2)} ETH
          </span>
          <span style={{ fontSize: "12px", color: "var(--brown-light)" }}>
            Full: {maxPot.toFixed(3)} ETH
          </span>
        </div>

        {/* Buttons */}
        {isHost ? (
          <div>
            <button
              className="btn-primary"
              onClick={handleStartGame}
              disabled={!canStart || loading}
              style={{
                width: "100%", height: "52px",
                fontSize: "16px", borderRadius: "16px",
                opacity: canStart && !loading ? 1 : 0.5,
                cursor: canStart && !loading ? "pointer" : "not-allowed",
                animation: canStart && !loading ? "pulse-glow 2s ease-in-out infinite" : "none",
              }}
            >
              {loading ? "Waiting for on-chain confirmation..." : "Start Game ▶"}
            </button>
            {!canStart && (
              <div style={{
                textAlign: "center", marginTop: "8px",
                fontSize: "12px", color: "var(--brown-light)",
              }}>
                At least 2 players needed to start
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: "10px",
            color: "var(--brown-light)", fontSize: "14px", fontWeight: 600,
          }}>
            <span style={{
              display: "inline-block",
              animation: "spin 1.5s linear infinite",
            }}>⏳</span>
            Waiting for host to start...
          </div>
        )}
      </div>

      <style>{`
        @keyframes bubbleRise {
          0%   { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(-120px) scale(1.5); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes slotAppear {
          0%   { transform: scale(0.9) translateX(-8px); opacity: 0; }
          60%  { transform: scale(1.03) translateX(2px); }
          100% { transform: scale(1) translateX(0); opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

// ── Player slot component ─────────────────────────────────────────
function PlayerSlot({
  player, index, isMe, isHostSlot,
}: {
  player: PlayerData;
  index: number;
  isMe: boolean;
  isHostSlot: boolean;
}) {
  if (player.joined) {
    return (
      <div style={{
        background: isMe ? "#FFF5F4" : "var(--cream)",
        border: `2px solid ${isMe ? "var(--coral)" : "transparent"}`,
        borderRadius: "16px",
        padding: "12px 16px",
        display: "flex", alignItems: "center", gap: "12px",
        animation: "slotAppear 0.4s ease forwards",
        animationDelay: `${index * 0.1}s`,
      }}>
        <div style={{
          width: "40px", height: "40px",
          background: `linear-gradient(135deg, var(--coral-light), var(--coral))`,
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px", flexShrink: 0,
        }}>🐡</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontWeight: 800, fontSize: "14px", color: "var(--brown)",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            {player.ens}
            {isMe && (
              <span style={{
                background: "var(--coral)", color: "white",
                borderRadius: "6px", padding: "1px 6px",
                fontSize: "10px", fontWeight: 700,
              }}>You</span>
            )}
            {isHostSlot && (
              <span style={{
                background: "var(--yellow-soft)", color: "#C8A020",
                borderRadius: "6px", padding: "1px 6px",
                fontSize: "10px", fontWeight: 700,
              }}>Host</span>
            )}
          </div>
          <div style={{
            fontSize: "11px", color: "var(--brown-light)",
            marginTop: "2px", fontWeight: 600,
          }}>🎣 {player.rod}</div>
        </div>
        <span style={{ fontSize: "18px" }}>✅</span>
      </div>
    );
  }

  return (
    <div style={{
      border: "2px dashed var(--cream-dark)",
      borderRadius: "16px",
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: "12px",
      height: "68px",
    }}>
      <div style={{
        width: "40px", height: "40px",
        border: "2px dashed var(--cream-dark)",
        borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "breathe 2s ease-in-out infinite",
        animationDelay: `${index * 0.3}s`,
        flexShrink: 0,
      }}>
        <div style={{
          width: "10px", height: "10px",
          borderRadius: "50%",
          background: "var(--cream-dark)",
        }}/>
      </div>
      <span style={{
        fontSize: "13px", color: "#CCC", fontWeight: 600,
      }}>Waiting...</span>
    </div>
  );
}
