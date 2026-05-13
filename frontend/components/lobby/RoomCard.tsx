"use client";

type RoomTier = "Bronze" | "Silver" | "Gold" | "Diamond";

interface RoomCardProps {
  roomId: number;
  name: string;
  tier: RoomTier;
  entryFee: string;
  playerCount: number;
  isLivestream: boolean;
  onJoin?: () => void;
  onWatch?: () => void;
}

const TIER_COLORS: Record<RoomTier, string> = {
  Bronze:  "#C8956C",
  Silver:  "#A8B8C8",
  Gold:    "#E8C547",
  Diamond: "#B39DDB",
};

const TIER_BG: Record<RoomTier, string> = {
  Bronze:  "#FFF5EE",
  Silver:  "#F0F5FA",
  Gold:    "#FFFDE7",
  Diamond: "#F5F0FF",
};

const TIER_ICONS: Record<RoomTier, string> = {
  Bronze:  "🪵",
  Silver:  "⛵",
  Gold:    "🏮",
  Diamond: "🏝️",
};

export default function RoomCard({
  roomId, name, tier, entryFee,
  playerCount, isLivestream, onJoin, onWatch,
}: RoomCardProps) {
  const isFull = playerCount >= 4;
  const color = TIER_COLORS[tier];

  return (
    <div style={{
      background: "white",
      borderRadius: "24px",
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      boxShadow: "var(--shadow-card)",
      border: "1px solid transparent",
      cursor: "pointer",
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
      height: "100px",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
      (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-hover)";
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
    }}>

      {/* 等级图标 */}
      <div style={{
        width: "60px", height: "60px",
        background: TIER_BG[tier],
        borderRadius: "16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "28px", flexShrink: 0,
        border: `2px solid ${color}30`,
      }}>
        {TIER_ICONS[tier]}
      </div>

      {/* 房间信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontWeight: 800, fontSize: "15px", color: "var(--brown)" }}>
            {name}
          </span>
          <span style={{
            background: `${color}20`,
            color: color,
            borderRadius: "8px",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 700,
          }}>{tier}</span>
          {isLivestream && (
            <span style={{
              background: "#FFE5E5",
              color: "#E53E3E",
              borderRadius: "8px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 700,
              display: "flex", alignItems: "center", gap: "3px",
            }}>
              <span style={{
                width: "6px", height: "6px",
                background: "#E53E3E",
                borderRadius: "50%",
                display: "inline-block",
              }}/>
              直播
            </span>
          )}
        </div>

        {/* 入场费 + 人数 */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{
            fontWeight: 800, fontSize: "17px", color: "var(--brown)",
          }}>{entryFee} ETH</span>

          {/* 鱼图标人数 */}
          <div style={{ display: "flex", gap: "4px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} style={{
                fontSize: "16px",
                opacity: i < playerCount ? 1 : 0.25,
                filter: i < playerCount ? "none" : "grayscale(1)",
              }}>🐠</span>
            ))}
          </div>
          <span style={{ fontSize: "12px", color: "var(--brown-light)", fontWeight: 600 }}>
            {playerCount}/4 人
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ flexShrink: 0 }}>
        {isFull ? (
          <button style={{
            background: "#F0F0F0",
            color: "#AAA",
            border: "none",
            borderRadius: "12px",
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "not-allowed",
          }}>已满</button>
        ) : isLivestream ? (
          <button onClick={onWatch} style={{
            background: "#FFF0F0",
            color: "#E53E3E",
            border: "1px solid #FFB3B3",
            borderRadius: "12px",
            padding: "10px 18px",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
          }}>👁 观看</button>
        ) : (
          <button onClick={onJoin} className="btn-primary"
            style={{ padding: "10px 18px", fontSize: "13px" }}>
            加入
          </button>
        )}
      </div>
    </div>
  );
}