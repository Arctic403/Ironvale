import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";
import { defineCrimePlugins } from "../core/plugin";

const action = (value: CrimeCareerAction) => value;

export const THEFT_CRIMES: CrimeCareerDefinition[] = [
  { id:"scavenging", name:"Scavenging", description:"Read live city activity and search different districts for cash, valuables and rare finds.", family:"theft", mode:"scavenge", icon:"cash", unlockCrimeExperience:0, baseNerve:1, risk:"LOW" },
  { id:"pickpocket", name:"Pickpocketing", description:"Choose from a rotating crowd, read target value, then time a quick pocket-zone grab. Mastery reveals better intel.", family:"theft", mode:"target", targetKind:"pickpocket", icon:"target", unlockCrimeExperience:0, baseNerve:2, risk:"LOW" },
  { id:"shoplift", name:"Shoplifting", description:"Choose a live store, build a basket and decide when greed has pushed suspicion too far.", family:"theft", mode:"shoplift", icon:"shops", unlockCrimeExperience:8, baseNerve:2, risk:"MEDIUM" },
  { id:"package-swipe", name:"Parcel Theft", description:"Watch residential delivery windows and take small item-focused scores instead of pure cash.", family:"theft", mode:"actions", icon:"package", unlockCrimeExperience:22, baseNerve:3, risk:"LOW", actions:[
    action({id:"porch-row",name:"Residential Row",description:"Low-value parcels rotate through a quiet residential block.",nerve:3,difficulty:26,minReward:90,maxReward:260,heat:2,recommendedItems:["thin-gloves"]}),
    action({id:"apartment-mailroom",name:"Apartment Mailroom",description:"More packages are concentrated here, but so are cameras and residents.",nerve:4,difficulty:35,minReward:180,maxReward:480,heat:4,masteryRequired:15,requiredItems:["disguise-kit"],recommendedItems:["thin-gloves"]}),
  ]},
  { id:"locker-theft", name:"Locker Theft", description:"Target rotating storage and locker opportunities with better loot pools at higher mastery.", family:"theft", mode:"actions", icon:"key", unlockCrimeExperience:35, baseNerve:3, risk:"MEDIUM", actions:[
    action({id:"gym-lockers",name:"Gym Lockers",description:"Quick low-tier storage targets with mostly cash and small valuables.",nerve:3,difficulty:31,minReward:140,maxReward:390,heat:3,recommendedItems:["thin-gloves"]}),
    action({id:"station-storage",name:"Station Storage",description:"A more valuable storage row that requires an abstract entry tool.",nerve:5,difficulty:44,minReward:350,maxReward:950,heat:6,masteryRequired:20,requiredItems:["lock-bypass"]}),
  ]}
];

import type { ScavengeLocation, ShopliftStore } from "../core/types";

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

// Plugin export: the registry consumes plugins, while the *_CRIMES array remains a compatibility/data export.
export const THEFT_CRIME_PLUGINS = defineCrimePlugins(THEFT_CRIMES);
