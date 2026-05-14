"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import RodCard from "@/components/rods/RodCard";
import { RodData, generateMockRods, ROD_TYPES } from "@/lib/rod";

export default function RodsHallPage() {
  const router = useRouter();
  const [rods, setRods] = useState<RodData[]>(generateMockRods());
  const [filterType, setFilterType] = useState<"All" | keyof typeof ROD_TYPES>("All");

  const filtered = rods.filter(rod => {
    if (filterType === "All") return true;
    return rod.type === filterType;
  });

  const handleRodClick = (tokenId: number) => {
    router.push(`/rods/${tokenId}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar />

      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 24px 64px",
        marginTop: "64px",
      }}>
        {/* Page Header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--brown)",
            marginBottom: "8px",
          }}>
            🎣 我的鱼竿库
          </div>
          <p style={{
            fontSize: "14px",
            color: "var(--brown-light)",
            lineHeight: "1.6",
          }}>
            展示你拥有的所有鱼竿。点击任意鱼竿查看详情、升级或维护它们。
          </p>
        </div>

        {/* Filter Buttons */}
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}>
          {["All", "Standard", "Speed", "Heavy", "Lucky"].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type as any)}
              style={{
                background: filterType === type ? "var(--coral)" : "white",
                color: filterType === type ? "white" : "var(--brown)",
                border: `2px solid ${filterType === type ? "var(--coral)" : "var(--cream-dark)"}`,
                borderRadius: "20px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => {
                if (filterType !== type) {
                  (e.currentTarget as any).style.borderColor = "var(--coral)";
                }
              }}
              onMouseLeave={e => {
                if (filterType !== type) {
                  (e.currentTarget as any).style.borderColor = "var(--cream-dark)";
                }
              }}
            >
              {type === "All" ? "全部" : ROD_TYPES[type as keyof typeof ROD_TYPES].name}
            </button>
          ))}
        </div>

        {/* Rods Grid */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--brown-light)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎣</div>
            <p style={{ fontSize: "15px", marginBottom: "16px" }}>
              暂无此类鱼竿
            </p>
            <button className="btn-primary" onClick={() => setFilterType("All")}>
              查看所有鱼竿
            </button>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px",
          }}>
            {filtered.map(rod => (
              <div key={rod.tokenId} onClick={() => handleRodClick(rod.tokenId)}>
                <RodCard rod={rod} onClick={() => handleRodClick(rod.tokenId)} />
              </div>
            ))}
          </div>
        )}

        {/* Purchase New Rod Section */}
        <div style={{
          marginTop: "48px",
          padding: "32px 24px",
          background: "white",
          borderRadius: "24px",
          boxShadow: "var(--shadow-card)",
        }}>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--brown)",
            marginBottom: "16px",
          }}>
            🛍️ 购买新鱼竿
          </div>
          <p style={{
            fontSize: "13px",
            color: "var(--brown-light)",
            marginBottom: "20px",
            lineHeight: "1.6",
          }}>
            你还没有其他类型的鱼竿？现在可以购买一把新的鱼竿来拓展你的收集。
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}>
            {["Speed", "Heavy", "Lucky"].map(type => {
              const rodInfo = ROD_TYPES[type as keyof typeof ROD_TYPES];
              const hasRod = rods.some(r => r.type === type);
              return (
                <div
                  key={type}
                  style={{
                    background: "var(--cream)",
                    borderRadius: "16px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}>
                    <span style={{ fontSize: "32px" }}>{rodInfo.icon}</span>
                    <div>
                      <div style={{
                        fontWeight: 700,
                        fontSize: "14px",
                        color: "var(--brown)",
                      }}>
                        {rodInfo.name}
                      </div>
                      <span className={`rod-rarity-badge rod-rarity-${rodInfo.rarity.toLowerCase()}`}>
                        {rodInfo.rarity}
                      </span>
                    </div>
                  </div>
                  <p style={{
                    fontSize: "12px",
                    color: "var(--brown-light)",
                    lineHeight: "1.5",
                  }}>
                    {rodInfo.description}
                  </p>
                  {!hasRod && (
                    <button
                      className="btn-primary"
                      style={{
                        marginTop: "8px",
                        width: "100%",
                      }}
                      onClick={() => alert(`购买 ${rodInfo.name}！`)}
                    >
                      购买 - {rodInfo.basePrice} ETH
                    </button>
                  )}
                  {hasRod && (
                    <div style={{
                      background: "#E8F5E9",
                      color: "#2E7D32",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      textAlign: "center",
                    }}>
                      ✓ 已拥有
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
