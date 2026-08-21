import React, { useMemo, useState } from "react";
import type { RiftCityGame } from "../pages/types";
import { GameIcon, type GameIconName } from "../components/GameIcon";
import { money, formatTime } from "../core/gameCore";
import { CRIMES } from "../systems/crimeSystem";
import { CRIME_TOOLS } from "../systems/crimeTools";
import { CRIME_FAMILY_LABELS, CRIME_OPERATIONS, GRAFFITI_SPOTS } from "../systems/crimeActivities";
import { DEFAULT_WEAPONS, WEAPON_SKILL_LABELS } from "../systems/combat/combatWeapons";
import { TRAINING_PROGRAMS } from "../systems/gymSystem";
import { JOBS } from "../data/jobs";
import { PROPERTIES } from "../data/properties";
import { EDUCATION } from "../data/education";
import { MISSIONS } from "../data/missions";
import { BANK_INVESTMENT_TIERS } from "../data/banking";
import { OFFSHORE_TIERS } from "../data/wealthRisk";
import { PRODUCTION_FACILITIES, PRODUCTION_RECIPES } from "../systems/contrabandSystem";
import { WORLD_EVENTS, MERIT_UPGRADES, PROPERTY_UPGRADES, FACTIONS, DAILY_CHALLENGES, WEEKLY_CHALLENGES } from "../data/expansion";
import { BLACK_MARKET_STATS, BETA_NPC_AUTO_BUY_MAX_MULTIPLIER, BETA_NPC_QUICK_SELL_MULTIPLIER } from "../systems/auctionSystem";
import { ITEMS } from "../data/items";

type WikiArticle = {
  id: string;
  title: string;
  category: string;
  icon: GameIconName;
  keywords: string;
  summary: string;
  content: React.ReactNode;
};

function WikiTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="wiki-table-wrap">
      <table className="wiki-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Facts({ children }: { children: React.ReactNode }) {
  return <div className="wiki-facts">{children}</div>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span>{label}</span><strong>{children}</strong></div>;
}

