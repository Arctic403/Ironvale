import type { CrimeRunModifiers } from "./crimeSystem";

export type CrimeTool = {
  id:string; name:string; description:string; price:number; rarity:"Common"|"Uncommon"|"Rare"|"Epic";
  recommendedFor:string[]; modifiers:Partial<CrimeRunModifiers>; icon:string;
};

export const CRIME_TOOLS: CrimeTool[] = [
  {id:"thin-gloves",name:"Disposable Grip Gloves",description:"Single-use gloves that reduce evidence left behind.",price:120,rarity:"Common",recommendedFor:["pickpocket","shoplift","package-swipe","burglary"],modifiers:{chanceModifier:3,heatModifier:-2,arrestModifier:-2},icon:"🧤"},
  {id:"burner-phone",name:"Burner Phone",description:"A throwaway phone used for one operation to keep coordination cleaner.",price:220,rarity:"Common",recommendedFor:["cargo-theft","vehicle-theft","robbery","warehouse-job","bank-job","major-heist"],modifiers:{chanceModifier:3,heatModifier:-3,bountyChance:-.02},icon:"📱"},
  {id:"disguise-kit",name:"Disguise Kit",description:"A disposable change of appearance that lowers recognition risk for one crime.",price:360,rarity:"Uncommon",recommendedFor:["shoplift","burglary","robbery","bank-job"],modifiers:{chanceModifier:5,heatModifier:-2,arrestModifier:-3},icon:"🥸"},
  {id:"lock-bypass",name:"Lock Bypass Kit",description:"A one-use abstract entry kit that improves access odds without guaranteeing success.",price:480,rarity:"Uncommon",recommendedFor:["burglary","vehicle-theft","warehouse-job"],modifiers:{chanceModifier:7,rewardMultiplier:1.04,heatModifier:-1},icon:"🧰"},
  {id:"signal-jammer",name:"Signal Jammer",description:"A fictional one-use jammer that briefly disrupts local security systems.",price:900,rarity:"Rare",recommendedFor:["vehicle-theft","data-breach","warehouse-job","bank-job","major-heist"],modifiers:{chanceModifier:8,heatModifier:-2,arrestModifier:-4,rewardMultiplier:1.05},icon:"📡"},
  {id:"forged-badge",name:"Forged Service Badge",description:"A single-use fake credential for slipping past routine checks.",price:700,rarity:"Rare",recommendedFor:["cargo-theft","data-breach","warehouse-job","bank-job"],modifiers:{chanceModifier:6,heatModifier:-1,lootMultiplier:1.1},icon:"🪪"},
  {id:"escape-route",name:"Prepared Escape Route",description:"A paid one-operation getaway plan that reduces arrest and injury exposure.",price:1100,rarity:"Rare",recommendedFor:["robbery","warehouse-job","bank-job","major-heist"],modifiers:{chanceModifier:4,arrestModifier:-7,injuryChance:-.04,heatModifier:-2},icon:"🗺️"},
  {id:"inside-tip",name:"Purchased Inside Tip",description:"A one-use information packet that improves payout and success odds on a major score.",price:1800,rarity:"Epic",recommendedFor:["data-breach","bank-job","major-heist"],modifiers:{chanceModifier:8,rewardMultiplier:1.18,lootMultiplier:1.25,heatModifier:1},icon:"📁"},
];

export const getCrimeTool=(id:string|null|undefined)=>CRIME_TOOLS.find(t=>t.id===id)??null;
export const recommendedCrimeTools=(crimeId:string)=>CRIME_TOOLS.filter(t=>t.recommendedFor.includes(crimeId));
