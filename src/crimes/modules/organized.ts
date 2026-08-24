import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";

const action = (value: CrimeCareerAction) => value;

export const ORGANIZED_CRIMES: CrimeCareerDefinition[] = [
  { id:"cargo-theft", name:"Cargo Theft", description:"Scout shipment opportunities and choose freight based on value, patrol pressure and capacity.", family:"organized", mode:"actions", icon:"warehouse", unlockCrimeExperience:72, baseNerve:5, risk:"MEDIUM", actions:[
    action({id:"local-freight",name:"Local Freight",description:"A lower-tier shipment with broad, unpredictable loot.",nerve:5,difficulty:42,minReward:480,maxReward:1350,heat:6,recommendedItems:["cargo-scanner"]}),
    action({id:"priority-shipment",name:"Priority Shipment",description:"High-value freight that requires both cargo intel and a prepared route.",nerve:8,difficulty:58,minReward:1500,maxReward:4200,heat:10,masteryRequired:40,requiredItems:["cargo-scanner","escape-route"]}),
  ]},
  { id:"black-market-delivery", name:"Black Market Delivery", description:"Run timed underground delivery contracts that link Crime progression to the market economy.", family:"organized", mode:"operation", icon:"route", unlockCrimeExperience:165, baseNerve:5, risk:"MEDIUM", operationIds:["black-market-delivery"] },
  { id:"smuggling", name:"Smuggling", description:"Higher-tier fictional logistics operation intended to connect to Airport destinations later.", family:"organized", mode:"operation", icon:"airport", unlockCrimeExperience:280, baseNerve:8, risk:"HIGH", operationIds:["smuggling-run"] },
  { id:"protection-racket", name:"Protection Racket", description:"Establish an abstract collection cycle for passive income and growing enforcement attention.", family:"organized", mode:"operation", icon:"shield", unlockCrimeExperience:300, baseNerve:8, risk:"HIGH", operationIds:["protection-racket"] },
  { id:"underground-gambling", name:"Underground Gambling", description:"Fund a fictional illegal game that earns passive cash while raid risk grows.", family:"organized", mode:"operation", icon:"dice", unlockCrimeExperience:250, baseNerve:7, risk:"HIGH", operationIds:["underground-gambling"] },
  { id:"evidence-cleanup", name:"Evidence Cleanup", description:"Spend money, Nerve and specialized supplies to reduce Heat instead of earning income.", family:"organized", mode:"actions", icon:"shield", unlockCrimeExperience:180, baseNerve:5, risk:"MEDIUM", actions:[
    action({id:"basic-cleanup",name:"Basic Cleanup",description:"A small post-job cleanup that trades resources for reduced Heat.",nerve:4,difficulty:36,minReward:4,maxReward:8,heat:0,requiredItems:["cleanup-kit"],rewardType:"heat-reduction"}),
    action({id:"professional-cleanup",name:"Professional Cleanup",description:"A larger cleanup operation requiring two preparation items.",nerve:7,difficulty:52,minReward:10,maxReward:18,heat:0,masteryRequired:35,requiredItems:["cleanup-kit","burner-phone"],rewardType:"heat-reduction"}),
  ]},
  { id:"robbery", name:"Street Robbery", description:"A direct score where branching decisions still matter because the situation can change fast.", family:"organized", mode:"major", icon:"crimes", unlockCrimeExperience:175, baseNerve:8, risk:"HIGH", legacyCrimeId:"robbery" },
  { id:"warehouse-job", name:"Warehouse Robbery", description:"A prepared multi-stage job with live decision events and larger loot potential.", family:"organized", mode:"major", icon:"warehouse", unlockCrimeExperience:225, baseNerve:9, risk:"HIGH", legacyCrimeId:"warehouse-job" },
  { id:"bank-job", name:"Bank Job", description:"A late-game prepared score that keeps RiftCity's branching live-job system.", family:"organized", mode:"major", icon:"bank", unlockCrimeExperience:290, baseNerve:11, risk:"EXTREME", legacyCrimeId:"bank-job" },
  { id:"major-heist", name:"Major Heist", description:"City-scale end-game criminal project; future crew play will plug into this structure.", family:"organized", mode:"major", icon:"crown", unlockCrimeExperience:390, baseNerve:13, risk:"EXTREME", legacyCrimeId:"major-heist" }
];
