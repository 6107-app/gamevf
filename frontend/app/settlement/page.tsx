"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PlayerResult {
  rank: number;
  ens: string;
  emoji: string;
  fishName: string;
  fishEmoji: string;
  rarity: string;
  score: number;
  prize: number;
  isMe: boolean;
}

const MOCK_RESULTS: PlayerResult[] = [
  { rank: 1, ens: "moon.eth",    emoji: "🐡", fishName: "锦鲤王",   fishEmoji: "🐉", rarity: "Legendary", score: 3870, prize: 0.0228, isMe: false },
  { rank: 2, ens: "你",          emoji: "🐠", fishName: "龙纹锦鲤", fishEmoji: "🦈", rarity: "Epic",      score: 2140, prize: 0.0095, isMe: true  },
  { rank: 3, ens: "sakura.eth",  emoji: "🐟", fishName: "金鲤鱼",   fishEmoji: "🐠", rarity: "Rare",      score: 1240, prize: 0.0038, isMe: false },
  { rank: 4, ens: "vitalik.eth", emoji: "🐡", fishName: "小鲫鱼",   fishEmoji: "🐟", rarity: "Common",    score: 320,  prize: 0,      isMe: false },
];

const RANK_STYLES = [
  { border: "#FFD700", bg: "linear-gradient(135deg, #FFFDE7, #FFF8E1)", badge: "🥇", confetti: true  },
  { border: "#A8B8C8", bg: "linear-gradient(135deg, #F0F5FA, #E8EEF4)", badge: "🥈", confetti: false },
  { border: "#C8956C", bg: "linear-gradient(135deg, #FFF5EE, #FDEEDE)", badge: "🥉", confetti: false },
  { border: "#E0E0E0", bg: "white",                                      badge: "4",  confetti: false },
];

const ACHIEVEMENTS = [
  { icon: "🎣", label: "首次参赛", desc: "完成第一场比赛" },
  { icon: "🐠", label: "普通鱼猎家", desc: "钓到 Common 鱼" },
];

export default function Settlement() {
  const router = useRouter();
  const [visible, setVisible] = useState<number[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [coins, setCoins] = useState<{ id: number; x: number; y: number }[]>([]);

  // 卡片依次出现
  useEffect(() => {
    MOCK_RESULTS.forEach((_, i) => {
      setTimeout(() => {
        setVisible(prev => [...prev, i]);
      }, 800 + i * 300);
    });
    setTimeout(() => setShowAchievements(true), 2400);

    // 金币动画
    setTimeout(() => {
      const c = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: 20 + Math.random() * 60,
        y: 10 + Math.random() * 40,
      }));
      setCoins(c);
    }, 1200);
  }, []);

  const totalPot = 0.04;
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
          position: "fixed",
          left: `${c.x}%`, top: `${c.y}%`,
          fontSize: "20px",
          animation: "coinFall 3s ease-in forwards",
          animationDelay: `${Math.random() * 1.5}s`,
          pointerEvents: "none", zIndex: 100,
        }}>🪙</div>
      ))}

      {/* 标题区 */}
      <div style={{
        textAlign: "center", paddingTop: "80px", paddingBottom: "32px",
      }}>
        <div style={{
          fontSize: "48px", marginBottom: "8px",
          animation: "bounce-in 0.6s ease forwards",
        }}>🎏</div>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontSize: "32px", fontWeight: 700,
          color: "white",
          textShadow: "0 2px 12px rgba(0,0,0,0.15)",
          animation: "bounce-in 0.6s ease 0.2s both",
        }}>今日渔获</h1>
        <div style={{
          fontSize: "14px", color: "rgba(255,255,255,0.8)",
          fontWeight: 600, marginTop: "4px",
          animation: "bounce-in 0.6s ease 0.3s both",
        }}>
          {new Date().toLocaleDateString("zh-CN", {
            year: "numeric", month: "long", day: "numeric",
          })}
        </div>
      </div>

      {/* 排名卡片 */}
      <div style={{
        maxWidth: "720px", margin: "0 auto",
        padding: "0 24px",
        display: "flex", flexDirection: "column", gap: "12px",
      }}>
        {MOCK_RESULTS.map((p, i) => {
          const style = RANK_STYLES[i];
          const isVisible = visible.includes(i);

          return (
            <div key={i} style={{
              background: style.bg,
              border: `2px solid ${style.border}`,
              borderRadius: "20px",
              padding: "16px 20px",
              display: "flex", alignItems: "center", gap: "16px",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              boxShadow: p.rank === 1
                ? "0 8px 32px rgba(255,215,0,0.3)"
                : "0 4px 16px rgba(0,0,0,0.06)",
              position: "relative", overflow: "hidden",
            }}>

              {/* 1名光晕 */}
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
                fontWeight: 900, minWidth: "40px",
                textAlign: "center",
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
                justifyContent: "center", fontSize: "22px",
                flexShrink: 0,
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
              <div style={{
                textAlign: "right", minWidth: "80px",
              }}>
                {p.prize > 0 ? (
                  <>
                    <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                      奖励
                    </div>
                    <div style={{
                      fontSize: "18px", fontWeight: 900,
                      color: p.rank === 1 ? "#C8A020" : "var(--brown)",
                    }}>
                      +{p.prize.toFixed(4)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--brown-light)" }}>ETH</div>
                  </>
                ) : (
                  <div style={{
                    fontSize: "12px", color: "#BBB",
                    fontWeight: 600, lineHeight: 1.4,
                  }}>今天鱼运<br/>不佳 🎣</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 手续费说明 */}
      <div style={{
        textAlign: "center", marginTop: "16px",
        fontSize: "12px", color: "rgba(255,255,255,0.7)",
        fontWeight: 600,
      }}>
        本局平台手续费 {platformFee.toFixed(4)} ETH，感谢支持我们继续做下去 🙏
      </div>

      {/* 成就区 */}
      {showAchievements && (
        <div style={{
          maxWidth: "720px", margin: "20px auto 0",
          padding: "0 24px",
          animation: "bounce-in 0.4s ease forwards",
        }}>
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              fontWeight: 800, fontSize: "14px",
              color: "var(--brown)", marginBottom: "12px",
            }}>🏅 本局解锁</div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {ACHIEVEMENTS.map((a, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "var(--cream)",
                  borderRadius: "12px", padding: "10px 14px",
                  animation: `bounce-in 0.4s ease ${i * 0.15}s both`,
                }}>
                  <div style={{
                    width: "40px", height: "40px",
                    background: "linear-gradient(135deg, var(--coral-light), var(--coral))",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "20px",
                  }}>{a.icon}</div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--brown)" }}>
                      {a.label}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--brown-light)" }}>
                      {a.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 底部按钮 */}
      <div style={{
        maxWidth: "720px", margin: "24px auto 48px",
        padding: "0 24px",
        display: "flex", gap: "12px",
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
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}