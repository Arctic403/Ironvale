import type { GameIconName } from "../components/GameIcon";
import type { CrimeFamily } from "./crimeActivities";

export type CrimeCareerMode = "scavenge" | "target" | "shoplift" | "graffiti" | "operation" | "actions" | "major";
export type CrimeCareerTargetKind = "pickpocket" | "burglary" | "vehicle";

export type CrimeCareerAction = {
  id: string;
  name: string;
  description: string;
  nerve: number;
  difficulty: number;
  minReward: number;
  maxReward: number;
  heat: number;
  masteryRequired?: number;
  streetRepRequired?: number;
  requiredItems?: string[];
  recommendedItems?: string[];
  rewardType?: "cash" | "heat-reduction" | "street-rep";
};

export type CrimeCareerDefinition = {
  id: string;
  name: string;
  description: string;
  family: CrimeFamily;
  mode: CrimeCareerMode;
  icon: GameIconName;
  unlockCrimeExperience: number;
  baseNerve: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  targetKind?: CrimeCareerTargetKind;
  operationIds?: string[];
  legacyCrimeId?: string;
  actions?: CrimeCareerAction[];
};

export type ScavengeLocation = {
  id: string;
  name: string;
  district: string;
  description: string;
  masteryRequired: number;
  nerve: number;
  difficulty: number;
  minReward: number;
  maxReward: number;
  heat: number;
  lootHint: string;
  requiredItems?: string[];
  opportunityProfile: "downtown" | "transit" | "rail" | "nightclub" | "harbor" | "casino" | "estate" | "luxury";
  peakLabel: string;
  lootIds?: string[];
  lootChanceBonus?: number;
};

export type ShopliftItem = {
  id: string;
  name: string;
  value: number;
  severity: 1 | 2 | 3 | 4 | 5;
  masteryRequired: number;
  requiredItems?: string[];
};

export type ShopliftStore = {
  id: string;
  name: string;
  district: string;
  description: string;
  masteryRequired: number;
  baseSecurity: number;
  items: ShopliftItem[];
};

export type ShopliftConditions = {
  crowd: "EMPTY" | "QUIET" | "NORMAL" | "BUSY" | "PACKED";
  security: "CAMERAS OFFLINE" | "PARTIAL" | "NORMAL" | "HIGH" | "LOCKDOWN";
  staffing: "UNDERSTAFFED" | "NORMAL" | "EXTRA STAFF" | "SECURITY PRESENT";
  opportunity: number;
  suspicionModifier: number;
  payoutMultiplier: number;
};

const action = (value: CrimeCareerAction) => value;

