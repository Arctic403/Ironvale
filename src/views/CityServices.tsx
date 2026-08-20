import React, { useEffect, useMemo, useRef, useState } from "react";
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
type PokerStage = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
type PokerSeat = { name: string; npc: boolean; chips: number; bet: number; folded: boolean; cards: CasinoCard[]; action: string };
type Horse = { name: string; number: number; speed: number; stamina: number; form: number; consistency: number; style: string; icon: string };
type SlotMachine = { id: string; name: string; icon: string; subtitle: string; symbols: string[]; jackpot: string };

const CASINO_DAILY_LIMIT = 50;
const CASINO_WINDOW_MS = 24 * 60 * 60 * 1000;
const CASINO_SESSION_LIMIT = 15;
const CASINO_COOLDOWN_MS = 10 * 60 * 1000;
const CASINO_NPCS = ["Maya Vale", "Vince Romano", "Juno Park", "Theo Knox", "Aria Stone", "Malik Reed"];
const POKER_SMALL_BLIND = 10;
const POKER_BIG_BLIND = 20;
const RACE_CYCLE_MS = 120_000;
const RACE_BETTING_MS = 75_000;
const RACE_RUNNING_MS = 35_000;

const SLOT_MACHINES: SlotMachine[] = [
  { id:"neon", name:"Neon Reels", icon:"⚡", subtitle:"Electric city lights and Rift stars", symbols:["⚡","◆","★","7","R","♛"], jackpot:"TRIPLE RIFT" },
  { id:"vault", name:"Vault Breaker", icon:"💰", subtitle:"Crack the vault and line up the gold", symbols:["💰","🔐","💎","🪙","★","7"], jackpot:"VAULT OPEN" },
  { id:"midnight", name:"Midnight Drive", icon:"🏎️", subtitle:"Street lights, cars, and midnight boosts", symbols:["🏎️","🌙","💨","🏁","★","7"], jackpot:"NIGHT RUN" },
  { id:"rift", name:"Rift Reactor", icon:"🌀", subtitle:"Unstable Rift energy with rare wild chains", symbols:["🌀","✦","⚛","◆","★","R"], jackpot:"RIFT SURGE" },
];

function buildCasinoDeck() {
  const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const suits = ["♠","♥","♦","♣"];
  return ranks.flatMap((rank) => suits.map((suit) => ({
    rank,
    suit,
    value: rank === "A" ? 14 : rank === "K" ? 13 : rank === "Q" ? 12 : rank === "J" ? 11 : Number(rank),
  })));
}

