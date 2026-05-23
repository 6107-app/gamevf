"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { useContract } from "@/lib/ethereum";
import { RARITY_NAMES, FISHING_GAME_ADDRESS, TIER_NAMES, PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI } from "@/lib/contract";
import { ethers } from "ethers";

// ─── Types ───────────────────────────────────────────────────────────────────
type Rarity = "Common" | "Rare" | "SuperRare" | "Epic" | "Legendary";
type PlayerStatus = "fishing" | "caught" | "locked" | "waiting";

interface Player {
  idx: number;
  addr: string;
  ens: string;
  avatar: string;
  status: PlayerStatus;
  rarity: Rarity | null;
  weight: number;
  score: number;
  recastCount: number;
}

interface LiveEvent {
  id: number;
  timestamp: string;
  playerEns: string;
  playerAvatar: string;
  type: "cast" | "caught" | "recast" | "locked" | "dice" | "bet";
  rarity?: Rarity;
  weight?: number;
  score?: number;
  diceResult?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RARITY_COLOR: Record<Rarity, string> = {
  Common:    "#9E9E9E",
  Rare:      "#2196F3",
  SuperRare: "#9C27B0",
  Epic:      "#FF6F00",
  Legendary: "#E8C547",
};
const RARITY_BG: Record<Rarity, string> = {
  Common:    "#F5F5F5",
  Rare:      "#E3F2FD",
  SuperRare: "#F3E5F5",
  Epic:      "#FFF3E0",
  Legendary: "#FFFDE7",
};
const RARITY_LABEL: Record<Rarity, string> = {
  Common: "Common", Rare: "Rare", SuperRare: "Super Rare", Epic: "Epic", Legendary: "Legendary",
};
const STATUS_EMOJI: Record<PlayerStatus, string> = {
  waiting: "😴", fishing: "🎣", caught: "😍", locked: "✅",
};
const STATUS_LABEL: Record<PlayerStatus, string> = {
  waiting: "Waiting", fishing: "Fishing", caught: "Hooked", locked: "Locked In",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
// TODO: Replace with ethers.js on-chain reads after contract is deployed
const MOCK_PLAYERS: Player[] = [
  { idx: 0, addr: "0xA1...", ens: "vitalik.eth",  avatar: "🐙", status: "locked",  rarity: "Epic",      weight: 12400, score: 3870, recastCount: 2 },
  { idx: 1, addr: "0xB2...", ens: "sakura.eth",   avatar: "🦊", status: "caught",  rarity: "Rare",      weight: 3200,  score: 1240, recastCount: 1 },
  { idx: 2, addr: "0xC3...", ens: "moon.eth",     avatar: "🐳", status: "fishing", rarity: null,        weight: 0,     score: 0,    recastCount: 0 },
  { idx: 3, addr: "0xD4...", ens: "anon.eth",     avatar: "🦄", status: "fishing", rarity: null,        weight: 0,     score: 0,    recastCount: 0 },
];

const MOCK_EVENTS: LiveEvent[] = [
  { id: 1, timestamp: "02:41", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "locked",  rarity: "Epic",  weight: 12400, score: 3870 },
  { id: 2, timestamp: "02:15", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "dice",    diceResult: "⚡ Super Buff! Rarity +30%" },
  { id: 3, timestamp: "01:58", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "recast"  },
  { id: 4, timestamp: "01:30", playerEns: "sakura.eth",  playerAvatar: "🦊", type: "caught",  rarity: "Rare",  weight: 3200,  score: 1240 },
  { id: 5, timestamp: "00:52", playerEns: "vitalik.eth", playerAvatar: "🐙", type: "caught",  rarity: "Rare",  weight: 2800,  score: 980  },
  { id: 6, timestamp: "00:10", playerEns: "moon.eth",    playerAvatar: "🐳", type: "cast"    },
  { id: 7, timestamp: "00:05", playerEns: "anon.eth",    playerAvatar: "🦄", type: "cast"    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcTimeWeight(elapsed: number): number {
  const MAX = 100, MIN = 10, DURATION = 180;
  if (elapsed >= DURATION) return MIN;
  return MAX - Math.floor((elapsed * (MAX - MIN)) / DURATION);
}

function fmtScore(s: number) {
  return s > 0 ? s.toLocaleString() : "—";
}

function fmtWeight(g: number) {
  if (g === 0) return "—";
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;
}

function nowStr() {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

const ADDR_AVATARS = ["🐙","🦊","🐳","🦄","🐬","🦁","🐯","🐻","🦋","🐝","🦅","🦉"];
function addrToAvatar(addr: string): string {
  const hash = parseInt(addr.slice(2, 6) || "0000", 16);
  return ADDR_AVATARS[hash % ADDR_AVATARS.length];
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function PlayerCard({
  player, rank, isSelected, onSelect, userBetIdx, odds, betEth,
}: {
  player: Player; rank: number | null; isSelected: boolean;
  onSelect: () => void; userBetIdx: number | null;
  /** implied odds percent 0-100 */
  odds: number;
  /** total weighted ETH bet on this player */
  betEth: number;
}) {

  return (
    <div
      onClick={onSelect}
      style={{
        background: isSelected
          ? "linear-gradient(135deg, #FFF0EE, #FFE4E0)"
          : "white",
        borderRadius: "20px",
        padding: "16px",
        border: isSelected
          ? "2px solid var(--coral)"
          : "2px solid transparent",
        boxShadow: isSelected
          ? "0 4px 20px rgba(255,123,107,0.2)"
          : "var(--shadow-card)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      {/* Rank badge */}
      {rank !== null && (
        <div style={{
          position: "absolute", top: "-8px", left: "16px",
          background: rank === 1 ? "var(--gold)" : rank === 2 ? "var(--silver)" : "var(--bronze)",
          color: "white", borderRadius: "10px",
          padding: "2px 10px", fontSize: "11px", fontWeight: 800,
        }}>
          #{rank}
        </div>
      )}

      {/* User bet indicator */}
      {userBetIdx === player.idx && (
        <div style={{
          position: "absolute", top: "-8px", right: "16px",
          background: "var(--mint-dark)", color: "white",
          borderRadius: "10px", padding: "2px 10px",
          fontSize: "11px", fontWeight: 800,
        }}>
          🎯 Bet Placed
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Avatar */}
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "var(--cream)", fontSize: "24px",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {player.avatar}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--brown)" }}>
              {player.ens}
            </span>
            <span style={{ fontSize: "16px" }}>{STATUS_EMOJI[player.status]}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
            {STATUS_LABEL[player.status]}
            {player.recastCount > 0 && ` · Recast ${player.recastCount}x`}
          </div>
        </div>

        {/* Score */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, fontSize: "18px", color: "var(--coral)" }}>
            {fmtScore(player.score)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
            pts
          </div>
        </div>
      </div>

      {/* Fish info row */}
      {player.rarity && (
        <div style={{
          marginTop: "10px",
          background: RARITY_BG[player.rarity],
          borderRadius: "10px", padding: "8px 12px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{
            fontSize: "11px", fontWeight: 800,
            color: RARITY_COLOR[player.rarity],
          }}>
            {RARITY_LABEL[player.rarity]}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown-light)" }}>
            {fmtWeight(player.weight)}
          </span>
        </div>
      )}

      {/* Odds bar */}
      <div style={{ marginTop: "10px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginBottom: "4px",
        }}>
          <span style={{ fontSize: "11px", color: "var(--brown-light)", fontWeight: 600 }}>
            Bet Share
          </span>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--brown)" }}>
            {odds}%
          </span>
        </div>
        <div style={{
          height: "6px", borderRadius: "3px",
          background: "var(--cream-dark)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: "3px",
            width: `${odds}%`,
            background: isSelected
              ? "var(--coral)"
              : "linear-gradient(90deg, var(--coral-light), var(--coral))",
            transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ fontSize: "10px", color: "var(--brown-light)", marginTop: "3px" }}>
          {betEth > 0 ? `${betEth.toFixed(4)} ETH bet` : "No bets yet"}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }: { event: LiveEvent }) {
  const typeConfig: Record<LiveEvent["type"], { label: string; color: string; icon: string }> = {
    cast:   { label: "Cast",    color: "#2196F3", icon: "🎣" },
    caught: { label: "Hooked!", color: "var(--coral)", icon: "🐟" },
    recast: { label: "Recast",  color: "#9C27B0", icon: "🔁" },
    locked: { label: "Lock In", color: "var(--mint-dark)", icon: "✅" },
    dice:   { label: "Dice",    color: "var(--gold)", icon: "🎲" },
    bet:    { label: "Bet",     color: "#7B1FA2", icon: "💰" },
  };
  const cfg = typeConfig[event.type];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "10px 0",
      borderBottom: "1px solid var(--cream-dark)",
      animation: "bounce-in 0.3s ease forwards",
    }}>
      <div style={{
        width: "32px", height: "32px", borderRadius: "50%",
        background: "var(--cream)", fontSize: "16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {event.playerAvatar}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--brown)" }}>
            {event.playerEns}
          </span>
          <span style={{
            fontSize: "10px", fontWeight: 700, padding: "1px 6px",
            borderRadius: "6px", background: cfg.color, color: "white",
          }}>
            {cfg.icon} {cfg.label}
          </span>
          <span style={{ fontSize: "10px", color: "var(--brown-light)", marginLeft: "auto" }}>
            {event.timestamp}
          </span>
        </div>

        {event.type === "caught" && event.rarity && (
          <div style={{
            fontSize: "11px", color: RARITY_COLOR[event.rarity], fontWeight: 700,
          }}>
            {RARITY_LABEL[event.rarity]} · {fmtWeight(event.weight ?? 0)} · {fmtScore(event.score ?? 0)} pts
          </div>
        )}
        {event.type === "dice" && (
          <div style={{ fontSize: "11px", color: "#E8C547", fontWeight: 700 }}>
            {event.diceResult}
          </div>
        )}
        {event.type === "locked" && event.rarity && (
          <div style={{ fontSize: "11px", color: "var(--mint-dark)", fontWeight: 700 }}>
            Final: {RARITY_LABEL[event.rarity]} {fmtWeight(event.weight ?? 0)} · {fmtScore(event.score ?? 0)} pts
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SpectatorPage() {
  const params  = useParams();
  const router  = useRouter();
  const roomId  = params.roomId as string;

  // Contract
  const { getRpcReadContract, wallet } = useContract();
  const isContractReady =
    FISHING_GAME_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // Game state
  const [players,    setPlayers]    = useState<Player[]>(MOCK_PLAYERS);
  const [events,     setEvents]     = useState<LiveEvent[]>(MOCK_EVENTS);
  const [elapsed,    setElapsed]    = useState(0);
  const [gameOver,   setGameOver]   = useState(false);
  const [dataSource, setDataSource] = useState<"mock" | "chain">("mock");
  const [roomStatus, setRoomStatus] = useState<0 | 1 | 2>(0); // 0=Waiting 1=Active 2=Finished
  const [txPending,  setTxPending]  = useState(false);

  // Ref: always reflects latest players — lets event listeners avoid stale closures
  const playersRef = useRef<Player[]>(MOCK_PLAYERS);
  useEffect(() => { playersRef.current = players; }, [players]);

  // Ref: track whether elapsed was initialised from GameStarted event (only once)
  const elapsedInitialized = useRef(false);

  // Room header state (populated from chain when available)
  const [roomTierLabel, setRoomTierLabel] = useState("Silver");
  const [roomTotalPot,  setRoomTotalPot]  = useState(0.20);

  // PredictionMarket state
  // oddsMap:   addr.toLowerCase() → implied odds percent (0-100)
  // betEthMap: addr.toLowerCase() → weighted ETH bet on this player
  const [oddsMap,          setOddsMap]          = useState<Record<string, number>>({});
  const [betEthMap,        setBetEthMap]         = useState<Record<string, number>>({});
  const [marketTotalPool,  setMarketTotalPool]   = useState(0);
  const [marketBettingOpen, setMarketBettingOpen] = useState(false);
  const marketReady =
    PREDICTION_MARKET_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // Betting state
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [betAmount,   setBetAmount]   = useState("");
  const [userBetIdx,  setUserBetIdx]  = useState<number | null>(null);
  const [hasBet,      setHasBet]      = useState(false);
  const [betError,    setBetError]    = useState("");

  const timeWeight = calcTimeWeight(elapsed);
  const timeRemaining = Math.max(0, 180 - elapsed);
  const timerStr = `${String(Math.floor(timeRemaining / 60)).padStart(2,"0")}:${String(timeRemaining % 60).padStart(2,"0")}`;

  // ─── Fetch PredictionMarket data ──────────────────────────────────────────
  // Called with the current list of player addresses so we avoid stale-closure issues.
  const fetchMarketData = useCallback(async (playerAddrs: string[]) => {
    if (!marketReady || playerAddrs.length === 0) return;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const market = new ethers.Contract(
      PREDICTION_MARKET_ADDRESS,
      PREDICTION_MARKET_ABI,
      provider,
    );

    try {
      // Total pool + bettingOpen flag
      const info = await market.getMarketInfo(Number(roomId));
      setMarketTotalPool(Number(info.totalPool) / 1e18);
      setMarketBettingOpen(Boolean(info.bettingOpen));

      // Per-player odds + weighted ETH
      const newOdds:   Record<string, number> = {};
      const newBetEth: Record<string, number> = {};

      await Promise.all(
        playerAddrs.map(async (addr) => {
          try {
            const result = await market.getOdds(Number(roomId), addr);
            // impliedOddsBps: 0-10000 → percentage 0-100
            newOdds[addr.toLowerCase()]   = Number(result.impliedOddsBps) / 100;
            // playerWeighted is in wei (ETH * time-weight factor); convert to ETH
            newBetEth[addr.toLowerCase()] = Number(result.playerWeighted) / 1e18;
          } catch {
            newOdds[addr.toLowerCase()]   = 0;
            newBetEth[addr.toLowerCase()] = 0;
          }
        }),
      );

      setOddsMap(newOdds);
      setBetEthMap(newBetEth);
    } catch {
      // PredictionMarket not yet opened — keep existing (zeroed) values
    }
  }, [marketReady, roomId]);

  // ─── Fetch room + players from chain ──────────────────────────────────────
  const fetchRoomAndPlayers = useCallback(async () => {
    if (!isContractReady) return;
    const contract = getRpcReadContract();
    if (!contract) return;

    try {
      const info = await contract.getRoomInfo(Number(roomId));

      // Room-level fields
      const tierIdx  = Number(info.tier);
      const status   = Number(info.status) as 0 | 1 | 2; // 0=Waiting 1=Active 2=Finished
      const pCount   = Number(info.playerCount);
      const pot      = Number(info.totalPot) / 1e18;

      setRoomTierLabel(TIER_NAMES[tierIdx] ?? "Bronze");
      setRoomTotalPot(pot);
      setRoomStatus(status);
      if (status === 2) setGameOver(true);

      // ── Initialise elapsed from GameStarted event (runs once per session) ──
      if (!elapsedInitialized.current && (status === 1 || status === 2)) {
        try {
          const pastEvents = await contract.queryFilter(
            contract.filters.GameStarted(BigInt(roomId)),
          );
          if (pastEvents.length > 0) {
            // GameStarted(uint256 indexed roomId, uint256 timestamp)
            const gameTs = Number((pastEvents[0] as { args: bigint[] }).args[1]);
            const nowTs  = Math.floor(Date.now() / 1000);
            setElapsed(Math.min(Math.max(0, nowTs - gameTs), 180));
          }
        } catch {
          // queryFilter failed — elapsed stays at 0
        }
        elapsedInitialized.current = true;
      }

      if (pCount === 0) return;

      // Fetch each player
      const fetched: Player[] = [];
      for (let i = 0; i < pCount; i++) {
        try {
          const p = await contract.getPlayerInfo(Number(roomId), i);
          const score      = Number(p.score);
          const pStatus    = Number(p.status);  // 0=Fishing 1=LockedIn 2=Recast
          const rarityIdx  = Number(p.rarity);
          const weightG    = Number(p.weight);  // stored in grams

          // Derive display status
          let dispStatus: PlayerStatus;
          if (pStatus === 1) {
            dispStatus = score > 0 ? "locked" : "caught";
          } else {
            dispStatus = "fishing";
          }

          // Rarity only meaningful once LockedIn with a fish
          const rarity: Rarity | null =
            pStatus === 1 && score > 0
              ? (RARITY_NAMES[rarityIdx] as Rarity ?? null)
              : null;

          fetched.push({
            idx:         i,
            addr:        p.addr,
            ens:         shortenAddr(p.addr),
            avatar:      addrToAvatar(p.addr),
            status:      dispStatus,
            rarity,
            weight:      weightG,
            score,
            recastCount: Number(p.recastCount),
          });
        } catch {
          // skip individual player errors
        }
      }

      if (fetched.length > 0) {
        setPlayers(fetched);
        // First time we get real chain data: wipe mock events so the feed starts clean
        setDataSource(prev => {
          if (prev === "mock") setEvents([]);
          return "chain";
        });
        // Piggyback market fetch — pass fresh addresses to avoid stale closure
        fetchMarketData(fetched.map(p => p.addr));
      }
    } catch {
      // keep existing data (mock or previous fetch)
    }
  }, [isContractReady, roomId, getRpcReadContract, fetchMarketData]);

  // Fetch on mount, then every 5 seconds
  useEffect(() => {
    fetchRoomAndPlayers();
    const id = setInterval(fetchRoomAndPlayers, 5000);
    return () => clearInterval(id);
  }, [fetchRoomAndPlayers]);

  // Countdown timer
  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [gameOver]);

  // ─── Chain event listeners (real-time feed) ─────────────────────────────────
  useEffect(() => {
    if (!isContractReady) return;
    const fishingGame = getRpcReadContract();
    if (!fishingGame) return;
    const roomIdNum = Number(roomId);

    // helper: look up player info by address from the ref (no stale closure)
    const pInfo = (addr: string) => {
      const found = playersRef.current.find(
        pl => pl.addr.toLowerCase() === addr.toLowerCase()
      );
      return {
        ens:    found?.ens    ?? shortenAddr(addr),
        avatar: found?.avatar ?? addrToAvatar(addr),
      };
    };

    // ── FishingGame events ─────────────────────────────────────────────────
    const onFishCaught = (
      evRoomId: bigint, playerAddr: string,
      rarity: number, weight: bigint, score: bigint,
    ) => {
      if (Number(evRoomId) !== roomIdNum) return;
      const { ens, avatar } = pInfo(playerAddr);
      const rarityName = (RARITY_NAMES[rarity] ?? "Common") as Rarity;
      setEvents(prev => [{
        id: Date.now(), timestamp: nowStr(),
        playerEns: ens, playerAvatar: avatar,
        type: "caught" as const, rarity: rarityName,
        weight: Number(weight), score: Number(score),
      }, ...prev].slice(0, 30));
      // Refresh player scoreboard
      fetchRoomAndPlayers();
    };

    const onPlayerLockedIn = (
      evRoomId: bigint, playerAddr: string, finalScore: bigint,
    ) => {
      if (Number(evRoomId) !== roomIdNum) return;
      const { ens, avatar } = pInfo(playerAddr);
      setEvents(prev => [{
        id: Date.now(), timestamp: nowStr(),
        playerEns: ens, playerAvatar: avatar,
        type: "locked" as const, score: Number(finalScore),
      }, ...prev].slice(0, 30));
      fetchRoomAndPlayers();
    };

    const onDiceRolled = (
      evRoomId: bigint, playerAddr: string, diceModifier: bigint,
    ) => {
      if (Number(evRoomId) !== roomIdNum) return;
      const { ens, avatar } = pInfo(playerAddr);
      const mod = Number(diceModifier);
      setEvents(prev => [{
        id: Date.now(), timestamp: nowStr(),
        playerEns: ens, playerAvatar: avatar,
        type: "dice" as const,
        diceResult: mod >= 0 ? `🎲 Buff +${mod}%` : `🎲 Debuff ${mod}%`,
      }, ...prev].slice(0, 30));
    };

    const onRecastStarted = (evRoomId: bigint, playerAddr: string) => {
      if (Number(evRoomId) !== roomIdNum) return;
      const { ens, avatar } = pInfo(playerAddr);
      setEvents(prev => [{
        id: Date.now(), timestamp: nowStr(),
        playerEns: ens, playerAvatar: avatar,
        type: "recast" as const,
      }, ...prev].slice(0, 30));
    };

    const onCastRequested = (evRoomId: bigint, playerAddr: string) => {
      if (Number(evRoomId) !== roomIdNum) return;
      const { ens, avatar } = pInfo(playerAddr);
      setEvents(prev => [{
        id: Date.now(), timestamp: nowStr(),
        playerEns: ens, playerAvatar: avatar,
        type: "cast" as const,
      }, ...prev].slice(0, 30));
    };

    fishingGame.on("FishCaught",     onFishCaught);
    fishingGame.on("PlayerLockedIn", onPlayerLockedIn);
    fishingGame.on("DiceRolled",     onDiceRolled);
    fishingGame.on("RecastStarted",  onRecastStarted);
    fishingGame.on("CastRequested",  onCastRequested);

    // ── PredictionMarket BetPlaced event ──────────────────────────────────
    let pmContract: ethers.Contract | null = null;
    if (marketReady) {
      const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      pmContract = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, provider,
      );

      const onBetPlaced = (
        evRoomId: bigint, bettor: string,
        predictedWinner: string, amount: bigint,
      ) => {
        if (Number(evRoomId) !== roomIdNum) return;
        const winner = playersRef.current.find(
          pl => pl.addr.toLowerCase() === predictedWinner.toLowerCase()
        );
        setEvents(prev => [{
          id: Date.now(), timestamp: nowStr(),
          playerEns:    shortenAddr(bettor),
          playerAvatar: addrToAvatar(bettor),
          type: "bet" as const,
          diceResult: `Bet on ${winner?.ens ?? shortenAddr(predictedWinner)} · ${(Number(amount) / 1e18).toFixed(4)} ETH`,
        }, ...prev].slice(0, 30));
        // Refresh odds after new bet
        fetchMarketData(playersRef.current.map(p => p.addr));
      };

      pmContract.on("BetPlaced", onBetPlaced);
    }

    return () => {
      fishingGame.removeAllListeners();
      pmContract?.removeAllListeners();
    };
  }, [isContractReady, roomId, getRpcReadContract, fetchRoomAndPlayers, fetchMarketData, marketReady]);

  // Mock event feed (only active before chain data arrives; stops automatically when dataSource==="chain")
  useEffect(() => {
    if (gameOver || dataSource === "chain") return;
    const id = setInterval(() => {
      setEvents(prev => [{
        id: Date.now(),
        timestamp: nowStr(),
        playerEns: "moon.eth",
        playerAvatar: "🐳",
        type: "caught" as const,
        rarity: "Rare" as const,
        weight: 2800,
        score: 1050,
      }, ...prev].slice(0, 20));
    }, 8000);
    return () => clearInterval(id);
  }, [gameOver, dataSource]);

  // Sorted ranking
  const ranked = [...players].sort((a, b) => b.score - a.score);

  // Convenience lookups backed by chain state (fall back to 0)
  const getPlayerOdds   = (addr: string) => oddsMap[addr.toLowerCase()]   ?? 0;
  const getPlayerBetEth = (addr: string) => betEthMap[addr.toLowerCase()] ?? 0;

  const handlePlaceBet = useCallback(async () => {
    setBetError("");

    // ── Input validation ───────────────────────────────────────────────────
    if (selectedIdx === null) { setBetError("Please select a player to bet on"); return; }
    const amt = parseFloat(betAmount);
    if (isNaN(amt) || amt < 0.001) { setBetError("Minimum bet is 0.001 ETH"); return; }
    if (elapsed >= 180)            { setBetError("Game is over, cannot place bet"); return; }

    const playerAddr = players[selectedIdx]?.addr;
    if (!playerAddr) { setBetError("Invalid player address"); return; }

    // ── Dev/demo mode: no contract deployed ───────────────────────────────
    if (!marketReady) {
      setHasBet(true);
      setUserBetIdx(selectedIdx);
      return;
    }

    // ── Wallet check ──────────────────────────────────────────────────────
    if (!wallet.signer) {
      setBetError("Please connect your MetaMask wallet first");
      return;
    }

    // ── Contract call ─────────────────────────────────────────────────────
    setTxPending(true);
    try {
      const market = new ethers.Contract(
        PREDICTION_MARKET_ADDRESS,
        PREDICTION_MARKET_ABI,
        wallet.signer,
      );
      const tx = await market.placeBet(Number(roomId), playerAddr, {
        value: ethers.parseEther(betAmount),
      });
      await tx.wait();

      setHasBet(true);
      setUserBetIdx(selectedIdx);
      // Refresh odds immediately after bet lands
      fetchMarketData(players.map(p => p.addr));
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; reason?: string; message?: string };
      setBetError(err.shortMessage ?? err.reason ?? err.message ?? "Bet failed, please try again");
    } finally {
      setTxPending(false);
    }
  }, [selectedIdx, betAmount, elapsed, players, marketReady, wallet.signer, roomId, fetchMarketData]);

  const tierColors: Record<string, string> = {
    Bronze: "#C8956C", Silver: "#A8B8C8", Gold: "#E8C547", Diamond: "#B39DDB",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <Navbar />

      {/* ── Room Header ── */}
      <div style={{
        background: "white",
        borderBottom: "2px solid var(--cream-dark)",
        padding: "16px 24px",
      }}>
        <div style={{
          maxWidth: "1400px", margin: "0 auto",
          display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
        }}>
          {/* Back */}
          <button onClick={() => router.push("/")} style={{
            background: "var(--cream)", border: "none",
            borderRadius: "12px", padding: "8px 14px",
            fontSize: "13px", fontWeight: 700, color: "var(--brown)",
            cursor: "pointer",
          }}>
            ← Back to Lobby
          </button>

          {/* Room name */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 900, fontSize: "18px", color: "var(--brown)" }}>
              Room #{roomId}
            </span>
            <span style={{
              background: tierColors[roomTierLabel] ?? tierColors["Silver"], color: "white",
              borderRadius: "8px", padding: "2px 10px",
              fontSize: "11px", fontWeight: 800,
            }}>{roomTierLabel}</span>
            {dataSource === "chain" && (
              <span style={{
                background: "#4CAF50", color: "white",
                borderRadius: "8px", padding: "2px 8px",
                fontSize: "10px", fontWeight: 700,
              }}>⛓ On-chain</span>
            )}
            {roomStatus === 1 && (
              <span style={{
                background: "#FF4444", color: "white",
                borderRadius: "8px", padding: "2px 10px",
                fontSize: "11px", fontWeight: 800,
              }}>● LIVE</span>
            )}
            {roomStatus === 2 && (
              <span style={{
                background: "#757575", color: "white",
                borderRadius: "8px", padding: "2px 10px",
                fontSize: "11px", fontWeight: 800,
              }}>🏁 Finished</span>
            )}
            {roomStatus === 0 && (
              <span style={{
                background: "#FFA726", color: "white",
                borderRadius: "8px", padding: "2px 10px",
                fontSize: "11px", fontWeight: 800,
              }}>⏳ Waiting</span>
            )}
          </div>

          {/* Timer */}
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: "20px",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontWeight: 900, fontSize: "24px",
                color: timeRemaining < 30 ? "#FF4444" : "var(--brown)",
                fontFamily: "monospace",
                transition: "color 0.3s",
              }}>
                {timerStr}
              </div>
              <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                Time Left
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: "20px", color: "var(--coral)" }}>
                {roomTotalPot.toFixed(3)} ETH
              </div>
              <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                Prize Pool
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: "20px", color: "#9C27B0" }}>
                {marketTotalPool.toFixed(4)} ETH
              </div>
              <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                {marketBettingOpen ? "Spectator Bet Pool 🔴" : "Spectator Bet Pool"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{
        maxWidth: "1400px", margin: "0 auto", padding: "24px",
        display: "flex",
        gap: "20px",
        alignItems: "stretch",
      }}>

        {/* ── Left: Player Cards ── */}
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--brown)", marginBottom: "14px" }}>
            🏆 Live Rankings
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {ranked.map((p, i) => (
              <PlayerCard
                key={p.idx}
                player={p}
                rank={p.score > 0 ? i + 1 : null}
                isSelected={selectedIdx === p.idx}
                onSelect={() => !hasBet && setSelectedIdx(p.idx)}
                userBetIdx={userBetIdx}
                odds={getPlayerOdds(p.addr)}
                betEth={getPlayerBetEth(p.addr)}
              />
            ))}
          </div>
        </div>

        {/* ── Middle: Event Feed ── */}
        <div className="card" style={{ width: "320px", flexShrink: 0, padding: "20px", display: "flex", flexDirection: "column" }}>
          <div style={{
            fontWeight: 800, fontSize: "15px",
            color: "var(--brown)", marginBottom: "14px",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            📡 Live Event Feed
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#FF4444", display: "inline-block",
              animation: "pulse-glow 2s ease-in-out infinite",
            }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {events.map(e => <EventItem key={e.id} event={e} />)}
          </div>
        </div>

        {/* ── Right: Bet Panel ── */}
        <div className="card" style={{ width: "280px", flexShrink: 0, padding: "20px" }}>
          {/* Inner sticky wrapper so content sticks while column stretches to full height */}
          <div style={{ position: "sticky", top: "24px" }}>
          <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--brown)", marginBottom: "16px" }}>
            🎯 Place Your Bet
          </div>

          {hasBet ? (
            /* ── Already bet state ── */
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--brown)", marginBottom: "6px" }}>
                Bet Placed Successfully!
              </div>
              <div style={{ fontSize: "13px", color: "var(--brown-light)", marginBottom: "16px" }}>
                Bet on {players[userBetIdx!].ens}
              </div>
              <div style={{
                background: "var(--cream)", borderRadius: "14px", padding: "14px",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "Bet Amount", value: `${betAmount} ETH` },
                    { label: "Time Weight", value: `×${timeWeight / 100}` },
                    { label: "Weighted Bet", value: `${(parseFloat(betAmount) * timeWeight / 100).toFixed(4)} ETH` },
                    { label: "Current Odds", value: (() => {
                        const betPlayer = players[userBetIdx!];
                        const o = betPlayer ? getPlayerOdds(betPlayer.addr) : 0;
                        return `1 : ${(100 / Math.max(1, o)).toFixed(1)}`;
                      })() },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: "white", borderRadius: "10px", padding: "10px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: "10px", color: "var(--brown-light)", fontWeight: 600 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--brown)", marginTop: "2px" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: "14px", fontSize: "11px", color: "var(--brown-light)" }}>
                Winnings can be claimed after the game ends
              </div>
            </div>
          ) : (
            /* ── Betting form ── */
            <>
              {/* Time weight indicator */}
              <div style={{
                background: "var(--cream)", borderRadius: "14px", padding: "12px 14px",
                marginBottom: "16px",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  marginBottom: "6px",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown-light)" }}>
                    ⏱ Time Weight
                  </span>
                  <span style={{
                    fontSize: "14px", fontWeight: 900,
                    color: timeWeight >= 70 ? "var(--mint-dark)"
                         : timeWeight >= 40 ? "var(--gold)"
                         : "var(--coral)",
                  }}>
                    {timeWeight}
                  </span>
                </div>
                <div style={{
                  height: "8px", borderRadius: "4px",
                  background: "var(--cream-dark)", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${timeWeight}%`,
                    borderRadius: "4px",
                    background: timeWeight >= 70
                      ? "var(--mint-dark)"
                      : timeWeight >= 40 ? "var(--gold)" : "var(--coral)",
                    transition: "width 1s ease, background 1s ease",
                  }} />
                </div>
                <div style={{ fontSize: "10px", color: "var(--brown-light)", marginTop: "4px" }}>
                  Earlier bets get higher weight (max 100, min 10)
                </div>
              </div>

              {/* Player select */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown)", marginBottom: "8px" }}>
                  Pick the player you back
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {players.map(p => (
                    <button
                      key={p.idx}
                      onClick={() => setSelectedIdx(p.idx)}
                      style={{
                        background: selectedIdx === p.idx
                          ? "linear-gradient(135deg, #FFF0EE, #FFE4E0)"
                          : "var(--cream)",
                        border: selectedIdx === p.idx
                          ? "2px solid var(--coral)"
                          : "2px solid transparent",
                        borderRadius: "12px", padding: "10px 12px",
                        cursor: "pointer", transition: "all 0.15s ease",
                        display: "flex", alignItems: "center", gap: "10px",
                        width: "100%", textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>{p.avatar}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 800, fontSize: "13px", color: "var(--brown)",
                        }}>
                          {p.ens}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--brown-light)" }}>
                          {fmtScore(p.score)} pts · {getPlayerOdds(p.addr).toFixed(1)}% bet
                        </div>
                      </div>
                      {selectedIdx === p.idx && (
                        <span style={{ color: "var(--coral)", fontWeight: 900 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount input */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--brown)", marginBottom: "8px" }}>
                  Bet Amount (ETH)
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={e => setBetAmount(e.target.value)}
                    placeholder="0.001"
                    min="0.001"
                    step="0.001"
                    style={{
                      width: "100%", padding: "12px 50px 12px 16px",
                      border: "2px solid var(--cream-dark)",
                      borderRadius: "12px", fontSize: "15px",
                      fontWeight: 700, fontFamily: "var(--font-main)",
                      background: "white", color: "var(--brown)",
                      outline: "none",
                    }}
                  />
                  <span style={{
                    position: "absolute", right: "14px", top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "12px", fontWeight: 800, color: "var(--brown-light)",
                  }}>
                    ETH
                  </span>
                </div>

                {/* Quick amounts */}
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  {["0.01", "0.05", "0.1"].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount(amt)}
                      style={{
                        flex: 1, background: "var(--cream)",
                        border: "2px solid var(--cream-dark)",
                        borderRadius: "8px", padding: "6px",
                        fontSize: "11px", fontWeight: 700,
                        color: "var(--brown)", cursor: "pointer",
                      }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {/* Preview */}
                {betAmount && !isNaN(parseFloat(betAmount)) && (
                  <div style={{
                    marginTop: "8px", background: "var(--cream)",
                    borderRadius: "10px", padding: "8px 12px",
                    fontSize: "11px", color: "var(--brown-light)",
                  }}>
                    Weighted bet: <strong style={{ color: "var(--brown)" }}>
                      {(parseFloat(betAmount) * timeWeight / 100).toFixed(4)} ETH
                    </strong>
                    (amount x weight {timeWeight})
                  </div>
                )}
              </div>

              {betError && (
                <div style={{
                  background: "#FFF0EE", borderRadius: "10px", padding: "10px 12px",
                  fontSize: "12px", color: "var(--coral-dark)", fontWeight: 700,
                  marginBottom: "12px",
                }}>
                  ⚠️ {betError}
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handlePlaceBet}
                disabled={txPending}
                style={{
                  width: "100%", height: "48px", borderRadius: "14px",
                  opacity: txPending ? 0.65 : 1,
                  cursor: txPending ? "wait" : "pointer",
                }}
              >
                {txPending ? "⏳ Confirming tx..." : "🎯 Confirm Bet"}
              </button>

              <div style={{
                marginTop: "10px", fontSize: "10px",
                color: "var(--brown-light)", textAlign: "center", lineHeight: 1.5,
              }}>
                5% platform fee · Winners split the pool proportionally by weighted bets
              </div>
            </>
          )}
          </div>{/* end sticky wrapper */}
        </div>
      </div>
    </div>
  );
}
