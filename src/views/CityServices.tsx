import React, { useEffect, useMemo, useRef, useState } from "react";
import type { useRiftCity } from "../hooks/useRiftCity";
import { Button, Panel } from "../components/ui";
import { ITEMS } from "../data/gameData";
import { formatTime, money, timeLeft } from "../core/gameCore";
import { BANK_INVESTMENT_TIERS, SAVINGS_WITHDRAWAL_FEE_RATE, SAVINGS_WITHDRAWAL_MIN_FEE, checkingProtectedCap, savingsProtectedCap } from "../data/banking";
import { BLACK_MARKET_STATS, betaNpcAutoBuyCeiling, betaNpcQuickSellPrice, betaNpcSuggestedListingPrice, blackMarketReferenceValue } from "../systems/auctionSystem";
import { CRIME_TOOLS } from "../systems/crimeTools";
import { PRODUCTION_FACILITIES, PRODUCTION_RECIPES, PRODUCTION_SUPPLIES, canFacilityRun } from "../systems/contrabandSystem";
import { OFFSHORE_TIERS, getOffshoreTier } from "../data/wealthRisk";

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
  const now = useNow();
  const [amount, setAmount] = useState("100");
  const [investAmount, setInvestAmount] = useState("500");
  const [offshoreAmount, setOffshoreAmount] = useState("1000");
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const invN = Math.max(0, Math.floor(Number(investAmount) || 0));
  const offshoreN = Math.max(0, Math.floor(Number(offshoreAmount) || 0));
  const tiers = BANK_INVESTMENT_TIERS;
  const unlocked = (t: typeof tiers[number]) => g.gameState.bankLifetimeDeposits >= t.unlockDeposit && now - g.gameState.bankOpenedAt >= t.unlockMs;
  const transferSavings = (direction:"toSavings"|"toChecking") => g.setGameState(prev => {
    if (prev.bankFrozenUntil && prev.bankFrozenUntil > Date.now()) return g.appendActivity(prev, "Domestic accounts are frozen.", "failure");
    const source = direction === "toSavings" ? prev.bank : prev.bankSavings;
    const move = Math.min(source, n);
    if (move <= 0) return prev;
    const fee = direction === "toChecking" ? Math.min(move, Math.max(SAVINGS_WITHDRAWAL_MIN_FEE, Math.floor(move * SAVINGS_WITHDRAWAL_FEE_RATE))) : 0;
    const credited = Math.max(0, move - fee);
    const bank = direction === "toSavings" ? prev.bank - move : prev.bank + credited;
    const bankSavings = direction === "toSavings" ? prev.bankSavings + move : prev.bankSavings - move;
    return { ...prev, bank, bankSavings, bankLosses:prev.bankLosses+fee, bankHistory:[...prev.bankHistory, bank + bankSavings].slice(-40), bankTransactions:[{id:`transfer-${Date.now()}`,type:"transfer",amount:direction === "toSavings" ? move : credited,time:Date.now(),note:direction === "toSavings" ? "Checking → Savings" : `Savings → Checking (${money(fee)} early-access fee)`},...prev.bankTransactions].slice(0,60) };
  });
  const startInvestment = (tier: typeof tiers[number]) => g.setGameState(prev => {
    if (prev.bankFrozenUntil && prev.bankFrozenUntil > Date.now()) return g.appendActivity(prev, "Domestic accounts are frozen.", "failure");
    if (!unlocked(tier)) return prev;
    const committed = prev.bankInvestments.filter(x => x.tierId === tier.id).reduce((sum,x)=>sum+x.principal,0);
    const availableCap = Math.max(0, tier.cap - committed);
    const principal = Math.min(invN, prev.bank, availableCap);
    if (principal <= 0) return prev;
    const startedAt = Date.now();
    return { ...prev, bank:prev.bank-principal, bankInvestments:[...prev.bankInvestments,{id:`inv-${startedAt}-${tier.id}`,tierId:tier.id,principal,rate:tier.targetRate,startedAt,maturesAt:startedAt+tier.term}], bankHistory:[...prev.bankHistory, prev.bank - principal + prev.bankSavings].slice(-40), bankTransactions:[{id:`inv-${startedAt}`,type:"investment",amount:-principal,time:startedAt,note:`Started ${tier.name}`},...prev.bankTransactions].slice(0,60) };
  });
  const total = g.gameState.bank + g.gameState.bankSavings + g.gameState.bankInvestments.reduce((sum,x)=>sum+x.principal,0) + g.gameState.offshoreBalance;
  const offshoreTier = getOffshoreTier(g.gameState.offshoreTier);
  const bankFrozen = Boolean(g.gameState.bankFrozenUntil && g.gameState.bankFrozenUntil > now);
  const checkingCap = checkingProtectedCap(g.gameState.bankLifetimeDeposits);
  const savingsCap = savingsProtectedCap(g.gameState.bankLifetimeDeposits);
  const checkingExposed = Math.max(0, g.gameState.bank - checkingCap);
  const savingsExposed = Math.max(0, g.gameState.bankSavings - savingsCap);
  const history = g.gameState.bankHistory.length > 1 ? g.gameState.bankHistory : [0,total];
  const max = Math.max(1,...history), min = Math.min(...history);
  const points = history.map((v,i)=>`${(i/(history.length-1))*100},${42-((v-min)/Math.max(1,max-min))*36}`).join(" ");
  return (
    <div className="city-service-page bank-v2">
      <section className="bank-hero"><div><small>RIFTCITY FINANCIAL</small><h2>{money(total)}</h2><p>Total managed balance · every storage option trades access, fees, limits, and risk</p></div><div className="bank-account-pills"><span>Checking <b>{money(g.gameState.bank)}</b></span><span>Savings <b>{money(g.gameState.bankSavings)}</b></span><span>Invested <b>{money(g.gameState.bankInvestments.reduce((s,x)=>s+x.principal,0))}</b></span><span>Offshore <b>{money(g.gameState.offshoreBalance)}</b></span></div></section>
      <div className="bank-risk-grid"><div><small>CASH ON HAND</small><b>Highest exposure</b><span>Crime failures and arrests can cost carried cash.</span></div><div><small>CHECKING</small><b>{checkingExposed ? `${money(checkingExposed)} exposed` : "Within protected allowance"}</b><span>Allowance: {money(checkingCap)} · excess can be hit by fraud/seizure events.</span></div><div><small>SAVINGS</small><b>{savingsExposed ? `${money(savingsExposed)} exposed` : "Within protected allowance"}</b><span>Allowance: {money(savingsCap)} · 2% early-access fee.</span></div><div><small>INVESTMENTS</small><b>Market risk</b><span>Returns can finish above or below principal depending on tier.</span></div><div><small>OFFSHORE</small><b>{offshoreTier ? `${money(g.gameState.offshoreBalance)} / ${money(offshoreTier.cap)}` : "Locked"}</b><span>Highest protection · fees + caps · a successful hostile hack steals only a small % then activates protection.</span></div></div>
      <div className="ui-grid two-col">
        <Panel title={`Accounts${bankFrozen ? " · FROZEN" : ""}`}>
          {bankFrozen && <div className="production-warning"><strong>Domestic account freeze</strong><span>Transfers, deposits, and withdrawals are blocked for {formatTime((g.gameState.bankFrozenUntil || now)-now)}. Offshore funds remain separate.</span></div>}
          <div className="input-group"><input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/><div className="btn-group"><Button disabled={n<=0} onClick={()=>g.bankDeposit(n)}>Deposit Cash</Button><Button disabled={n<=0} onClick={()=>g.bankWithdraw(n)}>Withdraw</Button></div></div>
          <div className="btn-group"><Button disabled={n<=0||g.gameState.bank<n} onClick={()=>transferSavings("toSavings")}>Move to Savings</Button><Button disabled={n<=0||g.gameState.bankSavings<n} onClick={()=>transferSavings("toChecking")}>Move to Checking</Button></div>
          <div className="data-list"><div className="data-row"><span>Checking daily interest</span><b>1.0% + perks</b></div><div className="data-row"><span>Savings daily interest</span><b>1.5% + perks</b></div><div className="data-row"><span>Lifetime deposits</span><b>{money(g.gameState.bankLifetimeDeposits)}</b></div><div className="data-row"><span>Interest earned</span><b>{money(g.gameState.bankInterest)}</b></div><div className="data-row"><span>Financial losses</span><b>{money(g.gameState.bankLosses)}</b></div><div className="data-row"><span>Bank seizures</span><b>{g.gameState.bankSeizures}</b></div><div className="data-row"><span>Heat exposure</span><b>{g.gameState.heat}/100</b></div></div>
        </Panel>
        <Panel title="Balance Graph">
          <div className="bank-chart"><svg viewBox="0 0 100 44" preserveAspectRatio="none"><polyline points={points}/></svg><div><span>{money(min)}</span><b>{money(history[history.length - 1] || 0)}</b><span>{money(max)}</span></div></div>
          <p className="muted-copy">Tracks recent account balance changes, transfers, interest, and investment maturities.</p>
        </Panel>
      </div>
      <Panel title="Investment Desk">
        <div className="investment-input"><label>Investment amount</label><input type="number" min="1" value={investAmount} onChange={e=>setInvestAmount(e.target.value)}/></div>
        <div className="investment-tier-grid">{tiers.map(t=>{const open=unlocked(t); const committed=g.gameState.bankInvestments.filter(x=>x.tierId===t.id).reduce((sum,x)=>sum+x.principal,0); return <div key={t.id} className={`investment-tier ${open?"open":"locked"}`}><small>{open?"UNLOCKED":"LOCKED"}</small><h3>{t.name}</h3><div><span>Cap</span><b>{money(t.cap)}</b></div><div><span>Term</span><b>{formatTime(t.term)}</b></div><div><span>Target return</span><b>{Math.round(t.targetRate*100)}%</b></div><div><span>Possible range</span><b>{Math.round(t.minRate*100)}% to +{Math.round(t.maxRate*100)}%</b></div><div><span>Risk</span><b>{t.riskLabel}</b></div><div><span>Committed</span><b>{money(committed)}</b></div>{!open&&<p>Requires {money(t.unlockDeposit)} lifetime deposits + {formatTime(t.unlockMs)} account age.</p>}<Button disabled={!open||invN<=0||g.gameState.bank<=0||committed>=t.cap} onClick={()=>startInvestment(t)}>Invest</Button></div>})}</div>
        {g.gameState.bankInvestments.length>0&&<div className="active-investments"><h3>Active Investments</h3>{g.gameState.bankInvestments.map(inv=>{const t=tiers.find(x=>x.id===inv.tierId); return <div key={inv.id}><span>{t?.name||inv.tierId}</span><b>{money(inv.principal)} · target {money(Math.floor(inv.principal*(1+inv.rate)))}</b><small>{now>=inv.maturesAt?"Maturing now":`${formatTime(inv.maturesAt-now)} remaining`}</small></div>})}</div>}
      </Panel>
      <Panel title="Offshore Network · High Protection / High Friction">
        <p>Offshore storage is the closest thing to safe cash: strict caps and routing fees apply. Future multiplayer hacks can only steal the configured percentage, then the account enters a protected window so the same player cannot be farmed repeatedly.</p>
        <div className="investment-tier-grid">{OFFSHORE_TIERS.map((tier,idx)=>{const currentIndex=OFFSHORE_TIERS.findIndex(t=>t.id===g.gameState.offshoreTier); const netWorth=g.gameState.cash+g.gameState.bank+g.gameState.bankSavings+g.gameState.offshoreBalance; const available=netWorth>=tier.unlockNetWorth && idx<=currentIndex+1; const active=tier.id===g.gameState.offshoreTier; return <div key={tier.id} className={`investment-tier ${active?"open":available?"open":"locked"}`}><small>{active?"ACTIVE":available?"AVAILABLE":"LOCKED"}</small><h3>{tier.name}</h3><div><span>Cap</span><b>{money(tier.cap)}</b></div><div><span>Deposit fee</span><b>{Math.round(tier.depositFeeRate*100)}%</b></div><div><span>Withdraw fee</span><b>{Math.round(tier.withdrawFeeRate*100)}%</b></div><div><span>Hack exposure</span><b>{(tier.hackLossMin*100).toFixed(1)}–{(tier.hackLossMax*100).toFixed(1)}%</b></div><div><span>Protection after breach</span><b>{formatTime(tier.protectionMs)}</b></div><div><span>Unlock net worth</span><b>{money(tier.unlockNetWorth)}</b></div><Button disabled={active||!available||idx<=currentIndex} onClick={()=>g.unlockOffshoreTier(tier.id)}>{active?"Active":"Unlock Tier"}</Button></div>})}</div>
        {offshoreTier && <><div className="input-group"><input type="number" min="0" value={offshoreAmount} onChange={e=>setOffshoreAmount(e.target.value)}/><div className="btn-group"><Button disabled={offshoreN<=0||g.gameState.cash<=0} onClick={()=>g.offshoreDeposit(offshoreN)}>Route Offshore</Button><Button disabled={offshoreN<=0||g.gameState.offshoreBalance<=0} onClick={()=>g.offshoreWithdraw(offshoreN)}>Withdraw Offshore</Button></div></div><div className="data-list"><div className="data-row"><span>Offshore balance</span><b>{money(g.gameState.offshoreBalance)}</b></div><div className="data-row"><span>Current cap</span><b>{money(offshoreTier.cap)}</b></div><div className="data-row"><span>Fees / hack losses</span><b>{money(g.gameState.offshoreLosses)}</b></div><div className="data-row"><span>Breach protection</span><b>{g.gameState.offshoreProtectedUntil && g.gameState.offshoreProtectedUntil>now ? formatTime(g.gameState.offshoreProtectedUntil-now) : "Not active"}</b></div></div></>}
      </Panel>

      <Panel title="Recent Banking Activity"><div className="bank-ledger">{g.gameState.bankTransactions.length?g.gameState.bankTransactions.slice(0,8).map(tx=><div key={tx.id}><span>{tx.note}</span><b className={tx.amount>=0?"positive":"negative"}>{tx.amount>=0?"+":""}{money(tx.amount)}</b><small>{new Date(tx.time).toLocaleString()}</small></div>):<p>No transactions yet.</p>}</div><BackToCity g={g}/></Panel>
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
  const [sellItemId, setSellItemId] = useState("");
  const [sellQuantity, setSellQuantity] = useState("1");
  const [query, setQuery] = useState("");
  const now = useNow();

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
  const sellOwned = sellItemId ? (g.gameState.inventory[sellItemId] || 0) : 0;
  const sellQty = Math.max(1, Math.min(sellOwned || 1, Math.floor(Number(sellQuantity) || 1)));
  const sellReference = sellItemId ? blackMarketReferenceValue(sellItemId) : 0;
  const sellUnitPrice = sellItemId ? betaNpcQuickSellPrice(sellItemId) : 0;
  const sellTotal = sellUnitPrice * sellQty;
  const autoBuyCeiling = itemId ? betaNpcAutoBuyCeiling(itemId) : 0;
  const visibleListings = listings.slice(0, query ? 80 : 45);

  return (
    <div className="city-service-page black-market-v2">
      <Panel title="Black Market Exchange · BETA">
        <div className="service-hero">
          <span>🕶️</span>
          <div>
            <h2>Underground Exchange</h2>
            <p>Simulated city-scale trading now runs beside player listings. NPC activity is beta economy data and can later be replaced by live multiplayer listings.</p>
          </div>
        </div>

        <div className="black-market-stats">
          <div><span>24h Trades</span><strong>{BLACK_MARKET_STATS.trades24h.toLocaleString()}</strong></div>
          <div><span>24h Volume</span><strong>{money(BLACK_MARKET_STATS.volume24h)}</strong></div>
          <div><span>Active Traders</span><strong>{BLACK_MARKET_STATS.traders.toLocaleString()}</strong></div>
          <div><span>Listings</span><strong>{BLACK_MARKET_STATS.activeListings.toLocaleString()}</strong></div>
          <div><span>Production Attention</span><strong>{g.gameState.productionAttention}/100</strong></div>
        </div>

        <div className="black-market-toolbar">
          <label><span>Search listings</span><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Item or seller" /></label>
          <div className="black-market-balance"><span>Cash</span><strong>{money(g.gameState.cash)}</strong></div>
        </div>

        <div className="auction-listings">
          {visibleListings.map((listing) => {
            const item = ITEMS.find((x) => x.id === listing.itemId);
            if (!item) return null;
            const mine = listing.seller === "You";
            const total = listing.price * listing.quantity;
            return (
              <article className="auction-listing" key={listing.id}>
                <div className="auction-item-copy">
                  <span className={`rarity-pill ${(item.rarity || "Common").toLowerCase()}`}>{item.rarity || "Common"}</span>
                  <h3>{item.name}</h3><p>{item.description}</p>
                  <small>Seller: <b>{listing.seller}</b> · Qty {listing.quantity}{item.contraband ? " · CONTRABAND" : ""}</small>
                </div>
                <div className="auction-listing-action">
                  <strong>{money(listing.price)} ea.</strong><small>{money(total)} total</small>
                  {mine ? <Button onClick={() => g.cancelAuctionListing(listing.id)}>Cancel Listing</Button> : <Button disabled={g.gameState.cash < total} onClick={() => g.buyAuctionListing(listing.id)}>{g.gameState.cash < total ? "Not Enough Cash" : "Buy Listing"}</Button>}
                </div>
              </article>
            );
          })}
        </div>
        {listings.length>visibleListings.length&&<p className="status-text">Showing {visibleListings.length} of {listings.length} matching listings. Search to narrow the exchange.</p>}
      </Panel>

      <Panel title="Sell Inventory · BETA TEST MODE">
        <div className="beta-market-callout"><strong>🤖 NPC AUTO-BUY ENABLED</strong><span>Temporary beta economy boost: the broker instantly buys inventory at 150% of normal sell value so you can fund and test the rest of RiftCity quickly.</span></div>
        <div className="auction-create-grid">
          <label><span>Item to sell</span><select value={sellItemId} onChange={(e)=>{setSellItemId(e.target.value);setSellQuantity("1");}}><option value="">Choose an owned item</option>{ownListable.map((item)=><option key={item.id} value={item.id}>{item.name} ({g.gameState.inventory[item.id]})</option>)}</select></label>
          <label><span>Quantity</span><input type="number" min="1" max={Math.max(1,sellOwned)} value={sellQuantity} onChange={(e)=>setSellQuantity(e.target.value)} /></label>
          <div className="beta-sell-payout"><span>Instant payout</span><strong>{sellItemId ? money(sellTotal) : "—"}</strong><small>{sellItemId ? `${money(sellUnitPrice)} each` : "Select an item"}</small></div>
        </div>
        <div className="data-list">
          <div className="data-row"><span>Owned</span><b>{sellOwned}</b></div>
          <div className="data-row"><span>Normal sell value</span><b>{sellItemId ? money(sellReference) : "—"}</b></div>
          <div className="data-row"><span>Beta NPC bonus</span><b>+50%</b></div>
          <div className="data-row"><span>Listing fee</span><b>None for Quick Sell</b></div>
        </div>
        <div className="btn-group"><Button disabled={!sellItemId || sellOwned < sellQty} onClick={()=>g.betaQuickSellBlackMarket(sellItemId,sellQty)}>{sellItemId ? `Sell ${sellQty} Now to NPC` : "Choose an Item"}</Button>{sellItemId&&sellOwned>1&&<Button onClick={()=>setSellQuantity(String(sellOwned))}>Sell All</Button>}</div>
      </Panel>

      <Panel title="Crime Tools · One Attempt Each">
        <p>Optional consumables improve selected crime odds, rewards, escape chance, or Heat. Each tool is consumed when the crime attempt begins.</p>
        <div className="service-item-grid">
          {CRIME_TOOLS.map(tool=><div className="service-item" key={tool.id}><div><b>{tool.icon} {tool.name}</b><small>{tool.description}</small><small>Recommended: {tool.recommendedFor.map(x=>x.replace(/-/g," ")).join(", ")}</small></div><div><b>{money(tool.price)}</b><small>Owned {g.gameState.inventory[tool.id]||0}</small><Button disabled={g.gameState.cash<tool.price} onClick={()=>g.buyBlackMarketItem(tool.id)}>Buy</Button></div></div>)}
        </div>
      </Panel>

      <Panel title="Production Supplies · BETA">
        <p>These are fictional abstract game resources, not real-world manufacturing ingredients.</p>
        <div className="service-item-grid">{PRODUCTION_SUPPLIES.map(supply=><div className="service-item" key={supply.id}><div><b>{supply.name}</b><small>{supply.description}</small></div><div><b>{money(supply.price)}</b><small>Owned {g.gameState.inventory[supply.id]||0}</small><Button disabled={g.gameState.cash<supply.price} onClick={()=>g.buyBlackMarketItem(supply.id)}>Buy</Button></div></div>)}</div>
      </Panel>

      <Panel title="Contraband Production · BETA TEST BALANCE">
        <div className="production-warning"><strong>Temporary beta tuning</strong><span>Setup prices are cheap and timers are 30–75 seconds for testing. Production raises Heat and a separate Attention score; repeated batches can trigger a raid, seizure, charges, and jail.</span></div>
        <div className="production-facilities">
          {PRODUCTION_FACILITIES.map(f=>{const owned=g.gameState.productionFacilities.includes(f.id);const unlocked=g.gameState.crimeExperience>=f.requiredCrimeExperience;return <article className={`production-card ${owned?"owned":""}`} key={f.id}><span>{f.icon}</span><div><h3>{f.name}</h3><p>{f.description}</p><small>CE {f.requiredCrimeExperience} · {f.capacity} active slot{f.capacity===1?"":"s"} · Heat shielding {f.heatShield}</small></div><div><strong>{owned?"OWNED":money(f.setupCost)}</strong>{!owned&&<Button disabled={!unlocked||g.gameState.cash<f.setupCost} onClick={()=>g.buyProductionFacility(f.id)}>{!unlocked?`Needs CE ${f.requiredCrimeExperience}`:"Set Up"}</Button>}</div></article>})}
        </div>

        <div className="production-recipes">
          {PRODUCTION_RECIPES.map(r=>{const product=ITEMS.find(i=>i.id===r.productId);const capable=canFacilityRun(g.gameState.productionFacilities,r.facilityId);const unlocked=g.gameState.crimeExperience>=r.requiredCrimeExperience;const hasInputs=Object.entries(r.inputs).every(([id,n])=>(g.gameState.inventory[id]||0)>=n);return <article className="production-card recipe" key={r.id}><div><h3>{r.name}</h3><p>{r.description}</p><small>{Object.entries(r.inputs).map(([id,n])=>`${n}× ${ITEMS.find(i=>i.id===id)?.name??id}`).join(" · ")}</small><small>Output {r.output}× {product?.name} · {Math.round(r.durationMs/1000)}s · +{r.heat} base Heat · +{r.attention} Attention</small></div><Button disabled={!capable||!unlocked||!hasInputs} onClick={()=>g.startProduction(r.id)}>{!unlocked?`Needs CE ${r.requiredCrimeExperience}`:!capable?"Need Better Setup":!hasInputs?"Missing Supplies":"Start Batch"}</Button></article>})}
        </div>

        {g.gameState.activeProductions.length>0&&<div className="active-production-list"><h3>Active / Finished Batches</h3>{g.gameState.activeProductions.map(job=>{const recipe=PRODUCTION_RECIPES.find(r=>r.id===job.recipeId);const done=job.finishesAt<=now;return <div className="data-row" key={job.id}><span>{recipe?.name??job.recipeId}</span><b>{done?"Ready":formatTime(Math.ceil((job.finishesAt-now)/1000))}</b><Button disabled={!done} onClick={()=>g.claimProduction(job.id)}>{done?"Collect":"Cooking"}</Button></div>})}</div>}
        <div className="data-list"><div className="data-row"><span>Production Attention</span><b>{g.gameState.productionAttention}/100</b></div><div className="data-row"><span>Batches Started</span><b>{g.gameState.productionBatches}</b></div><div className="data-row"><span>Raids</span><b>{g.gameState.productionRaids}</b></div></div>
      </Panel>

      <Panel title="List for Sale · NPC AUTO-BUY BETA">
        <div className="beta-market-callout"><strong>FAST BETA LIQUIDITY</strong><span>Listings priced at or below the displayed NPC ceiling are purchased immediately. Higher prices stay on the exchange normally. This auto-buy behavior is beta-only.</span></div>
        <div className="auction-create-grid">
          <label><span>Item</span><select value={itemId} onChange={(e)=>{const id=e.target.value;setItemId(id);setQuantity("1");if(id)setPrice(String(betaNpcSuggestedListingPrice(id)));}}><option value="">Choose an item</option>{ownListable.map((item)=><option key={item.id} value={item.id}>{item.name} ({g.gameState.inventory[item.id]})</option>)}</select></label>
          <label><span>Quantity</span><input type="number" min="1" max={Math.max(1,selectedOwned)} value={quantity} onChange={(e)=>setQuantity(e.target.value)} /></label>
          <label><span>Price each</span><input type="number" min="1" value={price} onChange={(e)=>setPrice(e.target.value)} /></label>
        </div>
        <div className="data-list"><div className="data-row"><span>Owned</span><b>{selectedOwned}</b></div><div className="data-row"><span>Listing total</span><b>{money(unitPrice * qty)}</b></div><div className="data-row"><span>Listing fee</span><b>{money(Math.max(25,Math.floor(unitPrice*qty*.03)))}</b></div><div className="data-row"><span>Beta NPC auto-buy ceiling</span><b>{itemId ? `${money(autoBuyCeiling)} each` : "—"}</b></div><div className="data-row"><span>Buyer status</span><b>{!itemId ? "Choose an item" : unitPrice<=autoBuyCeiling ? "Instant NPC buyer ready" : "Above ceiling · stays listed"}</b></div></div>
        <div className="btn-group"><Button disabled={!itemId || selectedOwned < qty} onClick={() => g.createAuctionListing(itemId, unitPrice, qty)}>{itemId&&unitPrice<=autoBuyCeiling ? "List + Instant NPC Sale" : "Create Listing"}</Button><BackToCity g={g} /></div>
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

type CasinoGameId = "blackjack" | "poker" | "roulette" | "baccarat" | "craps" | "war" | "wheel" | "racing" | "reels";
type CasinoCard = { rank: string; suit: string; value: number };
type PokerStage = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
type PokerSeat = { name: string; npc: boolean; chips: number; bet: number; folded: boolean; cards: CasinoCard[]; action: string };
type Horse = { name: string; number: number; speed: number; stamina: number; form: number; consistency: number; style: string; icon: string };
type SlotMachine = { id: string; name: string; icon: string; subtitle: string; symbols: string[]; jackpot: string; reels: number; baseMult: number };

const CASINO_CHIP_CAP = 75;
const CASINO_NPCS = ["Maya Vale", "Vince Romano", "Juno Park", "Theo Knox", "Aria Stone", "Malik Reed"];
const POKER_SMALL_BLIND = 5;
const POKER_BIG_BLIND = 10;
const POKER_BUY_IN = 200;
const RACE_CYCLE_MS = 120_000;
const RACE_BETTING_MS = 75_000;
const RACE_RUNNING_MS = 35_000;

const SLOT_MACHINES: SlotMachine[] = [
  { id:"neon", name:"Neon Reels", icon:"⚡", subtitle:"5 reels · wild streaks", symbols:["⚡","◆","★","7","R","♛"], jackpot:"NEON JACKPOT", reels:5, baseMult:8 },
  { id:"vault", name:"Vault Breaker", icon:"💰", subtitle:"5 reels · vault bonus", symbols:["💰","🔐","💎","🪙","★","7"], jackpot:"VAULT OPEN", reels:5, baseMult:10 },
  { id:"gold", name:"Gold Rush Mine", icon:"⛏️", subtitle:"6 reels · gold collect · random jackpot", symbols:["⛏️","🪙","💰","💎","🧨","🚋","★"], jackpot:"MOTHERLODE", reels:6, baseMult:12 },
  { id:"midnight", name:"Midnight Drive", icon:"🏎️", subtitle:"5 reels · boost multiplier", symbols:["🏎️","🌙","💨","🏁","★","7"], jackpot:"NIGHT RUN", reels:5, baseMult:9 },
  { id:"rift", name:"Rift Reactor", icon:"🌀", subtitle:"6 reels · cascade-style chain bonus", symbols:["🌀","✦","⚛","◆","★","R"], jackpot:"RIFT SURGE", reels:6, baseMult:11 },
  { id:"crown", name:"Crown & Diamonds", icon:"👑", subtitle:"5 reels · premium symbol boosts", symbols:["👑","💎","♛","★","7","R"], jackpot:"ROYAL DROP", reels:5, baseMult:10 },
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
  const [betAmount, setBetAmount] = useState(25);
  const blackjackBetRef = useRef(0);
  const raceBetRef = useRef(0);
  const [playerHand, setPlayerHand] = useState<CasinoCard[]>([]);
  const [dealerHand, setDealerHand] = useState<CasinoCard[]>([]);
  const [blackjackDone, setBlackjackDone] = useState(true);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [slotMachineId, setSlotMachineId] = useState("neon");
  const [reels, setReels] = useState(["◆","★","7","R","⚡"]);
  const [tableResult,setTableResult]=useState("Choose a bet and play a round.");
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

  const rank = g.gameState.casinoReputation >= 120 ? "Rift Elite" : g.gameState.casinoReputation >= 60 ? "VIP" : g.gameState.casinoReputation >= 25 ? "Regular" : "Visitor";

  const recordGame = (label: string, outcome: "win" | "loss" | "draw", rep = 1) => {
    g.setGameState((prev) => {
      const win = outcome === "win";
      const streak = win ? prev.casinoCurrentStreak + 1 : 0;
      const next = {
        ...prev,
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

  const wager = Math.max(1, Math.floor(betAmount));
  const canPlay = g.gameState.cash >= wager;
  const takeWager = (amount = wager) => {
    if (amount <= 0 || g.gameState.cash < amount) return false;
    g.setGameState(prev => ({ ...prev, cash: prev.cash - amount }));
    return true;
  };
  const payCash = (amount:number) => g.setGameState(prev => ({ ...prev, cash: prev.cash + Math.max(0, Math.floor(amount)) }));

  const startBlackjack = () => {
    if (!canPlay || !takeWager() || !recordGame("Blackjack Hall", "draw", 1)) return;
    blackjackBetRef.current = wager;
    const deck=shuffledDeck();
    setPlayerHand([deck.pop()!, deck.pop()!]);
    setDealerHand([deck.pop()!, deck.pop()!]);
    setBlackjackDone(false);
    setMessage("Cards are on the felt. Hit or stand.");
  };
  const hitBlackjack = () => {
    if (blackjackDone) return;
    const next = [...playerHand, casinoCard()]; setPlayerHand(next);
    if (blackjackValue(next) > 21) { setBlackjackDone(true); recordGame("Blackjack Hall", "loss", 0); setMessage(`Bust — you lose ${money(blackjackBetRef.current)}.`); blackjackBetRef.current=0; }
  };
  const standBlackjack = () => {
    if (blackjackDone) return;
    const nextDealer = [...dealerHand]; while (blackjackValue(nextDealer) < 17) nextDealer.push(casinoCard());
    setDealerHand(nextDealer); const p = blackjackValue(playerHand), d = blackjackValue(nextDealer); setBlackjackDone(true);
    const stake=blackjackBetRef.current;
    if (d > 21 || p > d) { payCash(stake*2); recordGame("Blackjack Hall", "win", 2); setMessage(`You win ${money(stake)} profit.`); }
    else if (p === d) { payCash(stake); setMessage("Push — your wager is returned."); }
    else { recordGame("Blackjack Hall", "loss", 0); setMessage(`Dealer wins — you lose ${money(stake)}.`); }
    blackjackBetRef.current=0;
  };

  const appendPokerLog=(entry:string)=>setPokerLog(prev=>[entry,...prev].slice(0,8));
  const drawPoker=(count:number)=>Array.from({length:count},()=>pokerDeckRef.current.pop()!);

  const settlePoker=(seats:PokerSeat[], board:CasinoCard[], pot:number) => {
    const active=seats.filter(s=>!s.folded);
    if(active.length===1){
      const winner=active[0];
      const next=seats.map(s=>s.name===winner.name?{...s,chips:s.chips+pot,action:"WON POT"}:s);
      setPokerSeats(next); setPokerStage("showdown"); appendPokerLog(`${winner.name} wins ${pot} table chips uncontested.`);
      const you=next[0]; payCash(you.chips);
      if(!winner.npc) { setMessage(`You take the pot and cash out ${money(you.chips)}.`); g.setGameState(prev=>({...prev,casinoReputation:prev.casinoReputation+4,casinoWins:prev.casinoWins+1})); } else setMessage(`Hand over — you cash out ${money(you.chips)}.`);
      return;
    }
    const scored=active.map(s=>({seat:s,score:bestPokerHand([...s.cards,...board])}));
    let best=scored[0].score; scored.forEach(x=>{if(comparePokerScore(x.score,best)>0) best=x.score;});
    const winners=scored.filter(x=>comparePokerScore(x.score,best)===0);
    const share=Math.floor(pot/winners.length);
    setPokerSeats(seats.map(s=>winners.some(w=>w.seat.name===s.name)?{...s,chips:s.chips+share,action:`${best.name} · WON`}:s));
    setPokerStage("showdown");
    appendPokerLog(`${winners.map(w=>w.seat.name).join(" & ")} win with ${best.name}.`);
    const finalSeats=seats.map(s=>winners.some(w=>w.seat.name===s.name)?{...s,chips:s.chips+share,action:`${best.name} · WON`}:s);
    const you=finalSeats[0]; payCash(you.chips);
    if(winners.some(w=>!w.seat.npc)){ setMessage(`You win with ${best.name} and cash out ${money(you.chips)}.`); g.setGameState(prev=>({...prev,casinoReputation:prev.casinoReputation+5,casinoWins:prev.casinoWins+1})); }
    else setMessage(`${winners[0].seat.name} wins with ${best.name}. You cash out ${money(you.chips)}.`);
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
    if(g.gameState.cash<POKER_BUY_IN||!takeWager(POKER_BUY_IN)||!recordGame("Poker Room","draw",2)) return;
    const nextDealer=(dealerIndex+1)%5;
    setDealerIndex(nextDealer);
    const deck=shuffledDeck(); pokerDeckRef.current=deck;
    const names=["You",...CASINO_NPCS.slice(0,4)];
    let seats=names.map((name,i)=>({name,npc:i!==0,chips:POKER_BUY_IN,bet:0,folded:false,cards:[deck.pop()!,deck.pop()!],action:"WAITING"}));
    const sb=(nextDealer+1)%seats.length, bb=(nextDealer+2)%seats.length;
    seats=seats.map((s,i)=>i===sb?{...s,chips:s.chips-POKER_SMALL_BLIND,bet:POKER_SMALL_BLIND,action:`SB ${POKER_SMALL_BLIND}`}:i===bb?{...s,chips:s.chips-POKER_BIG_BLIND,bet:POKER_BIG_BLIND,action:`BB ${POKER_BIG_BLIND}`}:s);
    setPokerSeats(seats); setCommunity([]); setPokerPot(POKER_SMALL_BLIND+POKER_BIG_BLIND); setPokerCurrentBet(POKER_BIG_BLIND); setPokerStage("preflop"); setPokerLog([`Blinds posted ${POKER_SMALL_BLIND}/${POKER_BIG_BLIND}.`,`Dealer: ${seats[nextDealer].name}`]); setMessage(`Texas Hold'em hand started with a ${money(POKER_BUY_IN)} cash buy-in.`);
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
    if (!canPlay || wheelSpinning || !takeWager() || !recordGame("Rift Wheel", "draw", 1)) return;
    const stake=wager;
    setWheelSpinning(true); setWheelResult(null); setMessage("The Rift Wheel is spinning…");
    window.setTimeout(()=>{
      const segments = ["RIFT STAR 5X","BLUE SECTOR 2X","GOLD SECTOR 3X","HOUSE","DOUBLE STAR 4X","HOUSE"];
      const result = segments[Math.floor(Math.random()*segments.length)]; setWheelResult(result); setWheelSpinning(false);
      const mult = result.includes("5X")?5:result.includes("4X")?4:result.includes("3X")?3:result.includes("2X")?2:0;
      if (mult) { payCash(stake*mult); recordGame("Rift Wheel","win",2); } else recordGame("Rift Wheel","loss",0);
      setMessage(mult?`Wheel result: ${result}. Paid ${money(stake*mult)}.`:`Wheel result: ${result}. House takes ${money(stake)}.`);
    },1800);
  };

  const playRoulette = (pick:"red"|"black"|"green") => {
    if(!canPlay||!takeWager()) return;
    const roll=Math.floor(Math.random()*37); const color=roll===0?"green":roll%2===0?"red":"black"; const mult=pick==="green"?36:2;
    if(color===pick){payCash(wager*mult);recordGame("Roulette","win",2);setTableResult(`${roll} ${color.toUpperCase()} — paid ${money(wager*mult)}.`);} else {recordGame("Roulette","loss",0);setTableResult(`${roll} ${color.toUpperCase()} — ${money(wager)} lost.`);}
  };
  const playBaccarat = (pick:"player"|"banker"|"tie") => {
    if(!canPlay||!takeWager()) return;
    const p=Math.floor(Math.random()*10), b=Math.floor(Math.random()*10); const result=p===b?"tie":p>b?"player":"banker"; const mult=pick==="tie"?9:2;
    if(result===pick){payCash(wager*mult);recordGame("Baccarat","win",2);} else recordGame("Baccarat","loss",0);
    setTableResult(`Player ${p} · Banker ${b} · ${result.toUpperCase()}${result===pick?` — paid ${money(wager*mult)}`:""}.`);
  };
  const playCraps = (pick:"pass"|"field") => {
    if(!canPlay||!takeWager()) return;
    const a=1+Math.floor(Math.random()*6), b=1+Math.floor(Math.random()*6), total=a+b; const win=pick==="pass"?[7,11].includes(total):[2,3,4,9,10,11,12].includes(total); const mult=pick==="field"&&[2,12].includes(total)?3:2;
    if(win){payCash(wager*mult);recordGame("Craps","win",2);} else recordGame("Craps","loss",0); setTableResult(`Dice ${a} + ${b} = ${total}${win?` — paid ${money(wager*mult)}`:` — ${money(wager)} lost`}.`);
  };
  const playWar = () => {
    if(!canPlay||!takeWager()) return; const deck=shuffledDeck(); const you=deck.pop()!, dealer=deck.pop()!; const win=you.value>dealer.value, tie=you.value===dealer.value;
    if(win){payCash(wager*2);recordGame("Casino War","win",1);} else if(tie){payCash(wager);recordGame("Casino War","draw",1);} else recordGame("Casino War","loss",0); setTableResult(`You ${you.rank}${you.suit} · Dealer ${dealer.rank}${dealer.suit} — ${win?"YOU WIN":tie?"TIE":"DEALER WINS"}.`);
  };

  const activeMachine=SLOT_MACHINES.find(m=>m.id===slotMachineId) || SLOT_MACHINES[0];
  const spinReels = () => {
    if (!canPlay || reelsSpinning || !takeWager() || !recordGame(activeMachine.name, "draw", 1)) return;
    const stake=wager; const contribution=Math.max(1,Math.floor(stake*.02));
    g.setGameState(prev=>({...prev,casinoJackpotPool:prev.casinoJackpotPool+contribution}));
    setReelsSpinning(true); setMessage(`${activeMachine.name} reels are spinning…`);
    let ticks=0;
    const id=window.setInterval(()=>{ setReels(Array.from({length:activeMachine.reels},()=>activeMachine.symbols[Math.floor(Math.random()*activeMachine.symbols.length)])); ticks+=1; if(ticks>=14){window.clearInterval(id); const next=Array.from({length:activeMachine.reels},()=>activeMachine.symbols[Math.floor(Math.random()*activeMachine.symbols.length)]); setReels(next);
      const counts=next.reduce<Record<string,number>>((acc,x)=>(acc[x]=(acc[x]||0)+1,acc),{}); const best=Math.max(...Object.values(counts)); const jackpotHit=Math.random()<0.0025;
      if(jackpotHit){ const jackpot=Math.max(10000,g.gameState.casinoJackpotPool); payCash(jackpot); g.setGameState(prev=>({...prev,casinoJackpotPool:25000})); recordGame(activeMachine.name,"win",8); setMessage(`${activeMachine.jackpot}! RANDOM JACKPOT — paid ${money(jackpot)}!`); }
      else if(best>=4){ const mult=activeMachine.baseMult+(best-activeMachine.reels+1)*4; payCash(stake*mult); recordGame(activeMachine.name,"win",3); setMessage(`${best} matching symbols — paid ${money(stake*mult)}.`); }
      else if(best>=3){ payCash(stake*3); recordGame(activeMachine.name,"win",2); setMessage(`3-symbol hit — paid ${money(stake*3)}.`); }
      else {recordGame(activeMachine.name,"loss",0);setMessage(`Reels stop — ${money(stake)} lost.`);} setReelsSpinning(false);}},70);
  };

  const lockRacePrediction=()=>{
    if(racePhase!=="betting"||raceLockedId===raceId||!canPlay||!takeWager()||!recordGame("Rift Downs Bet","draw",1)) return;
    raceBetRef.current=wager;
    setRaceLockedId(raceId); setMessage(`Prediction locked: ${raceHorses[racePick]?.name}. Race starts automatically.`);
  };

  useEffect(()=>{
    if(racePhase!=="results"||raceLockedId!==raceId||settledRaces.current.has(raceId)) return;
    settledRaces.current.add(raceId);
    const winner=orderedFinish[0]; const hit=winner.number-1===racePick;
    const stake=raceBetRef.current;
    if(hit) { payCash(stake*5); recordGame("Rift Downs Bet","win",3); } else recordGame("Rift Downs Bet","loss",0);
    setMessage(hit?`${winner.name} wins — paid ${money(stake*5)}!`:`${winner.name} wins race #${raceId%1000}. You lose ${money(stake)}.`);
    raceBetRef.current=0;
  },[racePhase,raceId,raceLockedId,racePick,orderedFinish]);

  const raceCountdown = racePhase==="betting" ? RACE_BETTING_MS-raceMs : racePhase==="running" ? RACE_BETTING_MS+RACE_RUNNING_MS-raceMs : RACE_CYCLE_MS-raceMs;

  return (
    <div className="city-service-page casino-v4">
      <section className="casino-hero casino-animated-lobby">
        <div className="casino-hero-glow"/><div className="casino-light-beam beam-a"/><div className="casino-light-beam beam-b"/>
        <div className="casino-brand"><span>✦</span><div><small>RIFTCITY ENTERTAINMENT DISTRICT</small><h2>THE RIFT CASINO</h2><p>Animated tables, live race schedules, NPC regulars, cash wagering, jackpots, and casino games.</p></div></div>
        <div className="casino-live-ticker"><span>LIVE</span><b>Rift Downs race #{raceId%1000}</b><small>{racePhase.toUpperCase()} · {formatTime(raceCountdown)}</small><i/> <b>Poker Room</b><small>NPC tables active</small><i/> <b>{activeMachine.name}</b><small>Featured machine</small></div>
        <div className="casino-metrics">
          <div><span>Cash</span><strong>{money(g.gameState.cash)}</strong><small>Available bankroll</small></div>
          <div><span>Casino Rank</span><strong>{rank}</strong><small>{g.gameState.casinoReputation} reputation</small></div>
          <div><span>Record</span><strong>{g.gameState.casinoWins}/{g.gameState.casinoGamesPlayed}</strong><small>Best streak {g.gameState.casinoBestStreak}</small></div>
        </div>
        <div className="casino-limit-note">No play timer or cooldown. Casino wagers use RiftCity cash. Bonus casino chips are capped at {CASINO_CHIP_CAP}; current chips: {Math.min(CASINO_CHIP_CAP,g.gameState.casinoChips)}.</div>
      </section>

      <div className="casino-floor-grid">
        {[
          ["blackjack","🂡","Blackjack Hall","Dealer Elena · animated felt table","PLAYABLE TABLE"],
          ["poker","♠","Texas Hold'em Room","5-seat Hold'em · NPCs fill open seats","REAL POKER"],
          ["roulette","🔴","Roulette Room","Red · black · green zero","TABLE GAME"],
          ["baccarat","🃏","Baccarat Salon","Player · banker · tie","TABLE GAME"],
          ["craps","🎲","Craps Pit","Pass line and field bets","TABLE GAME"],
          ["war","⚔️","Casino War","Fast high-card table","TABLE GAME"],
          ["wheel","◉","Rift Wheel","Animated wheel · cash multipliers","ARCADE FLOOR"],
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
        <div className={`casino-game-modal casino-game-${game}`}><div className="casino-wager-bar"><label>Cash wager</label><input type="number" min="1" max={Math.max(1,g.gameState.cash)} value={betAmount} onChange={e=>setBetAmount(Math.max(1,Number(e.target.value)||1))}/><b>{money(wager)}</b></div>
          <button type="button" className="casino-game-close" onClick={()=>setGame(null)}>×</button>
          <div className="casino-game-heading"><span>{game==="blackjack"?"🂡":game==="poker"?"♠":game==="roulette"?"🔴":game==="baccarat"?"🃏":game==="craps"?"🎲":game==="war"?"⚔️":game==="wheel"?"◉":game==="racing"?"🏇":"🎰"}</span><div><small>THE RIFT CASINO</small><h3>{game==="blackjack"?"Blackjack Hall":game==="poker"?"Texas Hold'em":game==="roulette"?"Roulette":game==="baccarat"?"Baccarat":game==="craps"?"Craps":game==="war"?"Casino War":game==="wheel"?"Rift Wheel":game==="racing"?"Rift Downs":"Slots Gallery"}</h3></div><b>{money(g.gameState.cash)} cash</b></div>

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
              <div className="poker-pot"><small>POT</small><b>{pokerPot}</b><span>TABLE CHIPS</span></div>
              {(pokerSeats.length?pokerSeats:["You",...CASINO_NPCS.slice(0,4)].map((name,i)=>({name,npc:i!==0,chips:POKER_BUY_IN,bet:0,folded:false,cards:[],action:"WAITING"}))).map((seat,i)=>{
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
              <Button disabled={g.gameState.cash<POKER_BUY_IN||!["waiting","showdown"].includes(pokerStage)} onClick={startPoker}>Deal Hold'em Hand</Button>
              <Button disabled={!pokerSeats.length||!["preflop","flop","turn","river"].includes(pokerStage)} onClick={()=>pokerPlayerAction("checkcall")}>{pokerSeats[0]&&pokerSeats[0].bet<pokerCurrentBet?`Call ${Math.max(0,pokerCurrentBet-pokerSeats[0].bet)}`:"Check"}</Button>
              <Button disabled={!pokerSeats.length||!["preflop","flop","turn","river"].includes(pokerStage)} onClick={()=>pokerPlayerAction("raise")}>Raise +40</Button>
              <Button disabled={!pokerSeats.length||!["preflop","flop","turn","river"].includes(pokerStage)} onClick={()=>pokerPlayerAction("fold")}>Fold</Button>
            </div>
            <div className="poker-action-log">{pokerLog.map((entry,i)=><span key={i}>{entry}</span>)}</div>
            <p className="casino-fair-note">Texas Hold'em uses a {money(POKER_BUY_IN)} cash buy-in. Table chips represent that hand's bankroll and cash back out when the hand ends.</p>
          </div>}

          {game==="roulette" && <div className="casino-table-game animated-felt"><div className="roulette-display"><span>0</span><span>RED</span><span>BLACK</span></div><div className="btn-group"><Button disabled={!canPlay} onClick={()=>playRoulette("red")}>Bet Red</Button><Button disabled={!canPlay} onClick={()=>playRoulette("black")}>Bet Black</Button><Button disabled={!canPlay} onClick={()=>playRoulette("green")}>Bet Green 0</Button></div><strong>{tableResult}</strong></div>}
          {game==="baccarat" && <div className="casino-table-game animated-felt"><div className="table-big-label">BACCARAT</div><div className="btn-group"><Button disabled={!canPlay} onClick={()=>playBaccarat("player")}>Player</Button><Button disabled={!canPlay} onClick={()=>playBaccarat("banker")}>Banker</Button><Button disabled={!canPlay} onClick={()=>playBaccarat("tie")}>Tie</Button></div><strong>{tableResult}</strong></div>}
          {game==="craps" && <div className="casino-table-game animated-felt"><div className="dice-stage">🎲 🎲</div><div className="btn-group"><Button disabled={!canPlay} onClick={()=>playCraps("pass")}>Pass Line</Button><Button disabled={!canPlay} onClick={()=>playCraps("field")}>Field</Button></div><strong>{tableResult}</strong></div>}
          {game==="war" && <div className="casino-table-game animated-felt"><div className="table-big-label">CASINO WAR</div><Button disabled={!canPlay} onClick={playWar}>Deal Cards</Button><strong>{tableResult}</strong></div>}

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
            <div className="slot-machine-tabs">{SLOT_MACHINES.map(m=><button type="button" key={m.id} className={slotMachineId===m.id?"active":""} onClick={()=>{setSlotMachineId(m.id);setReels(Array.from({length:m.reels},(_,i)=>m.symbols[i%m.symbols.length]));}}><span>{m.icon}</span><b>{m.name}</b><small>{m.subtitle}</small></button>)}</div>
            <div className={`slot-cabinet theme-${activeMachine.id} ${reelsSpinning?"spinning":""}`}><div className="slot-marquee"><span>{activeMachine.icon}</span><b>{activeMachine.name}</b><small>{activeMachine.jackpot} · Pool {money(g.gameState.casinoJackpotPool)}</small></div><div className="slot-lights">{Array.from({length:18},(_,i)=><i key={i}/>)}</div><div className={`neon-reels reels-${activeMachine.reels}`}>{reels.map((r,i)=><span className={`reel reel-${i}`} key={i}>{r}</span>)}</div><div className="slot-payline">★ PAYLINE ★</div><Button disabled={!canPlay||reelsSpinning} onClick={spinReels}>{reelsSpinning?"SPINNING…":"Spin Machine"}</Button></div>
            <p className="casino-fair-note">5- and 6-reel machines use RiftCity cash, matching-symbol payouts, and a rare random progressive-style jackpot funded by slot wagers.</p>
          </div>}
          <p className="casino-game-message">{message}</p>
        </div>
      </div>}
    </div>
  );
}

export function Nightclub({ g }: { g: Game }) {
  const [message,setMessage]=useState("The doors are open and the main floor is packed.");
  const rank=g.gameState.nightclubReputation>=120?"Headliner":g.gameState.nightclubReputation>=60?"VIP":g.gameState.nightclubReputation>=25?"Regular":"Guest";
  const action=(kind:"dance"|"dj"|"lounge")=>g.setGameState(prev=>{
    const cost=kind==="dance"?2:kind==="dj"?4:1; if(prev.energy<cost) return prev;
    const rep=kind==="dj"?4:kind==="dance"?2:1; const happy=kind==="dj"?8:kind==="dance"?6:3;
    const next={...prev,energy:prev.energy-cost,happiness:Math.min(g.maxHappiness,prev.happiness+happy),nightclubReputation:prev.nightclubReputation+rep,nightclubVisits:prev.nightclubVisits+1};
    return g.appendActivity(next,`Pulse Nightclub: ${kind==="dj"?"guest DJ set":kind==="dance"?"dance floor session":"VIP lounge visit"}.`,`system`);
  });
  return <div className="city-service-page nightclub-v1"><section className="nightclub-hero"><div className="club-lasers"/><small>ENTERTAINMENT DISTRICT</small><h2>PULSE</h2><p>Music, dancing, social events, reputation, and VIP progression.</p><div className="club-metrics"><span>Rank <b>{rank}</b></span><span>Rep <b>{g.gameState.nightclubReputation}</b></span><span>Visits <b>{g.gameState.nightclubVisits}</b></span></div></section><div className="nightclub-floor-grid"><button onClick={()=>{action("dance");setMessage("You hit the dance floor and build your nightlife rep.");}}><span>💃</span><b>Main Dance Floor</b><small>2 energy · +2 rep · happiness</small></button><button onClick={()=>{action("dj");setMessage("Your guest DJ set gets the room moving.");}}><span>🎧</span><b>Guest DJ Booth</b><small>4 energy · +4 rep · bigger happiness boost</small></button><button onClick={()=>{action("lounge");setMessage("You network in the lounge and meet new regulars.");}}><span>✨</span><b>Social Lounge</b><small>1 energy · +1 rep · social progression</small></button><div className={`club-vip-card ${g.gameState.nightclubReputation>=60?"open":"locked"}`}><span>👑</span><b>VIP Mezzanine</b><small>{g.gameState.nightclubReputation>=60?"Unlocked — premium social events":"Unlocks at 60 reputation"}</small></div></div><Panel title="Tonight at Pulse"><div className="club-event-line"><span>21:00</span><b>Neon City Set</b><small>Resident DJ rotation</small></div><div className="club-event-line"><span>23:00</span><b>Rift Lights</b><small>Animated floor event</small></div><div className="club-event-line"><span>01:00</span><b>After Hours Mix</b><small>High-rep social event</small></div><p>{message}</p><BackToCity g={g}/></Panel></div>;
}

export function Airport({ g }: { g: Game }) {
  return <div className="city-service-page"><Panel title="RiftCity International Airport"><div className="service-hero"><span>✈️</span><div><h2>Departures</h2><p>The terminal is operational; inter-city destinations are not unlocked yet.</p></div></div><div className="data-list"><div className="data-row"><span>Current location</span><b>{g.gameState.currentLocation}</b></div><div className="data-row"><span>Travel status</span><b>{g.travelLocked ? "Cooldown active" : "Ready"}</b></div></div><BackToCity g={g} /></Panel></div>;
}
