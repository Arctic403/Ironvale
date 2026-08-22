import type { CrimeTarget } from "./crimeActivities";

export type PickpocketMovement = "WAITING" | "STROLLING" | "WALKING" | "RUSHING" | "JOGGING" | "CYCLING";
export type PickpocketWealth = "BROKE" | "LOW" | "AVERAGE" | "COMFORTABLE" | "WEALTHY" | "ELITE";
export type PickpocketAwareness = "VERY LOW" | "LOW" | "MEDIUM" | "HIGH" | "VERY HIGH";
export type PickpocketApproachId = "blend" | "crowd" | "distraction" | "quick";

export type PickpocketApproach = {
  id: PickpocketApproachId;
  name: string;
  description: string;
  chanceModifier: number;
  rewardMultiplier: number;
  heatModifier: number;
  arrestModifier: number;
  favoredMovements: PickpocketMovement[];
};

export type PickpocketAttemptRead = {
  opening: number;
  openingLabel: string;
  chanceModifier: number;
  rewardMultiplier: number;
  heatModifier: number;
  arrestModifier: number;
  suspicion: "LOW" | "RISING" | "HIGH" | "CRITICAL";
  summary: string;
};

export const PICKPOCKET_APPROACHES: PickpocketApproach[] = [
  {id:"blend",name:"Blend In",description:"Low-profile approach. Strongest around slow or stationary pedestrians.",chanceModifier:3,rewardMultiplier:.96,heatModifier:-1,arrestModifier:-1,favoredMovements:["WAITING","STROLLING"]},
  {id:"crowd",name:"Use the Crowd",description:"Leans on busy foot traffic. Best against ordinary walking or rushing targets.",chanceModifier:1,rewardMultiplier:1.05,heatModifier:0,arrestModifier:0,favoredMovements:["WALKING","RUSHING"]},
  {id:"distraction",name:"Create a Distraction",description:"Higher-variance game approach that can open better scores but raises attention.",chanceModifier:5,rewardMultiplier:1.12,heatModifier:1,arrestModifier:2,favoredMovements:["WAITING","WALKING"]},
  {id:"quick",name:"Quick Move",description:"Fast commitment for short windows. Better against fast targets, harsher if mistimed.",chanceModifier:-1,rewardMultiplier:1.16,heatModifier:1,arrestModifier:2,favoredMovements:["RUSHING","JOGGING","CYCLING"]},
];

export type LivePickpocketNpc = {
  id: string;
  name: string;
  area: string;
  movement: PickpocketMovement;
  wealth: PickpocketWealth;
  awareness: PickpocketAwareness;
  description: string;
  windowMs: number;
  spawnedAt: number;
  expiresAt: number;
  target: CrimeTarget;
  rare: boolean;
  dangerNote?: string;
  clues: string[];
};

type PedestrianTemplate = {
  name: string;
  area: string;
  movement: PickpocketMovement;
  wealth: PickpocketWealth;
  awareness: PickpocketAwareness;
  description: string;
  difficulty: number;
  nerve: number;
  minReward: number;
  maxReward: number;
  heat: number;
  weight: number;
  dayWeight?: number;
  nightWeight?: number;
  rushWeight?: number;
  weekendWeight?: number;
  rare?: boolean;
  dangerNote?: string;
  specialLootIds?: string[];
  specialLootChance?: number;
};

const MOVEMENT_WINDOWS: Record<PickpocketMovement, [number, number]> = {
  WAITING: [14000, 22000],
  STROLLING: [11000, 17000],
  WALKING: [8500, 14000],
  RUSHING: [6000, 9500],
  JOGGING: [4500, 7000],
  CYCLING: [3500, 5600],
};

