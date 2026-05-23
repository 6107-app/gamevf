export default function AnnouncementBar() {
  const announcements = [
    "🎣 vitalik.eth just caught a Legendary Koi King! 18.4kg ✨",
    "🏆 Reed Bay #3 settled — sakura.eth wins with 2847 pts!",
    "🐟 128 games completed today, 6 Legendary fish caught",
    "🎁 Refer friends and earn 5% of their entry fees!",
    "⚡ Gold room now open! 0.1 ETH entry, challenge the best!",
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