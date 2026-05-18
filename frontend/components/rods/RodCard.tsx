"use client";

import { RodData, ROD_TYPES, ROD_RARITY_COLORS, ROD_MAX_LEVEL } from "@/lib/rod";
import RodDurabilityBar from "./RodDurabilityBar";

const ATTRIBUTE_LABELS = [
  { key: "speedBonus", label: "Speed", hint: "降低时间消耗", color: "#8B6355" },
  { key: "weightBonus", label: "Weight", hint: "提高鱼重量区间", color: "#8B6355" },
  { key: "luckBonus", label: "Luck", hint: "提高稀有度概率", color: "#8B6355" },
  { key: "stabilityBps", label: "Stability", hint: "降低空杆/Debuff影响", color: "#8B6355" },
] as const;

interface RodCardProps {
  rod: RodData;
  onClick?: () => void;
  showDurability?: boolean;
  compact?: boolean;
}

export default function RodCard({
  rod,
  onClick,
  showDurability = true,
  compact = false,
}: RodCardProps) {
  const rodType = ROD_TYPES[rod.type];
  const rarityColor = ROD_RARITY_COLORS[rod.rarity];

  if (compact) {
    return (
      <div
        className="rod-card"
        onClick={onClick}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
        }}
      >
        <div style={{
          fontSize: "32px",
          flex: "0 0 auto",
        }}>
          {rodType.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}>
            <span style={{
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--brown)",
            }}>
              {rodType.name}
            </span>
            <span
              className={`rod-rarity-badge rod-rarity-${rod.rarity.toLowerCase()}`}
            >
              {rod.rarity}
            </span>
            {rod.level > 0 && (
              <span className="rod-level-tag">+{rod.level}</span>
            )}
          </div>
          {showDurability && (
            <RodDurabilityBar rod={rod} showLabel={true} size="small" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rod-card"
      onClick={onClick}
      style={{
        padding: "16px",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "12px",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <div style={{
            fontSize: "40px",
            width: "60px",
            height: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--cream)",
            borderRadius: "16px",
          }}>
            {rodType.icon}
          </div>
          <div>
            <div style={{
              fontWeight: 800,
              fontSize: "16px",
              color: "var(--brown)",
              marginBottom: "4px",
            }}>
              {rodType.name}
            </div>
            <span
              className={`rod-rarity-badge rod-rarity-${rod.rarity.toLowerCase()}`}
            >
              {rod.rarity}
            </span>
          </div>
        </div>
        {rod.level > 0 && (
          <div className="rod-level-tag">+{rod.level}</div>
        )}
      </div>

      {/* Level Progress */}
      {rod.level < ROD_MAX_LEVEL && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--brown-light)",
            marginBottom: "6px",
          }}>
            等级进度：+{rod.level} / +{ROD_MAX_LEVEL}
          </div>
          <div className="rod-upgrade-progress">
            {Array.from({ length: ROD_MAX_LEVEL + 1 }).map((_, i) => (
              <div
                key={i}
                className={`rod-upgrade-dot ${i <= rod.level ? "active" : ""}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Durability */}
      {showDurability && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--brown-light)",
            marginBottom: "6px",
          }}>
            耐久度：
          </div>
          <RodDurabilityBar rod={rod} showLabel={true} size="medium" />
        </div>
      )}

      {/* Description */}
      <div style={{
        fontSize: "13px",
        color: "var(--brown-light)",
        lineHeight: "1.5",
        marginBottom: "12px",
      }}>
        {rodType.description}
      </div>

      {/* Attributes */}
      <div style={{
        background: "var(--cream)",
        borderRadius: "12px",
        padding: "10px 12px",
        marginBottom: "12px",
      }}>
        <div style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--brown)",
          marginBottom: "6px",
        }}>
          属性加成
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px",
        }}>
          {ATTRIBUTE_LABELS.map(attr => {
            const rawValue =
              attr.key === "stabilityBps"
                ? Math.round((rod.attributes.stabilityBps ?? 0) / 100)
                : Number((rod.attributes as any)[attr.key] ?? 0);
            return (
              <div key={attr.label} style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: "11px",
                  color: "var(--brown-light)",
                }}>
                  {attr.label}
                </div>
                <div style={{
                  fontSize: "12px",
                  color: "var(--brown-light)",
                  marginBottom: "2px",
                }}>
                  {attr.hint}
                </div>
                <div style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: rawValue > 0 ? attr.color : "#8B6355",
                }}>
                  +{rawValue}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Token ID */}
      <div style={{
        fontSize: "12px",
        color: "var(--brown-light)",
        textAlign: "right",
      }}>
        NFT #{rod.tokenId}
      </div>
    </div>
  );
}
