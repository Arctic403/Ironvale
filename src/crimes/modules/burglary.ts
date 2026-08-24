import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";

const action = (value: CrimeCareerAction) => value;

export const BURGLARY_CRIMES: CrimeCareerDefinition[] = [
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
  ]}
];
