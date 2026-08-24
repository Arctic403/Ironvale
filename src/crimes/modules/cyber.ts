import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";

const action = (value: CrimeCareerAction) => value;

export const CYBER_CRIMES: CrimeCareerDefinition[] = [
  { id:"data-breach", name:"Data Theft", description:"A fictional cyber skill check against abstract security tiers; no real hacking commands or techniques.", family:"cyber", mode:"actions", icon:"chip", unlockCrimeExperience:135, baseNerve:7, risk:"HIGH", actions:[
    action({id:"street-terminal",name:"Street Terminal",description:"Low-tier fictional data target for building Cyber skill.",nerve:6,difficulty:44,minReward:650,maxReward:1700,heat:6,requiredItems:["cyber-rig"]}),
    action({id:"corporate-node",name:"Corporate Node",description:"A high-security game target with valuable fictional data packages.",nerve:9,difficulty:62,minReward:1800,maxReward:5200,heat:11,masteryRequired:45,requiredItems:["cyber-rig","access-token"]}),
  ]}
];
