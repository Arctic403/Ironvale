import { CombatStats } from "./progressionSystem";
export type CrimeOutcome="success"|"failed"|"spooked"|"jailed";
export type Crime={id:string;name:string;description:string;levelRequired:number; crimeExperienceRequired:number;nerve:number;difficulty:number;minReward:number;maxReward:number;xp:number;crimeExperience:number;risk:number;successText:string};
export const CRIMES:Crime[]=[
{id:"pickpocket",crimeExperienceRequired:0,name:"Pickpocket",description:"Lift a little cash from an inattentive target.",levelRequired:1,nerve:2,difficulty:18,minReward:40,maxReward:110,xp:10,crimeExperience:8,risk:8,successText:"You got away clean."},
{id:"shoplift",crimeExperienceRequired:20,name:"Shoplifting",description:"Take merchandise before staff notice.",levelRequired:2,nerve:3,difficulty:28,minReward:80,maxReward:220,xp:16,crimeExperience:12,risk:12,successText:"The item leaves the store with you."},
{id:"burglary",crimeExperienceRequired:45,name:"Burglary",description:"Break into a property and search for valuables.",levelRequired:3,nerve:5,difficulty:38,minReward:150,maxReward:400,xp:22,crimeExperience:15,risk:16,successText:"You found something worth taking."},
{id:"vehicle-theft",crimeExperienceRequired:80,name:"Vehicle Theft",description:"Steal a parked vehicle and disappear.",levelRequired:4,nerve:6,difficulty:45,minReward:250,maxReward:650,xp:30,crimeExperience:20,risk:21,successText:"The vehicle is yours long enough to cash out."},
{id:"robbery",crimeExperienceRequired:125,name:"Armed Robbery",description:"Hit a high-value target under serious risk.",levelRequired:6,nerve:8,difficulty:54,minReward:500,maxReward:1200,xp:42,crimeExperience:28,risk:28,successText:"You leave with the score."},
{id:"bank-job",crimeExperienceRequired:190,name:"Bank Job",description:"Plan a major financial robbery.",levelRequired:9,nerve:10,difficulty:64,minReward:1000,maxReward:3000,xp:60,crimeExperience:40,risk:36,successText:"The vault gives up a portion of its money."},
{id:"major-heist",crimeExperienceRequired:275,name:"Major Heist",description:"Attempt a city-scale score.",levelRequired:13,nerve:12,difficulty:76,minReward:2500,maxReward:7500,xp:85,crimeExperience:55,risk:45,successText:"Against several sensible expectations, it worked."},
];
export function crimeUnlocked(c:Crime,crimeExperience:number){return crimeExperience>=c.crimeExperienceRequired}
export function getCrimeStatBonus(s:CombatStats){const avg=(s.strength+s.speed+s.dexterity)/3;return Math.min(20,Math.max(0,avg-1)*1.5)}
export function crimeSuccessChance(c:Crime,exp:number,_int=1,statBonus=0){return Math.max(8,Math.min(92,78-c.difficulty+Math.min(25,exp/20)+statBonus))}
export function randomReward(c:Crime){return Math.floor(c.minReward+Math.random()*(c.maxReward-c.minReward+1))}
export function rollCrimeOutcome(c:Crime,successChance:number):CrimeOutcome{const r=Math.random()*100;if(r<successChance)return"success";if(r<successChance+c.risk*.55)return"jailed";return r>92?"spooked":"failed"}
