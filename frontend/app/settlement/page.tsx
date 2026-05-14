"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useContract } from "@/lib/ethereum";
import { FISHING_GAME_ADDRESS, RARITY_NAMES } from "@/lib/contract";
import { ethers } from "ethers";

interface PlayerResult {
  rank: number;
  address: string;
  ens: string;
  emoji: string;
  fishName: string;
  fishEmoji: string;
  rarity: string;
  score: number;
  prize: number;
  isMe: boolean;
}

const FISH_NAMES: Record<string, string[]> = {
  Common:    ["小鲫鱼", "普通鲤鱼", "小草鱼"],
  Rare:      ["金鲤鱼", "鲈鱼", "鳜鱼"],
  SuperRare: ["锦鲤", "翻车鱼", "蝶尾金鱼"],
  Epic:      ["龙纹锦鲤", "古代鲟鱼", "巨型鲶鱼"],
  Legendary: ["锦鲤王", "神话巨鲤", "传说龙鱼"],
};

const FISH_EMOJI: Record<string, string> = {
  Common: "🐟", Rare: "🐠", SuperRare: "🐡", Epic: "🦈", Legendary: "🐉",
};

const MOCK_RESULTS: PlayerResult[] = [
  { rank: 1, address: "", ens: "moon.eth",    emoji: "🐡", fishName: "锦鲤王",   fishEmoji: "🐉", rarity: "Legendary", score: 3870, prize: 0.0228, isMe: false },
  { rank: 2, address: "", ens: "你",          emoji: "🐠", fishName: "龙纹锦鲤", fishEmoji: "🦈", rarity: "Epic",      score: 2140, prize: 0.0095, isMe: true  },
  { rank: 3, address: "", ens: "sakura.eth",  emoji: "🐟", fishName: "金鲤鱼",   fishEmoji: "🐠", rarity: "Rare",      score: 1240, prize: 0.0038, isMe: false },
  { rank: 4, address: "", ens: "vitalik.eth", emoji: "🐡", fishName: "小鲫鱼",   fishEmoji: "🐟", rarity: "Common",    score: 320,  prize: 0,      isMe: false },
];

const RANK_STYLES = [
  { border: "#FFD700", bg: "linear-gradient(135deg, #FFFDE7, #FFF8E1)", badge: "🥇" },
  { border: "#A8B8C8", bg: "linear-gradient(135deg, #F0F5FA, #E8EEF4)", badge: "🥈" },
  { border: "#C8956C", bg: "linear-gradient(135deg, #FFF5EE, #FDEEDE)", badge: "🥉" },
  { border: "#E0E0E0", bg: "white",                                      badge: "4"  },
];

const ACHIEVEMENTS = [
  { icon: "🎣", label: "首次参赛", desc: "完成第一场比赛" },
  { icon: "🐠", label: "普通鱼猎家", desc: "钓到 Common 鱼" },
];

function shortenAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getFishName(rarity: string, address: string): string {
  const names = FISH_NAMES[rarity] || FISH_NAMES.Common;
  const idx = parseInt(address.slice(-2) || "0", 16) % names.length;
  return names[idx];
}

export default function SettlementPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Settlement />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FF8C69 0%, #FFD4A3 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", color: "white" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🐠</div>
        <div style={{ fontSize: "18px", fontWeight: 700 }}>计算渔获中...</div>
      </div>
    </div>
  );
}

