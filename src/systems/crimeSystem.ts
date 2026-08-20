import { CombatStats } from "./progressionSystem";

export type CrimeOutcome="success"|"failed"|"spooked"|"jailed";
export type CrimeChoice = {
  id:string;
  label:string;
  description:string;
  chanceModifier:number;
  rewardMultiplier:number;
  heatModifier:number;
  masteryMultiplier:number;
};
export type Crime={
  id:string;name:string;description:string;levelRequired:number;crimeExperienceRequired:number;
  nerve:number;difficulty:number;minReward:number;maxReward:number;xp:number;crimeExperience:number;risk:number;
  successText:string;requiredIntel?:string;grantsIntel?:string;choices:CrimeChoice[];
};

const cautious:CrimeChoice={id:"cautious",label:"Play It Safe",description:"Reduce the payout and keep the risk under control.",chanceModifier:8,rewardMultiplier:.72,heatModifier:-2,masteryMultiplier:.9};
const balanced:CrimeChoice={id:"balanced",label:"Standard Approach",description:"Take the normal route with balanced risk and reward.",chanceModifier:0,rewardMultiplier:1,heatModifier:0,masteryMultiplier:1};
const bold:CrimeChoice={id:"bold",label:"Push Your Luck",description:"Take the riskier opportunity for a larger payout and more mastery.",chanceModifier:-10,rewardMultiplier:1.55,heatModifier:4,masteryMultiplier:1.35};

export const CRIMES:Crime[]=[
{id:"pickpocket",crimeExperienceRequired:0,name:"Pickpocket",description:"Work a crowded block and choose how aggressively to target valuables.",levelRequired:1,nerve:2,difficulty:18,minReward:40,maxReward:110,xp:10,crimeExperience:8,risk:8,successText:"You got away clean.",grantsIntel:"access-card",choices:[cautious,balanced,bold]},
{id:"shoplift",crimeExperienceRequired:12,name:"Retail Theft",description:"Slip merchandise out of a busy store while deciding how much risk to take.",levelRequired:1,nerve:3,difficulty:25,minReward:70,maxReward:210,xp:15,crimeExperience:11,risk:11,successText:"The goods leave with you.",choices:[cautious,balanced,bold]},
{id:"package-swipe",crimeExperienceRequired:28,name:"Package Swipe",description:"Target unattended deliveries across residential blocks.",levelRequired:2,nerve:3,difficulty:29,minReward:90,maxReward:260,xp:17,crimeExperience:12,risk:12,successText:"The package disappears into the city.",choices:[cautious,balanced,bold]},
{id:"burglary",crimeExperienceRequired:48,name:"Burglary",description:"Enter a property and decide whether to leave quickly or search deeper.",levelRequired:3,nerve:5,difficulty:38,minReward:160,maxReward:450,xp:24,crimeExperience:16,risk:17,successText:"You found something worth taking.",requiredIntel:"access-card",grantsIntel:"vehicle-code",choices:[cautious,balanced,bold]},
{id:"cargo-theft",crimeExperienceRequired:72,name:"Cargo Theft",description:"Intercept valuable freight moving through the industrial district.",levelRequired:4,nerve:5,difficulty:42,minReward:220,maxReward:620,xp:29,crimeExperience:19,risk:19,successText:"The cargo changed hands.",choices:[cautious,balanced,bold]},
{id:"vehicle-theft",crimeExperienceRequired:100,name:"Vehicle Theft",description:"Take a high-value vehicle and decide how long to keep pushing the score.",levelRequired:5,nerve:6,difficulty:47,minReward:300,maxReward:760,xp:34,crimeExperience:22,risk:23,successText:"The vehicle is yours long enough to cash out.",requiredIntel:"vehicle-code",choices:[cautious,balanced,bold]},
{id:"data-breach",crimeExperienceRequired:135,name:"Data Breach",description:"Exploit stolen access credentials for valuable digital information.",levelRequired:6,nerve:7,difficulty:52,minReward:420,maxReward:1000,xp:40,crimeExperience:26,risk:25,successText:"The data cache was worth the risk.",grantsIntel:"vault-intel",choices:[cautious,balanced,bold]},
{id:"robbery",crimeExperienceRequired:175,name:"High-Value Robbery",description:"Hit a valuable target and choose between a quick exit or chasing the full score.",levelRequired:7,nerve:8,difficulty:57,minReward:600,maxReward:1450,xp:48,crimeExperience:31,risk:30,successText:"You leave with the score.",choices:[cautious,balanced,bold]},
{id:"warehouse-job",crimeExperienceRequired:225,name:"Warehouse Job",description:"Use city intel to hit a secured warehouse after hours.",levelRequired:9,nerve:9,difficulty:62,minReward:850,maxReward:2200,xp:56,crimeExperience:36,risk:34,successText:"The warehouse paid out.",choices:[cautious,balanced,bold]},
{id:"bank-job",crimeExperienceRequired:290,name:"Bank Job",description:"Coordinate a major financial score with multiple exit strategies.",levelRequired:11,nerve:11,difficulty:68,minReward:1400,maxReward:3900,xp:70,crimeExperience:44,risk:39,successText:"The vault gives up part of its money.",requiredIntel:"vault-intel",choices:[cautious,balanced,bold]},
{id:"major-heist",crimeExperienceRequired:390,name:"Major Heist",description:"Attempt a city-scale operation where every decision changes the risk profile.",levelRequired:15,nerve:13,difficulty:77,minReward:3200,maxReward:9000,xp:95,crimeExperience:60,risk:47,successText:"Against several sensible expectations, it worked.",choices:[cautious,balanced,bold]},
];

export function crimeUnlocked(c:Crime,crimeExperience:number){return crimeExperience>=c.crimeExperienceRequired}
export function getCrimeStatBonus(s:CombatStats){const avg=(s.strength+s.speed+s.dexterity)/3;return Math.min(20,Math.max(0,avg-1)*1.5)}
export function crimeMasteryLevel(masteryXp:number){return Math.min(20,Math.floor(Math.max(0,masteryXp)/50))}
export function crimeSuccessChance(c:Crime,exp:number,_int=1,statBonus=0,masteryXp=0,choice?:CrimeChoice){
  const masteryBonus=Math.min(12,crimeMasteryLevel(masteryXp)*.6);
  return Math.max(8,Math.min(94,78-c.difficulty+Math.min(25,exp/20)+statBonus+masteryBonus+(choice?.chanceModifier??0)));
}
export function randomReward(c:Crime){return Math.floor(c.minReward+Math.random()*(c.maxReward-c.minReward+1))}
export function rollCrimeOutcome(c:Crime,successChance:number):CrimeOutcome{const r=Math.random()*100;if(r<successChance)return"success";if(r<successChance+c.risk*.55)return"jailed";return r>92?"spooked":"failed"}