const PEDESTRIANS: PedestrianTemplate[] = [
  {name:"Homeless Panhandler",area:"Downtown",movement:"WAITING",wealth:"BROKE",awareness:"MEDIUM",description:"Stationary and easy to read, but usually carrying very little.",difficulty:14,nerve:1,minReward:8,maxReward:45,heat:1,weight:12,nightWeight:1.15},
  {name:"Street Drifter",area:"Southside",movement:"STROLLING",wealth:"LOW",awareness:"LOW",description:"Moving slowly through the block with little obvious value.",difficulty:17,nerve:1,minReward:15,maxReward:70,heat:1,weight:10,nightWeight:1.25},
  {name:"Construction Worker",area:"Industrial District",movement:"WALKING",wealth:"AVERAGE",awareness:"MEDIUM",description:"Work gear, a busy route, and an ordinary city payday.",difficulty:24,nerve:2,minReward:55,maxReward:190,heat:2,weight:9,dayWeight:1.8},
  {name:"Delivery Driver",area:"City Center",movement:"RUSHING",wealth:"AVERAGE",awareness:"MEDIUM",description:"In a hurry between stops and rarely standing still for long.",difficulty:28,nerve:2,minReward:70,maxReward:230,heat:2,weight:8,dayWeight:1.45,rushWeight:1.3},
  {name:"Food Courier",area:"Downtown",movement:"CYCLING",wealth:"LOW",awareness:"HIGH",description:"Fast-moving target with a very short opportunity window.",difficulty:33,nerve:2,minReward:45,maxReward:180,heat:2,weight:7,dayWeight:1.35},
  {name:"Morning Jogger",area:"Central Park",movement:"JOGGING",wealth:"COMFORTABLE",awareness:"MEDIUM",description:"Passes quickly with fitness gear and little time to decide.",difficulty:31,nerve:2,minReward:80,maxReward:280,heat:2,weight:7,dayWeight:1.6},
  {name:"City Cyclist",area:"Financial District",movement:"CYCLING",wealth:"COMFORTABLE",awareness:"HIGH",description:"A fast commuter; valuable enough to tempt you, hard enough to punish hesitation.",difficulty:38,nerve:3,minReward:120,maxReward:380,heat:3,weight:6,rushWeight:1.8},
  {name:"Office Worker",area:"Financial District",movement:"RUSHING",wealth:"COMFORTABLE",awareness:"MEDIUM",description:"Part of the commuter wave, carrying a normal professional-day loadout.",difficulty:29,nerve:2,minReward:95,maxReward:330,heat:2,weight:12,dayWeight:1.35,rushWeight:2.2},
  {name:"Distracted Commuter",area:"Transit Platforms",movement:"WALKING",wealth:"AVERAGE",awareness:"VERY LOW",description:"Focused on the next train instead of the crowd around them.",difficulty:18,nerve:2,minReward:50,maxReward:175,heat:1,weight:12,rushWeight:2.4},
  {name:"Tourist With Map",area:"City Center",movement:"STROLLING",wealth:"COMFORTABLE",awareness:"LOW",description:"Slow-moving visitor taking in the city and carrying travel cash.",difficulty:24,nerve:2,minReward:90,maxReward:320,heat:2,weight:10,dayWeight:1.3,weekendWeight:1.4},
  {name:"Backpacker",area:"Transit Platforms",movement:"WALKING",wealth:"LOW",awareness:"LOW",description:"Plenty of pockets, usually modest value.",difficulty:21,nerve:2,minReward:40,maxReward:165,heat:1,weight:8,dayWeight:1.2},
  {name:"Retail Employee",area:"Shopping Row",movement:"RUSHING",wealth:"AVERAGE",awareness:"MEDIUM",description:"Heading between shifts with a short window to act.",difficulty:27,nerve:2,minReward:70,maxReward:250,heat:2,weight:8,dayWeight:1.25},
  {name:"Nightclub Patron",area:"Entertainment Strip",movement:"STROLLING",wealth:"COMFORTABLE",awareness:"LOW",description:"Nightlife crowd member with better-than-average cash potential.",difficulty:30,nerve:3,minReward:120,maxReward:430,heat:3,weight:9,nightWeight:2.3,weekendWeight:1.45,specialLootIds:["nightclub-ticket","moon-chews"],specialLootChance:.05},
  {name:"Late-Night Regular",area:"Entertainment Strip",movement:"WALKING",wealth:"AVERAGE",awareness:"VERY LOW",description:"Tired, distracted, and lingering after the busiest part of the night.",difficulty:25,nerve:2,minReward:80,maxReward:300,heat:3,weight:8,nightWeight:2.0},
  {name:"Casino Guest",area:"Casino District",movement:"STROLLING",wealth:"WEALTHY",awareness:"MEDIUM",description:"A valuable target moving between nightlife and casino traffic.",difficulty:42,nerve:4,minReward:260,maxReward:850,heat:5,weight:5,nightWeight:2.0,weekendWeight:1.35,specialLootIds:["old-city-token","black-envelope"],specialLootChance:.055},
  {name:"High Roller",area:"Casino District",movement:"WAITING",wealth:"ELITE",awareness:"HIGH",description:"Rare, rich, and surrounded by the kind of attention that makes mistakes expensive.",difficulty:62,nerve:6,minReward:700,maxReward:2300,heat:9,weight:.7,nightWeight:2.2,weekendWeight:1.6,rare:true,dangerNote:"Heavy security presence",specialLootIds:["prototype-key","encrypted-chip"],specialLootChance:.11},
  {name:"Luxury Shopper",area:"Financial District",movement:"STROLLING",wealth:"WEALTHY",awareness:"MEDIUM",description:"Premium bags and a premium payout ceiling.",difficulty:44,nerve:4,minReward:280,maxReward:920,heat:5,weight:4,dayWeight:1.55,weekendWeight:1.4,specialLootIds:["black-envelope","old-city-token"],specialLootChance:.06},
  {name:"Corporate Executive",area:"Financial District",movement:"RUSHING",wealth:"WEALTHY",awareness:"HIGH",description:"A fast professional target with expensive belongings and very little margin for error.",difficulty:51,nerve:5,minReward:380,maxReward:1250,heat:6,weight:3.5,dayWeight:1.8,rushWeight:1.55,specialLootIds:["encrypted-chip"],specialLootChance:.07},
  {name:"Private Courier",area:"Commerce Row",movement:"WALKING",wealth:"WEALTHY",awareness:"VERY HIGH",description:"Rare valuables are possible, but the courier is trained to notice trouble.",difficulty:57,nerve:5,minReward:430,maxReward:1450,heat:7,weight:2.4,dayWeight:1.4,rare:true,dangerNote:"High awareness",specialLootIds:["encrypted-chip","access-token"],specialLootChance:.09},
  {name:"Jewelry Buyer",area:"Luxury District",movement:"STROLLING",wealth:"ELITE",awareness:"HIGH",description:"A rare premium pedestrian with an unusually valuable loot ceiling.",difficulty:64,nerve:6,minReward:800,maxReward:2800,heat:9,weight:.55,dayWeight:1.4,weekendWeight:1.4,rare:true,specialLootIds:["prototype-key","old-city-token"],specialLootChance:.12},
  {name:"Tech Founder",area:"Downtown",movement:"WALKING",wealth:"ELITE",awareness:"MEDIUM",description:"An uncommon high-value target carrying expensive tech and data collectibles.",difficulty:58,nerve:6,minReward:650,maxReward:2200,heat:8,weight:.7,dayWeight:1.5,rare:true,specialLootIds:["encrypted-chip","prototype-key"],specialLootChance:.1},
  {name:"Celebrity Guest",area:"Entertainment Strip",movement:"WAITING",wealth:"ELITE",awareness:"VERY HIGH",description:"Extremely rare appearance with huge value and equally huge attention.",difficulty:72,nerve:7,minReward:1200,maxReward:4200,heat:12,weight:.18,nightWeight:2.8,weekendWeight:1.8,rare:true,dangerNote:"Entourage nearby",specialLootIds:["prototype-key","old-city-token","black-envelope"],specialLootChance:.18},
  {name:"Security Contractor",area:"Downtown",movement:"WALKING",wealth:"COMFORTABLE",awareness:"VERY HIGH",description:"Not an attractive target unless your skill is much better than your judgment.",difficulty:66,nerve:5,minReward:220,maxReward:720,heat:10,weight:1.3,dayWeight:1.2,dangerNote:"Very high detection risk"},
  {name:"Off-Duty Officer",area:"City Center",movement:"STROLLING",wealth:"AVERAGE",awareness:"VERY HIGH",description:"A dangerous city encounter. High mastery helps you recognize the risk before committing.",difficulty:76,nerve:5,minReward:150,maxReward:600,heat:14,weight:.65,nightWeight:1.2,dangerNote:"Law-enforcement risk"},
  {name:"Street Vendor",area:"Downtown",movement:"WAITING",wealth:"AVERAGE",awareness:"HIGH",description:"Stationary but constantly watching the people around the stand.",difficulty:35,nerve:3,minReward:100,maxReward:360,heat:3,weight:6,dayWeight:1.55},
  {name:"Restaurant Manager",area:"Entertainment Strip",movement:"RUSHING",wealth:"COMFORTABLE",awareness:"MEDIUM",description:"Moving between venues with a decent cash range and a short window.",difficulty:36,nerve:3,minReward:140,maxReward:500,heat:4,weight:5,nightWeight:1.5},
  {name:"Hotel Guest",area:"Downtown",movement:"STROLLING",wealth:"WEALTHY",awareness:"LOW",description:"Visitor carrying travel money and occasionally something collectible.",difficulty:36,nerve:3,minReward:180,maxReward:650,heat:4,weight:5,nightWeight:1.2,weekendWeight:1.35,specialLootIds:["black-envelope"],specialLootChance:.055},
  {name:"Business Traveler",area:"Airport Link",movement:"RUSHING",wealth:"WEALTHY",awareness:"MEDIUM",description:"High-value travel traffic that appears more often around commuter windows.",difficulty:46,nerve:4,minReward:280,maxReward:980,heat:5,weight:3.2,rushWeight:1.65,specialLootIds:["encrypted-chip"],specialLootChance:.06},
];

