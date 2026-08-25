import { escapeHtml, panel } from '../ui/helpers.js';

const SECTIONS = [
  ['Getting Started','RiftCity is a server-authoritative browser MMO. Your account, player resources, inventory, location, progression and timed states are stored in D1. The browser requests actions and renders results; it does not choose rewards or outcomes.'],
  ['Resources','Health controls combat readiness. Energy powers gym, jobs and combat. Nerve powers crimes. Cash on hand is separate from checking and savings. Level and XP unlock advanced systems.'],
  ['Crimes','Crime definitions live in plugins. Every attempt spends nerve and is resolved by the Worker. Mastery, tools, cash, XP, item drops and jail/hospital consequences are persisted server-side.'],
  ['Combat','Combat uses Strength, Defense, Speed and Dexterity plus equipped weapon stats. NPC and asynchronous player encounters consume energy, create combat history, grant XP and can cause hospitalization.'],
  ['Inventory','Items are registry-driven. Consumables can restore resources, equipment can be equipped, tradeable items can move through shops and the player Exchange, and production outputs enter the same inventory.'],
  ['Gym','Forge Athletics uses training programs instead of copied gym tiers. Programs unlock with gym XP and apply different multipliers to Strength, Defense, Speed and Dexterity. Education and city events can change gains.'],
  ['Jobs','Careers have companies, role ladders, energy costs, skill XP and promotions. Work shifts pay server-calculated cash and contribute to shared mission/challenge progression.'],
  ['Education','Courses cost cash, require levels and finish on server timers. Completed courses feed real modifiers into crime, gym and combat systems.'],
  ['Properties','Residences can be purchased and set as your active home. Home bonuses affect real player limits. Higher properties can also generate passive income with upkeep.'],
  ['Bank','Rift National Bank provides checking, savings, a transaction ledger and risk-based investment products. Offshore transfers require travel to supported destinations.'],
  ['Markets','The city market contains fictional assets with server-generated prices. World events can change volatility. Holdings and average cost are persistent.'],
  ['Black Market','The Exchange is the player auction house. Listing an item removes it from inventory, purchases are reserved server-side, and cancelling a listing returns the item.'],
  ['Production','Production facilities provide concurrent slots and timed recipes. The server charges costs, checks required inputs, tracks completion, and grants outputs when claimed.'],
  ['Factions','Players can join a city faction, build reputation, earn faction points and progress through ranks. Faction work feeds shared progression.'],
  ['Missions & Challenges','Missions, achievements and rotating daily/weekly challenges reuse shared progression counters instead of maintaining disconnected client progress.'],
  ['Travel','International travel has fares, level gates and arrival timers. Travel state blocks incompatible actions until the server settles arrival. Some destinations unlock offshore banking.'],
  ['Jail & Hospital','Crime and combat consequences can apply persistent blocking statuses. Recovery/sentence timers are server-owned and clear automatically when expired.'],
  ['World Events','Rotating city events modify selected systems such as crime, gym, jobs, markets and combat. The active event is visible in the HUD effects strip.'],
  ['Casino','The Meridian currently has a persistent in-game chip account and 75-chip daily grant. Individual game engines remain locked until their server-authoritative implementations are added.']
];

export async function renderWiki(root) {
  root.innerHTML=`
    <section class="service-hero"><div><span class="eyebrow">RIFTCITY FIELD MANUAL</span><h2>Game Systems</h2><p>A player-facing reference for the current V2 architecture and mechanics.</p></div><div class="service-kpis"><div><span>SECTIONS</span><strong>${SECTIONS.length}</strong></div></div></section>
    <div class="wiki-layout">
      <nav class="wiki-toc">${SECTIONS.map(([title],i)=>`<a href="#wiki-section-${i}" data-wiki-jump="${i}">${escapeHtml(title)}</a>`).join('')}</nav>
      <div class="wiki-pages">${SECTIONS.map(([title,text],i)=>`<section id="wiki-section-${i}" class="rc-panel wiki-section"><span class="eyebrow">FIELD MANUAL ${String(i+1).padStart(2,'0')}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></section>`).join('')}</div>
    </div>`;
  root.querySelectorAll('[data-wiki-jump]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();root.querySelector(`#wiki-section-${a.dataset.wikiJump}`)?.scrollIntoView({behavior:'smooth',block:'start'});}));
}
