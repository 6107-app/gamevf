"use client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import AnnouncementBar from "@/components/ui/AnnouncementBar";
import RoomCard from "@/components/lobby/RoomCard";
import { useState, useEffect, useCallback } from "react";
import { useContract } from "@/lib/ethereum";
import { FISHING_GAME_ADDRESS, TIER_NAMES, requiredRodLevelForTier, type RoomTier as ContractRoomTier } from "@/lib/contract";
import { ROD_TYPES } from "@/lib/rod";
import { fetchRodsForOwner } from "@/lib/fishingRod";
import { ethers } from "ethers";

type RoomTier = "Bronze" | "Silver" | "Gold" | "Diamond";
type FilterTier = "All" | RoomTier;

interface RoomData {
  roomId: number;
  name: string;
  tier: RoomTier;
  entryFee: string;
  playerCount: number;
  isLivestream: boolean;
}

const TIER_FILTER_COLORS: Record<FilterTier, string> = {
  "All":     "#FF7B6B",
  "Bronze":  "#C8956C",
  "Silver":  "#A8B8C8",
  "Gold":    "#E8C547",
  "Diamond": "#B39DDB",
};

const ROOM_NAMES: Record<RoomTier, string[]> = {
  Bronze:  ["Reed Bay", "Bamboo Bay", "Grass Pond"],
  Silver:  ["Lotus Pond", "Silver Moon Lake", "Breeze Ferry"],
  Gold:    ["Golden Scale Lake", "Koi Pond", "Dragon Gate"],
  Diamond: ["Star Diamond Bay", "Dragon Palace", "Immortal Ferry"],
};

function generateRoomName(tier: RoomTier, roomId: number): string {
  const names = ROOM_NAMES[tier];
  return `${names[roomId % names.length]} #${roomId + 1}`;
}