export const CRIME_CAREERS: CrimeCareerDefinition[] = [
  { id:"scavenging", name:"Scavenging", description:"Read live city activity and search different districts for cash, valuables and rare finds.", family:"theft", mode:"scavenge", icon:"cash", unlockCrimeExperience:0, baseNerve:1, risk:"LOW" },
  { id:"pickpocket", name:"Pickpocketing", description:"Work rotating NPC targets. Higher mastery reveals more information before you commit.", family:"theft", mode:"target", targetKind:"pickpocket", icon:"target", unlockCrimeExperience:0, baseNerve:2, risk:"LOW" },
  { id:"shoplift", name:"Shoplifting", description:"Choose a live store, build a basket and decide when greed has pushed suspicion too far.", family:"theft", mode:"shoplift", icon:"shops", unlockCrimeExperience:8, baseNerve:2, risk:"MEDIUM" },
  { id:"graffiti", name:"Graffiti", description:"Tag increasingly visible locations to build Street Reputation and Street Art mastery.", family:"street", mode:"graffiti", icon:"spray", unlockCrimeExperience:12, baseNerve:1, risk:"LOW" },
  { id:"package-swipe", name:"Parcel Theft", description:"Watch residential delivery windows and take small item-focused scores instead of pure cash.", family:"theft", mode:"actions", icon:"package", unlockCrimeExperience:22, baseNerve:3, risk:"LOW", actions:[
    action({id:"porch-row",name:"Residential Row",description:"Low-value parcels rotate through a quiet residential block.",nerve:3,difficulty:26,minReward:90,maxReward:260,heat:2,recommendedItems:["thin-gloves"]}),
    action({id:"apartment-mailroom",name:"Apartment Mailroom",description:"More packages are concentrated here, but so are cameras and residents.",nerve:4,difficulty:35,minReward:180,maxReward:480,heat:4,masteryRequired:15,requiredItems:["disguise-kit"],recommendedItems:["thin-gloves"]}),
  ]},
  { id:"locker-theft", name:"Locker Theft", description:"Target rotating storage and locker opportunities with better loot pools at higher mastery.", family:"theft", mode:"actions", icon:"key", unlockCrimeExperience:35, baseNerve:3, risk:"MEDIUM", actions:[
    action({id:"gym-lockers",name:"Gym Lockers",description:"Quick low-tier storage targets with mostly cash and small valuables.",nerve:3,difficulty:31,minReward:140,maxReward:390,heat:3,recommendedItems:["thin-gloves"]}),
    action({id:"station-storage",name:"Station Storage",description:"A more valuable storage row that requires an abstract entry tool.",nerve:5,difficulty:44,minReward:350,maxReward:950,heat:6,masteryRequired:20,requiredItems:["lock-bypass"]}),
  ]},
  { id:"burglary", name:"Burglary", description:"Scout persistent properties to reveal security, payout and risk before entering.", family:"burglary", mode:"target", targetKind:"burglary", icon:"building", unlockCrimeExperience:48, baseNerve:5, risk:"MEDIUM" },
  { id:"commercial-burglary", name:"Commercial Burglary", description:"Move from homes to offices and retail targets with multi-item preparation requirements.", family:"burglary", mode:"actions", icon:"warehouse", unlockCrimeExperience:95, baseNerve:7, risk:"HIGH", actions:[
    action({id:"closed-office",name:"Closed Office",description:"An after-hours office score with electronics and cash-equivalent loot.",nerve:7,difficulty:48,minReward:700,maxReward:1850,heat:7,masteryRequired:25,requiredItems:["lock-bypass","thin-gloves"],recommendedItems:["inside-tip"]}),
    action({id:"luxury-retail",name:"Luxury Retail Backroom",description:"Premium inventory behind layered fictional security.",nerve:9,difficulty:59,minReward:1400,maxReward:3600,heat:10,masteryRequired:45,requiredItems:["advanced-entry-kit","security-bypass-module"],recommendedItems:["disguise-kit"]}),
  ]},
  { id:"safecracking", name:"Safecracking", description:"Work fictional lock tiers that reward Burglary mastery without modeling real safe-opening methods.", family:"burglary", mode:"actions", icon:"lock", unlockCrimeExperience:120, baseNerve:6, risk:"HIGH", actions:[
    action({id:"office-safe",name:"Office Safe",description:"A fictional low-tier safe target resolved through character stats and mastery.",nerve:6,difficulty:48,minReward:800,maxReward:2200,heat:7,requiredItems:["lock-bypass"]}),
    action({id:"private-vault",name:"Private Vault",description:"An elite game target requiring two abstract preparation items.",nerve:9,difficulty:65,minReward:2400,maxReward:6800,heat:12,masteryRequired:55,requiredItems:["advanced-entry-kit","security-bypass-module"]}),
  ] },
  { id:"art-theft", name:"Art Theft", description:"Rare high-value targets require preparation and often need underground buyers to realize their value.", family:"burglary", mode:"actions", icon:"awards", unlockCrimeExperience:155, baseNerve:8, risk:"HIGH", actions:[
    action({id:"gallery-piece",name:"Private Gallery Piece",description:"A prestige target with a large payout ceiling and serious attention.",nerve:8,difficulty:61,minReward:1800,maxReward:5200,heat:11,masteryRequired:50,requiredItems:["advanced-entry-kit","inside-tip"]}),
    action({id:"collector-vault",name:"Collector Vault",description:"Extremely rare collector inventory protected by multiple abstract security layers.",nerve:11,difficulty:72,minReward:4200,maxReward:11000,heat:16,masteryRequired:75,requiredItems:["advanced-entry-kit","security-bypass-module"],recommendedItems:["escape-route"]}),
  ]},
  { id:"vehicle-theft", name:"Vehicle Theft", description:"Choose from rotating vehicles with different security, value and demand.", family:"vehicle", mode:"target", targetKind:"vehicle", icon:"car", unlockCrimeExperience:100, baseNerve:6, risk:"MEDIUM" },
  { id:"parts-theft", name:"Parts Theft", description:"Take fictional vehicle components that feed crafting and Black Market supply.", family:"vehicle", mode:"actions", icon:"tools", unlockCrimeExperience:125, baseNerve:5, risk:"MEDIUM", actions:[
    action({id:"parking-row",name:"Parking Row",description:"Low-tier component targets with modest Heat.",nerve:5,difficulty:40,minReward:420,maxReward:1150,heat:5,requiredItems:["tool-bag"]}),
    action({id:"performance-lot",name:"Performance Lot",description:"Premium component targets with higher surveillance.",nerve:7,difficulty:54,minReward:900,maxReward:2500,heat:8,masteryRequired:35,requiredItems:["tool-bag","vehicle-module"]}),
  ]},
  { id:"chop-shop", name:"Chop Shop", description:"Run stolen-vehicle processing as a passive operation while you do other activities.", family:"vehicle", mode:"operation", icon:"garage", unlockCrimeExperience:190, baseNerve:6, risk:"HIGH", operationIds:["chop-shop"] },
  { id:"card-skimming", name:"Card Skimming", description:"Deploy an abstract game device, let value build over time, then collect before detection catches up.", family:"fraud", mode:"operation", icon:"chip", unlockCrimeExperience:55, baseNerve:3, risk:"MEDIUM", operationIds:["card-skimming"] },
  { id:"email-fraud", name:"Email Fraud", description:"Fund fictional campaign tiers that resolve over time. No real-world procedures are modeled.", family:"fraud", mode:"operation", icon:"envelope", unlockCrimeExperience:90, baseNerve:4, risk:"MEDIUM", operationIds:["email-fraud"] },
  { id:"forgery", name:"Forgery", description:"Use an abstract forgery bench to create value through timed underground commissions.", family:"fraud", mode:"operation", icon:"badge", unlockCrimeExperience:135, baseNerve:5, risk:"HIGH", operationIds:["forgery-run"] },
  { id:"counterfeit-run", name:"Counterfeit Goods", description:"Finance fictional underground goods batches and sell the finished output into the simulated economy.", family:"fraud", mode:"operation", icon:"package", unlockCrimeExperience:145, baseNerve:5, risk:"HIGH", operationIds:["counterfeit-run"] },
  { id:"identity-fraud", name:"Identity Fraud", description:"A high-tier abstract fraud operation with expensive setup and stronger investigation pressure.", family:"fraud", mode:"operation", icon:"character", unlockCrimeExperience:220, baseNerve:7, risk:"HIGH", operationIds:["identity-fraud"] },
  { id:"corporate-fraud", name:"Corporate Fraud", description:"Late-game passive financial crime with large setup capital, big returns and serious Heat exposure.", family:"fraud", mode:"operation", icon:"building", unlockCrimeExperience:360, baseNerve:10, risk:"EXTREME", operationIds:["corporate-fraud"] },
  { id:"data-breach", name:"Data Theft", description:"A fictional cyber skill check against abstract security tiers; no real hacking commands or techniques.", family:"cyber", mode:"actions", icon:"chip", unlockCrimeExperience:135, baseNerve:7, risk:"HIGH", actions:[
    action({id:"street-terminal",name:"Street Terminal",description:"Low-tier fictional data target for building Cyber skill.",nerve:6,difficulty:44,minReward:650,maxReward:1700,heat:6,requiredItems:["cyber-rig"]}),
    action({id:"corporate-node",name:"Corporate Node",description:"A high-security game target with valuable fictional data packages.",nerve:9,difficulty:62,minReward:1800,maxReward:5200,heat:11,masteryRequired:45,requiredItems:["cyber-rig","access-token"]}),
  ]},
  { id:"cargo-theft", name:"Cargo Theft", description:"Scout shipment opportunities and choose freight based on value, patrol pressure and capacity.", family:"organized", mode:"actions", icon:"warehouse", unlockCrimeExperience:72, baseNerve:5, risk:"MEDIUM", actions:[
    action({id:"local-freight",name:"Local Freight",description:"A lower-tier shipment with broad, unpredictable loot.",nerve:5,difficulty:42,minReward:480,maxReward:1350,heat:6,recommendedItems:["cargo-scanner"]}),
    action({id:"priority-shipment",name:"Priority Shipment",description:"High-value freight that requires both cargo intel and a prepared route.",nerve:8,difficulty:58,minReward:1500,maxReward:4200,heat:10,masteryRequired:40,requiredItems:["cargo-scanner","escape-route"]}),
  ]},
  { id:"black-market-delivery", name:"Black Market Delivery", description:"Run timed underground delivery contracts that link Crime progression to the market economy.", family:"organized", mode:"operation", icon:"route", unlockCrimeExperience:165, baseNerve:5, risk:"MEDIUM", operationIds:["black-market-delivery"] },
  { id:"smuggling", name:"Smuggling", description:"Higher-tier fictional logistics operation intended to connect to Airport destinations later.", family:"organized", mode:"operation", icon:"airport", unlockCrimeExperience:280, baseNerve:8, risk:"HIGH", operationIds:["smuggling-run"] },
  { id:"protection-racket", name:"Protection Racket", description:"Establish an abstract collection cycle for passive income and growing enforcement attention.", family:"organized", mode:"operation", icon:"shield", unlockCrimeExperience:300, baseNerve:8, risk:"HIGH", operationIds:["protection-racket"] },
  { id:"underground-gambling", name:"Underground Gambling", description:"Fund a fictional illegal game that earns passive cash while raid risk grows.", family:"organized", mode:"operation", icon:"dice", unlockCrimeExperience:250, baseNerve:7, risk:"HIGH", operationIds:["underground-gambling"] },
  { id:"evidence-cleanup", name:"Evidence Cleanup", description:"Spend money, Nerve and specialized supplies to reduce Heat instead of earning income.", family:"organized", mode:"actions", icon:"shield", unlockCrimeExperience:180, baseNerve:5, risk:"MEDIUM", actions:[
    action({id:"basic-cleanup",name:"Basic Cleanup",description:"A small post-job cleanup that trades resources for reduced Heat.",nerve:4,difficulty:36,minReward:4,maxReward:8,heat:0,requiredItems:["cleanup-kit"],rewardType:"heat-reduction"}),
    action({id:"professional-cleanup",name:"Professional Cleanup",description:"A larger cleanup operation requiring two preparation items.",nerve:7,difficulty:52,minReward:10,maxReward:18,heat:0,masteryRequired:35,requiredItems:["cleanup-kit","burner-phone"],rewardType:"heat-reduction"}),
  ]},
  { id:"robbery", name:"Street Robbery", description:"A direct score where branching decisions still matter because the situation can change fast.", family:"organized", mode:"major", icon:"crimes", unlockCrimeExperience:175, baseNerve:8, risk:"HIGH", legacyCrimeId:"robbery" },
  { id:"warehouse-job", name:"Warehouse Robbery", description:"A prepared multi-stage job with live decision events and larger loot potential.", family:"organized", mode:"major", icon:"warehouse", unlockCrimeExperience:225, baseNerve:9, risk:"HIGH", legacyCrimeId:"warehouse-job" },
  { id:"bank-job", name:"Bank Job", description:"A late-game prepared score that keeps RiftCity's branching live-job system.", family:"organized", mode:"major", icon:"bank", unlockCrimeExperience:290, baseNerve:11, risk:"EXTREME", legacyCrimeId:"bank-job" },
  { id:"major-heist", name:"Major Heist", description:"City-scale end-game criminal project; future crew play will plug into this structure.", family:"organized", mode:"major", icon:"crown", unlockCrimeExperience:390, baseNerve:13, risk:"EXTREME", legacyCrimeId:"major-heist" },
];

