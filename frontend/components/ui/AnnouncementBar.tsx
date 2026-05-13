export default function AnnouncementBar() {
  const announcements = [
    "🎣 vitalik.eth 刚刚钓到了传说级 锦鲤王！重达 18.4kg ✨",
    "🏆 芦苇湾3号 房间已结算，sakura.eth 以 2847分 夺冠！",
    "🐟 今日已有 128 场比赛完成，共钓出 6 条 Legendary 鱼",
    "🎁 邀请好友参赛可获得入场费 5% 返佣，快去分享吧！",
    "⚡ Gold 房间新开！入场费 0.1 ETH，快来挑战高手！",
  ];

  const text = announcements.join("　　　　");

  return (
    <div style={{
      background: "var(--cream-dark)",
      borderBottom: "1px solid #EDE0CC",
      height: "36px",
      display: "flex",
      alignItems: "center",
      overflow: "hidden",
      marginTop: "64px",
    }}>
      <div style={{
        display: "flex",
        whiteSpace: "nowrap",
      }} className="animate-marquee">
        <span style={{
          fontSize: "12px",
          color: "var(--brown-light)",
          paddingRight: "80px",
          fontWeight: 600,
        }}>{text}　　　　{text}</span>
      </div>
    </div>
  );
}