function randomBetween(min:number,max:number){ return min + Math.random() * (max-min); }
function pickWeighted<T>(entries:{value:T;weight:number}[]):T{
  const total=entries.reduce((sum,e)=>sum+Math.max(0,e.weight),0);
  let roll=Math.random()*Math.max(.001,total);
  for(const entry of entries){ roll-=Math.max(0,entry.weight); if(roll<=0)return entry.value; }
  return entries[entries.length-1]!.value;
}

function torontoClock(now:number){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(now));
  const get=(type:string)=>parts.find((p)=>p.type===type)?.value??"0";
  const weekdays:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return {hour:Number(get("hour"))+Number(get("minute"))/60,weekday:weekdays[get("weekday")]??0};
}

function awarenessPenalty(value:PickpocketAwareness){
  return value==="VERY LOW"?5:value==="LOW"?2:value==="MEDIUM"?0:value==="HIGH"?-4:-8;
}

function pickpocketClues(template:PedestrianTemplate){
  const clues:string[]=[];
  if(template.awareness==="VERY LOW"||template.awareness==="LOW") clues.push("Distracted by surroundings");
  if(template.awareness==="HIGH"||template.awareness==="VERY HIGH") clues.push("Frequently scans the crowd");
  if(template.movement==="RUSHING"||template.movement==="JOGGING"||template.movement==="CYCLING") clues.push("Very short decision window");
  if(template.movement==="WAITING"||template.movement==="STROLLING") clues.push("Slow, readable movement");
  if(template.wealth==="WEALTHY"||template.wealth==="ELITE") clues.push("Expensive belongings visible");
  if(template.wealth==="BROKE"||template.wealth==="LOW") clues.push("Little obvious value");
  if(template.rare) clues.push("Unusual target — bigger upside and attention");
  if(template.dangerNote) clues.push(template.dangerNote);
  return clues.slice(0,3);
}