export const SCAVENGE_LOCATIONS: ScavengeLocation[] = [
  {id:"downtown-alleys",name:"Downtown Alleys",district:"Downtown",description:"A dependable starter route. Lunch traffic and evening footfall create the strongest windows.",masteryRequired:1,nerve:1,difficulty:16,minReward:20,maxReward:140,heat:0,lootHint:"Cash · small valuables",opportunityProfile:"downtown",peakLabel:"Lunch + evening",lootIds:["black-envelope","old-city-token","sugar-rush"]},
  {id:"transit-platforms",name:"Transit Platforms",district:"City Center",description:"A real-time commuter location: strongest around morning and evening rush, weakest late at night.",masteryRequired:1,nerve:1,difficulty:20,minReward:35,maxReward:200,heat:1,lootHint:"Cash · phones · transit collectibles",opportunityProfile:"transit",peakLabel:"7–9 AM + 4–6 PM",lootIds:["black-envelope","old-city-token","encrypted-chip"]},
  {id:"abandoned-rail-yard",name:"Abandoned Rail Yard",district:"Industrial",description:"Locked perimeter with industrial leftovers and forgotten cargo. You must own Bolt Cutters to access it.",masteryRequired:1,requiredItems:["bolt-cutters"],nerve:2,difficulty:27,minReward:90,maxReward:520,heat:2,lootHint:"Tools · components · cargo finds",opportunityProfile:"rail",peakLabel:"Late evening + overnight",lootIds:["encrypted-chip","old-city-token","black-envelope"],lootChanceBonus:.04},
  {id:"nightclub-strip",name:"Nightclub Strip",district:"Entertainment",description:"Almost dead in daylight, then rises through the evening and peaks around late-night closing crowds. A Nightclub Entry Ticket is required.",masteryRequired:1,requiredItems:["nightclub-ticket"],nerve:2,difficulty:30,minReward:80,maxReward:440,heat:2,lootHint:"Cash · jewelry · nightlife finds",opportunityProfile:"nightclub",peakLabel:"11 PM–2 AM",lootIds:["black-envelope","moon-chews","encrypted-chip"],lootChanceBonus:.03},
  {id:"harbor-docks",name:"Harbor Docks",district:"Harbor",description:"Daytime operations leave little room to search. Opportunity climbs after dark and is strongest before dawn.",masteryRequired:50,nerve:3,difficulty:36,minReward:160,maxReward:900,heat:3,lootHint:"Cargo · industrial goods · rare shipment finds",opportunityProfile:"harbor",peakLabel:"1–4 AM",lootIds:["encrypted-chip","black-envelope","old-city-token"],lootChanceBonus:.05},
  {id:"casino-district",name:"Casino District",district:"Entertainment",description:"A long evening window with strong weekend traffic. Valuable finds are balanced by heavier surveillance.",masteryRequired:50,nerve:3,difficulty:42,minReward:220,maxReward:1250,heat:4,lootHint:"Cash · chips · jewelry · collectibles",opportunityProfile:"casino",peakLabel:"8 PM–1 AM",lootIds:["black-envelope","old-city-token","encrypted-chip"],lootChanceBonus:.06},
  {id:"abandoned-luxury-estate",name:"Abandoned Luxury Estate",district:"Northside",description:"A high-value late-game search area with old valuables, art and rare collectibles. Daytime turnover creates the best windows.",masteryRequired:75,nerve:4,difficulty:50,minReward:420,maxReward:2600,heat:4,lootHint:"Art · watches · premium valuables · rare collectibles",opportunityProfile:"estate",peakLabel:"Late morning + afternoon",lootIds:["old-city-token","encrypted-chip","prototype-key","black-envelope"],lootChanceBonus:.09},
  {id:"luxury-district",name:"Luxury District",district:"Financial",description:"Master-level scavenging in RiftCity's wealthiest streets. Shopping and early-evening activity create premium opportunity.",masteryRequired:100,nerve:5,difficulty:58,minReward:700,maxReward:4800,heat:5,lootHint:"Premium valuables · ultra-rare collectibles",opportunityProfile:"luxury",peakLabel:"2–7 PM",lootIds:["prototype-key","encrypted-chip","old-city-token","black-envelope"],lootChanceBonus:.12},
];

