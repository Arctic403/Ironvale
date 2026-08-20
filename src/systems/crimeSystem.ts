import { CombatStats } from "./progressionSystem";

export type CrimeOutcome="success"|"failed"|"spooked"|"jailed";
export type CrimeChoice = {
  id:string; label:string; description:string; chanceModifier:number; rewardMultiplier:number;
  heatModifier:number; masteryMultiplier:number;
};
export type Crime={
  id:string;name:string;description:string;levelRequired:number;crimeExperienceRequired:number;
  nerve:number;difficulty:number;minReward:number;maxReward:number;xp:number;crimeExperience:number;risk:number;
  successText:string;requiredIntel?:string;grantsIntel?:string;choices:CrimeChoice[];
};

export type CrimeRunModifiers = {
  chanceModifier:number;
  rewardMultiplier:number;
  heatModifier:number;
  arrestModifier:number;
  injuryChance:number;
  bountyChance:number;
  bountyMultiplier:number;
  lootMultiplier:number;
  masteryMultiplier:number;
  extraXpMultiplier:number;
  riskLabel:string;
  story:string[];
};

export type CrimeEventOption = {
  id:string;
  label:string;
  description:string;
  risk:"LOW"|"MEDIUM"|"HIGH"|"EXTREME";
  modifiers:Partial<Omit<CrimeRunModifiers,"riskLabel"|"story">>;
  resultText:string;
  rare?:boolean;
  requiredStat?:{stat:"strength"|"speed"|"dexterity";value:number};
};