export function getPickpocketOpening(npc:LivePickpocketNpc, now=Date.now()){
  const elapsed=Math.max(0,now-npc.spawnedAt);
  const cycle=8000;
  const phase=(elapsed%cycle)/cycle;
  const wave=(Math.sin(phase*Math.PI*2-Math.PI/2)+1)/2;
  const movementPenalty=npc.movement==="CYCLING"?13:npc.movement==="JOGGING"?9:npc.movement==="RUSHING"?5:0;
  return Math.max(4,Math.min(100,Math.round(wave*100-movementPenalty)));
}

export function evaluatePickpocketAttempt(npc:LivePickpocketNpc, approachId:PickpocketApproachId, now=Date.now(), crackdown=false):PickpocketAttemptRead{
  const approach=PICKPOCKET_APPROACHES.find(x=>x.id===approachId)??PICKPOCKET_APPROACHES[0];
  const opening=getPickpocketOpening(npc,now);
  const favored=approach.favoredMovements.includes(npc.movement);
  const timing=opening>=78?10:opening>=58?5:opening>=35?0:opening>=18?-7:-13;
  const mismatch=favored?4:-3;
  const crackdownChance=crackdown?-6:0;
  const chanceModifier=approach.chanceModifier+timing+mismatch+awarenessPenalty(npc.awareness)+crackdownChance;
  const arrestModifier=approach.arrestModifier+(opening<25?5:opening<45?2:0)+(crackdown?4:0)+(npc.awareness==="VERY HIGH"?3:0);
  const heatModifier=approach.heatModifier+(crackdown?2:0)+(opening<20?1:0);
  const rewardMultiplier=Math.max(.75,approach.rewardMultiplier*(opening>=78?1.08:opening<25?.9:1));
  const suspicionScore=Math.max(0,Math.min(100,45-opening+(npc.awareness==="VERY HIGH"?28:npc.awareness==="HIGH"?17:npc.awareness==="MEDIUM"?8:0)+(favored?-6:7)+(crackdown?18:0)));
  const suspicion=suspicionScore>=72?"CRITICAL":suspicionScore>=50?"HIGH":suspicionScore>=27?"RISING":"LOW";
  const openingLabel=opening>=78?"CLEAN OPENING":opening>=58?"GOOD WINDOW":opening>=35?"MIXED":opening>=18?"WATCHED":"BAD WINDOW";
  const summary=`${approach.name} · ${openingLabel}${favored?" · good fit":" · poor fit"}${crackdown?" · crackdown pressure":""}`;
  return {opening,openingLabel,chanceModifier,rewardMultiplier,heatModifier,arrestModifier,suspicion,summary};
}

