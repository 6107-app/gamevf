"use client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import AnnouncementBar from "@/components/ui/AnnouncementBar";
import RoomCard from "@/components/lobby/RoomCard";
import { useState } from "react";

type RoomTier = "Bronze" | "Silver" | "Gold" | "Diamond";
type FilterTier = "全部" | RoomTier;

const MOCK_ROOMS = [
  { roomId: 0, name: "芦苇湾 3号", tier: "Bronze" as RoomTier, entryFee: "0.01", playerCount: 2, isLivestream: false },
  { roomId: 1, name: "荷花池 1号", tier: "Silver" as RoomTier, entryFee: "0.05", playerCount: 3, isLivestream: true },
  { roomId: 2, name: "金鳞湖 7号", tier: "Gold" as RoomTier, entryFee: "0.10", playerCount: 1, isLivestream: false },
  { roomId: 3, name: "星钻湾 2号", tier: "Diamond" as RoomTier, entryFee: "0.50", playerCount: 4, isLivestream: true },
  { roomId: 4, name: "竹林湾 5号", tier: "Bronze" as RoomTier, entryFee: "0.01", playerCount: 1, isLivestream: false },
];

const TIER_FILTER_COLORS: Record<FilterTier, string> = {
  "全部":    "#FF7B6B",
  "Bronze":  "#C8956C",
  "Silver":  "#A8B8C8",
  "Gold":    "#E8C547",
  "Diamond": "#B39DDB",
};

export default function Home() {
  const [filter, setFilter] = useState<FilterTier>("全部");
  const [liveOnly, setLiveOnly] = useState(false);
  const router = useRouter();

  const filtered = MOCK_ROOMS.filter(r => {
    if (filter !== "全部" && r.tier !== filter) return false;
    if (liveOnly && !r.isLivestream) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar />
      <AnnouncementBar />

      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 24px",
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gap: "24px",
      }}>

        {/* 左侧：房间列表 */}
        <div>
          {/* 筛选栏 */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: "10px", marginBottom: "20px", flexWrap: "wrap",
          }}>
            {(["全部", "Bronze", "Silver", "Gold", "Diamond"] as FilterTier[]).map(t => (
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

            {/* 只看直播开关 */}
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              marginLeft: "auto",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--brown-light)" }}>
                只看直播
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

          {/* 房间列表 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px",
                color: "var(--brown-light)", fontSize: "15px",
              }}>
                🎣 暂无符合条件的房间，要不要创建一个？
              </div>
            ) : filtered.map(room => (
              <RoomCard key={room.roomId} {...room}
                onJoin={() => alert(`加入房间 ${room.name}`)}
                onWatch={() => alert(`观看直播 ${room.name}`)}
              />
            ))}
          </div>

          {/* 创建房间按钮 */}
          <button className="btn-primary" onClick={() => router.push("/create-room")} style={{
            width: "100%", marginTop: "20px",
            height: "56px", fontSize: "16px",
            borderRadius: "20px",
          }}>
            
            🚩 创建新房间
          </button>
        </div>

        {/* 右侧：我的状态 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* 玩家状态卡片 */}
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
                  未连接钱包
                </div>
                <div style={{ fontSize: "12px", color: "var(--brown-light)", marginTop: "2px" }}>
                  连接后查看战绩
                </div>
              </div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}>
              {[
                { label: "今日场次", value: "—" },
                { label: "本周最佳", value: "—" },
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

          {/* 我的鱼竿 */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{
              fontWeight: 800, fontSize: "14px",
              color: "var(--brown)", marginBottom: "12px",
            }}>🎣 我的鱼竿</div>
            {[
              { name: "Standard Rod", level: "+0", durability: 80 },
              { name: "Speed Rod", level: "+2", durability: 45 },
            ].map(rod => (
              <div key={rod.name} style={{
                background: "var(--cream)",
                borderRadius: "12px", padding: "10px 12px",
                marginBottom: "8px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--brown)" }}>
                    {rod.name} <span style={{ color: "var(--coral)", fontSize: "11px" }}>{rod.level}</span>
                  </div>
                  {/* 耐久爱心条 */}
                  <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} style={{
                        fontSize: "10px",
                        opacity: i < Math.ceil(rod.durability / 20) ? 1 : 0.25,
                      }}>❤️</span>
                    ))}
                  </div>
                </div>
                <span style={{ fontSize: "12px", color: "var(--brown-light)", fontWeight: 600 }}>
                  {rod.durability}%
                </span>
              </div>
            ))}
          </div>

          {/* 推荐好友 */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 800, fontSize: "14px", color: "var(--brown)", marginBottom: "8px" }}>
              🎁 推荐好友
            </div>
            <p style={{ fontSize: "12px", color: "var(--brown-light)", lineHeight: 1.6, marginBottom: "12px" }}>
              邀朋友一起钓鱼，每次你都有小惊喜 🎁
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
              }}>复制</button>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "8px", marginTop: "10px",
            }}>
              {[
                { label: "已推荐", value: "0 人" },
                { label: "累计返佣", value: "0 ETH" },
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