function shuffledDeck() {
  const deck = buildCasinoDeck();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function casinoCard(): CasinoCard {
  const deck = buildCasinoDeck();
  return deck[Math.floor(Math.random() * deck.length)];
}

function blackjackValue(cards: CasinoCard[]) {
  let total = cards.reduce((sum, card) => sum + (card.rank === "A" ? 11 : Math.min(card.value, 10)), 0);
  let aces = cards.filter((card) => card.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

const POKER_RANK_VALUE: Record<string, number> = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14};

function scoreFive(cards: CasinoCard[]) {
  const values = cards.map((c)=>POKER_RANK_VALUE[c.rank]).sort((a,b)=>b-a);
  const counts = new Map<number, number>();
  values.forEach((v)=>counts.set(v,(counts.get(v)||0)+1));
  const groups = [...counts.entries()].sort((a,b)=>b[1]-a[1] || b[0]-a[0]);
  const flush = cards.every((c)=>c.suit===cards[0].suit);
  const unique = [...new Set(values)];
  if (unique[0]===14) unique.push(1);
  let straightHigh = 0;
  for (let i=0;i<=unique.length-5;i+=1) {
    if (unique[i]-unique[i+4]===4) { straightHigh=unique[i]; break; }
  }
  const pairValues = groups.filter(([,n])=>n===2).map(([v])=>v).sort((a,b)=>b-a);
  const trips = groups.filter(([,n])=>n===3).map(([v])=>v).sort((a,b)=>b-a);
  const quads = groups.find(([,n])=>n===4)?.[0] || 0;
  if (flush && straightHigh) return { category:8, name:"Straight Flush", tiebreak:[straightHigh] };
  if (quads) return { category:7, name:"Four of a Kind", tiebreak:[quads,...values.filter(v=>v!==quads).slice(0,1)] };
  if (trips.length && (pairValues.length || trips.length>1)) {
    const pair = trips.length>1 ? trips[1] : pairValues[0];
    return { category:6, name:"Full House", tiebreak:[trips[0],pair] };
  }
  if (flush) return { category:5, name:"Flush", tiebreak:values };
  if (straightHigh) return { category:4, name:"Straight", tiebreak:[straightHigh] };
  if (trips.length) return { category:3, name:"Three of a Kind", tiebreak:[trips[0],...values.filter(v=>v!==trips[0]).slice(0,2)] };
  if (pairValues.length>=2) {
    const hi=pairValues[0], lo=pairValues[1];
    return { category:2, name:"Two Pair", tiebreak:[hi,lo,...values.filter(v=>v!==hi&&v!==lo).slice(0,1)] };
  }
  if (pairValues.length===1) {
    const pair=pairValues[0];
    return { category:1, name:"Pair", tiebreak:[pair,...values.filter(v=>v!==pair).slice(0,3)] };
  }
  return { category:0, name:"High Card", tiebreak:values };
}

function comparePokerScore(a:{category:number;tiebreak:number[]}, b:{category:number;tiebreak:number[]}) {
  if (a.category!==b.category) return a.category-b.category;
  const len=Math.max(a.tiebreak.length,b.tiebreak.length);
  for(let i=0;i<len;i+=1){ const d=(a.tiebreak[i]||0)-(b.tiebreak[i]||0); if(d) return d; }
  return 0;
}

function bestPokerHand(cards: CasinoCard[]) {
  if (cards.length < 5) return { category:0, name:"Waiting", tiebreak:[] as number[] };
  let best = scoreFive(cards.slice(0,5));
  for(let a=0;a<cards.length-4;a+=1) for(let b=a+1;b<cards.length-3;b+=1) for(let c=b+1;c<cards.length-2;c+=1) for(let d=c+1;d<cards.length-1;d+=1) for(let e=d+1;e<cards.length;e+=1){
    const score=scoreFive([cards[a],cards[b],cards[c],cards[d],cards[e]]);
    if(comparePokerScore(score,best)>0) best=score;
  }
  return best;
}

function CasinoCardView({ card, hidden=false, delay=0 }: { card: CasinoCard; hidden?: boolean; delay?: number }) {
  const red = card.suit === "♥" || card.suit === "♦";
  if (hidden) return <span className="casino-playing-card card-back deal-card" style={{animationDelay:`${delay}ms`}}>R</span>;
  return <span className={`casino-playing-card ${red ? "red" : ""} deal-card`} style={{animationDelay:`${delay}ms`}}><b>{card.rank}</b><em>{card.suit}</em></span>;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function horsesForRace(raceId:number): Horse[] {
  const names=["Night Signal","Blue Comet","Iron Echo","Velvet Rift","Northline","Chrome Halo","Glass Arrow","Last Light","Static Bloom"];
  const styles=["Front runner","Late charger","Balanced","Stamina finisher","Aggressive break"];
  return Array.from({length:6},(_,i)=>{
    const seed=raceId*31+i*17;
    return {
      name:names[(raceId+i*2)%names.length], number:i+1,
      speed:62+Math.floor(seededRandom(seed+1)*35),
      stamina:60+Math.floor(seededRandom(seed+2)*38),
      form:55+Math.floor(seededRandom(seed+3)*43),
      consistency:58+Math.floor(seededRandom(seed+4)*40),
      style:styles[Math.floor(seededRandom(seed+5)*styles.length)], icon:["🐎","🏇","🐴"][i%3],
    };
  });
}

function horseFinishScore(h:Horse,raceId:number){
  return h.speed*.35+h.stamina*.25+h.form*.22+h.consistency*.18+seededRandom(raceId*101+h.number*13)*22;
}

export function Casino({ g }: { g: Game }) {
  const now = useNow();
  const [game, setGame] = useState<CasinoGameId | null>(null);
  const [message, setMessage] = useState("Choose a room on the casino floor.");
  const [playerHand, setPlayerHand] = useState<CasinoCard[]>([]);
  const [dealerHand, setDealerHand] = useState<CasinoCard[]>([]);
  const [blackjackDone, setBlackjackDone] = useState(true);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [slotMachineId, setSlotMachineId] = useState("neon");
  const [reels, setReels] = useState(["◆","★","7"]);
  const [reelsSpinning, setReelsSpinning] = useState(false);

  const [pokerStage,setPokerStage]=useState<PokerStage>("waiting");
  const [pokerSeats,setPokerSeats]=useState<PokerSeat[]>([]);
  const [community,setCommunity]=useState<CasinoCard[]>([]);
  const [pokerPot,setPokerPot]=useState(0);
  const [pokerCurrentBet,setPokerCurrentBet]=useState(0);
  const [pokerLog,setPokerLog]=useState<string[]>(["Take a seat and deal a hand."]);
  const pokerDeckRef=useRef<CasinoCard[]>([]);
  const [dealerIndex,setDealerIndex]=useState(0);

  const raceId=Math.floor(now/RACE_CYCLE_MS);
  const raceMs=now%RACE_CYCLE_MS;
  const racePhase: "betting"|"running"|"results" = raceMs<RACE_BETTING_MS ? "betting" : raceMs<RACE_BETTING_MS+RACE_RUNNING_MS ? "running" : "results";
  const raceHorses=useMemo(()=>horsesForRace(raceId),[raceId]);
  const [racePick,setRacePick]=useState(0);
  const [raceLockedId,setRaceLockedId]=useState<number|null>(null);
  const settledRaces=useRef(new Set<number>());
  const raceElapsed=Math.max(0,raceMs-RACE_BETTING_MS);
  const raceProgress=Math.min(1,raceElapsed/RACE_RUNNING_MS);
  const orderedFinish=useMemo(()=>[...raceHorses].sort((a,b)=>horseFinishScore(b,raceId)-horseFinishScore(a,raceId)),[raceHorses,raceId]);

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
    const deck=shuffledDeck();
    setPlayerHand([deck.pop()!, deck.pop()!]);
    setDealerHand([deck.pop()!, deck.pop()!]);
    setBlackjackDone(false);
    setMessage("Cards are on the felt. Hit or stand.");
  };
  const hitBlackjack = () => {
    if (blackjackDone) return;
    const next = [...playerHand, casinoCard()]; setPlayerHand(next);
    if (blackjackValue(next) > 21) { setBlackjackDone(true); setMessage("Bust — dealer takes the round."); }
  };
  const standBlackjack = () => {
    if (blackjackDone) return;
    const nextDealer = [...dealerHand]; while (blackjackValue(nextDealer) < 17) nextDealer.push(casinoCard());
    setDealerHand(nextDealer); const p = blackjackValue(playerHand), d = blackjackValue(nextDealer); setBlackjackDone(true);
    if (d > 21 || p > d) { setMessage("You win the blackjack round."); g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+2})); }
    else if (p === d) setMessage("Push — even round."); else setMessage("Dealer wins this round.");
  };

  const appendPokerLog=(entry:string)=>setPokerLog(prev=>[entry,...prev].slice(0,8));
  const drawPoker=(count:number)=>Array.from({length:count},()=>pokerDeckRef.current.pop()!);

  const settlePoker=(seats:PokerSeat[], board:CasinoCard[], pot:number) => {
    const active=seats.filter(s=>!s.folded);
    if(active.length===1){
      const winner=active[0];
      const next=seats.map(s=>s.name===winner.name?{...s,chips:s.chips+pot,action:"WON POT"}:s);
      setPokerSeats(next); setPokerStage("showdown"); appendPokerLog(`${winner.name} wins ${pot} table chips uncontested.`);
      if(!winner.npc) { setMessage("You take the pot."); g.setGameState(prev=>({...prev,casinoReputation:prev.casinoReputation+4,casinoWins:prev.casinoWins+1})); }
      return;
    }
    const scored=active.map(s=>({seat:s,score:bestPokerHand([...s.cards,...board])}));
    let best=scored[0].score; scored.forEach(x=>{if(comparePokerScore(x.score,best)>0) best=x.score;});
    const winners=scored.filter(x=>comparePokerScore(x.score,best)===0);
    const share=Math.floor(pot/winners.length);
    setPokerSeats(seats.map(s=>winners.some(w=>w.seat.name===s.name)?{...s,chips:s.chips+share,action:`${best.name} · WON`}:s));
    setPokerStage("showdown");
    appendPokerLog(`${winners.map(w=>w.seat.name).join(" & ")} win with ${best.name}.`);
    if(winners.some(w=>!w.seat.npc)){ setMessage(`You win with ${best.name}.`); g.setGameState(prev=>({...prev,casinoReputation:prev.casinoReputation+5,casinoWins:prev.casinoWins+1})); }
    else setMessage(`${winners[0].seat.name} wins with ${best.name}.`);
  };

  const npcStreetActions=(seats:PokerSeat[], targetBet:number, board:CasinoCard[])=>{
    return seats.map((seat,i)=>{
      if(!seat.npc||seat.folded) return seat;
      const strength=board.length>=3?bestPokerHand([...seat.cards,...board]).category:Math.max(...seat.cards.map(c=>POKER_RANK_VALUE[c.rank]))/14;
      const pressure=targetBet-seat.bet;
      const bravery=(i+1)*.09+Math.random()*.35+(typeof strength==="number"?Number(strength)*.12:0);
      if(pressure>0 && bravery<.28) return {...seat,folded:true,action:"FOLD"};
      const pay=Math.min(seat.chips,Math.max(0,pressure));
      return {...seat,chips:seat.chips-pay,bet:seat.bet+pay,action:pay>0?`CALL ${pay}`:"CHECK"};
    });
  };

  const advancePokerStreet=(seats:PokerSeat[], pot:number) => {
    const reset=seats.map(s=>({...s,bet:0,action:s.folded?"FOLDED":"WAITING"}));
    if(pokerStage==="preflop") { const board=drawPoker(3); setCommunity(board); setPokerSeats(reset); setPokerCurrentBet(0); setPokerStage("flop"); appendPokerLog("Flop dealt."); }
    else if(pokerStage==="flop") { const board=[...community,...drawPoker(1)]; setCommunity(board); setPokerSeats(reset); setPokerCurrentBet(0); setPokerStage("turn"); appendPokerLog("Turn dealt."); }
    else if(pokerStage==="turn") { const board=[...community,...drawPoker(1)]; setCommunity(board); setPokerSeats(reset); setPokerCurrentBet(0); setPokerStage("river"); appendPokerLog("River dealt."); }
    else if(pokerStage==="river") settlePoker(reset,community,pot);
  };

  const startPoker=()=>{
    if(!canPlay||!recordGame("Poker Room","draw",2)) return;
    const nextDealer=(dealerIndex+1)%5;
    setDealerIndex(nextDealer);
    const deck=shuffledDeck(); pokerDeckRef.current=deck;
    const names=["You",...CASINO_NPCS.slice(0,4)];
    let seats=names.map((name,i)=>({name,npc:i!==0,chips:1000,bet:0,folded:false,cards:[deck.pop()!,deck.pop()!],action:"WAITING"}));
    const sb=(nextDealer+1)%seats.length, bb=(nextDealer+2)%seats.length;
    seats=seats.map((s,i)=>i===sb?{...s,chips:s.chips-POKER_SMALL_BLIND,bet:POKER_SMALL_BLIND,action:`SB ${POKER_SMALL_BLIND}`}:i===bb?{...s,chips:s.chips-POKER_BIG_BLIND,bet:POKER_BIG_BLIND,action:`BB ${POKER_BIG_BLIND}`}:s);
    setPokerSeats(seats); setCommunity([]); setPokerPot(POKER_SMALL_BLIND+POKER_BIG_BLIND); setPokerCurrentBet(POKER_BIG_BLIND); setPokerStage("preflop"); setPokerLog([`Blinds posted ${POKER_SMALL_BLIND}/${POKER_BIG_BLIND}.`,`Dealer: ${seats[nextDealer].name}`]); setMessage("Texas Hold'em hand started. Table chips reset each hand and have no cash value.");
  };

  const pokerPlayerAction=(kind:"checkcall"|"raise"|"fold")=>{
    if(!["preflop","flop","turn","river"].includes(pokerStage)) return;
    const player=pokerSeats[0]; if(!player||player.folded) return;
    if(kind==="fold"){ const seats=[{...player,folded:true,action:"FOLD"},...pokerSeats.slice(1)]; appendPokerLog("You fold."); settlePoker(seats,community,pokerPot); return; }
    const raiseTo=kind==="raise"?Math.max(pokerCurrentBet+40,40):pokerCurrentBet;
    const pay=Math.min(player.chips,Math.max(0,raiseTo-player.bet));
    let seats=[{...player,chips:player.chips-pay,bet:player.bet+pay,action:kind==="raise"?`RAISE ${player.bet+pay}`:pay?`CALL ${pay}`:"CHECK"},...pokerSeats.slice(1)];
    let pot=pokerPot+pay; const target=kind==="raise"?player.bet+pay:pokerCurrentBet;
    seats=npcStreetActions(seats,target,community);
    const npcPaid=seats.slice(1).reduce((sum,s,i)=>sum+Math.max(0,s.bet-pokerSeats[i+1].bet),0); pot+=npcPaid;
    setPokerSeats(seats); setPokerPot(pot); setPokerCurrentBet(target); appendPokerLog(kind==="raise"?`You raise to ${target}.`:pay?`You call ${pay}.`:"You check.");
    const active=seats.filter(s=>!s.folded); if(active.length===1){ settlePoker(seats,community,pot); return; }
    window.setTimeout(()=>advancePokerStreet(seats,pot),420);
  };

  const spinWheel = () => {
    if (!canPlay || wheelSpinning || !recordGame("Rift Wheel", "draw", 1)) return;
    setWheelSpinning(true); setWheelResult(null); setMessage("The Rift Wheel is spinning…");
    window.setTimeout(()=>{
      const segments = ["RIFT STAR +3 REP","BLUE SECTOR +1 REP","GOLD SECTOR +2 REP","NEUTRAL","DOUBLE STAR +4 REP","NEUTRAL"];
      const result = segments[Math.floor(Math.random()*segments.length)]; setWheelResult(result); setWheelSpinning(false);
      const bonus = result.includes("+4")?4:result.includes("+3")?3:result.includes("+2")?2:result.includes("+1")?1:0;
      if (bonus) g.setGameState((prev)=>({...prev,casinoReputation:prev.casinoReputation+bonus})); setMessage(`Wheel result: ${result}.`);
    },1800);
  };

  const activeMachine=SLOT_MACHINES.find(m=>m.id===slotMachineId) || SLOT_MACHINES[0];
  const spinReels = () => {
    if (!canPlay || reelsSpinning || !recordGame(activeMachine.name, "draw", 1)) return;
    setReelsSpinning(true); setMessage(`${activeMachine.name} reels are spinning…`);
    let ticks=0;
    const id=window.setInterval(()=>{ setReels([0,1,2].map(()=>activeMachine.symbols[Math.floor(Math.random()*activeMachine.symbols.length)])); ticks+=1; if(ticks>=12){window.clearInterval(id); const next=[0,1,2].map(()=>activeMachine.symbols[Math.floor(Math.random()*activeMachine.symbols.length)]); setReels(next); const match=next[0]===next[1]&&next[1]===next[2]; if(match)g.setGameState(prev=>({...prev,casinoReputation:prev.casinoReputation+6})); setMessage(match?`${activeMachine.jackpot}! Triple ${next[0]} — reputation bonus.`:"Reels stop. Lights settle across the machine."); setReelsSpinning(false);}},75);
  };

  const lockRacePrediction=()=>{
    if(racePhase!=="betting"||raceLockedId===raceId||!canPlay||!recordGame("Rift Downs Prediction","draw",1)) return;
    setRaceLockedId(raceId); setMessage(`Prediction locked: ${raceHorses[racePick]?.name}. Race starts automatically.`);
  };

  useEffect(()=>{
    if(racePhase!=="results"||raceLockedId!==raceId||settledRaces.current.has(raceId)) return;
    settledRaces.current.add(raceId);
    const winner=orderedFinish[0]; const hit=winner.number-1===racePick;
    if(hit) g.setGameState(prev=>({...prev,casinoReputation:prev.casinoReputation+5,casinoWins:prev.casinoWins+1}));
    setMessage(hit?`${winner.name} wins — your prediction hit!`:`${winner.name} wins race #${raceId%1000}.`);
  },[racePhase,raceId,raceLockedId,racePick,orderedFinish]);

  const raceCountdown = racePhase==="betting" ? RACE_BETTING_MS-raceMs : racePhase==="running" ? RACE_BETTING_MS+RACE_RUNNING_MS-raceMs : RACE_CYCLE_MS-raceMs;

  return (
    <div className="city-service-page casino-v4">
      <section className="casino-hero casino-animated-lobby">
        <div className="casino-hero-glow"/><div className="casino-light-beam beam-a"/><div className="casino-light-beam beam-b"/>
        <div className="casino-brand"><span>✦</span><div><small>RIFTCITY ENTERTAINMENT DISTRICT</small><h2>THE RIFT CASINO</h2><p>Animated tables, live race schedules, NPC regulars, and arcade-style casino games.</p></div></div>
        <div className="casino-live-ticker"><span>LIVE</span><b>Rift Downs race #{raceId%1000}</b><small>{racePhase.toUpperCase()} · {formatTime(raceCountdown)}</small><i/> <b>Poker Room</b><small>NPC tables active</small><i/> <b>{activeMachine.name}</b><small>Featured machine</small></div>
        <div className="casino-metrics">
          <div><span>Daily Plays</span><strong>{remaining}/{CASINO_DAILY_LIMIT}</strong><small>{resetAt ? `Resets in ${formatTime(Math.max(0,resetAt-now))}` : "24h window starts on first play"}</small></div>
          <div><span>Casino Rank</span><strong>{rank}</strong><small>{g.gameState.casinoReputation} reputation</small></div>
          <div><span>Record</span><strong>{g.gameState.casinoWins}/{g.gameState.casinoGamesPlayed}</strong><small>Best streak {g.gameState.casinoBestStreak}</small></div>
        </div>
        <div className="casino-limit-note">Play is capped at {CASINO_DAILY_LIMIT} actions per 24 hours. After {CASINO_SESSION_LIMIT} consecutive actions, the floor enforces a {CASINO_COOLDOWN_MS/60000}-minute break. Table chips are play-only, reset, cannot be bought or traded, and have no cash value.</div>
        {cooldownActive && <div className="casino-cooldown">☕ Floor break active · {cooldownRemaining} remaining. You can still browse and spectate.</div>}
      </section>

      <div className="casino-floor-grid">
        {[
          ["blackjack","🂡","Blackjack Hall","Dealer Elena · animated felt table","PLAYABLE TABLE"],
          ["poker","♠","Texas Hold'em Room","5-seat Hold'em · NPCs fill open seats","REAL POKER"],
          ["wheel","◉","Rift Wheel","Animated arcade wheel · reputation prizes","ARCADE FLOOR"],
          ["racing","🏇","Rift Downs","Timed races · live horse stats and track","LIVE RACING"],
          ["reels","🎰","Slots Gallery",`${SLOT_MACHINES.length} animated themed machines`,"ANIMATED SLOTS"],
        ].map(([id,icon,title,sub,status])=>(
          <button key={id} type="button" className="casino-room casino-room-live" onClick={()=>setGame(id as CasinoGameId)}>
            <span className="casino-room-icon">{icon}</span><div><small>{status}</small><h3>{title}</h3><p>{sub}</p></div><b>ENTER →</b>
          </button>
        ))}
        <div className="casino-room locked"><span className="casino-room-icon">💎</span><div><small>Reputation 60</small><h3>VIP Lounge</h3><p>Special NPCs, cosmetics, social events, and future tournaments.</p></div><b>{g.gameState.casinoReputation>=60?"UNLOCKED":"LOCKED"}</b></div>
      </div>

      <div className="casino-table-strip casino-live-floor">
        <div><span className="live-dot"/> BLACKJACK 04 <b>4/5</b><small>Maya · Vince · Juno · 1 open seat</small></div>
        <div><span className="live-dot"/> HOLD'EM 02 <b>3/5</b><small>NPCs automatically fill vacant seats until multiplayer connects</small></div>
        <div><span className="live-dot"/> RIFT DOWNS <b>{racePhase.toUpperCase()}</b><small>Next phase in {formatTime(raceCountdown)}</small></div>
      </div>

      <div className="casino-footer-actions"><p>{message}</p><div className="btn-group"><Button onClick={g.randomEncounter}>Explore Casino Floor</Button><BackToCity g={g}/></div></div>

      {game && <div className="casino-game-backdrop" role="dialog" aria-modal="true" aria-label="Casino game">
        <div className={`casino-game-modal casino-game-${game}`}>
          <button type="button" className="casino-game-close" onClick={()=>setGame(null)}>×</button>
          <div className="casino-game-heading"><span>{game==="blackjack"?"🂡":game==="poker"?"♠":game==="wheel"?"◉":game==="racing"?"🏇":"🎰"}</span><div><small>THE RIFT CASINO</small><h3>{game==="blackjack"?"Blackjack Hall":game==="poker"?"Texas Hold'em":game==="wheel"?"Rift Wheel":game==="racing"?"Rift Downs":"Slots Gallery"}</h3></div><b>{remaining} plays left</b></div>

          {game==="blackjack" && <div className="casino-table-game animated-felt">
            <div className="casino-seat-row"><span className="casino-seat npc">MAYA<br/><small>NPC</small></span><span className="casino-seat npc">VINCE<br/><small>NPC</small></span><span className="casino-seat dealer">ELENA<br/><small>DEALER</small></span><span className="casino-seat npc">JUNO<br/><small>NPC</small></span></div>
            <div className="casino-hand"><label>Dealer · {dealerHand.length ? blackjackValue(dealerHand) : "—"}</label><div>{dealerHand.map((c,i)=><CasinoCardView key={i} card={c} delay={i*80}/>)}</div></div>
            <div className="casino-hand player"><label>You · {playerHand.length ? blackjackValue(playerHand) : "—"}</label><div>{playerHand.map((c,i)=><CasinoCardView key={i} card={c} delay={i*80}/>)}</div></div>
            <div className="btn-group"><Button disabled={!canPlay || !blackjackDone} onClick={startBlackjack}>Deal New Round</Button><Button disabled={blackjackDone} onClick={hitBlackjack}>Hit</Button><Button disabled={blackjackDone} onClick={standBlackjack}>Stand</Button></div>
          </div>}

          {game==="poker" && <div className="holdem-game">
            <div className="poker-table-shell">
              <div className="poker-felt-logo">RIFT HOLD'EM</div>
              <div className="community-cards">{community.length?community.map((c,i)=><CasinoCardView card={c} key={i} delay={i*100}/>):<span className="board-placeholder">COMMUNITY CARDS</span>}</div>
              <div className="poker-pot"><small>POT</small><b>{pokerPot}</b><span>PLAY CHIPS</span></div>
              {(pokerSeats.length?pokerSeats:["You",...CASINO_NPCS.slice(0,4)].map((name,i)=>({name,npc:i!==0,chips:1000,bet:0,folded:false,cards:[],action:"WAITING"}))).map((seat,i)=>{
                const hand=pokerStage==="showdown"&&!seat.folded?bestPokerHand([...seat.cards,...community]).name:"";
                return <div key={seat.name} className={`holdem-seat seat-${i} ${seat.npc?"npc":"you"} ${seat.folded?"folded":""}`}>
                  <div className="seat-avatar">{seat.npc?"◆":"YOU"}</div><b>{seat.name}</b><small>{seat.chips} chips</small>
                  <div className="seat-cards">{seat.cards.map((c,j)=><CasinoCardView key={j} card={c} hidden={seat.npc&&pokerStage!=="showdown"} delay={j*90}/>)}</div>
                  <span className="seat-action">{hand||seat.action}</span>{seat.bet>0&&<em className="seat-bet">{seat.bet}</em>}
                  {i===dealerIndex&&<i className="dealer-button">D</i>}
                </div>;
              })}
            </div>
            <div className="poker-status-row"><span>Stage <b>{pokerStage.toUpperCase()}</b></span><span>Blinds <b>{POKER_SMALL_BLIND}/{POKER_BIG_BLIND}</b></span><span>Current bet <b>{pokerCurrentBet}</b></span></div>
            <div className="poker-controls">
              <Button disabled={!canPlay||!["waiting","showdown"].includes(pokerStage)} onClick={startPoker}>Deal Hold'em Hand</Button>
              <Button disabled={!pokerSeats.length||!["preflop","flop","turn","river"].includes(pokerStage)} onClick={()=>pokerPlayerAction("checkcall")}>{pokerSeats[0]&&pokerSeats[0].bet<pokerCurrentBet?`Call ${Math.max(0,pokerCurrentBet-pokerSeats[0].bet)}`:"Check"}</Button>
              <Button disabled={!pokerSeats.length||!["preflop","flop","turn","river"].includes(pokerStage)} onClick={()=>pokerPlayerAction("raise")}>Raise +40</Button>
              <Button disabled={!pokerSeats.length||!["preflop","flop","turn","river"].includes(pokerStage)} onClick={()=>pokerPlayerAction("fold")}>Fold</Button>
            </div>
            <div className="poker-action-log">{pokerLog.map((entry,i)=><span key={i}>{entry}</span>)}</div>
            <p className="casino-fair-note">Texas Hold'em uses play-only table chips. They reset for each hand and cannot be purchased, traded, withdrawn, or converted to RiftCity cash.</p>
          </div>}

          {game==="wheel" && <div className="casino-wheel-game"><div className={`rift-wheel ${wheelSpinning?"spinning":""}`}><span>R</span></div><strong>{wheelResult || (wheelSpinning?"SPINNING…":"Ready to spin")}</strong><Button disabled={!canPlay||wheelSpinning} onClick={spinWheel}>Spin Arcade Wheel</Button></div>}

          {game==="racing" && <div className="race-center">
            <div className="race-header-board"><div><small>RACE</small><b>#{raceId%1000}</b></div><div><small>STATUS</small><b>{racePhase.toUpperCase()}</b></div><div><small>NEXT PHASE</small><b>{formatTime(raceCountdown)}</b></div></div>
            <div className="horse-form-grid">{raceHorses.map((h,i)=><button type="button" disabled={racePhase!=="betting"||raceLockedId===raceId} className={`horse-form-card ${racePick===i?"selected":""}`} key={h.number} onClick={()=>setRacePick(i)}><span className="horse-number">{h.number}</span><div><b>{h.name}</b><small>{h.style}</small></div><dl><div><dt>SPD</dt><dd>{h.speed}</dd></div><div><dt>STA</dt><dd>{h.stamina}</dd></div><div><dt>FORM</dt><dd>{h.form}</dd></div><div><dt>CONS</dt><dd>{h.consistency}</dd></div></dl></button>)}</div>
            <div className="live-race-track">{raceHorses.map((h,i)=>{
              const score=horseFinishScore(h,raceId); const normalized=.78+(score-70)/180; const jitter=Math.sin(raceProgress*16+i*1.7)*1.2; const pos=racePhase==="betting"?2:racePhase==="results"?(orderedFinish.findIndex(x=>x.number===h.number)===0?95:88-orderedFinish.findIndex(x=>x.number===h.number)*5):Math.min(94,3+raceProgress*90*normalized+jitter);
              return <div className="race-lane" key={h.number}><span className="lane-num">{h.number}</span><div className="lane-line"><span className={`running-horse ${racePhase==="running"?"galloping":""}`} style={{left:`${pos}%`}}>{h.icon}</span></div><b>{h.name}</b></div>;
            })}<div className="finish-line">FINISH</div></div>
            {racePhase==="results"&&<div className="race-results"><b>Official Finish</b>{orderedFinish.slice(0,3).map((h,i)=><span key={h.number}>{i+1}. {h.name}</span>)}</div>}
            <div className="race-actions"><strong>{raceLockedId===raceId?`Prediction locked: ${raceHorses[racePick].name}`:racePhase==="betting"?`Selected: ${raceHorses[racePick].name}`:"Predictions closed"}</strong><Button disabled={!canPlay||racePhase!=="betting"||raceLockedId===raceId} onClick={lockRacePrediction}>Lock Prediction</Button></div>
          </div>}

          {game==="reels" && <div className="slots-gallery">
            <div className="slot-machine-tabs">{SLOT_MACHINES.map(m=><button type="button" key={m.id} className={slotMachineId===m.id?"active":""} onClick={()=>{setSlotMachineId(m.id);setReels(m.symbols.slice(0,3));}}><span>{m.icon}</span><b>{m.name}</b><small>{m.subtitle}</small></button>)}</div>
            <div className={`slot-cabinet theme-${activeMachine.id} ${reelsSpinning?"spinning":""}`}><div className="slot-marquee"><span>{activeMachine.icon}</span><b>{activeMachine.name}</b><small>{activeMachine.jackpot}</small></div><div className="slot-lights">{Array.from({length:18},(_,i)=><i key={i}/>)}</div><div className="neon-reels">{reels.map((r,i)=><span className={`reel reel-${i}`} key={i}>{r}</span>)}</div><div className="slot-payline">★ PAYLINE ★</div><Button disabled={!canPlay||reelsSpinning} onClick={spinReels}>{reelsSpinning?"SPINNING…":"Spin Machine"}</Button></div>
            <p className="casino-fair-note">All machines are arcade-style minigames. No purchasable or cash-out wagering currency is used.</p>
          </div>}

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