export const SHOPLIFT_STORES: ShopliftStore[] = [
  {id:"corner-mart",name:"Corner Mart",district:"Southside",description:"Low security and cheap merchandise; ideal for learning the suspicion system.",masteryRequired:1,baseSecurity:18,items:[
    {id:"snacks",name:"Snack Bundle",value:35,severity:1,masteryRequired:1},
    {id:"toiletries",name:"Personal Care Set",value:70,severity:1,masteryRequired:1},
    {id:"gift-cards",name:"Gift Card Rack",value:160,severity:2,masteryRequired:8,requiredItems:["concealment-bag"]},
  ]},
  {id:"streetwear",name:"Rift Streetwear",district:"City Center",description:"Crowd swings dramatically with time of day and changes the risk profile.",masteryRequired:8,baseSecurity:28,items:[
    {id:"cap",name:"Designer Cap",value:110,severity:1,masteryRequired:8},
    {id:"jacket",name:"Premium Jacket",value:360,severity:2,masteryRequired:14,requiredItems:["concealment-bag"]},
    {id:"limited-shoes",name:"Limited Shoes",value:780,severity:3,masteryRequired:24,requiredItems:["concealment-bag","distraction-device"]},
  ]},
  {id:"electronics",name:"Volt Electronics",district:"Downtown",description:"Higher-value merchandise with stronger camera coverage.",masteryRequired:18,baseSecurity:40,items:[
    {id:"earbuds",name:"Wireless Earbuds",value:250,severity:2,masteryRequired:18},
    {id:"tablet",name:"Tablet",value:820,severity:3,masteryRequired:28,requiredItems:["concealment-bag"]},
    {id:"premium-phone",name:"Premium Phone",value:1450,severity:4,masteryRequired:42,requiredItems:["concealment-bag","distraction-device"]},
  ]},
  {id:"luxury-boutique",name:"Aurum Boutique",district:"Financial District",description:"End-game retail targets where almost every worthwhile item needs preparation.",masteryRequired:45,baseSecurity:55,items:[
    {id:"watch",name:"Luxury Watch",value:2100,severity:4,masteryRequired:45,requiredItems:["concealment-bag","disguise-kit"]},
    {id:"display-piece",name:"Display Piece",value:4800,severity:5,masteryRequired:65,requiredItems:["distraction-device","security-bypass-module"]},
  ]},
];

