import type { CrimeCareerAction, ScavengeLocation, ShopliftConditions, ShopliftItem, ShopliftStore } from "../crimes/core/types";
import { CRIME_CAREERS } from "../crimes/core/registry";
export type { CrimeCareerMode, CrimeCareerTargetKind, CrimeCareerAction, CrimeCareerDefinition, ScavengeLocation, ShopliftItem, ShopliftStore, ShopliftConditions, CrimePlugin, CrimePluginUiKind } from "../crimes/core/types";
export { CRIME_CAREERS, CRIME_PLUGINS, getCrimePlugin, requireCrimePlugin } from "../crimes/core/registry";
export { SCAVENGE_LOCATIONS, SHOPLIFT_STORES } from "../crimes/modules/theft";

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

export function scavengingOutcomeRates(location: ScavengeLocation, mastery: number, heat: number, opportunity: number) {
  const restricted = Boolean(location.requiredItems?.length) || location.masteryRequired >= 50;
  const bustChance = Math.max(restricted ? .8 : .15, Math.min(restricted ? 12 : 3, location.difficulty * .07 + heat * .045 + Math.max(0, 35 - opportunity) * .035));
  const luckyChance = Math.max(.6, Math.min(10, .7 + opportunity * .025 + mastery * .02 + (location.lootChanceBonus ?? 0) * 34));
  const jailOnBust = restricted ? Math.min(42, Math.max(4, location.difficulty * .38 + heat * .12 - mastery * .08)) : Math.min(8, heat * .035);
  return { luckyChance, bustChance, jailOnBust };
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
