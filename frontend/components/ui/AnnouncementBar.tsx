export default function AnnouncementBar() {
  const announcements = [
    "🎣 vitalik.eth just caught a Legendary Koi King! Weight: 18.4kg ✨",
    "🏆 Room Reed Bay #3 settled — sakura.eth wins with 2847 points!",
    "🐟 128 matches completed today, with 6 Legendary fish caught in total",
    "🎁 Invite friends to earn 5% referral bonus on entry fees — share now!",
    "⚡ New Gold room open! Entry fee 0.1 ETH — come challenge the best!",
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