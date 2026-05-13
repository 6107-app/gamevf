"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";

type RoomTier = "Bronze" | "Silver" | "Gold" | "Diamond";

const TIERS: {
  tier: RoomTier;
  icon: string;
  scene: string;
  fee: string;
  color: string;
  bg: string;
  desc: string;
}[] = [
  { tier: "Bronze", icon: "🪵", scene: "普通木码头", fee: "0.01", color: "#C8956C", bg: "#FFF5EE", desc: "新手友好，随意钓" },
  { tier: "Silver", icon: "⛵", scene: "遮阳棚码头", fee: "0.05", color: "#7A9AB8", bg: "#F0F5FA", desc: "中级玩家首选" },
  { tier: "Gold",   icon: "🏮", scene: "彩灯栈道",   fee: "0.10", color: "#C8A020", bg: "#FFFDE7", desc: "高手竞技场" },
  { tier: "Diamond",icon: "🏝️", scene: "湖心岛凉亭", fee: "0.50", color: "#7E6AAA", bg: "#F5F0FF", desc: "顶级挑战，赢家通吃" },
];

export default function CreateRoom() {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<RoomTier>("Bronze");
  const [isPublic, setIsPublic] = useState(true);
  const [isLivestream, setIsLivestream] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = TIERS.find(t => t.tier === selectedTier)!;

  const handleCreate = async () => {
    setLoading(true);
    // 后续接合约
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    router.push("/waiting-room");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar />

      <div style={{
        maxWidth: "560px",
        margin: "0 auto",
        padding: "100px 24px 48px",
      }}>

        {/* 顶部标题 */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <button onClick={() => router.back()} style={{
            background: "white",
            border: "1px solid var(--cream-dark)",
            borderRadius: "12px",
            width: "36px", height: "36px",
            cursor: "pointer", fontSize: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>←</button>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "22px", fontWeight: 700,
            color: "var(--brown)",
          }}>创建钓鱼房间 🏠</h1>
        </div>

        {/* 主卡片 */}
        <div className="card" style={{ padding: "28px" }}>

          {/* 等级选择 */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{
              fontSize: "13px", fontWeight: 700,
              color: "var(--brown-light)", marginBottom: "12px",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>选择房间等级</div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}>
              {TIERS.map(t => (
                <div key={t.tier} onClick={() => setSelectedTier(t.tier)}
                  style={{
                    background: selectedTier === t.tier ? t.bg : "var(--cream)",
                    border: `2px solid ${selectedTier === t.tier ? t.color : "transparent"}`,
                    borderRadius: "16px",
                    padding: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    transform: selectedTier === t.tier ? "scale(1.03)" : "scale(1)",
                  }}>
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>{t.icon}</div>
                  <div style={{
                    fontWeight: 800, fontSize: "14px",
                    color: selectedTier === t.tier ? t.color : "var(--brown)",
                  }}>{t.tier}</div>
                  <div style={{
                    fontSize: "11px", color: "var(--brown-light)",
                    fontWeight: 600, marginTop: "2px",
                  }}>{t.scene}</div>
                  <div style={{
                    fontWeight: 800, fontSize: "15px",
                    color: "var(--brown)", marginTop: "6px",
                  }}>{t.fee} ETH</div>
                  <div style={{
                    fontSize: "10px", color: "var(--brown-light)", marginTop: "2px",
                  }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 分割线 */}
          <div style={{ height: "1px", background: "var(--cream-dark)", margin: "4px 0 20px" }}/>

          {/* 开关设置 */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{
              fontSize: "13px", fontWeight: 700,
              color: "var(--brown-light)", marginBottom: "12px",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>房间设置</div>

            {/* 公开/私人 */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0",
              borderBottom: "1px solid var(--cream-dark)",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--brown)" }}>
                  {isPublic ? "🌍 公开房间" : "🔒 私人房间"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--brown-light)", marginTop: "2px" }}>
                  {isPublic ? "所有人可见并加入" : "仅凭密码加入"}
                </div>
              </div>
              <Toggle value={isPublic} onChange={setIsPublic} />
            </div>

            {/* 密码输入（私人房间展开） */}
            <div style={{
              overflow: "hidden",
              maxHeight: !isPublic ? "72px" : "0px",
              transition: "max-height 0.3s ease",
            }}>
              <div style={{ paddingTop: "12px", paddingBottom: "4px" }}>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: "12px", top: "50%",
                    transform: "translateY(-50%)", fontSize: "16px",
                  }}>🔑</span>
                  <input
                    type="password"
                    placeholder="设置房间密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 12px 12px 40px",
                      borderRadius: "12px",
                      border: "1px solid var(--cream-dark)",
                      fontFamily: "var(--font-main)",
                      fontSize: "14px",
                      background: "var(--cream)",
                      color: "var(--brown)",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 直播开关 */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--brown)" }}>
                  📺 开放直播
                </div>
                <div style={{ fontSize: "11px", color: "var(--brown-light)", marginTop: "2px" }}>
                  观众可实时观看并下注预测
                </div>
              </div>
              <Toggle value={isLivestream} onChange={setIsLivestream} />
            </div>
          </div>

          {/* 费用汇总 */}
          <div style={{
            background: "var(--yellow-soft)",
            borderRadius: "16px",
            padding: "16px 20px",
            marginBottom: "24px",
            border: "1px solid #F0E06A",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: "8px",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brown-light)" }}>
                入场费
              </span>
              <span style={{ fontSize: "22px", fontWeight: 900, color: "var(--brown)" }}>
                {selected.fee} ETH
              </span>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brown-light)" }}>
                满员奖池（预估）
              </span>
              <span style={{ fontSize: "16px", fontWeight: 800, color: selected.color }}>
                {(parseFloat(selected.fee) * 4 * 0.95).toFixed(3)} ETH
              </span>
            </div>
            <div style={{
              fontSize: "10px", color: "var(--brown-light)",
              marginTop: "8px", lineHeight: 1.5,
            }}>
              * 平台收取 5% 手续费，奖池实发 95%
            </div>
          </div>

          {/* 确认按钮 */}
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={loading}
            style={{
              width: "100%", height: "56px",
              fontSize: "16px", borderRadius: "16px",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: "8px",
              opacity: loading ? 0.85 : 1,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }}>🐠</span>
                等待链上确认...
              </>
            ) : "出发钓鱼！🎣"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Toggle 组件 ──────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: "48px", height: "26px",
      background: value ? "var(--coral)" : "#DDD",
      borderRadius: "13px",
      cursor: "pointer",
      position: "relative",
      transition: "background 0.2s ease",
      flexShrink: 0,
    }}>
      <div style={{
        position: "absolute",
        top: "3px",
        left: value ? "25px" : "3px",
        width: "20px", height: "20px",
        background: "white",
        borderRadius: "50%",
        transition: "left 0.2s ease",
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }}/>
    </div>
  );
}