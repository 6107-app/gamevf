"use client";

import { RodData, getRodStatus } from "@/lib/rod";

interface RodDurabilityBarProps {
  rod: RodData;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
}

export default function RodDurabilityBar({
  rod,
  showLabel = true,
  size = "medium",
}: RodDurabilityBarProps) {
  const status = getRodStatus(rod);
  const percent = (rod.durability / rod.maxDurability) * 100;

  const sizeConfig = {
    small: { height: "6px", fontSize: "12px", gap: "4px" },
    medium: { height: "8px", fontSize: "13px", gap: "6px" },
    large: { height: "12px", fontSize: "14px", gap: "8px" },
  };

  const config = sizeConfig[size];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: config.gap }}>
      <div style={{ flex: 1 }}>
        <div style={{
          width: "100%",
          height: config.height,
          background: "#E8E8E8",
          borderRadius: "4px",
          overflow: "hidden",
        }}>
          <div
            className={`rod-durability-fill ${
              status === "low" ? "rod-durability-low" : ""
            } ${status === "critical" ? "rod-durability-critical" : ""}`}
            style={{
              width: `${percent}%`,
              height: "100%",
            }}
          />
        </div>
      </div>
      {showLabel && (
        <span style={{
          fontSize: config.fontSize,
          fontWeight: 600,
          color: status === "critical" ? "#E53935" : "#8B6355",
          minWidth: "50px",
          textAlign: "right",
        }}>
          {rod.durability}/{rod.maxDurability}
        </span>
      )}
    </div>
  );
}
