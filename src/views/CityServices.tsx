import React, { useEffect, useMemo, useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button, Panel } from "../components/ui";
import { ITEMS } from "../data/gameData";
import { formatTime, money, timeLeft } from "../core/gameCore";

type Game = ReturnType<typeof useRiftCity>;

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function BackToCity({ g }: { g: Game }) {
  return <Button onClick={() => g.setCurrentScreen("city")}>← Back to City Map</Button>;
}

export function Bank({ g }: { g: Game }) {
  const [amount, setAmount] = useState("100");
  const n = Math.max(0, Number(amount) || 0);
  return (
    <div className="ui-grid two-col city-service-page">
      <Panel title="RiftCity Bank">
        <div className="service-hero"><span>🏦</span><div><h2>{money(g.gameState.bank)}</h2><p>Protected balance</p></div></div>
        <div className="input-group">
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="btn-group">
            <Button disabled={n <= 0} onClick={() => g.bankDeposit(n)}>Deposit</Button>
            <Button disabled={n <= 0} onClick={() => g.bankWithdraw(n)}>Withdraw</Button>
          </div>
        </div>
      </Panel>
      <Panel title="Account Summary">
        <div className="data-list">
          <div className="data-row"><span>Cash on hand</span><b>{money(g.gameState.cash)}</b></div>
          <div className="data-row"><span>Bank balance</span><b>{money(g.gameState.bank)}</b></div>
          <div className="data-row"><span>Interest earned</span><b>{money(g.gameState.bankInterest)}</b></div>
        </div>
        <BackToCity g={g} />
      </Panel>
    </div>
  );
}

export function Jail({ g }: { g: Game }) {
  const now = useNow();
  const active = Boolean(g.gameState.jailUntil && g.gameState.jailUntil > now);
  const remaining = active && g.gameState.jailUntil ? formatTime(timeLeft(g.gameState.jailUntil)) : "Released";
  const sentence = g.gameState.jailSentenceMs ? formatTime(g.gameState.jailSentenceMs) : "Unknown";
  return (
    <div className="city-service-page">
      <Panel title="RiftCity Jail — Detention Roster">
        <div className={`custody-banner ${active ? "active" : "clear"}`}><span>🔒</span><div><b>{active ? "IN CUSTODY" : "NO ACTIVE DETENTION"}</b><small>{active ? `${remaining} remaining` : "You are currently free to leave."}</small></div></div>
        <div className="custody-table-wrap">
          <table className="custody-table"><thead><tr><th>Player</th><th>Status</th><th>Offense</th><th>Sentence</th><th>Remaining</th></tr></thead>
            <tbody>{active ? <tr><td>You</td><td>Detained</td><td>{g.gameState.jailReason || "Unknown offense"}</td><td>{sentence}</td><td>{remaining}</td></tr> : <tr><td colSpan={5}>No active detainees.</td></tr>}</tbody>
          </table>
        </div>
        <div className="data-list">
          <div className="data-row"><span>Times jailed</span><b>{g.gameState.timesJailed}</b></div>
          <div className="data-row"><span>Current Heat</span><b>{g.gameState.heat} / 100</b></div>
        </div>
        <BackToCity g={g} />
      </Panel>
    </div>
  );
}