function Settlement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId");

  const { wallet, getReadContract } = useContract();
  const isContractReady = !!wallet.address &&
    FISHING_GAME_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPot, setTotalPot] = useState(0.04);
  const [visible, setVisible] = useState<number[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [coins, setCoins] = useState<{ id: number; x: number; y: number }[]>([]);
  const [dataSource, setDataSource] = useState<"real" | "mock">("mock");

  useEffect(() => {
    const loadResults = async () => {
      // 没连接钱包或没有 roomId → Mock 数据
      if (!isContractReady || !roomId) {
        setResults(MOCK_RESULTS);
        setDataSource("mock");
        setLoading(false);
        return;
      }

      const contract = getReadContract();
      if (!contract) {
        setResults(MOCK_RESULTS);
        setDataSource("mock");
        setLoading(false);
        return;
      }

      try {
        const info = await contract.getRoomInfo(Number(roomId));
        const pot = parseFloat(ethers.formatEther(info.totalPot));
        setTotalPot(pot);
        const playerCount = Number(info.playerCount);

        // 读取所有玩家数据
        const players: {
          address: string;
          score: number;
          rarity: string;
          weight: number;
        }[] = [];

        for (let i = 0; i < playerCount; i++) {
          const p = await contract.getPlayerInfo(Number(roomId), i);
          players.push({
            address: p.addr,
            score: Number(p.score),
            rarity: RARITY_NAMES[Number(p.rarity)] || "Common",
            weight: Number(p.weight),
          });
        }

        // 按分数排序
        const sorted = [...players].sort((a, b) => b.score - a.score);

        // 计算奖励
        const PRIZE_SHARES = [0.6, 0.25, 0.1, 0];
        const prizePool = pot * 0.95;

        const ranked: PlayerResult[] = sorted.map((p, i) => {
          const isMe = wallet.address?.toLowerCase() === p.address.toLowerCase();
          const rarity = p.rarity;
          return {
            rank: i + 1,
            address: p.address,
            ens: shortenAddress(p.address),
            emoji: isMe ? "🐠" : "🐡",
            fishName: getFishName(rarity, p.address),
            fishEmoji: FISH_EMOJI[rarity] || "🐟",
            rarity,
            score: p.score,
            prize: i < 3 ? parseFloat((prizePool * PRIZE_SHARES[i]).toFixed(6)) : 0,
            isMe,
          };
        });

        setResults(ranked);
        setDataSource("real");
      } catch (e) {
        console.error("读取结算数据失败:", e);
        setResults(MOCK_RESULTS);
        setDataSource("mock");
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [isContractReady, roomId, getReadContract, wallet.address]);

  // 卡片依次出现
  useEffect(() => {
    if (loading) return;
    results.forEach((_, i) => {
      setTimeout(() => setVisible(prev => [...prev, i]), 800 + i * 300);
    });
    setTimeout(() => setShowAchievements(true), 2400);
    setTimeout(() => {
      setCoins(Array.from({ length: 12 }, (_, i) => ({
        id: i, x: 20 + Math.random() * 60, y: 10 + Math.random() * 40,
      })));
    }, 1200);
  }, [loading, results]);

  if (loading) return <LoadingScreen />;

  const platformFee = totalPot * 0.05;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #FF8C69 0%, #FFB347 30%, #FFD4A3 60%, #FFF0E0 100%)",
      position: "relative", overflow: "hidden",
    }}>

      {/* 金币飘落 */}
      {coins.map(c => (
        <div key={c.id} style={{
          position: "fixed", left: `${c.x}%`, top: `${c.y}%`,
          fontSize: "20px",
          animation: "coinFall 3s ease-in forwards",
          animationDelay: `${Math.random() * 1.5}s`,
          pointerEvents: "none", zIndex: 100,
        }}>🪙</div>
      ))}

      {/* 标题 */}
      <div style={{ textAlign: "center", paddingTop: "80px", paddingBottom: "32px" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px",
          animation: "bounce-in 0.6s ease forwards" }}>🎏</div>
        <h1 style={{
          fontFamily: "var(--font-serif)", fontSize: "32px", fontWeight: 700,
          color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.15)",
          animation: "bounce-in 0.6s ease 0.2s both",
        }}>今日渔获</h1>

        {/* 数据来源标签 */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          background: dataSource === "real"
            ? "rgba(76,175,80,0.2)" : "rgba(255,255,255,0.2)",
          borderRadius: "20px", padding: "4px 12px",
          marginTop: "8px",
          border: `1px solid ${dataSource === "real" ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.3)"}`,
        }}>
          <span style={{ fontSize: "10px" }}>
            {dataSource === "real" ? "🟢" : "⚪"}
          </span>
          <span style={{
            fontSize: "11px", fontWeight: 700,
            color: "white", opacity: 0.9,
          }}>
            {dataSource === "real"
              ? `链上真实数据 · 房间 #${roomId}`
              : "演示数据（未连接钱包）"}
          </span>
        </div>
      </div>

      {/* 排名卡片 */}
      <div style={{
        maxWidth: "720px", margin: "0 auto",
        padding: "0 24px",
        display: "flex", flexDirection: "column", gap: "12px",
      }}>
        {results.map((p, i) => {
          const style = RANK_STYLES[Math.min(i, 3)];
          const isVisible = visible.includes(i);
          return (
            <div key={i} style={{
              background: style.bg,
              border: `2px solid ${style.border}`,
              borderRadius: "20px", padding: "16px 20px",
              display: "flex", alignItems: "center", gap: "16px",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              boxShadow: p.rank === 1
                ? "0 8px 32px rgba(255,215,0,0.3)"
                : "0 4px 16px rgba(0,0,0,0.06)",
              position: "relative", overflow: "hidden",
            }}>

              {p.rank === 1 && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.08), transparent)",
                  animation: "shimmer 2s ease-in-out infinite",
                  pointerEvents: "none",
                }}/>
              )}

              {/* 名次 */}
              <div style={{
                fontSize: p.rank <= 3 ? "28px" : "20px",
                fontWeight: 900, minWidth: "40px", textAlign: "center",
                color: p.rank === 4 ? "#BBB" : "var(--brown)",
              }}>{style.badge}</div>

              {/* 头像 */}
              <div style={{
                width: "48px", height: "48px",
                background: p.isMe
                  ? "linear-gradient(135deg, var(--coral-light), var(--coral))"
                  : "linear-gradient(135deg, #B2DFDB, #80CBC4)",
                borderRadius: "50%",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "22px", flexShrink: 0,
                border: p.isMe ? "2px solid var(--coral)" : "none",
              }}>{p.emoji}</div>

              {/* 玩家信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: "15px", color: "var(--brown)",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  {p.ens}
                  {p.isMe && (
                    <span style={{
                      background: "var(--coral)", color: "white",
                      borderRadius: "6px", padding: "1px 6px",
                      fontSize: "10px", fontWeight: 700,
                    }}>你</span>
                  )}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px", marginTop: "4px",
                }}>
                  <span style={{ fontSize: "16px" }}>{p.fishEmoji}</span>
                  <span style={{ fontSize: "12px", color: "var(--brown-light)", fontWeight: 600 }}>
                    {p.fishName}
                  </span>
                  <span style={{
                    fontSize: "10px", fontWeight: 700,
                    background: p.rarity === "Legendary" ? "#FFF9C4"
                      : p.rarity === "Epic" ? "#FFF3E0"
                      : p.rarity === "Rare" ? "#E3F2FD" : "#F5F5F5",
                    color: p.rarity === "Legendary" ? "#C8A020"
                      : p.rarity === "Epic" ? "#E65100"
                      : p.rarity === "Rare" ? "#1565C0" : "#777",
                    borderRadius: "6px", padding: "1px 6px",
                  }}>{p.rarity}</span>
                </div>
              </div>

              {/* 分数 */}
              <div style={{ textAlign: "center", minWidth: "60px" }}>
                <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                  总分
                </div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--brown)" }}>
                  {p.score}
                </div>
              </div>

              {/* 奖励 */}
              <div style={{ textAlign: "right", minWidth: "80px" }}>
                {p.prize > 0 ? (
                  <>
                    <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                      奖励
                    </div>
                    <div style={{
                      fontSize: "18px", fontWeight: 900,
                      color: p.rank === 1 ? "#C8A020" : "var(--brown)",
                    }}>+{p.prize.toFixed(4)}</div>
                    <div style={{ fontSize: "10px", color: "var(--brown-light)" }}>ETH</div>
                  </>
                ) : (
                  <div style={{ fontSize: "12px", color: "#BBB", fontWeight: 600, lineHeight: 1.4 }}>
                    今天鱼运<br/>不佳 🎣
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 手续费 */}
      <div style={{
        textAlign: "center", marginTop: "16px",
        fontSize: "12px", color: "rgba(255,255,255,0.7)", fontWeight: 600,
      }}>
        本局平台手续费 {platformFee.toFixed(4)} ETH，感谢支持我们继续做下去 🙏
      </div>

      {/* 成就 */}
      {showAchievements && (
        <div style={{
          maxWidth: "720px", margin: "20px auto 0", padding: "0 24px",
          animation: "bounce-in 0.4s ease forwards",
        }}>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 800, fontSize: "14px", color: "var(--brown)", marginBottom: "12px" }}>
              🏅 本局解锁
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {ACHIEVEMENTS.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "var(--cream)", borderRadius: "12px", padding: "10px 14px",
                  animation: `bounce-in 0.4s ease ${i * 0.15}s both`,
                }}>
                  <div style={{
                    width: "40px", height: "40px",
                    background: "linear-gradient(135deg, var(--coral-light), var(--coral))",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
                  }}>{a.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--brown)" }}>{a.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--brown-light)" }}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 按钮 */}
      <div style={{
        maxWidth: "720px", margin: "24px auto 48px",
        padding: "0 24px", display: "flex", gap: "12px",
      }}>
        <button className="btn-primary"
          onClick={() => router.push("/create-room")}
          style={{ flex: 1, height: "52px", fontSize: "15px", borderRadius: "16px" }}>
          再来一局！🎣
        </button>
        <button className="btn-secondary"
          onClick={() => router.push("/")}
          style={{ flex: 1, height: "52px", fontSize: "15px", borderRadius: "16px" }}>
          回到大厅
        </button>
      </div>

      <style>{`
        @keyframes coinFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
        }
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50%       { transform: translateX(100%); }
        }
        @keyframes bounce-in {
          0%   { transform: scale(0.8); opacity: 0; }
          60%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}