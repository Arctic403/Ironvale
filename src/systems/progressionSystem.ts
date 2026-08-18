export type CombatStats = { strength: number; defense: number; speed: number; dexterity: number };
export type LevelInfo = { level: number; currentXp: number; requiredXp: number };
export function getLevel(xp: number): LevelInfo { const safe=Math.max(0,Math.floor(xp)); const level=Math.floor(safe/100)+1; return {level,currentXp:safe%100,requiredXp:100}; }
export function addXp(xp:number, amount:number){return Math.max(0,xp+amount)}
export function getNaturalNerveMax(crimeExperience:number){return 10+Math.min(50,Math.floor(Math.max(0,crimeExperience)/100)*5)}
export function getMaxHealth(propertyHealthBonus:number){return 100+Math.max(0,propertyHealthBonus)}
export function getEffectiveCombatStats(stats:CombatStats, educationBonus=0):CombatStats{const m=1+Math.max(0,educationBonus)/100;return Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,v*m])) as CombatStats}