export function crimeCareerMasteryLevel(xp: number) {
  return Math.max(1, Math.min(100, 1 + Math.floor(Math.max(0, Number(xp) || 0) / 30)));
}

export function crimeCareerMasteryProgress(xp: number) {
  const safe = Math.max(0, Number(xp) || 0);
  const level = crimeCareerMasteryLevel(safe);
  if (level >= 100) return 100;
  return ((safe % 30) / 30) * 100;
}

export function masteryRank(level: number) {
  if (level >= 100) return "MASTERED";
  if (level >= 75) return "EXPERT";
  if (level >= 50) return "SPECIALIST";
  if (level >= 25) return "EXPERIENCED";
  if (level >= 10) return "FAMILIAR";
  return "ROOKIE";
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function randomFromSeed(seed: number) {
  let value = seed || 1;
  value = (value * 1664525 + 1013904223) >>> 0;
  return value / 4294967296;
}

export function crimeCityConditions(now = Date.now()) {
  const block = Math.floor(now / (5 * 60 * 1000));
  const police = Math.round(randomFromSeed(block * 91 + 7) * 100);
  const nightlife = Math.round(randomFromSeed(block * 131 + 13) * 100);
  const retail = Math.round(randomFromSeed(block * 173 + 29) * 100);
  const industrial = Math.round(randomFromSeed(block * 211 + 41) * 100);
  const label = (value: number) => value < 28 ? "LOW" : value > 72 ? "HIGH" : "NORMAL";
  return { police, nightlife, retail, industrial, policeLabel:label(police), nightlifeLabel:label(nightlife), retailLabel:label(retail), industrialLabel:label(industrial) };
}

type OpportunityPoint = readonly [hour: number, value: number];

export const RIFTCITY_TIME_ZONE = "America/Toronto";

type RiftCityClock = { year:number; month:number; day:number; weekday:number; hour:number; minute:number; second:number };

function riftCityClockParts(now: number): RiftCityClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RIFTCITY_TIME_ZONE, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays: Record<string, number> = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return {
    year:Number(get("year")), month:Number(get("month")), day:Number(get("day")),
    weekday:weekdays[get("weekday")] ?? 0, hour:Number(get("hour")), minute:Number(get("minute")), second:Number(get("second")),
  };
}

