import { CombatStats } from "./progressionSystem";
export type CrimeOutcome="success"|"failed"|"spooked"|"jailed";
export type Crime={id:string;name:string;description:string;levelRequired:number;nerve:number;difficulty:number;minReward:number;maxReward:number;xp:number;crimeExperience:number;risk:number;successText:string};
export const CRIMES:Crime[]=[
{id:"pickpocket",name:"Pickpocket",description:"Lift a little cash from an inattentive target.",levelRequired:1,nerve:2,difficulty:18,minReward:40,maxReward:110,xp:10,crimeExperience:8,risk:8,successText:"You got away clean."},
{id:"shoplift",name:"Shoplifting",description:"Take merchandise before staff notice.",levelRequired:2,nerve:3,difficulty:28,minReward:80,maxReward:220,xp:16,crimeExperience:12,risk:12,successText:"The item leaves the store with you."},
{id:"burglary",name:"Burglary",description:"Break into a property and search for valuables.",levelRequired:3,nerve:5,difficulty:38,minReward:150,maxReward:400,xp:22,crimeExperience:15,risk:16,successText:"You found something worth taking."},
{id:"vehicle-theft",name:"Vehicle Theft",description:"Steal a parked vehicle and disappear.",levelRequired:4,nerve:6,difficulty:45,minReward:250,maxReward:650,xp:30,crimeExperience:20,risk:21,successText:"The vehicle is yours long enough to cash out."},
{id:"robbery",name:"Armed Robbery",description:"Hit a high-value target under serious risk.",levelRequired:6,nerve:8,difficulty:54,minReward:500,maxReward:1200,xp:42,crimeExperience:28,risk:28,successText:"You leave with the score."},
{id:"bank-job",name:"Bank Job",description:"Plan a major financial robbery.",levelRequired:9,nerve:10,difficulty:64,minReward:1000,maxReward:3000,xp:60,crimeExperience:40,risk:36,successText:"The vault gives up a portion of its money."},
{id:"major-heist",name:"Major Heist",description:"Attempt a city-scale score.",levelRequired:13,nerve:12,difficulty:76,minReward:2500,maxReward:7500,xp:85,crimeExperience:55,risk:45,successText:"Against several sensible expectations, it worked."},
{id:"counterfeit",name:"Counterfeit Operation",description:"Move a risky batch of forged goods.",levelRequired:16,nerve:13,difficulty:80,minReward:4000,maxReward:10000,xp:100,crimeExperience:65,risk:48,successText:"The operation clears the city without drawing attention."},
{id:"warehouse-raid",name:"Warehouse Raid",description:"Hit a guarded industrial warehouse.",levelRequired:20,nerve:15,difficulty:84,minReward:6000,maxReward:15000,xp:120,crimeExperience:80,risk:52,successText:"You escape with valuable contraband."},
{id:"corporate-swindle",name:"Corporate Swindle",description:"Exploit a wealthy target's weak controls.",levelRequired:25,nerve:18,difficulty:88,minReward:10000,maxReward:25000,xp:150,crimeExperience:100,risk:56,successText:"The score lands before anyone notices."},
{id:"city-heist",name:"City Heist",description:"Coordinate an ambitious city-wide operation.",levelRequired:30,nerve:20,difficulty:92,minReward:20000,maxReward:50000,xp:200,crimeExperience:140,risk:62,successText:"A legendary score becomes your newest record."},
];
export function crimeUnlocked(c:Crime,lvl:number){return lvl>=c.levelRequired}
export function getCrimeStatBonus(s:CombatStats){const avg=(s.strength+s.speed+s.dexterity)/3;return Math.min(20,Math.max(0,avg-1)*1.5)}
export function crimeSuccessChance(c:Crime,exp:number,_int=1,statBonus=0){return Math.max(8,Math.min(92,78-c.difficulty+Math.min(25,exp/20)+statBonus))}
export function randomReward(c:Crime){return Math.floor(c.minReward+Math.random()*(c.maxReward-c.minReward+1))}
export function rollCrimeOutcome(c:Crime,successChance:number):CrimeOutcome{const r=Math.random()*100;if(r<successChance)return"success";if(r<successChance+c.risk*.55)return"jailed";return r>92?"spooked":"failed"}
