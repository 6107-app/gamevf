"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";

const MOCK_PLAYERS = [
  { address: "0xEf4b...3D2E", ens: "sakura.eth", rod: "Speed Rod +2", joined: true },
  { address: "0xEb0A...3324", ens: "vitalik.eth", rod: "Lucky Rod", joined: true },
  { address: "", ens: "", rod: "", joined: false },
  { address: "", ens: "", rod: "", joined: false },
];

export default function WaitingRoom() {
  const router = useRouter();
  const isHost = true;
  const playerCount = MOCK_PLAYERS.filter(p => p.joined).length;
  const canStart = playerCount >= 2;

  // 模拟新玩家加入动画
  const [animatedSlots, setAnimatedSlots] = useState<number[]>([0, 1]);
  const [pot, setPot] = useState(0.02);

  // 水面气泡
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #B8E4F9 0%, #7EC8E3 30%, #4A9DB5 60%, #2E7A96 100%)",
      position: "relative",
      overflow: "hidden",
    }}>
      <Navbar />

      {/* 背景装饰：远山 */}
      <div style={{
        position: "absolute", bottom: "30%", left: 0, right: 0,
        height: "120px",
        background: "linear-gradient(180deg, #A8C5A0 0%, #7AAD70 100%)",
        clipPath: "ellipse(60% 100% at 50% 100%)",
        opacity: 0.6,
      }}/>

      {/* 水面 */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: "35%",
        background: "linear-gradient(180deg, #4A9DB5 0%, #2E6B8A 100%)",
        opacity: 0.85,
      }}/>

      {/* 气泡 */}
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

      {/* 主卡片 */}
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

        {/* 标题 */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            fontSize: "24px", fontWeight: 800,
            color: "var(--brown)",
            fontFamily: "var(--font-serif)",
          }}>等待其他小钓手 🎣</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "6px" }}>
            <span style={{ fontSize: "13px", color: "var(--brown-light)", fontWeight: 600 }}>
              芦苇湾 3号
            </span>
            <span style={{
              background: "#FFF5EE", color: "#C8956C",
              borderRadius: "8px", padding: "2px 8px",
              fontSize: "11px", fontWeight: 700,
            }}>Bronze</span>
          </div>
        </div>

        {/* 玩家槽位 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          {MOCK_PLAYERS.map((player, i) => (
            <PlayerSlot key={i} player={player} index={i} isMe={i === 0} />
          ))}
        </div>

        {/* 分割线 + 奖池 */}
        <div style={{
          height: "1px", background: "var(--cream-dark)", margin: "4px 0 16px",
        }}/>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "8px", marginBottom: "20px",
        }}>
          <span style={{ fontSize: "13px", color: "var(--brown-light)", fontWeight: 600 }}>
            当前奖池
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
            满员后 {(0.04 * 0.95).toFixed(3)} ETH
          </span>
        </div>

        {/* 按钮区 */}
        {isHost ? (
          <div>
            <button
              className="btn-primary"
              onClick={() => router.push("/game")}
              disabled={!canStart}
              style={{
                width: "100%", height: "52px",
                fontSize: "16px", borderRadius: "16px",
                opacity: canStart ? 1 : 0.5,
                cursor: canStart ? "pointer" : "not-allowed",
                animation: canStart ? "pulse-glow 2s ease-in-out infinite" : "none",
              }}
            >
              开始游戏 ▶
            </button>
            {!canStart && (
              <div style={{
                textAlign: "center", marginTop: "8px",
                fontSize: "12px", color: "var(--brown-light)",
              }}>
                至少需要 2 名玩家才能开始
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
            等待房主开始游戏...
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

// ── 玩家槽位组件 ─────────────────────────────────────────
function PlayerSlot({
  player, index, isMe,
}: {
  player: { address: string; ens: string; rod: string; joined: boolean };
  index: number;
  isMe: boolean;
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
              }}>你</span>
            )}
            {index === 0 && (
              <span style={{
                background: "var(--yellow-soft)", color: "#C8A020",
                borderRadius: "6px", padding: "1px 6px",
                fontSize: "10px", fontWeight: 700,
              }}>房主</span>
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
      }}>等待中...</span>
    </div>
  );
}