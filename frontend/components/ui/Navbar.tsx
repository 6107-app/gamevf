"use client";

interface NavbarProps {
  walletAddress?: string | null;
  isConnecting?: boolean;
  onConnect?: () => void;
}

export default function Navbar({ walletAddress, isConnecting, onConnect }: NavbarProps) {
  const connected = !!walletAddress;

  const handleConnect = async () => {
    if (onConnect) {
      onConnect();
      return;
    }
    // Fallback: standalone wallet connect (for pages that don't pass props)
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      // No-op in standalone mode since we can't set parent state
      void accounts;
    } else {
      alert("请安装 MetaMask 🦊");
    }
  };

  return (
    <nav style={{
      height: "64px",
      background: "white",
      borderBottom: "1px solid var(--cream-dark)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 32px",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      boxShadow: "0 2px 12px rgba(92,61,46,0.06)",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px",
          background: "linear-gradient(135deg, var(--coral), var(--coral-dark))",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "18px",
        }}>🐟</div>
        <span style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 700,
          fontSize: "20px",
          color: "var(--brown)",
          letterSpacing: "0.02em",
        }}>DeepCast</span>
      </div>

      {/* 钱包按钮 */}
      {connected ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          background: "var(--cream)",
          borderRadius: "20px",
          padding: "8px 16px",
          border: "1px solid var(--cream-dark)",
        }}>
          <span style={{ fontSize: "16px" }}>👛</span>
          <span style={{
            fontWeight: 700, fontSize: "13px", color: "var(--brown)",
          }}>
            {walletAddress!.slice(0, 6)}...{walletAddress!.slice(-4)}
          </span>
        </div>
      ) : (
        <button className="btn-primary" onClick={handleConnect}
          disabled={isConnecting}
          style={{ padding: "10px 20px", fontSize: "14px", opacity: isConnecting ? 0.7 : 1 }}>
          {isConnecting ? "连接中..." : "连接钱包 🎣"}
        </button>
      )}
    </nav>
  );
}
