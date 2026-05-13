"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";

// ─── Types ───────────────────────────────────────────────────────────────────
type Rarity = "Common" | "Rare" | "SuperRare" | "Epic" | "Legendary";
type PlayerStatus = "fishing" | "caught" | "locked" | "waiting";

interface Player {
  idx: number;
  addr: string;
  ens: string;
  avatar: string;
  status: PlayerStatus;
  rarity: Rarity | null;
  weight: number;
  score: number;
  recastCount: number;
}

interface LiveEvent {
  id: number;
  timestamp: string;
  playerEns: string;
  playerAvatar: string;
  type: "cast" | "caught" | "recast" | "locked" | "dice";
  rarity?: Rarity;
  weight?: number;
  score?: number;
  diceResult?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<Rarity, string> = {
  Common:    "#9E9E9E",
  Rare:      "#2196F3",
  SuperRare: "#9C27B0",
  Epic:      "#FF6F00",
  Legendary: "#E8C547",
};
const RARITY_BG: Record<Rarity, string> = {
  Common:    "#F5F5F5",
  Rare:      "#E3F2FD",
  SuperRare: "#F3E5F5",
  Epic:      "#FFF3E0",
  Legendary: "#FFFDE7",
};
const RARITY_LABEL: Record<Rarity, string> = {
  Common: "普通", Rare: "稀有", SuperRare: "精品", Epic: "史诗", Legendary: "传说",
};
const STATUS_EMOJI: Record<PlayerStatus, string> = {
  waiting: "😴", fishing: "🎣", caught: "😍", locked: "✅",
};
const STATUS_LABEL: Record<PlayerStatus, string> = {
  waiting: "等待中", fishing: "钓鱼中", caught: "已上钩", locked: "已锁定",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: Replace with ethers.js on-chain reads after contract is deployed
const MOCK_PLAYERS: Player[] = [
  { idx: 0, addr: "0xA1...", ens: "vitalik.eth",  avatar: "🐙", status: "locked",  rarity: "Epic",      weight: 12400, score: 3870, recastCount: 2 },
  { idx: 1, addr: "0xB2...", ens: "sakura.eth",   avatar: "🦊", status: "caught",  rarity: "Rare",      weight: 3200,  score: 1240, recastCount: 1 },
  { idx: 2, addr: "0xC3...", ens: "moon.eth",     avatar: "🐳", status: "fishing", rarity: null,        weight: 0,     score: 0,    recastCount: 0 },
  { idx: 3, addr: "0xD4...", ens: "anon.eth",     avatar: "🦄", status: "fishing", rarity: null,        weight: 0,     score: 0,    recastCount: 0 },
];

const MOCK_EVENTS: LiveEvent[] = [
  { id: 1, timestamp: "02:41", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "locked",  rarity: "Epic",  weight: 12400, score: 3870 },
  { id: 2, timestamp: "02:15", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "dice",    diceResult: "⚡ 超级Buff！稀有度 +30%" },
  { id: 3, timestamp: "01:58", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "recast"  },
  { id: 4, timestamp: "01:30", playerEns: "sakura.eth",  playerAvatar: "🦊", type: "caught",  rarity: "Rare",  weight: 3200,  score: 1240 },
  { id: 5, timestamp: "00:52", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "caught",  rarity: "Rare",  weight: 2800,  score: 980  },
  { id: 6, timestamp: "00:10", playerEns: "moon.eth",    playerAvatar: "🐳", type: "cast"    },
  { id: 7, timestamp: "00:05", playerEns: "anon.eth",    playerAvatar: "🦄", type: "cast"    },
];

// Mock weighted bets (in ETH × 100 for simplicity)
const MOCK_BETS: Record<number, number> = { 0: 240, 1: 80, 2: 30, 3: 10 };
const MOCK_TOTAL_BET = 360;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcTimeWeight(elapsed: number): number {
  const MAX = 100, MIN = 10, DURATION = 180;
  if (elapsed >= DURATION) return MIN;
  return MAX - Math.floor((elapsed * (MAX - MIN)) / DURATION);
}

function fmtScore(s: number) {
  return s > 0 ? s.toLocaleString() : "—";
}

function fmtWeight(g: number) {
  if (g === 0) return "—";
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;
}

function getOdds(playerIdx: number): number {
  if (MOCK_TOTAL_BET === 0) return 0;
  return Math.round((MOCK_BETS[playerIdx] / MOCK_TOTAL_BET) * 100);
}

function nowStr() {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function PlayerCard({
  player, rank, isSelected, onSelect, userBetIdx,
}: {
  player: Player; rank: number | null; isSelected: boolean;
  onSelect: () => void; userBetIdx: number | null;
}) {
  const odds = getOdds(player.idx);
  const betAmt = MOCK_BETS[player.idx];

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? "linear-gradient(135deg, #FFF0EE, #FFE4E0)"
          : "white",
        borderRadius: "20px",
        padding: "16px",
        border: isSelected
          ? "2px solid var(--coral)"
          : "2px solid transparent",
        boxShadow: isSelected
          ? "0 4px 20px rgba(255,123,107,0.2)"
          : "var(--shadow-card)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      {/* Rank badge */}
      {rank !== null && (
        <div style={{
          position: "absolute", top: "-8px", left: "16px",
          background: rank === 1 ? "var(--gold)" : rank === 2 ? "var(--silver)" : "var(--bronze)",
          color: "white", borderRadius: "10px",
          padding: "2px 10px", fontSize: "11px", fontWeight: 800,
        }}>
          #{rank}
        </div>
      )}

      {/* User bet indicator */}
      {userBetIdx === player.idx && (
        <div style={{
          position: "absolute", top: "-8px", right: "16px",
          background: "var(--mint-dark)", color: "white",
          borderRadius: "10px", padding: "2px 10px",
          fontSize: "11px", fontWeight: 800,
        }}>
          🎯 已押注
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Avatar */}
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "var(--cream)", fontSize: "24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {player.avatar}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--brown)" }}>
              {player.ens}
            </span>
            <span style={{ fontSize: "16px" }}>{STATUS_EMOJI[player.status]}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
            {STATUS_LABEL[player.status]}
            {player.recastCount > 0 && ` · 重投${player.recastCount}次`}
          </div>
        </div>

        {/* Score */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--coral)" }}>
            {fmtScore(player.score)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
            分
          </div>
        </div>
      </div>

      {/* Fish info row */}
      {player.rarity && (
        <div style={{
          marginTop: "10px",
          background: RARITY_BG[player.rarity],
          borderRadius: "10px", padding: "8px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{
            fontSize: "11px", fontWeight: 800,
            color: RARITY_COLOR[player.rarity],
          }}>
            {RARITY_LABEL[player.rarity]}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown-light)" }}>
            {fmtWeight(player.weight)}
          </span>
        </div>
      )}

      {/* Odds bar */}
      <div style={{ marginTop: "10px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginBottom: "4px",
        }}>
          <span style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
            押注占比
          </span>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--brown)" }}>
            {odds}%
          </span>
        </div>
        <div style={{
          height: "6px", borderRadius: "3px",
          background: "var(--cream-dark)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: "3px",
            width: `${odds}%`,
            background: isSelected
              ? "var(--coral)"
              : "linear-gradient(90deg, var(--coral-light), var(--coral))",
            transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ fontSize: "10px", color: "var(--brown-light)", marginTop: "3px" }}>
          {(betAmt / 100).toFixed(2)} ETH 已押
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: LiveEvent }) {
  const typeConfig: Record<LiveEvent["type"], { label: string; color: string; icon: string }> = {
    cast:   { label: "抛竿",   color: "#2196F3", icon: "🎣" },
    caught: { label: "上钩！", color: "var(--coral)", icon: "🐟" },
    recast: { label: "重投",   color: "#9C27B0", icon: "🔁" },
    locked: { label: "锁定",   color: "var(--mint-dark)", icon: "✅" },
    dice:   { label: "骰子",   color: "var(--gold)", icon: "🎲" },
  };
  const cfg = typeConfig[event.type];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "10px 0",
      borderBottom: "1px solid var(--cream-dark)",
      animation: "bounce-in 0.3s ease forwards",
    }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        background: "var(--cream)", fontSize: "16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {event.playerAvatar}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--brown)" }}>
            {event.playerEns}
          </span>
          <span style={{
            fontSize: "10px", fontWeight: 700, padding: "1px 6px",
            borderRadius: "6px", background: cfg.color, color: "white",
          }}>
            {cfg.icon} {cfg.label}
          </span>
          <span style={{ fontSize: "10px", color: "var(--brown-light)", marginLeft: "auto" }}>
            {event.timestamp}
          </span>
        </div>

        {event.type === "caught" && event.rarity && (
          <div style={{
            fontSize: "11px", color: RARITY_COLOR[event.rarity], fontWeight: 700,
          }}>
            {RARITY_LABEL[event.rarity]} · {fmtWeight(event.weight ?? 0)} · {fmtScore(event.score ?? 0)} 分
          </div>
        )}
        {event.type === "dice" && (
          <div style={{ fontSize: "11px", color: "#E8C547", fontWeight: 700 }}>
            {event.diceResult}
          </div>
        )}
        {event.type === "locked" && event.rarity && (
          <div style={{ fontSize: "11px", color: "var(--mint-dark)", fontWeight: 700 }}>
            最终：{RARITY_LABEL[event.rarity]} {fmtWeight(event.weight ?? 0)} · {fmtScore(event.score ?? 0)} 分
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SpectatorPage() {
  const params  = useParams();
  const router  = useRouter();
  const roomId  = params.roomId as string;

  // Game state
  const [players]    = useState<Player[]>(MOCK_PLAYERS);
  const [events, setEvents] = useState<LiveEvent[]>(MOCK_EVENTS);
  const [elapsed, setElapsed] = useState(47); // seconds since game started
  const [gameOver]   = useState(false);

  // Betting state
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [betAmount,   setBetAmount]   = useState("");
  const [userBetIdx,  setUserBetIdx]  = useState<number | null>(null);
  const [hasBet,      setHasBet]      = useState(false);
  const [betError,    setBetError]    = useState("");

  const timeWeight = calcTimeWeight(elapsed);
  const timeRemaining = Math.max(0, 180 - elapsed);
  const timerStr = `${String(Math.floor(timeRemaining / 60)).padStart(2,"0")}:${String(timeRemaining % 60).padStart(2,"0")}`;

  // Countdown timer
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  // Simulate a live event every 8 seconds
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      setEvents(prev => [{
        id: Date.now(),
        timestamp: nowStr(),
        playerEns: "moon.eth",
        playerAvatar: "🐳",
        type: "caught",
        rarity: "Rare",
        weight: 2800,
        score: 1050,
      }, ...prev].slice(0, 20));
    }, 8000);
    return () => clearInterval(id);
  }, [gameOver]);

  // Sorted ranking
  const ranked = [...players].sort((a, b) => b.score - a.score);

  const handlePlaceBet = useCallback(() => {
    setBetError("");
    if (selectedIdx === null) { setBetError("请选择你要押注的玩家"); return; }
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt < 0.001) { setBetError("最低下注 0.001 ETH"); return; }
    if (elapsed >= 180) { setBetError("比赛已结束，无法下注"); return; }

    // TODO: call PredictionMarket.placeBet(roomId, playerAddr) with ethers.js
    setHasBet(true);
    setUserBetIdx(selectedIdx);
  }, [selectedIdx, betAmount, elapsed]);

  const tierColors: Record<string, string> = {
    Bronze: "#C8956C", Silver: "#A8B8C8", Gold: "#E8C547", Diamond: "#B39DDB",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar />

      {/* ── Room Header ── */}
      <div style={{
        background: "white",
        borderBottom: "2px solid var(--cream-dark)",
        padding: "16px 24px",
      }}>
        <div style={{
          maxWidth: "1400px", margin: "0 auto",
          display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
        }}>
          {/* Back */}
          <button onClick={() => router.push("/")} style={{
            background: "var(--cream)", border: "none",
            borderRadius: "12px", padding: "8px 14px",
            fontSize: "13px", fontWeight: 700, color: "var(--brown)",
            cursor: "pointer",
          }}>
            ← 返回大厅
          </button>

          {/* Room name */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 900, fontSize: "18px", color: "var(--brown)" }}>
              荷花池 1号
            </span>
            <span style={{
              background: tierColors["Silver"], color: "white",
              borderRadius: "8px", padding: "2px 10px",
              fontSize: "11px", fontWeight: 800,
            }}>Silver</span>
            <span style={{
              background: "#FF4444", color: "white",
              borderRadius: "8px", padding: "2px 10px",
              fontSize: "11px", fontWeight: 800,
            }}>● 直播中</span>
          </div>

          {/* Timer */}
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: "20px",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontWeight: 900, fontSize: "24px",
                color: timeRemaining < 30 ? "#FF4444" : "var(--brown)",
                fontFamily: "monospace",
                transition: "color 0.3s",
              }}>
                {timerStr}
              </div>
              <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                剩余时间
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: "20px", color: "var(--coral)" }}>
                0.20 ETH
              </div>
              <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                玩家总奖池
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: "20px", color: "#9C27B0" }}>
                {(MOCK_TOTAL_BET / 100).toFixed(2)} ETH
              </div>
              <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                观众押注池
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{
        maxWidth: "1400px", margin: "0 auto", padding: "24px",
        display: "flex",
        gap: "20px",
        alignItems: "stretch",
      }}>

        {/* ── Left: Player Cards ── */}
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--brown)", marginBottom: "14px" }}>
            🏆 实时排行
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {ranked.map((p, i) => (
              <PlayerCard
                key={p.idx}
                player={p}
                rank={p.score > 0 ? i + 1 : null}
                isSelected={selectedIdx === p.idx}
                onSelect={() => !hasBet && setSelectedIdx(p.idx)}
                userBetIdx={userBetIdx}
              />
            ))}
          </div>
        </div>

        {/* ── Middle: Event Feed ── */}
        <div className="card" style={{ width: "320px", flexShrink: 0, padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{
            fontWeight: 800, fontSize: "15px",
            color: "var(--brown)", marginBottom: "14px",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            📡 直播事件流
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#FF4444", display: "inline-block",
              animation: "pulse-glow 2s ease-in-out infinite",
            }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {events.map(e => <EventItem key={e.id} event={e} />)}
          </div>
        </div>

        {/* ── Right: Bet Panel ── */}
        <div className="card" style={{ width: "280px", flexShrink: 0, padding: "20px" }}>
          {/* Inner sticky wrapper so content sticks while column stretches to full height */}
          <div style={{ position: "sticky", top: "24px" }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--brown)", marginBottom: "16px" }}>
            🎯 竞猜下注
          </div>

          {hasBet ? (
            /* ── Already bet state ── */
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--brown)", marginBottom: "6px" }}>
                下注成功！
              </div>
              <div style={{ fontSize: "13px", color: "var(--brown-light)", marginBottom: "16px" }}>
                押注 {players[userBetIdx!].ens}
              </div>
              <div style={{
                background: "var(--cream)", borderRadius: "14px", padding: "14px",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "押注金额", value: `${betAmount} ETH` },
                    { label: "时间权重", value: `×${timeWeight / 100}` },
                    { label: "加权注额", value: `${(parseFloat(betAmount) * timeWeight / 100).toFixed(4)} ETH` },
                    { label: "当前赔率", value: `1 : ${(100 / Math.max(1, getOdds(userBetIdx!))).toFixed(1)}` },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: "white", borderRadius: "10px", padding: "10px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--brown)", marginTop: "2px" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: "14px", fontSize: "11px", color: "var(--brown-light)" }}>
                比赛结束后可领取奖金
              </div>
            </div>
          ) : (
            /* ── Betting form ── */
            <>
              {/* Time weight indicator */}
              <div style={{
                background: "var(--cream)", borderRadius: "14px", padding: "12px 14px",
                marginBottom: "16px",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: "6px",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown-light)" }}>
                    ⏱ 时间权重
                  </span>
                  <span style={{
                    fontSize: "14px", fontWeight: 900,
                    color: timeWeight >= 70 ? "var(--mint-dark)"
                         : timeWeight >= 40 ? "var(--gold)"
                         : "var(--coral)",
                  }}>
                    {timeWeight}
                  </span>
                </div>
                <div style={{
                  height: "8px", borderRadius: "4px",
                  background: "var(--cream-dark)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${timeWeight}%`,
                    borderRadius: "4px",
                    background: timeWeight >= 70
                      ? "var(--mint-dark)"
                      : timeWeight >= 40 ? "var(--gold)" : "var(--coral)",
                    transition: "width 1s ease, background 1s ease",
                  }} />
                </div>
                <div style={{ fontSize: "10px", color: "var(--brown-light)", marginTop: "4px" }}>
                  越早下注权重越高（最高 100，最低 10）
                </div>
              </div>

              {/* Player select */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown)", marginBottom: "8px" }}>
                  选择你看好的玩家
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {players.map(p => (
                    <button
                      key={p.idx}
                      onClick={() => setSelectedIdx(p.idx)}
                      style={{
                        background: selectedIdx === p.idx
                          ? "linear-gradient(135deg, #FFF0EE, #FFE4E0)"
                          : "var(--cream)",
                        border: selectedIdx === p.idx
                          ? "2px solid var(--coral)"
                          : "2px solid transparent",
                        borderRadius: "12px", padding: "10px 12px",
                        cursor: "pointer", transition: "all 0.15s ease",
                        display: "flex", alignItems: "center", gap: "10px",
                        width: "100%", textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>{p.avatar}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 800, fontSize: "13px", color: "var(--brown)",
                        }}>
                          {p.ens}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--brown-light)" }}>
                          {fmtScore(p.score)} 分 · {getOdds(p.idx)}% 押注
                        </div>
                      </div>
                      {selectedIdx === p.idx && (
                        <span style={{ color: "var(--coral)", fontWeight: 900 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown)", marginBottom: "8px" }}>
                  下注金额（ETH）
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    placeholder="0.001"
                    min="0.001"
                    step="0.001"
                    style={{
                      width: "100%", padding: "12px 50px 12px 16px",
                      border: "2px solid var(--cream-dark)",
                      borderRadius: "12px", fontSize: "15px",
                      fontWeight: 700, fontFamily: "var(--font-main)",
                      background: "white", color: "var(--brown)",
                      outline: "none",
                    }}
                  />
                  <span style={{
                    position: "absolute", right: "14px", top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "12px", fontWeight: 800, color: "var(--brown-light)",
                  }}>
                    ETH
                  </span>
                </div>

                {/* Quick amounts */}
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  {["0.01", "0.05", "0.1"].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount(amt)}
                      style={{
                        flex: 1, background: "var(--cream)",
                        border: "2px solid var(--cream-dark)",
                        borderRadius: "8px", padding: "6px",
                        fontSize: "11px", fontWeight: 700,
                        color: "var(--brown)", cursor: "pointer",
                      }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {/* Preview */}
                {betAmount && !isNaN(parseFloat(betAmount)) && (
                  <div style={{
                    marginTop: "8px", background: "var(--cream)",
                    borderRadius: "10px", padding: "8px 12px",
                    fontSize: "11px", color: "var(--brown-light)",
                  }}>
                    加权注额：<strong style={{ color: "var(--brown)" }}>
                      {(parseFloat(betAmount) * timeWeight / 100).toFixed(4)} ETH
                    </strong>
                    （原始 × 权重 {timeWeight}）
                  </div>
                )}
              </div>

              {betError && (
                <div style={{
                  background: "#FFF0EE", borderRadius: "10px", padding: "10px 12px",
                  fontSize: "12px", color: "var(--coral-dark)", fontWeight: 700,
                  marginBottom: "12px",
                }}>
                  ⚠️ {betError}
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handlePlaceBet}
                style={{ width: "100%", height: "48px", borderRadius: "14px" }}
              >
                🎯 确认下注
              </button>

              <div style={{
                marginTop: "10px", fontSize: "10px",
                color: "var(--brown-light)", textAlign: "center", lineHeight: 1.5,
              }}>
                平台收取 5% 手续费 · 押中者按加权比例瓜分奖池
              </div>
            </>
          )}
          </div>{/* end sticky wrapper */}
        </div>
      </div>
    </div>
  );
}