export function Hospital({ g }: { g: Game }) {
  const now = useNow();
  const active = Boolean(g.gameState.hospitalUntil && g.gameState.hospitalUntil > now);
  const remaining = active && g.gameState.hospitalUntil ? formatTime(timeLeft(g.gameState.hospitalUntil)) : "Discharged";
  const duration = g.gameState.hospitalDurationMs ? formatTime(g.gameState.hospitalDurationMs) : "Unknown";
  const treatmentCost = 250;
  const canTreat = !active && !g.gameState.jailUntil && g.gameState.health < g.maxHealth && g.gameState.cash >= treatmentCost;
  const treat = () => g.setGameState((prev) => {
    if (prev.cash < treatmentCost || prev.health >= g.maxHealth) return prev;
    const next = { ...prev, cash: prev.cash - treatmentCost, health: g.maxHealth, lastHealthUpdate: Date.now() };
    return g.appendActivity(next, `Hospital treatment restored your health for ${money(treatmentCost)}.`, "success");
  });
  return (
    <div className="city-service-page">
      <Panel title="RiftCity Hospital — Patient Board">
        <div className={`custody-banner hospital ${active ? "active" : "clear"}`}><span>🏥</span><div><b>{active ? "ADMITTED" : "NO ACTIVE ADMISSION"}</b><small>{active ? `${remaining} remaining` : "Walk-in treatment is available."}</small></div></div>
        <div className="custody-table-wrap"><table className="custody-table"><thead><tr><th>Patient</th><th>Status</th><th>Reason</th><th>Stay</th><th>Remaining</th></tr></thead>
          <tbody>{active ? <tr><td>You</td><td>Hospitalized</td><td>{g.gameState.hospitalReason || "Emergency admission"}</td><td>{duration}</td><td>{remaining}</td></tr> : <tr><td colSpan={5}>No active patients.</td></tr>}</tbody></table></div>
        <div className="data-list"><div className="data-row"><span>Health</span><b>{Math.floor(g.gameState.health)} / {g.maxHealth}</b></div><div className="data-row"><span>Walk-in treatment</span><b>{money(treatmentCost)}</b></div></div>
        <div className="btn-group"><Button disabled={!canTreat} onClick={treat}>Full Treatment</Button><BackToCity g={g} /></div>
      </Panel>
    </div>
  );
}

export function Police({ g }: { g: Game }) {
  return <div className="ui-grid two-col city-service-page"><Panel title="RiftCity Police Department"><div className="service-hero"><span>🚔</span><div><h2>Heat {g.gameState.heat}/100</h2><p>{g.gameState.heat >= 75 ? "High priority" : g.gameState.heat >= 40 ? "Wanted" : g.gameState.heat > 0 ? "Known to police" : "No active attention"}</p></div></div><Button disabled={g.gameState.heat <= 0 || g.gameState.energy < 5} onClick={g.coolHeat}>Lay Low / Clear Attention (5 ⚡)</Button></Panel><Panel title="Custody Record"><div className="data-list"><div className="data-row"><span>Times jailed</span><b>{g.gameState.timesJailed}</b></div><div className="data-row"><span>Failed crimes</span><b>{g.gameState.crimesFailed}</b></div><div className="data-row"><span>Guard reputation</span><b>{g.gameState.npcReputation.torres ?? 0}</b></div></div><BackToCity g={g} /></Panel></div>;
}

function ItemShop({ g, ids, title, icon }: { g: Game; ids: string[]; title: string; icon: string }) {
  const items = useMemo(() => ITEMS.filter((item) => ids.includes(item.id)), [ids]);
  return <div className="city-service-page"><Panel title={title}><div className="service-hero"><span>{icon}</span><div><h2>{title}</h2><p>Cash: {money(g.gameState.cash)}</p></div></div><div className="service-item-grid">{items.map((item) => <div className="service-item" key={item.id}><div><b>{item.name}</b><small>{item.description}</small></div><div><b>{money(item.price)}</b><Button disabled={g.gameState.cash < item.price} onClick={() => g.buyItem(item.id)}>Buy</Button></div></div>)}</div><BackToCity g={g} /></Panel></div>;
}