export type CrimeEvent = {
  id:string;
  title:string;
  text:string;
  minMastery?:number;
  rare?:boolean;
  crimes?:string[];
  options:CrimeEventOption[];
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

export const CRIME_EVENTS:CrimeEvent[]=[
  {id:"witness",title:"Someone Saw Something",text:"A witness pauses and starts paying attention. You have seconds to decide how much attention you want to risk.",options:[
    {id:"leave",label:"Walk Away",description:"Cut the score short and protect the escape.",risk:"LOW",modifiers:{chanceModifier:8,rewardMultiplier:.82,heatModifier:-2,arrestModifier:-4},resultText:"You abandon the best part of the score before the witness gets a clear look."},
    {id:"finish",label:"Finish Fast",description:"Keep the score alive and move before they react.",risk:"MEDIUM",modifiers:{chanceModifier:-2,rewardMultiplier:1.12,heatModifier:1,bountyChance:.03},resultText:"You finish the move while the witness is still deciding what they saw."}
  ]},
  {id:"extra-cache",title:"A Better Score",text:"You spot a second stash that was not part of the plan. It could be junk—or the best thing here.",options:[
    {id:"bank",label:"Take What You Have",description:"Keep the current haul and get moving.",risk:"LOW",modifiers:{chanceModifier:4,rewardMultiplier:1.02},resultText:"You ignore the temptation and protect the score already in hand."},
    {id:"search",label:"Search The Stash",description:"Spend more time for better cash and item odds.",risk:"HIGH",modifiers:{chanceModifier:-7,rewardMultiplier:1.35,heatModifier:2,arrestModifier:4,lootMultiplier:1.8,bountyChance:.04},resultText:"You stay longer and pull extra valuables from the hidden stash."}
  ]},
  {id:"security",title:"Security Changes",text:"A patrol pattern changes halfway through the job. The easy route is gone.",options:[
    {id:"reroute",label:"Take The Long Exit",description:"Lose time but lower the chance of getting boxed in.",risk:"MEDIUM",modifiers:{chanceModifier:3,rewardMultiplier:.94,heatModifier:-1},resultText:"You reroute through a slower exit and avoid the worst of the patrol."},
    {id:"push",label:"Beat The Patrol",description:"Race the security window before it closes.",risk:"HIGH",modifiers:{chanceModifier:-6,rewardMultiplier:1.22,heatModifier:3,arrestModifier:5,injuryChance:.04},resultText:"You push through the closing window with almost no room for error."}
  ]},
  {id:"locked-case",title:"Locked Display Case",text:"A reinforced case holds something that looks far more valuable than the original target.",crimes:["shoplift","burglary","warehouse-job","robbery","bank-job","major-heist"],options:[
    {id:"skip",label:"Leave It",description:"Do not turn a clean score into a disaster.",risk:"LOW",modifiers:{chanceModifier:5},resultText:"You leave the case untouched and keep moving."},
    {id:"force",label:"Force It Open",description:"A noisy attempt with a major reward upside.",risk:"HIGH",modifiers:{chanceModifier:-8,rewardMultiplier:1.42,heatModifier:4,arrestModifier:6,injuryChance:.06,lootMultiplier:2.2,bountyChance:.06},resultText:"The case gives way and the haul suddenly gets much more interesting."}
  ]},
  {id:"collector-item",title:"RARE: Collector Piece",text:"Behind the ordinary valuables is a collector piece with a tiny city-wide supply. Leaving now is safe. Taking it could change the entire score.",rare:true,minMastery:2,options:[
    {id:"leave",label:"Leave The Rare Item",description:"Bank the existing score with almost no added exposure.",risk:"LOW",modifiers:{chanceModifier:7,heatModifier:-1},resultText:"You leave the collector piece exactly where you found it."},
    {id:"take",label:"Take It",description:"Huge loot odds, but this kind of item gets noticed.",risk:"EXTREME",rare:true,modifiers:{chanceModifier:-12,rewardMultiplier:1.8,heatModifier:7,arrestModifier:9,injuryChance:.08,bountyChance:.18,bountyMultiplier:2.2,lootMultiplier:4,masteryMultiplier:1.3},resultText:"You take the collector piece. If anyone connects it to you, the city will remember."}
  ]},
  {id:"back-room",title:"Unmarked Back Room",text:"A door that should be locked is slightly open. Whatever is behind it was never part of the job.",crimes:["burglary","cargo-theft","warehouse-job","bank-job","major-heist"],minMastery:1,options:[
    {id:"ignore",label:"Ignore It",description:"Stick to the plan.",risk:"LOW",modifiers:{chanceModifier:3},resultText:"You stay disciplined and keep to the original route."},
    {id:"peek",label:"Check The Room",description:"Possible contraband, candy caches, collectibles, or nothing.",risk:"HIGH",modifiers:{chanceModifier:-5,rewardMultiplier:1.18,heatModifier:2,lootMultiplier:2.5,arrestModifier:3},resultText:"The back room adds a completely different pile of goods to the score."}
  ]},
  {id:"clean-exit",title:"Clean Exit Window",text:"For a moment, everything lines up: no eyes, no patrol, no delay. You can cash out now or use the quiet window to push farther.",options:[
    {id:"exit",label:"Cash Out",description:"Convert the opening into a safer escape.",risk:"LOW",modifiers:{chanceModifier:9,rewardMultiplier:.9,heatModifier:-3,arrestModifier:-5},resultText:"You use the clean window and disappear before the situation changes."},
    {id:"deeper",label:"Go Deeper",description:"Give up the safe exit for a stronger score.",risk:"HIGH",modifiers:{chanceModifier:-8,rewardMultiplier:1.38,heatModifier:3,lootMultiplier:1.6,bountyChance:.05},resultText:"You let the safe exit close and chase a larger haul."}
  ]},
  {id:"nothing-weird",title:"Hold Your Nerve",text:"For once, nothing unexpected happens. The window is open and the next move is yours.",options:[
    {id:"continue",label:"Continue The Job",description:"Keep moving with the original plan.",risk:"MEDIUM",modifiers:{masteryMultiplier:1.04},resultText:"You keep your nerve and move through the quiet part of the job."}
  ]},
  {id:"three-way",title:"Three Ways Out",text:"The situation splits into three possible paths: one protects the score, one protects you, and one gambles on both.",options:[
    {id:"protect-self",label:"Protect The Escape",description:"Give up part of the upside to preserve the cleanest exit.",risk:"LOW",modifiers:{chanceModifier:7,rewardMultiplier:.86,heatModifier:-2,arrestModifier:-3},resultText:"You prioritize the escape route and sacrifice part of the haul."},
    {id:"protect-score",label:"Protect The Haul",description:"Keep the valuables even if the route gets hotter.",risk:"HIGH",modifiers:{chanceModifier:-4,rewardMultiplier:1.28,heatModifier:3,bountyChance:.04},resultText:"You hold onto the full haul and accept a hotter exit."},
    {id:"all-in",label:"Take The Hidden Route",description:"A difficult opening that can preserve the haul and multiply item odds.",risk:"EXTREME",rare:true,requiredStat:{stat:"dexterity",value:16},modifiers:{chanceModifier:-1,rewardMultiplier:1.3,lootMultiplier:2.1,masteryMultiplier:1.25,arrestModifier:4,bountyChance:.07},resultText:"Your dexterity lets you take an opening most people could not use."}
  ]},
  {id:"heavy-obstacle",title:"Unexpected Obstacle",text:"Something heavy blocks the planned route. You can abandon the extra loot or force a new opening.",crimes:["cargo-theft","burglary","warehouse-job","bank-job","major-heist"],options:[
    {id:"leave-extra",label:"Leave The Extra Loot",description:"Stay mobile and keep the job controlled.",risk:"LOW",modifiers:{chanceModifier:4,rewardMultiplier:.92},resultText:"You leave the bulky valuables behind and stay mobile."},
    {id:"move-it",label:"Clear The Obstacle",description:"Strength can turn the blocked route back into a profitable one.",risk:"HIGH",requiredStat:{stat:"strength",value:15},modifiers:{rewardMultiplier:1.32,lootMultiplier:1.5,injuryChance:.04,masteryMultiplier:1.15},resultText:"You clear the obstacle and recover the more valuable part of the score."}
  ]},
  {id:"timing-window",title:"Closing Window",text:"The opportunity is disappearing fast. A quick player can still squeeze value out of it.",options:[
    {id:"cut",label:"Cut The Attempt Short",description:"Take a smaller result before the window closes.",risk:"LOW",modifiers:{chanceModifier:6,rewardMultiplier:.8,heatModifier:-1},resultText:"You stop chasing the full score and secure what you can."},
    {id:"beat-clock",label:"Beat The Window",description:"Speed can preserve the full score without taking the slow route.",risk:"HIGH",requiredStat:{stat:"speed",value:14},modifiers:{chanceModifier:2,rewardMultiplier:1.22,lootMultiplier:1.25,arrestModifier:2},resultText:"Your speed keeps the opportunity alive just long enough."}
  ]},
  {id:"expert-route",title:"Mastery Read",text:"Experience tells you something about this scene that a beginner would miss.",minMastery:4,options:[
    {id:"exploit",label:"Use The Opening",description:"Your mastery creates a cleaner, more profitable route.",risk:"MEDIUM",modifiers:{chanceModifier:6,rewardMultiplier:1.2,lootMultiplier:1.25,masteryMultiplier:1.2},resultText:"You recognize the pattern and exploit an opening most people would never notice."},
    {id:"jackpot",label:"Exploit It Fully",description:"Turn expert knowledge into a dangerous jackpot attempt.",risk:"EXTREME",rare:true,modifiers:{chanceModifier:-5,rewardMultiplier:1.65,heatModifier:4,arrestModifier:5,bountyChance:.1,lootMultiplier:3,masteryMultiplier:1.5,extraXpMultiplier:1.3},resultText:"You push your mastery to its limit and turn the opening into a major score."}
  ]}
];

export const emptyCrimeRunModifiers=():CrimeRunModifiers=>({chanceModifier:0,rewardMultiplier:1,heatModifier:0,arrestModifier:0,injuryChance:0,bountyChance:0,bountyMultiplier:1,lootMultiplier:1,masteryMultiplier:1,extraXpMultiplier:1,riskLabel:"BASE",story:[]});

export function applyCrimeEventOption(current:CrimeRunModifiers, option:CrimeEventOption):CrimeRunModifiers{
  const m=option.modifiers;
  return {
    chanceModifier:current.chanceModifier+(m.chanceModifier??0),
    rewardMultiplier:current.rewardMultiplier*(m.rewardMultiplier??1),
    heatModifier:current.heatModifier+(m.heatModifier??0),
    arrestModifier:current.arrestModifier+(m.arrestModifier??0),
    injuryChance:Math.min(.65,current.injuryChance+(m.injuryChance??0)),
    bountyChance:Math.min(.75,current.bountyChance+(m.bountyChance??0)),
    bountyMultiplier:current.bountyMultiplier*(m.bountyMultiplier??1),
    lootMultiplier:current.lootMultiplier*(m.lootMultiplier??1),
    masteryMultiplier:current.masteryMultiplier*(m.masteryMultiplier??1),
    extraXpMultiplier:current.extraXpMultiplier*(m.extraXpMultiplier??1),
    riskLabel:option.risk,
    story:[...current.story,option.resultText],
  };
}

export function generateCrimeEvents(crime:Crime, masteryLevel:number):CrimeEvent[]{
  const eligible=CRIME_EVENTS.filter(e=>(!e.crimes||e.crimes.includes(crime.id))&&(e.minMastery??0)<=masteryLevel);
  const normal=eligible.filter(e=>!e.rare).sort(()=>Math.random()-.5);
  const rare=eligible.filter(e=>e.rare).sort(()=>Math.random()-.5);
  const stageRoll=Math.random();
  const count=stageRoll<.32?1:stageRoll<.84?2:3;
  const chosen=normal.slice(0,count);
  // Rare opportunities should feel genuinely rare, but mastery improves the chance slightly.
  if(rare.length&&Math.random()<Math.min(.16,.035+masteryLevel*.008)) chosen.splice(Math.min(chosen.length,1+Math.floor(Math.random()*chosen.length)),0,rare[0]);
  return chosen.slice(0,3);
}

export function crimeUnlocked(c:Crime,crimeExperience:number){return crimeExperience>=c.crimeExperienceRequired}
export function getCrimeStatBonus(s:CombatStats){const avg=(s.strength+s.speed+s.dexterity)/3;return Math.min(20,Math.max(0,avg-1)*1.5)}
export function crimeMasteryLevel(masteryXp:number){return Math.min(20,Math.floor(Math.max(0,masteryXp)/50))}
export function crimeSuccessChance(c:Crime,exp:number,_int=1,statBonus=0,masteryXp=0,choice?:CrimeChoice){
  const masteryBonus=Math.min(12,crimeMasteryLevel(masteryXp)*.6);
  return Math.max(8,Math.min(94,78-c.difficulty+Math.min(25,exp/20)+statBonus+masteryBonus+(choice?.chanceModifier??0)));
}
export function randomReward(c:Crime){return Math.floor(c.minReward+Math.random()*(c.maxReward-c.minReward+1))}
export function rollCrimeOutcome(c:Crime,successChance:number):CrimeOutcome{const r=Math.random()*100;if(r<successChance)return"success";if(r<successChance+c.risk*.55)return"jailed";return r>92?"spooked":"failed"}
