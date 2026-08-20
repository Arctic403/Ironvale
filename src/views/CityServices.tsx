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

export function Casino({ g }: { g: Game }) {
  return <div className="city-service-page"><Panel title="The Rift Casino"><div className="service-hero"><span>🎰</span><div><h2>Entertainment Floor</h2><p>The venue is open for social events, shows, and city encounters.</p></div></div><p className="status-text">Wagering mechanics are not enabled in this build. The location is fully enterable and ready for future non-wagering events and mission content.</p><div className="btn-group"><Button onClick={g.randomEncounter}>Look Around</Button><BackToCity g={g} /></div></Panel></div>;
}

export function Airport({ g }: { g: Game }) {
  return <div className="city-service-page"><Panel title="RiftCity International Airport"><div className="service-hero"><span>✈️</span><div><h2>Departures</h2><p>The terminal is operational; inter-city destinations are not unlocked yet.</p></div></div><div className="data-list"><div className="data-row"><span>Current location</span><b>{g.gameState.currentLocation}</b></div><div className="data-row"><span>Travel status</span><b>{g.travelLocked ? "Cooldown active" : "Ready"}</b></div></div><BackToCity g={g} /></Panel></div>;
}