export function formatRiftCityTime(now = Date.now()) {
  return new Intl.DateTimeFormat(undefined, { timeZone:RIFTCITY_TIME_ZONE, weekday:"short", hour:"numeric", minute:"2-digit" }).format(new Date(now));
}

const SCAVENGE_DAILY_CURVES: Record<ScavengeLocation["opportunityProfile"], readonly OpportunityPoint[]> = {
  downtown: [[0,48],[3,26],[6,22],[9,48],[12,67],[15,58],[18,72],[21,76],[24,48]],
  transit: [[0,16],[5,24],[7,84],[8.5,96],[10,58],[13,43],[16,78],[17.5,95],[19.5,60],[22,27],[24,16]],
  rail: [[0,70],[3,77],[6,48],[9,30],[12,24],[16,34],[19,58],[22,74],[24,70]],
  nightclub: [[0,97],[2,91],[4,54],[7,16],[12,8],[16,15],[18,34],[20,61],[22,86],[23.5,99],[24,97]],
  harbor: [[0,82],[3,97],[6,62],[9,27],[12,14],[16,19],[19,43],[22,71],[24,82]],
  casino: [[0,91],[3,69],[6,31],[10,34],[14,54],[18,79],[21,94],[24,91]],
  estate: [[0,42],[4,34],[7,49],[10,72],[13,84],[16,76],[19,58],[22,47],[24,42]],
  luxury: [[0,34],[6,18],[9,44],[12,72],[15,89],[18,84],[21,61],[24,34]],
};

