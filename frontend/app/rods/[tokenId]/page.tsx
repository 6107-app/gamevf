"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import RodCard from "@/components/rods/RodCard";
import RodDurabilityBar from "@/components/rods/RodDurabilityBar";
import { generateMockRods, ROD_TYPES, ROD_MAX_LEVEL, REPAIR_FEES, UPGRADE_FEES, getUpgradeSuccessRate, getRodStatus } from "@/lib/rod";

interface RodDetailPageProps {
  params: { tokenId: string };
}

export default function RodDetailPage({ params }: RodDetailPageProps) {
  const router = useRouter();
  const tokenId = parseInt(params.tokenId);
  const allRods = generateMockRods();
  const rod = allRods.find(r => r.tokenId === tokenId);

  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!rod) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
        <Navbar />
        <div style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "64px 24px",
          marginTop: "64px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎣</div>
          <p style={{ fontSize: "16px", color: "var(--brown-light)", marginBottom: "24px" }}>
            找不到这把鱼竿
          </p>
          <button className="btn-primary" onClick={() => router.push("/rods")}>
            返回鱼竿库
          </button>
        </div>
      </div>
    );
  }

  const rodType = ROD_TYPES[rod.type];
  const canUpgrade = rod.level < ROD_MAX_LEVEL;
  const needsRepair = getRodStatus(rod) !== "healthy";
  const repairFee = REPAIR_FEES[rod.level];
  const upgradeFee = canUpgrade ? UPGRADE_FEES[rod.level] : 0;

  const handleRepair = async () => {
    setIsProcessing(true);
    // 模拟维护过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    setShowRepairModal(false);
    alert(`✅ 鱼竿维护成功！耐久度已恢复至 100/100。`);
  };

  const handleUpgrade = async () => {
    setIsProcessing(true);
    // 模拟升级过程
    await new Promise(resolve => setTimeout(resolve, 2000));
    const successRate = getUpgradeSuccessRate(rod.level);
    const isSuccess = Math.random() * 100 < successRate;
    setIsProcessing(false);
    setShowUpgradeModal(false);

    if (isSuccess) {
      alert(`🎉 升级成功！${rodType.name} 现已升至 +${rod.level + 1} 级！`);
    } else {
      alert(`❌ 升级失败。升级费 ${upgradeFee} ETH 已扣除，请重新尝试。`);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar />

      <div style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "32px 24px 64px",
        marginTop: "64px",
      }}>
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--coral)",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "24px",
            padding: 0,
          }}
        >
          ← 返回
        </button>

        {/* Main Content Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          marginBottom: "32px",
        }}>
          {/* Left: Rod Card */}
          <div>
            <RodCard rod={rod} />
          </div>

          {/* Right: Details & Actions */}
          <div>
            {/* Status Section */}
            <div
              className="card"
              style={{
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              <div style={{
                fontWeight: 700,
                fontSize: "14px",
                color: "var(--brown)",
                marginBottom: "16px",
              }}>
                📊 鱼竿状态
              </div>

              {/* Level Info */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
              }}>
                <div style={{
                  background: "var(--cream)",
                  borderRadius: "12px",
                  padding: "12px",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: "var(--brown-light)",
                    marginBottom: "4px",
                  }}>
                    当前等级
                  </div>
                  <div style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "var(--coral)",
                  }}>
                    +{rod.level}
                  </div>
                </div>
                <div style={{
                  background: "var(--cream)",
                  borderRadius: "12px",
                  padding: "12px",
                }}>
                  <div style={{
                    fontSize: "11px",
                    color: "var(--brown-light)",
                    marginBottom: "4px",
                  }}>
                    最高等级
                  </div>
                  <div style={{
                    fontSize: "20px",
                    fontWeight: 800,
                    color: "var(--brown)",
                  }}>
                    +{ROD_MAX_LEVEL}
                  </div>
                </div>
              </div>

              {/* Durability Status */}
              <div style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "12px",
                marginBottom: "16px",
              }}>
                <div style={{
                  fontSize: "11px",
                  color: "var(--brown-light)",
                  marginBottom: "8px",
                  fontWeight: 600,
                }}>
                  耐久度状态
                </div>
                <RodDurabilityBar rod={rod} showLabel={true} size="large" />
              </div>

              {/* Status Badge */}
              <div style={{
                textAlign: "center",
                padding: "12px",
                borderRadius: "8px",
                background:
                  getRodStatus(rod) === "healthy"
                    ? "#E8F5E9"
                    : getRodStatus(rod) === "warning"
                      ? "#FFF9C4"
                      : "#FFEBEE",
                color:
                  getRodStatus(rod) === "healthy"
                    ? "#2E7D32"
                    : getRodStatus(rod) === "warning"
                      ? "#F57F17"
                      : "#C62828",
                fontSize: "12px",
                fontWeight: 600,
              }}>
                {getRodStatus(rod) === "healthy"
                  ? "✓ 状态良好"
                  : getRodStatus(rod) === "warning"
                    ? "⚠️ 耐久度即将耗尽"
                    : "🔴 需要紧急维护"}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Repair Button */}
              <button
                className="btn-primary"
                disabled={!needsRepair || isProcessing}
                onClick={() => setShowRepairModal(true)}
                style={{
                  width: "100%",
                  opacity: !needsRepair ? 0.5 : 1,
                  cursor: !needsRepair ? "not-allowed" : "pointer",
                }}
              >
                {isProcessing ? "维护中..." : `🔧 维护鱼竿 (${repairFee} ETH)`}
              </button>

              {/* Upgrade Button */}
              <button
                className="btn-primary"
                disabled={!canUpgrade || isProcessing}
                onClick={() => setShowUpgradeModal(true)}
                style={{
                  width: "100%",
                  opacity: !canUpgrade ? 0.5 : 1,
                  cursor: !canUpgrade ? "not-allowed" : "pointer",
                }}
              >
                {isProcessing
                  ? "升级中..."
                  : canUpgrade
                    ? `⬆️ 升级至 +${rod.level + 1} (${upgradeFee} ETH)`
                    : "✓ 已达到最高等级"}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div
          className="card"
          style={{
            padding: "20px",
          }}
        >
          <div style={{
            fontWeight: 700,
            fontSize: "14px",
            color: "var(--brown)",
            marginBottom: "16px",
          }}>
            ℹ️ 鱼竿说明
          </div>

          <div style={{
            display: "grid",
            gap: "16px",
          }}>
            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                特性描述
              </div>
              <p style={{
                fontSize: "13px",
                color: "var(--brown)",
                lineHeight: "1.6",
              }}>
                {rodType.description}
              </p>
            </div>

            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                使用说明
              </div>
              <ul style={{
                fontSize: "13px",
                color: "var(--brown)",
                lineHeight: "1.8",
                paddingLeft: "20px",
              }}>
                <li>每使用 {10} 次鱼竿，耐久度会下降至无法使用</li>
                <li>使用前请确保耐久度充足</li>
                <li>维护费用会随着等级提升而增加</li>
                <li>升级可以提升鱼竿的各项属性</li>
                <li>升级失败不会扣除鱼竿等级，但升级费用不退还</li>
              </ul>
            </div>

            <div>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--brown-light)",
                marginBottom: "6px",
              }}>
                费用信息
              </div>
              <div style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "12px",
                fontSize: "12px",
                color: "var(--brown)",
              }}>
                <div style={{ marginBottom: "6px" }}>
                  • 维护费（当前等级）：{repairFee} ETH
                </div>
                <div>
                  • 升级费（下一等级）：{canUpgrade ? upgradeFee : "-"} ETH
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Repair Modal */}
      {showRepairModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !isProcessing && setShowRepairModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "420px",
              width: "90%",
              padding: "32px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontSize: "32px",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              🔧
            </div>

            <div style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--brown)",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              维护鱼竿
            </div>

            <p style={{
              fontSize: "14px",
              color: "var(--brown-light)",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: "1.6",
            }}>
              确认维护 <strong>{rodType.name}</strong> 吗？
            </p>

            <div
              style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px",
                textAlign: "center",
              }}
            >
              <div style={{
                fontSize: "12px",
                color: "var(--brown-light)",
                marginBottom: "8px",
              }}>
                维护费用
              </div>
              <div style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--coral)",
              }}>
                {repairFee} ETH
              </div>
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
            }}>
              <button
                className="btn-secondary"
                disabled={isProcessing}
                onClick={() => setShowRepairModal(false)}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={handleRepair}
                style={{ flex: 1 }}
              >
                {isProcessing ? "维护中..." : "确认维护"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !isProcessing && setShowUpgradeModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: "420px",
              width: "90%",
              padding: "32px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontSize: "32px",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              ⬆️
            </div>

            <div style={{
              fontFamily: "var(--font-serif)",
              fontSize: "18px",
              fontWeight: 700,
              color: "var(--brown)",
              textAlign: "center",
              marginBottom: "16px",
            }}>
              升级鱼竿
            </div>

            <p style={{
              fontSize: "14px",
              color: "var(--brown-light)",
              textAlign: "center",
              marginBottom: "24px",
              lineHeight: "1.6",
            }}>
              将 <strong>{rodType.name}</strong> 从 <strong>+{rod.level}</strong> 升级至{" "}
              <strong>+{rod.level + 1}</strong>
            </p>

            <div
              style={{
                background: "var(--cream)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px",
              }}
            >
              <div style={{
                display: "grid",
                gap: "12px",
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}>
                  <span style={{ color: "var(--brown-light)" }}>升级费用</span>
                  <span style={{ fontWeight: 700, color: "var(--brown)" }}>
                    {upgradeFee} ETH
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "13px",
                }}>
                  <span style={{ color: "var(--brown-light)" }}>成功率</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#FFB74D",
                    }}
                  >
                    {getUpgradeSuccessRate(rod.level)}%
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: "#FFF9C4",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "24px",
                fontSize: "12px",
                color: "#F57F17",
                lineHeight: "1.6",
              }}
            >
              ⚠️ 升级失败时不会扣除等级，但升级费用不会退还。
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
            }}>
              <button
                className="btn-secondary"
                disabled={isProcessing}
                onClick={() => setShowUpgradeModal(false)}
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                className="btn-primary"
                disabled={isProcessing}
                onClick={handleUpgrade}
                style={{ flex: 1 }}
              >
                {isProcessing ? "升级中..." : "确认升级"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