export function Wiki({ g }: { g: RiftCityGame }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const articles = useMemo<WikiArticle[]>(() => [
    {
      id: "getting-started",
      title: "Getting Started & Core Loop",
      category: "Basics",
      icon: "city",
      keywords: "start beginner loop money level xp resources city beta",
      summary: "How RiftCity fits together and what your character is trying to build over time.",
      content: <>
        <p>RiftCity is an MMO-style crime/economy RPG built around persistent character progression. You earn money through legal work, crimes, combat, trading, casino play, property rent and other systems, then decide how much of that wealth to risk, protect or reinvest.</p>
        <p>The current build is a local beta simulation. Systems such as the Black Market and opponents already use multiplayer-shaped data, but simulated NPC activity stands in for a live population while features are tested.</p>
        <Facts>
          <Fact label="Level">Driven by total XP</Fact>
          <Fact label="Character growth">Stats, weapon skills, crime experience, gym experience, job skills, education and merits</Fact>
          <Fact label="Economic idea">More profitable systems generally carry more risk, fees, locks or time commitments</Fact>
          <Fact label="Current save">Stored locally in the browser during beta</Fact>
        </Facts>
      </>,
    },
    {
      id: "resources",
      title: "Resources, Stats & Heat",
      category: "Basics",
      icon: "progression",
      keywords: "health energy nerve happiness heat strength defense speed dexterity cash bank points merits stats",
      summary: "The numbers shown in the top character header and what they affect.",
      content: <>
        <p><b>Health</b> is your survivability. <b>Energy</b> powers gym activity. <b>Nerve</b> is spent on crimes. <b>Happiness</b> affects training quality. Health, Energy, Nerve and Happiness regenerate through the game clock and can be influenced by properties or consumables.</p>
        <p><b>Strength</b> improves physical damage, <b>Defense</b> reduces incoming damage, <b>Speed</b> contributes to combat pace/evasion, and <b>Dexterity</b> contributes heavily to weapon control and accuracy.</p>
        <p><b>Heat</b> represents law-enforcement attention. Crimes, production and certain risky outcomes raise it. High Heat can make illegal activity more dangerous and interacts with raids, enforcement and crime outcomes.</p>
        <Facts>
          <Fact label="Cash">Carried money; highly accessible and exposed to losses</Fact>
          <Fact label="Bank">Domestic stored money with its own risk/protection rules</Fact>
          <Fact label="Points">Special progression/reward currency</Fact>
          <Fact label="Merits">Permanent upgrade currency</Fact>
        </Facts>
      </>,
    },
    {
      id: "effects",
      title: "Effects & Timed Statuses",
      category: "Basics",
      icon: "spark",
      keywords: "effects status buff debuff timer jail hospital freeze offshore protection travel production world event",
      summary: "The Effects strip under the player header shows important active conditions in one place.",
      content: <>
        <p>The top Effects strip is the quick reference for temporary conditions that can change what you are able to do. It updates every second and shows remaining time when a condition expires on a timer.</p>
        <p>Current displayed effects include jail time, hospitalization, domestic bank freezes, offshore breach protection, travel cooldowns, active world events, running production batches and Production Attention.</p>
        <p>Instant resource changes are not shown as timed effects because they resolve immediately. Future multiplayer buffs/debuffs can plug into this same presentation layer.</p>
      </>,
    },
    {
      id: "city-travel",
      title: "City, Locations & Travel",
      category: "World",
      icon: "pin",
      keywords: "city map location travel airport downtown hospital police park market district cooldown",
      summary: "How the city map, locations and travel restrictions work.",
      content: <>
        <p>The City page is RiftCity's main navigation map. Visiting locations changes your current location and can unlock location-specific systems or bonuses. Travel can create a cooldown, which is shown in the Effects strip while active.</p>
        <p>The Airport currently exists as an operational city destination, but international destination gameplay is still marked as a future expansion in this build. Offshore accounts are currently managed from the Bank; an airport-first offshore-opening flow is not yet enforced by the current code.</p>
        <p>The City map itself is a dedicated custom map and is intentionally separate from the game's generic icon system.</p>
      </>,
    },
    {
      id: "crimes",
      title: "Crime System",
      category: "Crime",
      icon: "crimes",
      keywords: "crime nerve mastery heat arrest jail choices branching intel bounty loot odds success",
      summary: "Crime progression, choices, mastery, success odds, Heat and consequences.",
      content: <>
        <p>Crimes are split into different gameplay rhythms instead of forcing every activity through the same three-choice sequence. Pickpocketing, burglary and vehicle theft use rotating target boards with optional scouting. Retail theft, package swipes and cargo theft resolve as quick crimes. Major robberies/heists keep the live branching-event system because the decisions carry more weight there.</p>
        <p>Crime-family skills now progress separately: Street Theft, Burglary, Vehicle Crime, Fraud, Street Art and Organized Crime. Using a family improves that family over time. Street Reputation is a second progression track earned mainly through graffiti and successful criminal activity; it unlocks more visible graffiti spots and gives a small capped bonus to target work.</p>
        <p>Outcomes still include normal/critical success, being spooked and arrest. Heat, character stats, family skill, Street Rep, scouting, mastery, location and optional crime tools can all influence the final odds depending on the activity.</p>
        <WikiTable headers={["Legacy crime", "Crime XP", "Nerve", "Reward", "Risk"]} rows={CRIMES.map((crime) => [crime.name, crime.crimeExperienceRequired, crime.nerve, `${money(crime.minReward)}–${money(crime.maxReward)}`, crime.risk])} />
      </>,
    },
    {
      id: "crime-careers",
      title: "Crime Careers, Operations & Graffiti",
      category: "Crime",
      icon: "spray",
      keywords: "pickpocket scout burglary vehicle theft passive operations card skimming email fraud graffiti street reputation skill family",
      summary: "Rotating targets, passive criminal income, separate skill families and the Street Reputation graffiti ladder.",
      content: <>
        <p><b>Targets:</b> Pickpocketing, burglary and vehicle theft show rotating target boards. Scouting costs 1 Nerve, reveals the target's payout/Heat estimate and adds a success bonus. Targets disappear from the board after an attempt and the board rotates every five minutes.</p>
        <p><b>Operations:</b> Passive/semi-passive crimes consume setup cash and Nerve, then continue on a timer while you use other parts of the game. When finished, you collect the result. Higher matching skill reduces detection risk. These systems are deliberately abstract game mechanics rather than real-world procedures.</p>
        <p><b>Graffiti:</b> Graffiti is primarily a Street Reputation activity. Better-known players unlock more visible spots, while every successful tag trains Street Art skill, adds Heat and can add a small amount of faction visibility when the character belongs to a faction.</p>
        <WikiTable headers={["Crime family", "Role"]} rows={Object.entries(CRIME_FAMILY_LABELS).map(([id, label]) => [label, id === "fraud" ? "Passive fraud operations" : id === "street" ? "Graffiti / Street Rep" : id === "organized" ? "Major jobs and late-game operations" : "Target/quick-crime specialization"])} />
        <WikiTable headers={["Passive operation", "Crime XP", "Setup", "Timer", "Payout"]} rows={CRIME_OPERATIONS.map((operation) => [operation.name, operation.crimeExperienceRequired, money(operation.setupCost), formatTime(operation.durationMs), `${money(operation.minReward)}–${money(operation.maxReward)}`])} />
        <WikiTable headers={["Graffiti spot", "Street Rep", "Nerve", "Rep gain", "Heat"]} rows={GRAFFITI_SPOTS.map((spot) => [spot.name, spot.reputationRequired, spot.nerve, `+${spot.reputationGain}`, `+${spot.heat}`])} />
      </>,
    },
    {
      id: "crime-tools",
      title: "Recommended Crime Tools",
      category: "Crime",
      icon: "tools",
      keywords: "crime tool burner phone disguise gloves jammer badge escape route inside tip one use recommended",
      summary: "Optional one-use preparation items that modify a crime attempt.",
      content: <>
        <p>Crime tools are optional rather than hard requirements. The crime screen recommends tools that fit the selected operation. If you choose an owned tool, one unit is consumed when the attempt begins.</p>
        <WikiTable headers={["Tool", "Price", "Rarity", "Recommended for"]} rows={CRIME_TOOLS.map((tool) => [tool.name, money(tool.price), tool.rarity, tool.recommendedFor.join(", ")])} />
      </>,
    },
    {
      id: "combat",
      title: "Combat & PvP",
      category: "Combat",
      icon: "combat",
      keywords: "combat pvp turn based asynchronous mug cash attack weapon armor damage accuracy range cover animation",
      summary: "RiftCity combat stays turn-based/asynchronous while the client visually plays each resolved attack.",
      content: <>
        <p>Combat is designed around asynchronous turn-based PvP. A turn is resolved by the combat rules first, then the fight stage visually plays the attack, hit/miss reaction, damage and health change. It does not require both players to be online and reacting in real time.</p>
        <p>Weapon accuracy is intentionally not a flat guaranteed number. Base weapon handling is combined with weapon skill, Dexterity, the opponent, range and other combat conditions. Melee damage leans more heavily on Strength, while firearm effectiveness depends more on weapon handling and skill.</p>
        <p>Carried cash is part of PvP risk: mugging is intended to make keeping too much cash on hand dangerous. Armor and Defense reduce incoming damage.</p>
        <WikiTable headers={["Weapon", "Class", "Base dmg", "Base accuracy", "Best range"]} rows={DEFAULT_WEAPONS.map((weapon) => [weapon.name, WEAPON_SKILL_LABELS[weapon.weaponClass], weapon.baseDamage, `${weapon.accuracy}%`, weapon.optimalZone])} />
      </>,
    },
    {
      id: "weapon-skills",
      title: "Weapon Skills",
      category: "Combat",
      icon: "target",
      keywords: "weapon skills xp unarmed blades blunt handguns smgs shotguns rifles level 100",
      summary: "Persistent MMO-style proficiency for every major weapon family.",
      content: <>
        <p>Weapon skill is persistent progression. Using a weapon class earns skill XP; successful hits award more progress than misses. Skills use a slowing curve and cap at level 100, so specialization is meant to be long-term.</p>
        <Facts>{Object.values(WEAPON_SKILL_LABELS).map((label) => <Fact key={label} label={label}>Level 1–100 progression</Fact>)}</Facts>
      </>,
    },
    {
      id: "inventory",
      title: "Inventory, Equipment & Items",
      category: "Character",
      icon: "inventory",
      keywords: "inventory item equip weapon armor medical energy nerve loot rarity drop consumable",
      summary: "Where equipment, consumables, loot, crime tools and production supplies live.",
      content: <>
        <p>Inventory is shared across shops, combat, crimes and the Black Market. Weapons and armor can be equipped. Consumables can restore resources or trigger item-specific game outcomes. Crime tools and production supplies are consumed by their related systems.</p>
        <p>Rare loot can appear from crimes and other reward systems. Item rarity ranges from Common through Legendary. Selling the last copy of an equipped weapon or armor item automatically unequips it.</p>
        <Facts>
          <Fact label="Items in current catalog">{ITEMS.length}</Fact>
          <Fact label="Weapon slots">One equipped weapon</Fact>
          <Fact label="Armor slots">One equipped armor item</Fact>
          <Fact label="Loot">Can include cash-value collectibles, consumables and special items</Fact>
        </Facts>
      </>,
    },
    {
      id: "gym",
      title: "Gym & Stat Training",
      category: "Character",
      icon: "gym",
      keywords: "gym training strength defense speed dexterity happiness streak program energy",
      summary: "An adaptive training system built around programs and consistency rather than buying a ladder of gyms.",
      content: <>
        <p>The Rift Performance Lab trains Strength, Defense, Speed and Dexterity. Training costs Energy. Happiness modifies training quality, and maintaining a training streak improves gains.</p>
        <p>Instead of repeatedly buying stronger gyms, RiftCity unlocks specialized training programs as Gym Experience grows. Jail has its own reduced training area.</p>
        <WikiTable headers={["Program", "Unlock Gym XP", "Energy modifier", "Focus"]} rows={TRAINING_PROGRAMS.map((program) => [program.name, program.unlockGymExp, `${program.energyModifier.toFixed(2)}×`, program.description])} />
      </>,
    },
    {
      id: "jobs",
      title: "Jobs, Skills & Promotions",
      category: "Economy",
      icon: "jobs",
      keywords: "job income career skill promotion work shift salary company stats passive pay",
      summary: "Legal income with persistent career skills and position tiers.",
      content: <>
        <p>Jobs are a legal income path. Joining a company unlocks salary progression and manual work shifts. Job skills level independently and can add combat-stat bonuses. Higher skill levels unlock higher positions and better pay.</p>
        <WikiTable headers={["Company", "Starting role", "Top role", "Top salary"]} rows={JOBS.map((job) => [job.company, job.positions[0]?.title ?? job.title, job.positions[job.positions.length - 1]?.title ?? "—", money(job.positions[job.positions.length - 1]?.salary ?? 0)])} />
      </>,
    },
    {
      id: "banking",
      title: "Banking & Investments",
      category: "Economy",
      icon: "bank",
      keywords: "bank checking savings interest investment freeze seizure hack protected cap fee wealth",
      summary: "Domestic storage is safer than carried cash, but it is intentionally not completely risk-free.",
      content: <>
        <p>RiftCity banking separates checking, savings, investments and offshore storage. Domestic balances have protected allowances that grow with lifetime deposits. Money above those allowances can be exposed to abstract fraud/seizure events, and a bank freeze can temporarily restrict access.</p>
        <p>Savings has an early-access fee. Investments lock principal for a term and use tier-specific return ranges, meaning some investment outcomes can finish below principal.</p>
        <WikiTable headers={["Tier", "Unlock deposits", "Cap", "Term", "Return range"]} rows={BANK_INVESTMENT_TIERS.map((tier) => [tier.name, money(tier.unlockDeposit), money(tier.cap), formatTime(tier.term), `${(tier.minRate * 100).toFixed(1)}% to ${(tier.maxRate * 100).toFixed(1)}%`])} />
      </>,
    },
    {
      id: "offshore",
      title: "Offshore Accounts",
      category: "Economy",
      icon: "shield",
      keywords: "offshore account protection hack fee cap breach bank country airport",
      summary: "The strongest current wealth-protection layer, balanced by caps, fees and limited breach exposure.",
      content: <>
        <p>Offshore tiers unlock with net worth. Each tier has a balance cap, deposit fee, withdrawal fee, a limited percentage that can be lost to a simulated hostile breach, and a protection period after a successful breach so the same account cannot be repeatedly farmed.</p>
        <p><b>Current-build note:</b> offshore tiers are presently unlocked from the banking interface. The previously discussed design where the first account must be opened by flying to its country through the Airport is not yet enforced in this build and remains a planned expansion.</p>
        <WikiTable headers={["Tier", "Net worth", "Cap", "Deposit / withdraw", "Breach exposure", "Protection"]} rows={OFFSHORE_TIERS.map((tier) => [tier.name, money(tier.unlockNetWorth), money(tier.cap), `${Math.round(tier.depositFeeRate * 100)}% / ${Math.round(tier.withdrawFeeRate * 100)}%`, `${(tier.hackLossMin * 100).toFixed(1)}–${(tier.hackLossMax * 100).toFixed(1)}%`, formatTime(tier.protectionMs)])} />
      </>,
    },
    {
      id: "property",
      title: "Properties, Upgrades & Rentals",
      category: "Economy",
      icon: "property",
      keywords: "property home rent rental passive income upkeep seizure loss security happiness health nerve",
      summary: "Homes improve the character while extra holdings can generate passive rent with ongoing risk.",
      content: <>
        <p>Your residence can increase maximum Health, Nerve and Happiness. Property upgrades add permanent benefits such as a better bedroom, home gym, medical room, security or storage.</p>
        <p>Additional property holdings can be enabled as rentals. Rental income is passive but is not treated as perfectly safe money: upkeep, risk checks and property losses are part of the system.</p>
        <WikiTable headers={["Property", "Price", "Health bonus", "Nerve bonus", "Max happiness"]} rows={PROPERTIES.map((property) => [property.name, money(property.price), `+${property.maxHealthBonus}`, `+${property.nerveBonus}`, property.maxHappiness])} />
        <WikiTable headers={["Upgrade", "Ranks", "Base price", "Benefit"]} rows={PROPERTY_UPGRADES.map((upgrade) => [upgrade.name, upgrade.maxRank, money(upgrade.basePrice), upgrade.benefit])} />
      </>,
    },
    {
      id: "black-market",
      title: "Black Market & Beta Economy",
      category: "Economy",
      icon: "market",
      keywords: "black market npc listings trade sell quick sell beta auto buy listing fee economy",
      summary: "A simulated city-scale marketplace that already uses the same basic shape intended for future player trading.",
      content: <>
        <p>The Black Market combines simulated NPC listings with player listings. The city-scale headline activity is generated for the beta so the market does not look empty before live multiplayer.</p>
        <p><b>Beta testing economy:</b> Quick Sell pays {Math.round(BETA_NPC_QUICK_SELL_MULTIPLIER * 100)}% of the item's reference sell value. Player listings priced at or below {BETA_NPC_AUTO_BUY_MAX_MULTIPLIER}× reference value are instantly purchased by a simulated NPC buyer. This is intentionally generous so expensive features can be tested quickly and should be tightened before a live economy.</p>
        <Facts>
          <Fact label="Simulated traders">{BLACK_MARKET_STATS.traders.toLocaleString()}</Fact>
          <Fact label="Displayed 24h trades">{BLACK_MARKET_STATS.trades24h.toLocaleString()}</Fact>
          <Fact label="Displayed 24h volume">{money(BLACK_MARKET_STATS.volume24h)}</Fact>
          <Fact label="Listing fee">3% of listing value, minimum fee applies</Fact>
        </Facts>
      </>,
    },
    {
      id: "production",
      title: "Contraband Production",
      category: "Crime",
      icon: "lab",
      keywords: "production facility batch timer heat attention raid supplies black market beta lab",
      summary: "A mid/end-game illegal production loop using deliberately fictionalized game supplies and beta-short timers.",
      content: <>
        <p>Production facilities unlock through Crime Experience and cash. A facility has capacity and a Heat-shield value. Starting a batch consumes abstract game supplies, starts a timer, raises Heat and Production Attention, and can trigger a raid when repeated production becomes too conspicuous.</p>
        <p>All production inputs are deliberately fictional abstractions; the game does not model real-world manufacturing procedures. Current setup prices and timers are aggressively shortened for beta testing.</p>
        <WikiTable headers={["Facility", "Setup", "Capacity", "Heat shield", "Crime XP"]} rows={PRODUCTION_FACILITIES.map((facility) => [facility.name, money(facility.setupCost), facility.capacity, facility.heatShield, facility.requiredCrimeExperience])} />
        <WikiTable headers={["Batch", "Facility", "Output", "Timer", "Heat", "Attention"]} rows={PRODUCTION_RECIPES.map((recipe) => [recipe.name, PRODUCTION_FACILITIES.find((f) => f.id === recipe.facilityId)?.name ?? recipe.facilityId, recipe.output, formatTime(recipe.durationMs), recipe.heat, recipe.attention])} />
      </>,
    },
    {
      id: "casino-nightclub",
      title: "Casino & Nightclub",
      category: "World",
      icon: "casino",
      keywords: "casino blackjack poker slots roulette horse race nightclub chips fun income jackpot",
      summary: "Entertainment systems that also move money through the economy.",
      content: <>
        <p>The Casino includes playable table games, slots, poker, roulette-style games, racing and jackpot systems. Casino chips separate game wagering from the rest of the UI while still making wins/losses meaningful to the character economy.</p>
        <p>The Nightclub is a separate social/entertainment destination with reputation, events and actions tied to Happiness and city progression. Both systems are intended to feel like destinations rather than generic menu cards.</p>
      </>,
    },
    {
      id: "education-missions",
      title: "Education & Missions",
      category: "Progression",
      icon: "education",
      keywords: "education course mission chapter prerequisite reward xp cash merit points progression",
      summary: "Longer-term objectives and timed courses that add permanent progression.",
      content: <>
        <p>Education courses cost money, take time and require a minimum level. Completed courses provide permanent bonuses to areas such as crime, gym or combat.</p>
        <p>Missions are objective chains that track existing gameplay rather than creating a separate minigame. Chapters and prerequisites guide progression while rewards include cash, XP, Points and Merits.</p>
        <WikiTable headers={["Course", "Level", "Cost", "Duration", "Bonus"]} rows={EDUCATION.map((course) => [course.name, course.levelRequired, money(course.cost), `${course.durationHours}h`, `${course.bonus} +${course.bonusAmount}`])} />
        <WikiTable headers={["Mission", "Target", "Cash", "XP"]} rows={MISSIONS.map((mission) => [mission.name, `${mission.requirement} ${mission.target}`, money(mission.rewardCash), mission.rewardXp])} />
      </>,
    },
    {
      id: "factions-merits",
      title: "Factions, Merits & Challenges",
      category: "Progression",
      icon: "faction",
      keywords: "faction reputation rank rewards merit upgrade daily weekly challenge points",
      summary: "Parallel progression tracks that reward specialization and regular play.",
      content: <>
        <p>Factions build Reputation and unlock ranks/rewards. Merits buy permanent account-style character upgrades with rank caps. Daily and weekly challenges pay cash/Points and can award Merits.</p>
        <WikiTable headers={["Faction", "Specialty", "Top rank"]} rows={FACTIONS.map((faction) => [faction.id, faction.specialty, faction.ranks[faction.ranks.length - 1]?.name ?? "—"])} />
        <WikiTable headers={["Merit upgrade", "Max rank", "Effect / rank"]} rows={MERIT_UPGRADES.map((upgrade) => [upgrade.name, upgrade.maxRank, upgrade.effectLabel])} />
        <Facts>
          <Fact label="Daily challenges">{DAILY_CHALLENGES.length}</Fact>
          <Fact label="Weekly challenges">{WEEKLY_CHALLENGES.length}</Fact>
        </Facts>
      </>,
    },
    {
      id: "jail-hospital",
      title: "Jail, Hospital & Enforcement",
      category: "World",
      icon: "police",
      keywords: "jail hospital police arrest charge sentence recovery raid freeze seizure enforcement",
      summary: "Failure states are part of the economy and progression instead of simple game-over screens.",
      content: <>
        <p>Arrests can create charges, remove carried cash and place the character in jail for a timed sentence. Production raids can also cause arrest and contraband seizure. Jail has its own limited gym option.</p>
        <p>Combat injuries and other failures can send the character to the Hospital. While jailed or hospitalized, many normal actions are restricted. These timers now appear in the top Effects strip so the restriction is visible from any page.</p>
      </>,
    },
    {
      id: "world-events",
      title: "World Events",
      category: "World",
      icon: "spark",
      keywords: "world event dock strike crackdown gym rush hiring boom quiet night timer effect",
      summary: "Temporary city-wide modifiers that change the value or risk of normal activities.",
      content: <>
        <WikiTable headers={["Event", "Duration", "Effect"]} rows={WORLD_EVENTS.map((event) => [event.name, `${event.durationMinutes} min`, event.effect])} />
      </>,
    },
    {
      id: "beta-roadmap",
      title: "Beta vs. Multiplayer",
      category: "Reference",
      icon: "info",
      keywords: "beta multiplayer npc simulated local save future live economy async pvp roadmap",
      summary: "Which parts are intentionally accelerated or simulated in the current testing build.",
      content: <>
        <p>RiftCity is currently tuned for rapid feature testing. Black Market activity is simulated, Black Market selling is intentionally generous, production setup costs/timers are shortened, and saves are local. These are beta conveniences, not final economy promises.</p>
        <p>The architecture already separates routed feature pages and persistent player state so live accounts, server persistence, real player listings and asynchronous PvP can replace the simulated/local layers without redesigning every screen.</p>
        <p>The Wiki labels planned behavior when it differs from what the current code actually enforces. That distinction is important while the game is moving quickly.</p>
      </>,
    },
  ], []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(articles.map((article) => article.category)))], [articles]);
  const normalized = query.trim().toLowerCase();
  const filtered = articles.filter((article) => {
    if (category !== "All" && article.category !== category) return false;
    if (!normalized) return true;
    return `${article.title} ${article.category} ${article.summary} ${article.keywords}`.toLowerCase().includes(normalized);
  });

  return (
    <div className="wiki-page">
      <section className="wiki-hero">
        <div className="wiki-hero-icon"><GameIcon name="book" size={30} /></div>
        <div>
          <span className="card-tag">RIFTCITY FIELD MANUAL</span>
          <h2>Game Wiki</h2>
          <p>Search the current mechanics, progression systems, economy, combat, crime and beta rules. Reference tables are pulled from the same game data wherever practical.</p>
        </div>
        <div className="wiki-hero-meta">
          <strong>{articles.length}</strong><span>guide sections</span>
          <strong>{g.level}</strong><span>your level</span>
        </div>
      </section>

      <section className="wiki-toolbar">
        <label className="wiki-search">
          <GameIcon name="target" size={16} />
          <input value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search mechanics, combat, bank, Heat…" aria-label="Search the RiftCity wiki" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search">×</button>}
        </label>
        <div className="wiki-category-row">
          {categories.map((name) => <button key={name} type="button" className={category === name ? "active" : ""} onClick={() => setCategory(name)}>{name}</button>)}
        </div>
      </section>

      <div className="wiki-layout">
        <aside className="wiki-index" aria-label="Wiki contents">
          <span>CONTENTS</span>
          {filtered.map((article) => <a key={article.id} href={`#wiki-${article.id}`}><GameIcon name={article.icon} size={14} />{article.title}</a>)}
        </aside>

        <div className="wiki-articles">
          {filtered.length === 0 ? (
            <div className="wiki-empty"><GameIcon name="info" size={22} /><strong>No matching article</strong><span>Try a broader game term.</span></div>
          ) : filtered.map((article) => (
            <article key={article.id} id={`wiki-${article.id}`} className="wiki-article">
              <header>
                <span className="wiki-article-icon"><GameIcon name={article.icon} size={20} /></span>
                <div><small>{article.category}</small><h3>{article.title}</h3><p>{article.summary}</p></div>
              </header>
              <div className="wiki-article-body">{article.content}</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