function interpolateOpportunity(points: readonly OpportunityPoint[], hour: number) {
  const h = Math.max(0, Math.min(24, hour));
  for (let i = 0; i < points.length - 1; i += 1) {
    const [h0, v0] = points[i];
    const [h1, v1] = points[i + 1];
    if (h >= h0 && h <= h1) {
      const t = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
      // Smoothstep keeps the bar moving naturally rather than jumping at hour boundaries.
      const eased = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * eased;
    }
  }
  return points[points.length - 1]?.[1] ?? 50;
}

function scavengingScheduleModifier(location: ScavengeLocation, clock: RiftCityClock) {
  const day = clock.weekday;
  const hour = clock.hour + clock.minute / 60;
  const weekend = day === 5 || day === 6;
  let modifier = 0;
  if (location.opportunityProfile === "nightclub" && weekend && (hour >= 18 || hour < 4)) modifier += 7;
  if (location.opportunityProfile === "casino" && weekend && (hour >= 14 || hour < 3)) modifier += 6;
  if (location.opportunityProfile === "transit") {
    const weekday = day >= 1 && day <= 5;
    const rush = (hour >= 6.5 && hour <= 9.5) || (hour >= 15.5 && hour <= 19);
    if (rush) modifier += weekday ? 7 : -11;
  }
  if (location.opportunityProfile === "luxury" && (day === 0 || day === 6) && hour >= 10 && hour <= 20) modifier += 6;
  return modifier;
}

function scavengingDailyVariance(location: ScavengeLocation, clock: RiftCityClock) {
  // One tiny deterministic modifier per RiftCity calendar day. The real-time curve remains the main driver.
  const dayKey = `${clock.year}-${clock.month}-${clock.day}`;
  return Math.round(randomFromSeed(hash(`${location.id}-${dayKey}`)) * 8 - 4);
}