export function spawnLivePickpocket(now=Date.now(), sequence=0):LivePickpocketNpc{
  const clock=torontoClock(now);
  const night=clock.hour>=19||clock.hour<5;
  const rush=(clock.hour>=6.5&&clock.hour<=9.5)||(clock.hour>=15.5&&clock.hour<=19);
  const weekend=clock.weekday===0||clock.weekday===6;
  const template=pickWeighted(PEDESTRIANS.map((entry)=>{
    let weight=entry.weight;
    weight*=night?(entry.nightWeight??1):(entry.dayWeight??1);
    if(rush)weight*=entry.rushWeight??1;
    if(weekend)weight*=entry.weekendWeight??1;
    return {value:entry,weight};
  }));
  const [minWindow,maxWindow]=MOVEMENT_WINDOWS[template.movement];
  const windowMs=Math.round(randomBetween(minWindow,maxWindow));
  const spawnedAt=now;
  const rewardVariance=randomBetween(.92,1.12);
  const target:CrimeTarget={
    id:`pickpocket-live-${spawnedAt}-${sequence}-${template.name.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,
    kind:"pickpocket",
    name:template.name,
    area:template.area,
    profile:`${template.wealth} · ${template.movement}`,
    difficulty:template.difficulty+Math.round(randomBetween(-3,3)),
    nerve:template.nerve,
    minReward:Math.max(1,Math.round(template.minReward*rewardVariance)),
    maxReward:Math.max(2,Math.round(template.maxReward*rewardVariance)),
    heat:template.heat,
    family:"theft",
    hint:template.description,
    specialLootIds:template.specialLootIds,
    specialLootChance:template.specialLootChance,
  };
  return {id:target.id,name:template.name,area:template.area,movement:template.movement,wealth:template.wealth,awareness:template.awareness,description:template.description,windowMs,spawnedAt,expiresAt:spawnedAt+windowMs,target,rare:Boolean(template.rare),dangerNote:template.dangerNote,clues:pickpocketClues(template)};
}

export type CrimeContextPulse={
  label:string;
  value:number;
  status:string;
  detail:string;
  chanceModifier:number;
  rewardMultiplier:number;
  heatModifier:number;
  inverse?:boolean;
};

function seededUnit(seed:number){
  let x=(seed>>>0)||1;
  x=(x*1664525+1013904223)>>>0;
  return x/4294967296;
}
function hash(text:string){let h=2166136261;for(let i=0;i<text.length;i+=1)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
function pulse(seed:string,now:number,periodMs:number){
  const block=Math.floor(now/periodMs);
  const a=seededUnit(hash(`${seed}-${block}`));
  const b=seededUnit(hash(`${seed}-${block+1}`));
  const t=(now%periodMs)/periodMs;
  const smooth=t*t*(3-2*t);
  return Math.round((a+(b-a)*smooth)*100);
}

export function getCrimeContextPulse(crimeId:string, now=Date.now(), heat=0):CrimeContextPulse|null{
  const clock=torontoClock(now); const hour=clock.hour;
  if(crimeId==="package-swipe"){
    const dayBase=hour>=9&&hour<=20?72:hour>=7&&hour<9?45:18; const wave=Math.round((pulse("delivery-wave",now,4*60*1000)-50)*.32); const value=Math.max(5,Math.min(100,dayBase+wave));
    return {label:"DELIVERY WAVE",value,status:value>=75?"DENSE":value>=45?"ACTIVE":"THIN",detail:"Package opportunities rise with daytime delivery traffic and short neighborhood waves.",chanceModifier:(value-50)*.08,rewardMultiplier:.88+value/420,heatModifier:value>80?1:0};
  }
  if(crimeId==="locker-theft"){
    const traffic=pulse("locker-traffic",now,3*60*1000); const value=100-traffic;
    return {label:"QUIET WINDOW",value,status:value>=75?"CLEAR":value>=45?"MIXED":"CROWDED",detail:"Lower foot traffic creates a better locker window. The meter represents how quiet the area is.",chanceModifier:(value-50)*.09,rewardMultiplier:.95+value/650,heatModifier:value<25?2:0};
  }
  if(crimeId==="commercial-burglary"){
    const afterHours=hour>=21||hour<6; const value=Math.max(8,Math.min(100,(afterHours?78:28)+Math.round((pulse("commercial-patrol",now,7*60*1000)-50)*.35)));
    return {label:"AFTER-HOURS WINDOW",value,status:value>=70?"OPEN":value>=40?"RISKY":"ACTIVE BUSINESS",detail:"Commercial targets become more favorable after closing hours while patrol patterns still shift.",chanceModifier:(value-50)*.08,rewardMultiplier:.92+value/600,heatModifier:value<30?2:0};
  }
  if(crimeId==="safecracking"){
    const value=pulse("fictional-safe-sync",now,11500);
    return {label:"DIAL SYNC",value,status:value>=82?"SWEET SPOT":value>=55?"CLOSE":"OFF-SYNC",detail:"Pure game timing: wait for the fictional sync meter to rise, then commit. No real safe-opening method is represented.",chanceModifier:(value-50)*.14,rewardMultiplier:.92+value/520,heatModifier:value<25?2:0};
  }
  if(crimeId==="art-theft"){
    const value=pulse("collector-demand",now,12*60*1000);
    return {label:"BUYER DEMAND",value,status:value>=75?"HOT BUYERS":value>=40?"NORMAL":"COLD MARKET",detail:"Underground collector demand changes the value of art targets before you take the risk.",chanceModifier:(value-50)*.035,rewardMultiplier:.72+value/175,heatModifier:value>85?1:0};
  }
  if(crimeId==="parts-theft"){
    const value=pulse("parts-demand",now,8*60*1000);
    return {label:"PARTS DEMAND",value,status:value>=72?"HOT":value>=38?"STEADY":"SOFT",detail:"Black-market demand changes which component scores are worth the exposure.",chanceModifier:(value-50)*.04,rewardMultiplier:.78+value/205,heatModifier:0};
  }
  if(crimeId==="data-breach"){
    const load=pulse("security-load",now,17*1000); const value=100-load;
    return {label:"SECURITY GAP",value,status:value>=78?"WIDE":value>=45?"NARROW":"HARDENED",detail:"Abstract cyber timing only: the security gap pulse changes your game odds without modeling real hacking.",chanceModifier:(value-50)*.11,rewardMultiplier:.94+value/700,heatModifier:value<25?2:0};
  }
  if(crimeId==="cargo-theft"){
    const manifest=pulse("manifest-value",now,6*60*1000); const patrol=pulse("cargo-patrol",now,4*60*1000); const value=Math.max(5,Math.min(100,Math.round(manifest*.68+(100-patrol)*.32)));
    return {label:"FREIGHT WINDOW",value,status:value>=75?"PRIME LOAD":value>=42?"WORKABLE":"POOR RUN",detail:"Manifest value and patrol pressure combine into one live freight opportunity score.",chanceModifier:(value-50)*.08,rewardMultiplier:.8+value/230,heatModifier:patrol>75?2:0};
  }
  if(crimeId==="evidence-cleanup"){
    const value=Math.max(5,Math.min(100,Math.round(heat*.82+pulse("evidence-pressure",now,5*60*1000)*.18)));
    return {label:"EVIDENCE PRESSURE",value,status:value>=70?"URGENT":value>=35?"BUILDING":"LOW",detail:"This crime is a money/resource sink: cleanup matters most while your Heat and evidence pressure are high.",chanceModifier:value*.035,rewardMultiplier:1,heatModifier:0};
  }
  return null;
}

export const CRIME_SIGNATURES:Record<string,{title:string;description:string}>={
  "package-swipe":{title:"LIVE DELIVERY WINDOWS",description:"Neighborhood delivery density changes through the day. Wait for a strong wave or take a weaker opportunity immediately."},
  "locker-theft":{title:"FOOT-TRAFFIC WINDOWS",description:"The same locker row changes risk as people enter and leave. Quiet windows are safer; crowded windows punish greed."},
  "commercial-burglary":{title:"BUSINESS HOURS + PATROLS",description:"Real-time closing hours and patrol cycles change the quality of commercial targets."},
  safecracking:{title:"FICTIONAL SYNC TIMING",description:"A moving game-only sync signal gives this crime a timing layer without representing real safe-opening techniques."},
  "art-theft":{title:"COLLECTOR DEMAND",description:"Rare targets are only half the problem: underground buyer demand changes what the score is worth right now."},
  "parts-theft":{title:"LIVE PARTS MARKET",description:"Demand shifts over time, so the most profitable component target is not always the hardest one."},
  "data-breach":{title:"ABSTRACT SECURITY PULSE",description:"Time your attempt around a fictional security-gap meter. This is a pure game mechanic, not a real hacking simulation."},
  "cargo-theft":{title:"MANIFEST + PATROL WINDOW",description:"Cargo value and patrol activity combine into a live opportunity score that changes which shipment is worth touching."},
  "evidence-cleanup":{title:"AFTERMATH MANAGEMENT",description:"This one is not an income crime. It spends resources to control Heat and consequences after bigger jobs."},
};