export default function Home() {
  const [filter, setFilter] = useState<FilterTier>("All");
  const [liveOnly, setLiveOnly] = useState(false);
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayGames, setTodayGames] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const router = useRouter();

  const { wallet, getReadContract, getRpcReadContract, getWriteContract } = useContract();
  const isContractReady = wallet.address && FISHING_GAME_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // Fetch rooms from contract
  const fetchRooms = useCallback(async () => {
    if (!isContractReady) {
      setRooms([]);
      return;
    }
    const contract = getReadContract();
    if (!contract) return;

    setLoading(true);
    try {
      const count = await contract.roomCount();
      const roomCount = Number(count);
      const fetchedRooms: RoomData[] = [];

      for (let i = 0; i < roomCount; i++) {
        try {
          const info = await contract.getRoomInfo(i);
          const tierIndex = Number(info.tier);
          const status = Number(info.status);
          // Only show Waiting rooms in the lobby
          if (status !== 0) continue;
          const tier = TIER_NAMES[tierIndex] as RoomTier;
          fetchedRooms.push({
            roomId: Number(info.id),
            name: generateRoomName(tier, Number(info.id)),
            tier,
            entryFee: ethers.formatEther(info.entryFee),
            playerCount: Number(info.playerCount),
            isLivestream: info.isLivestream,
          });
        } catch {
          // Skip rooms that fail to load
        }
      }

      setRooms(fetchedRooms);
      setTodayGames(roomCount);

      let maxScore = 0;
      for (let i = 0; i < roomCount; i++) {
        try {
          const info = await contract.getRoomInfo(i);
          const pc = Number(info.playerCount);
          for (let j = 0; j < pc; j++) {
            try {
              const p = await contract.getPlayerInfo(i, j);
              const s = Number(p.score);
              if (s > maxScore) maxScore = s;
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
      setBestScore(maxScore);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [isContractReady, getReadContract]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Listen for RoomCreated events to refresh
  useEffect(() => {
    if (!isContractReady) return;
    const contract = getRpcReadContract();
    if (!contract) return;

    const onRoomCreated = () => {
      fetchRooms();
    };
    contract.on("RoomCreated", onRoomCreated);
    return () => {
      contract.off("RoomCreated", onRoomCreated);
    };
  }, [isContractReady, getReadContract, fetchRooms]);

  // Join room handler
  const handleJoin = async (roomId: number, tierName: string, entryFee: string) => {
    if (!isContractReady) {
      alert(`Join Room ${roomId}`);
      return;
    }
    const contract = getWriteContract();
    if (!contract) return;

    try {
      const requiredLevel = requiredRodLevelForTier(tierName as ContractRoomTier);
      const provider = wallet.provider ?? new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545");
      if (wallet.address) {
        const rods = await fetchRodsForOwner(wallet.address, provider, 200);
        const eligible = rods.filter(r => r.level >= requiredLevel);
        if (eligible.length === 0) {
          if (requiredLevel <= 0) {
            alert("You need at least one rod to join a room.");
          } else {
            alert(`Rod level too low! Joining a ${tierName} room requires a Lv.${requiredLevel}+ rod.`);
          }
          return;
        }
      }
      const tx = await contract.joinRoom(roomId, {
        value: ethers.parseEther(entryFee),
      });
      await tx.wait();
      router.push(`/waiting-room?roomId=${roomId}`);
    } catch (e: unknown) {
      const selector = ethers.id("AlreadyInRoom()").slice(0, 10).toLowerCase();
      const insufficientRodSelector = ethers.id("InsufficientRodLevel()").slice(0, 10).toLowerCase();
      const anyErr = e as any;
      const revertData =
        (typeof anyErr?.data === "string" && anyErr.data) ||
        (typeof anyErr?.error?.data === "string" && anyErr.error.data) ||
        (typeof anyErr?.info?.error?.data === "string" && anyErr.info.error.data) ||
        (typeof anyErr?.cause?.data === "string" && anyErr.cause.data) ||
        null;

      if (revertData && revertData.toLowerCase().startsWith(selector)) {
        router.push(`/waiting-room?roomId=${roomId}`);
        return;
      }

      if (revertData && revertData.toLowerCase().startsWith(insufficientRodSelector)) {
        const requiredLevel = requiredRodLevelForTier(tierName as ContractRoomTier);
        if (requiredLevel <= 0) {
          alert("You need at least one rod to join a room.");
        } else {
          alert(`Rod level too low! Joining a ${tierName} room requires a Lv.${requiredLevel}+ rod.`);
        }
        return;
      }

      const msg = anyErr?.shortMessage || anyErr?.message || "Failed to join";
      alert(msg);
    } finally {
    }
  };

  const filtered = rooms.filter(r => {
    if (filter !== "All" && r.tier !== filter) return false;
    if (liveOnly && !r.isLivestream) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar
        walletAddress={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
      />
      <AnnouncementBar />

      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 24px",
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gap: "24px",
      }}>

        {/* Room list */}
        <div>
          {/* Filter bar */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: "10px", marginBottom: "20px", flexWrap: "wrap",
          }}>
            {(["All", "Bronze", "Silver", "Gold", "Diamond"] as FilterTier[]).map(t => (
              <button key={t} onClick={() => setFilter(t)} style={{
                background: filter === t ? TIER_FILTER_COLORS[t] : "white",
                color: filter === t ? "white" : "var(--brown)",
                border: `2px solid ${filter === t ? TIER_FILTER_COLORS[t] : "var(--cream-dark)"}`,
                borderRadius: "20px",
                padding: "8px 18px",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "var(--font-main)",
              }}>{t}</button>
            ))}

            {/* Live only toggle */}
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginLeft: "auto",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brown-light)" }}>
                Live Only
              </span>
              <div onClick={() => setLiveOnly(!liveOnly)} style={{
                width: "44px", height: "24px",
                background: liveOnly ? "var(--coral)" : "#DDD",
                borderRadius: "12px",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
              }}>
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: liveOnly ? "22px" : "2px",
                  width: "20px", height: "20px",
                  background: "white",
                  borderRadius: "50%",
                  transition: "left 0.2s ease",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                }}/>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{
              textAlign: "center", padding: "40px",
              color: "var(--brown-light)", fontSize: "14px",
            }}>
              Loading rooms...
            </div>
          )}

          {/* Room list */}
          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filtered.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "60px",
                  color: "var(--brown-light)", fontSize: "15px",
                }}>
                  No matching rooms found. Want to create one?
                </div>
              ) : filtered.map(room => (
                <RoomCard key={room.roomId} {...room}
                  onJoin={() => handleJoin(room.roomId, room.tier, room.entryFee)}
                  onWatch={() => router.push(`/spectator/${room.roomId}`)}
                />
              ))}
            </div>
          )}

          {/* Create Room button */}
          <button className="btn-primary" onClick={() => router.push("/create-room")} style={{
            width: "100%", marginTop: "20px",
            height: "56px", fontSize: "16px",
            borderRadius: "20px",
          }}>

            Create New Room
          </button>
        </div>

        {/* My status */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Player status card */}
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{
                width: "52px", height: "52px",
                background: "linear-gradient(135deg, var(--coral-light), var(--coral))",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "24px",
              }}>🐡</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--brown)" }}>
                  {wallet.address
                    ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                    : "Wallet Not Connected"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--brown-light)", marginTop: "2px" }}>
                  {wallet.address ? "Connected" : "Connect to view stats"}
                </div>
              </div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}>
              {[
                { label: "Today's Games", value: todayGames > 0 ? `${todayGames} games` : "—" },
                { label: "Best Score", value: bestScore > 0 ? `${bestScore} pts` : "—" },
              ].map(item => (
                <div key={item.label} style={{
                  background: "var(--cream)",
                  borderRadius: "12px", padding: "10px 12px",
                }}>
                  <div style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--brown)", marginTop: "2px" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Rods */}
          <button 
            onClick={() => router.push("/rods")}
            className="card" 
            style={{ 
              padding: "20px",
              background: "white",
              border: "none",
              cursor: "pointer",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              width: "100%",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-hover)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}>
              <div style={{
                fontSize: "28px",
              }}>🎣</div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: 800, fontSize: "14px",
                  color: "var(--brown)", marginBottom: "2px",
                }}>My Rod Collection</div>
                <div style={{
                  fontSize: "11px",
                  color: "var(--brown-light)",
                }}>Click to view and manage all your rods</div>
              </div>
              <div style={{
                fontSize: "18px",
              }}>→</div>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
            }}>
              {(Object.values(ROD_TYPES) as Array<(typeof ROD_TYPES)[keyof typeof ROD_TYPES]>).map((item, index) => (
                <div key={item.name} style={{
                  background: "var(--cream)",
                  borderRadius: "8px",
                  padding: "8px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "16px", marginBottom: "2px" }}>{item.icon}</div>
                  <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--brown)" }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--coral)" }}>
                    {index === 0 ? "+0" : index === 1 ? "+2" : index === 2 ? "+1" : "+3"}
                  </div>
                </div>
              ))}
            </div>
          </button>

          {/* Refer Friends */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 800, fontSize: "14px", color: "var(--brown)", marginBottom: "8px" }}>
              Refer Friends
            </div>
            <p style={{ fontSize: "12px", color: "var(--brown-light)", lineHeight: 1.6, marginBottom: "12px" }}>
              Invite friends to fish together and earn rewards
            </p>
            <div style={{
              background: "var(--cream)", borderRadius: "12px",
              padding: "10px 12px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brown)", letterSpacing: "0.05em" }}>
                CAST-XXXX
              </span>
              <button style={{
                background: "var(--coral)",
                color: "white", border: "none",
                borderRadius: "8px", padding: "4px 10px",
                fontSize: "11px", fontWeight: 700, cursor: "pointer",
              }}>Copy</button>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "8px", marginTop: "10px",
            }}>
              {[
                { label: "Referred", value: "0" },
                { label: "Total Rewards", value: "0 ETH" },
              ].map(item => (
                <div key={item.label} style={{
                  background: "var(--mint)",
                  borderRadius: "10px", padding: "8px 10px",
                }}>
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
        </div>
      </div>
    </div>
  );
}