export function Pharmacy({ g }: { g: Game }) { return <ItemShop g={g} ids={["medkit", "energy-drink", "nerve-tonic"]} title="RiftCare Pharmacy" icon="💊" />; }
export function BlackMarket({ g }: { g: Game }) {
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("500");
  const [quantity, setQuantity] = useState("1");
  const [query, setQuery] = useState("");

  const ownListable = ITEMS.filter((item) => (g.gameState.inventory[item.id] || 0) > 0);
  const listings = [...g.gameState.auctionListings, ...g.seededAuctionListings.filter((listing) => !g.gameState.auctionRemovedListingIds.includes(listing.id))]
    .filter((listing) => {
      const item = ITEMS.find((x) => x.id === listing.itemId);
      const q = query.trim().toLowerCase();
      return !q || item?.name.toLowerCase().includes(q) || listing.seller.toLowerCase().includes(q);
    })
    .sort((a,b) => a.price - b.price);

  const selectedOwned = itemId ? (g.gameState.inventory[itemId] || 0) : 0;
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const unitPrice = Math.max(1, Math.floor(Number(price) || 1));

  return (
    <div className="city-service-page black-market-v2">
      <Panel title="Black Market Exchange">
        <div className="service-hero">
          <span>🕶️</span>
          <div>
            <h2>Player Listings</h2>
            <p>Underground items are traded by players, not sold by a duplicate NPC weapon shop.</p>
          </div>
        </div>

        <div className="black-market-toolbar">
          <label>
            <span>Search listings</span>
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Item or seller" />
          </label>
          <div className="black-market-balance"><span>Cash</span><strong>{money(g.gameState.cash)}</strong></div>
        </div>

        <div className="auction-listings">
          {listings.map((listing) => {
            const item = ITEMS.find((x) => x.id === listing.itemId);
            if (!item) return null;
            const mine = listing.seller === "You";
            const total = listing.price * listing.quantity;
            return (
              <article className="auction-listing" key={listing.id}>
                <div className="auction-item-copy">
                  <span className={`rarity-pill ${(item.rarity || "Common").toLowerCase()}`}>{item.rarity || "Common"}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <small>Seller: <b>{listing.seller}</b> · Qty {listing.quantity}{item.contraband ? " · CONTRABAND" : ""}</small>
                </div>
                <div className="auction-listing-action">
                  <strong>{money(listing.price)} ea.</strong>
                  <small>{money(total)} total</small>
                  {mine ? (
                    <Button onClick={() => g.cancelAuctionListing(listing.id)}>Cancel Listing</Button>
                  ) : (
                    <Button disabled={g.gameState.cash < total} onClick={() => g.buyAuctionListing(listing.id)}>
                      {g.gameState.cash < total ? "Not Enough Cash" : "Buy Listing"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="List an Item">
        <p>Listings are stored locally for now, but this UI is structured so the seller and listing data can later come from the multiplayer server.</p>
        <div className="auction-create-grid">
          <label><span>Item</span><select value={itemId} onChange={(e)=>setItemId(e.target.value)}><option value="">Choose an item</option>{ownListable.map((item)=><option key={item.id} value={item.id}>{item.name} ({g.gameState.inventory[item.id]})</option>)}</select></label>
          <label><span>Quantity</span><input type="number" min="1" max={Math.max(1,selectedOwned)} value={quantity} onChange={(e)=>setQuantity(e.target.value)} /></label>
          <label><span>Price each</span><input type="number" min="1" value={price} onChange={(e)=>setPrice(e.target.value)} /></label>
        </div>
        <div className="data-list">
          <div className="data-row"><span>Owned</span><b>{selectedOwned}</b></div>
          <div className="data-row"><span>Listing total</span><b>{money(unitPrice * qty)}</b></div>
          <div className="data-row"><span>Listing fee</span><b>{money(Math.max(25,Math.floor(unitPrice*qty*.03)))}</b></div>
        </div>
        <div className="btn-group">
          <Button disabled={!itemId || selectedOwned < qty} onClick={() => g.createAuctionListing(itemId, unitPrice, qty)}>Create Listing</Button>
          <BackToCity g={g} />
        </div>
      </Panel>
    </div>
  );
}

export function Park({ g }: { g: Game }) {
  const rest = () => g.setGameState((prev) => {
    if (prev.energy < 2) return g.appendActivity(prev, "You need 2 energy to spend time in the park.", "failure");
    const next = { ...prev, energy: prev.energy - 2, happiness: prev.happiness + 5, heat: Math.max(0, prev.heat - 2) };
    return g.appendActivity(next, "A quiet walk through Central Park improved your mood and cooled some attention.", "system");
  });
  return <div className="city-service-page"><Panel title="Central Park"><div className="service-hero"><span>🌳</span><div><h2>Central Park</h2><p>A calm pocket in the middle of RiftCity.</p></div></div><div className="data-list"><div className="data-row"><span>Happiness</span><b>{Math.floor(g.gameState.happiness)}</b></div><div className="data-row"><span>Heat</span><b>{g.gameState.heat}</b></div></div><div className="btn-group"><Button disabled={g.gameState.energy < 2} onClick={rest}>Take a Walk (2 ⚡)</Button><BackToCity g={g} /></div></Panel></div>;
}

export function Downtown({ g }: { g: Game }) {
  const links: Array<[string, string]> = [["shops", "🛒 Shops"], ["jobs", "💼 Employment"], ["market", "📈 Market"], ["bank", "🏦 Bank"], ["missions", "🎯 Missions"]];
  return <div className="city-service-page"><Panel title="Downtown RiftCity"><div className="service-hero"><span>📍</span><div><h2>Downtown</h2><p>The city's busiest hub. Jump directly to nearby services.</p></div></div><div className="service-link-grid">{links.map(([screen, label]) => <div key={screen}><Button onClick={() => g.setCurrentScreen(screen as any)}>{label}</Button></div>)}</div><BackToCity g={g} /></Panel></div>;
}

type CasinoGameId = "blackjack" | "poker" | "wheel" | "racing" | "reels";
type CasinoCard = { rank: string; suit: string; value: number };

const CASINO_DAILY_LIMIT = 50;
const CASINO_WINDOW_MS = 24 * 60 * 60 * 1000;
const CASINO_SESSION_LIMIT = 15;
const CASINO_COOLDOWN_MS = 10 * 60 * 1000;
const CASINO_NPCS = ["Maya Vale", "Vince Romano", "Juno Park", "Theo Knox", "Aria Stone", "Malik Reed"];

function casinoCard(): CasinoCard {
  const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const suits = ["♠","♥","♦","♣"];
  const rank = ranks[Math.floor(Math.random()*ranks.length)];
  const value = rank === "A" ? 11 : ["J","Q","K"].includes(rank) ? 10 : Number(rank);
  return { rank, suit: suits[Math.floor(Math.random()*suits.length)], value };
}

function blackjackValue(cards: CasinoCard[]) {
  let total = cards.reduce((sum, card) => sum + card.value, 0);
  let aces = cards.filter((card) => card.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

function pokerScore(cards: CasinoCard[]) {
  const counts = Object.values(cards.reduce<Record<string,number>>((acc,c)=>{ acc[c.rank]=(acc[c.rank]||0)+1; return acc; },{})).sort((a,b)=>b-a);
  const flush = cards.every((c)=>c.suit===cards[0].suit);
  const order = cards.map(c=>["2","3","4","5","6","7","8","9","10","J","Q","K","A"].indexOf(c.rank)).sort((a,b)=>a-b);
  const straight = order.every((v,i)=>i===0 || v===order[i-1]+1);
  if (straight && flush) return { rank: 8, name: "Straight Flush" };
  if (counts[0]===4) return { rank: 7, name: "Four of a Kind" };
  if (counts[0]===3 && counts[1]===2) return { rank: 6, name: "Full House" };
  if (flush) return { rank: 5, name: "Flush" };
  if (straight) return { rank: 4, name: "Straight" };
  if (counts[0]===3) return { rank: 3, name: "Three of a Kind" };
  if (counts[0]===2 && counts[1]===2) return { rank: 2, name: "Two Pair" };
  if (counts[0]===2) return { rank: 1, name: "Pair" };
  return { rank: 0, name: "High Card" };
}

function CasinoCardView({ card }: { card: CasinoCard }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return <span className={`casino-playing-card ${red ? "red" : ""}`}><b>{card.rank}</b><em>{card.suit}</em></span>;
}

export function Casino({ g }: { g: Game }) {
  const now = useNow();
  const [game, setGame] = useState<CasinoGameId | null>(null);
  const [message, setMessage] = useState("Choose a room on the casino floor.");
  const [playerHand, setPlayerHand] = useState<CasinoCard[]>([]);
  const [dealerHand, setDealerHand] = useState<CasinoCard[]>([]);
  const [blackjackDone, setBlackjackDone] = useState(true);
  const [pokerHands, setPokerHands] = useState<Array<{name:string;cards:CasinoCard[];score:{rank:number;name:string}}>>([]);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [racePick, setRacePick] = useState(0);
  const [raceResult, setRaceResult] = useState<string | null>(null);
  const [reels, setReels] = useState(["◆","★","7"]);

  const windowExpired = !g.gameState.casinoWindowStartedAt || now - g.gameState.casinoWindowStartedAt >= CASINO_WINDOW_MS;
  const used = windowExpired ? 0 : g.gameState.casinoActionsUsed;
  const remaining = Math.max(0, CASINO_DAILY_LIMIT - used);
  const resetAt = windowExpired ? null : g.gameState.casinoWindowStartedAt + CASINO_WINDOW_MS;
  const cooldownActive = Boolean(g.gameState.casinoCooldownUntil && g.gameState.casinoCooldownUntil > now);
  const cooldownRemaining = cooldownActive && g.gameState.casinoCooldownUntil ? formatTime(timeLeft(g.gameState.casinoCooldownUntil)) : null;
  const rank = g.gameState.casinoReputation >= 120 ? "Rift Elite" : g.gameState.casinoReputation >= 60 ? "VIP" : g.gameState.casinoReputation >= 25 ? "Regular" : "Visitor";

  useEffect(() => {
    if (windowExpired && g.gameState.casinoWindowStartedAt) {
      g.setGameState((prev) => ({ ...prev, casinoActionsUsed: 0, casinoWindowStartedAt: 0, casinoSessionActions: 0, casinoCooldownUntil: null }));
    } else if (g.gameState.casinoCooldownUntil && g.gameState.casinoCooldownUntil <= now && g.gameState.casinoSessionActions !== 0) {
      g.setGameState((prev) => ({ ...prev, casinoCooldownUntil: null, casinoSessionActions: 0 }));
    }
  }, [windowExpired, now, g.gameState.casinoWindowStartedAt, g.gameState.casinoCooldownUntil, g.gameState.casinoSessionActions]);

  const recordGame = (label: string, outcome: "win" | "loss" | "draw", rep = 1) => {
    if (remaining <= 0 || cooldownActive) return false;
    g.setGameState((prev) => {
      const t = Date.now();
      const expired = !prev.casinoWindowStartedAt || t - prev.casinoWindowStartedAt >= CASINO_WINDOW_MS;
      const actionsUsed = expired ? 0 : prev.casinoActionsUsed;
      if (actionsUsed >= CASINO_DAILY_LIMIT) return prev;
      const sessionActions = (prev.casinoCooldownUntil && prev.casinoCooldownUntil > t) ? prev.casinoSessionActions : prev.casinoSessionActions + 1;
      const win = outcome === "win";
      const streak = win ? prev.casinoCurrentStreak + 1 : 0;
      const hitCooldown = sessionActions >= CASINO_SESSION_LIMIT;
      const next = {
        ...prev,
        casinoWindowStartedAt: expired ? t : prev.casinoWindowStartedAt,
        casinoActionsUsed: actionsUsed + 1,
        casinoSessionActions: hitCooldown ? 0 : sessionActions,
        casinoCooldownUntil: hitCooldown ? t + CASINO_COOLDOWN_MS : prev.casinoCooldownUntil,
        casinoReputation: prev.casinoReputation + Math.max(1, rep + (win ? 1 : 0)),
        casinoGamesPlayed: prev.casinoGamesPlayed + 1,
        casinoWins: prev.casinoWins + (win ? 1 : 0),
        casinoCurrentStreak: streak,
        casinoBestStreak: Math.max(prev.casinoBestStreak, streak),
      };
      return g.appendActivity(next, `Casino: ${label} — ${outcome}.`, win ? "success" : "system");
    });
    return true;
  };

  const canPlay = remaining > 0 && !cooldownActive;

  const startBlackjack = () => {
    if (!canPlay || !recordGame("Blackjack Hall", "draw", 1)) return;
    setPlayerHand([casinoCard(), casinoCard()]);
    setDealerHand([casinoCard(), casinoCard()]);
    setBlackjackDone(false);
    setMessage("Blackjack practice table started. Hit or stand.");
  };
  const hitBlackjack = () => {
    if (blackjackDone) return;
    const next = [...playerHand, casinoCard()];
    setPlayerHand(next);
    if (blackjackValue(next) > 21) { setBlackjackDone(true); setMessage("Bust — dealer takes the round."); }
  };
  const standBlackjack = () => {
    if (blackjackDone) return;
    const nextDealer = [...dealerHand];
    while (blackjackValue(nextDealer) < 17) nextDealer.push(casinoCard());
    setDealerHand(nextDealer);
    const p = blackjackValue(playerHand), d = blackjackValue(nextDealer);
    setBlackjackDone(true);
    if (d > 21 || p > d) { setMessage("You win the table round — reputation up."); g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+2,casinoWins:prev.casinoWins+1,casinoCurrentStreak:prev.casinoCurrentStreak+1,casinoBestStreak:Math.max(prev.casinoBestStreak,prev.casinoCurrentStreak+1)})); }
    else if (p === d) setMessage("Push — even round.");
    else { setMessage("Dealer wins this round."); g.setGameState((prev)=>({...prev,casinoCurrentStreak:0})); }
  };

  const dealPoker = () => {
    if (!canPlay || !recordGame("Poker Room", "draw", 1)) return;
    const names = ["You", ...CASINO_NPCS.slice(0,4)];
    const hands = names.map((name)=>{ const cards=[casinoCard(),casinoCard(),casinoCard(),casinoCard(),casinoCard()]; return {name,cards,score:pokerScore(cards)}; });
    const best = Math.max(...hands.map(h=>h.score.rank));
    const winners = hands.filter(h=>h.score.rank===best);
    setPokerHands(hands);
    if (winners.some(w=>w.name==="You")) { setMessage(`Showdown win — ${hands[0].score.name}.`); g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+3,casinoWins:prev.casinoWins+1})); }
    else setMessage(`${winners[0].name} takes the showdown with ${winners[0].score.name}.`);
  };

  const spinWheel = () => {
    if (!canPlay || !recordGame("Rift Wheel", "draw", 1)) return;
    const segments = ["RIFT STAR +3 REP","BLUE SECTOR +1 REP","GOLD SECTOR +2 REP","NEUTRAL","DOUBLE STAR +4 REP","NEUTRAL"];
    const result = segments[Math.floor(Math.random()*segments.length)];
    setWheelResult(result);
    const bonus = result.includes("+4")?4:result.includes("+3")?3:result.includes("+2")?2:result.includes("+1")?1:0;
    if (bonus) g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+bonus,casinoWins:prev.casinoWins+1}));
    setMessage(`Wheel result: ${result}.`);
  };

  const runRace = () => {
    if (!canPlay || !recordGame("Rift Downs", "draw", 1)) return;
    const horses = ["Night Signal","Blue Comet","Iron Echo","Velvet Rift","Northline"];
    const winner = Math.floor(Math.random()*horses.length);
    setRaceResult(`${horses[winner]} wins the race${winner===racePick ? " — your prediction was right!" : "."}`);
    if (winner===racePick) g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+4,casinoWins:prev.casinoWins+1}));
  };

  const spinReels = () => {
    if (!canPlay || !recordGame("Neon Reels", "draw", 1)) return;
    const symbols=["◆","★","7","R","♛"];
    const next=[0,1,2].map(()=>symbols[Math.floor(Math.random()*symbols.length)]);
    setReels(next);
    const match = next[0]===next[1]&&next[1]===next[2];
    if (match) g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+5,casinoWins:prev.casinoWins+1}));
    setMessage(match ? "Triple match — big reputation bonus!" : "Reels stopped. Try another floor activity later.");
  };

  return (
    <div className="city-service-page casino-v3">
      <section className="casino-hero">
        <div className="casino-hero-glow" />
        <div className="casino-brand"><span>✦</span><div><small>RIFTCITY ENTERTAINMENT DISTRICT</small><h2>THE RIFT CASINO</h2><p>Live tables, NPC regulars, tournaments, racing, and arcade-style casino games.</p></div></div>
        <div className="casino-metrics">
          <div><span>Daily Plays</span><strong>{remaining}/{CASINO_DAILY_LIMIT}</strong><small>{resetAt ? `Resets in ${formatTime(Math.max(0,resetAt-now))}` : "24h window starts on first play"}</small></div>
          <div><span>Casino Rank</span><strong>{rank}</strong><small>{g.gameState.casinoReputation} reputation</small></div>
          <div><span>Record</span><strong>{g.gameState.casinoWins}/{g.gameState.casinoGamesPlayed}</strong><small>Best streak {g.gameState.casinoBestStreak}</small></div>
        </div>
        <div className="casino-limit-note">Play is capped at {CASINO_DAILY_LIMIT} actions per 24 hours. After {CASINO_SESSION_LIMIT} consecutive actions, the floor enforces a {CASINO_COOLDOWN_MS/60000}-minute break. There is no purchasable, tradable, or cash-out casino currency.</div>
        {cooldownActive && <div className="casino-cooldown">☕ Floor break active · {cooldownRemaining} remaining. You can still browse and spectate.</div>}
      </section>

      <div className="casino-floor-grid">
        {[
          ["blackjack","🂡","Blackjack Hall","Dealer Elena · 4/5 seats","Playable table"],
          ["poker","♠","Poker Room","5-seat table · NPCs fill empty seats","Playable showdown"],
          ["wheel","◉","Rift Wheel","Arcade wheel · reputation prizes","Playable"],
          ["racing","🏇","Rift Downs","Scheduled-style race simulator","Playable prediction"],
          ["reels","🎰","Neon Reels","Arcade reels · no wagering","Playable"],
        ].map(([id,icon,title,sub,status])=>(
          <button key={id} type="button" className="casino-room" onClick={()=>setGame(id as CasinoGameId)}>
            <span className="casino-room-icon">{icon}</span><div><small>{status}</small><h3>{title}</h3><p>{sub}</p></div><b>ENTER →</b>
          </button>
        ))}
        <div className="casino-room locked"><span className="casino-room-icon">💎</span><div><small>Reputation 60</small><h3>VIP Lounge</h3><p>Special NPCs, social events, cosmetics, and future tournaments.</p></div><b>{g.gameState.casinoReputation>=60?"UNLOCKED":"LOCKED"}</b></div>
      </div>

      <div className="casino-table-strip">
        <div><span className="live-dot"/> TABLE 04 <b>4/5</b><small>You · Maya Vale · Vince Romano · Juno Park · Open Seat</small></div>
        <div><span className="live-dot"/> TABLE 09 <b>5/5</b><small>NPC-filled until multiplayer players sit down</small></div>
        <div><span className="live-dot"/> POKER 02 <b>3/5</b><small>2 open player seats · NPCs keep the room alive</small></div>
      </div>

      <div className="casino-footer-actions"><p>{message}</p><div className="btn-group"><Button onClick={g.randomEncounter}>Explore Casino Floor</Button><BackToCity g={g} /></div></div>

      {game && <div className="casino-game-backdrop" role="dialog" aria-modal="true" aria-label="Casino game">
        <div className="casino-game-modal">
          <button type="button" className="casino-game-close" onClick={()=>setGame(null)}>×</button>
          <div className="casino-game-heading"><span>{game==="blackjack"?"🂡":game==="poker"?"♠":game==="wheel"?"◉":game==="racing"?"🏇":"🎰"}</span><div><small>THE RIFT CASINO</small><h3>{game==="blackjack"?"Blackjack Hall":game==="poker"?"Poker Room":game==="wheel"?"Rift Wheel":game==="racing"?"Rift Downs":"Neon Reels"}</h3></div><b>{remaining} plays left</b></div>

          {game==="blackjack" && <div className="casino-table-game">
            <div className="casino-seat-row"><span className="casino-seat npc">MAYA<br/><small>NPC</small></span><span className="casino-seat npc">VINCE<br/><small>NPC</small></span><span className="casino-seat dealer">ELENA<br/><small>DEALER</small></span><span className="casino-seat npc">JUNO<br/><small>NPC</small></span></div>
            <div className="casino-hand"><label>Dealer · {dealerHand.length ? blackjackValue(dealerHand) : "—"}</label><div>{dealerHand.map((c,i)=><CasinoCardView key={i} card={c}/>)}</div></div>
            <div className="casino-hand player"><label>You · {playerHand.length ? blackjackValue(playerHand) : "—"}</label><div>{playerHand.map((c,i)=><CasinoCardView key={i} card={c}/>)}</div></div>
            <div className="btn-group"><Button disabled={!canPlay || !blackjackDone} onClick={startBlackjack}>Deal New Round</Button><Button disabled={blackjackDone} onClick={hitBlackjack}>Hit</Button><Button disabled={blackjackDone} onClick={standBlackjack}>Stand</Button></div>
          </div>}

          {game==="poker" && <div className="casino-poker-game"><div className="casino-poker-table">{(pokerHands.length?pokerHands:["You",...CASINO_NPCS.slice(0,4)].map(name=>({name,cards:[] as CasinoCard[],score:{rank:0,name:"Waiting"}}))).map((h,i)=><div className={`casino-poker-seat ${i===0?"you":""}`} key={h.name}><b>{h.name}</b><small>{i===0?"PLAYER":"NPC"} · {h.score.name}</small><div>{h.cards.map((c,j)=><CasinoCardView key={j} card={c}/>)}</div></div>)}</div><Button disabled={!canPlay} onClick={dealPoker}>Deal Showdown</Button></div>}

          {game==="wheel" && <div className="casino-wheel-game"><div className="rift-wheel"><span>R</span></div><strong>{wheelResult || "Ready to spin"}</strong><Button disabled={!canPlay} onClick={spinWheel}>Spin Arcade Wheel</Button></div>}

          {game==="racing" && <div className="casino-race-game"><div className="race-track">🏇  · · · · · · · · · ·  🏁</div><label>Choose your prediction<select value={racePick} onChange={(e)=>setRacePick(Number(e.target.value))}>{["Night Signal","Blue Comet","Iron Echo","Velvet Rift","Northline"].map((h,i)=><option value={i} key={h}>{h}</option>)}</select></label><strong>{raceResult || "Race board ready"}</strong><Button disabled={!canPlay} onClick={runRace}>Run Race</Button></div>}

          {game==="reels" && <div className="casino-reels-game"><div className="neon-reels">{reels.map((r,i)=><span key={i}>{r}</span>)}</div><Button disabled={!canPlay} onClick={spinReels}>Spin Reels</Button></div>}

          {!canPlay && <div className="casino-play-blocked">{remaining<=0 ? "Daily play limit reached. Browse, spectate, or return after your 24-hour reset." : `Session break active for ${cooldownRemaining}.`}</div>}
          <p className="casino-game-message">{message}</p>
        </div>
      </div>}
    </div>
  );
}

export function Airport({ g }: { g: Game }) {
  return <div className="city-service-page"><Panel title="RiftCity International Airport"><div className="service-hero"><span>✈️</span><div><h2>Departures</h2><p>The terminal is operational; inter-city destinations are not unlocked yet.</p></div></div><div className="data-list"><div className="data-row"><span>Current location</span><b>{g.gameState.currentLocation}</b></div><div className="data-row"><span>Travel status</span><b>{g.travelLocked ? "Cooldown active" : "Ready"}</b></div></div><BackToCity g={g} /></Panel></div>;
}