export function scavengingOpportunity(location: ScavengeLocation, now = Date.now()) {
  const clock = riftCityClockParts(now);
  const hour = clock.hour + clock.minute / 60 + clock.second / 3600;
  const base = interpolateOpportunity(SCAVENGE_DAILY_CURVES[location.opportunityProfile], hour);
  const value = base + scavengingScheduleModifier(location, clock) + scavengingDailyVariance(location, clock);
  return Math.max(4, Math.min(100, Math.round(value)));
}

export function scavengingOpportunityTrend(location: ScavengeLocation, now = Date.now()) {
  const current = scavengingOpportunity(location, now);
  const future = scavengingOpportunity(location, now + 15 * 60 * 1000);
  const delta = future - current;
  if (delta >= 3) return "RISING" as const;
  if (delta <= -3) return "FALLING" as const;
  return "STEADY" as const;
}

export function scavengingOpportunityLabel(value: number) {
  if (value >= 90) return "PEAK";
  if (value >= 72) return "VERY HIGH";
  if (value >= 52) return "HIGH";
  if (value >= 32) return "MODERATE";
  if (value >= 16) return "LOW";
  return "VERY LOW";
}

export function getShopliftingConditions(store: ShopliftStore, now = Date.now()): ShopliftConditions {
  const block = Math.floor(now / (3 * 60 * 1000));
  const seed = block * 1009 + hash(store.id);
  const crowdIndex = Math.floor(randomFromSeed(seed + 11) * 5);
  const securityIndex = Math.floor(randomFromSeed(seed + 29) * 5);
  const staffIndex = Math.floor(randomFromSeed(seed + 47) * 4);
  const crowds: ShopliftConditions["crowd"][] = ["EMPTY","QUIET","NORMAL","BUSY","PACKED"];
  const securities: ShopliftConditions["security"][] = ["CAMERAS OFFLINE","PARTIAL","NORMAL","HIGH","LOCKDOWN"];
  const staffs: ShopliftConditions["staffing"][] = ["UNDERSTAFFED","NORMAL","EXTRA STAFF","SECURITY PRESENT"];
  const crowd = crowds[crowdIndex];
  const security = securities[securityIndex];
  const staffing = staffs[staffIndex];
  const crowdSuspicion = {EMPTY:8,QUIET:4,NORMAL:0,BUSY:-4,PACKED:-7}[crowd];
  const securitySuspicion = {"CAMERAS OFFLINE":-10,PARTIAL:-5,NORMAL:0,HIGH:9,LOCKDOWN:18}[security];
  const staffSuspicion = {UNDERSTAFFED:-7,NORMAL:0,"EXTRA STAFF":7,"SECURITY PRESENT":13}[staffing];
  const opportunity = Math.max(5, Math.min(95, 55 - crowdSuspicion - securitySuspicion - staffSuspicion + Math.round(randomFromSeed(seed + 61) * 20 - 10)));
  const payoutMultiplier = crowd === "PACKED" ? 1.12 : crowd === "EMPTY" ? 0.9 : 1;
  return { crowd, security, staffing, opportunity, suspicionModifier:crowdSuspicion + securitySuspicion + staffSuspicion, payoutMultiplier };
}

export function shopliftingSuspicion(store: ShopliftStore, selected: ShopliftItem[], conditions: ShopliftConditions, alertLevel = 0) {
  const severity = selected.reduce((total, item) => total + item.severity * (7 + item.severity * 2), 0);
  return Math.max(2, Math.min(98, Math.round(store.baseSecurity * 0.45 + severity + conditions.suspicionModifier + alertLevel * 3)));
}

export function careerActionSuccessChance(action: CrimeCareerAction, familyLevel: number, masteryLevel: number, dexterity: number, heat: number) {
  const value = 86 - action.difficulty * 0.72 + familyLevel * 0.8 + Math.min(15, dexterity * 0.3) + Math.min(12, masteryLevel * 0.12) - heat * 0.13;
  return Math.max(6, Math.min(96, value));
}

export function crimeCareerIdForOperation(operationId: string) {
  return CRIME_CAREERS.find((crime) => crime.operationIds?.includes(operationId))?.id ?? operationId;
}
