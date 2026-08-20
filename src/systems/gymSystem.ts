import { CombatStats } from "./progressionSystem";

export type TrainingStat = "strength" | "defense" | "speed" | "dexterity";

export type Gym = {
  id:string;
  name:string;
  description:string;
  gymExpRequired:number;
  membershipCost:number;
  energyCost:number;
  gains:Record<TrainingStat,number|null>;
  jailOnly?:boolean;
};

export type TrainingProgram = {
  id:string;
  name:string;
  description:string;
  energyModifier:number;
  statMultipliers:Record<TrainingStat,number>;
  unlockGymExp:number;
  streakBonus:number;
};

export type TrainingStatInfo = { id:TrainingStat; name:string; icon:string; description:string; };
export type TrainingResult = { stats:CombatStats; gain:number; };

export const TRAINING_STATS:TrainingStatInfo[]=[
  {id:"strength",name:"Strength",icon:"💪",description:"Raises physical damage and close-range power."},
  {id:"defense",name:"Defense",icon:"🛡️",description:"Raises damage resistance and staying power."},
  {id:"speed",name:"Speed",icon:"⚡",description:"Raises initiative, movement and combat pace."},
  {id:"dexterity",name:"Dexterity",icon:"🎯",description:"Raises accuracy, control and precision."},
];

/*
 * RiftCity uses one evolving training facility instead of copying
 * the standard "buy better gym" ladder. Progression comes from
 * unlocking training programs and building a consistency streak.
 */
export const GYMS:Gym[]=[
  {
    id:"rift-performance-lab",
    name:"Rift Performance Lab",
    description:"RiftCity's adaptive training complex. Your program matters more than the building.",
    gymExpRequired:0,
    membershipCost:0,
    energyCost:8,
    gains:{strength:1.0,defense:1.0,speed:1.0,dexterity:1.0},
  },
  {
    id:"crims-gym",
    name:"Crims Yard",
    description:"A stripped-down jail training area with limited options.",
    gymExpRequired:0,
    membershipCost:0,
    energyCost:6,
    gains:{strength:.55,defense:.65,speed:.45,dexterity:.4},
    jailOnly:true,
  },
];

export const TRAINING_PROGRAMS:TrainingProgram[]=[
  {id:"balanced",name:"Balanced Foundation",description:"Reliable gains across every combat stat.",energyModifier:1,statMultipliers:{strength:1,defense:1,speed:1,dexterity:1},unlockGymExp:0,streakBonus:.015},
  {id:"power",name:"Power Cycle",description:"Heavy sessions that strongly favor Strength and Defense.",energyModifier:1.25,statMultipliers:{strength:1.45,defense:1.2,speed:.8,dexterity:.78},unlockGymExp:150,streakBonus:.012},
  {id:"velocity",name:"Velocity Protocol",description:"Fast, reactive sessions focused on Speed and Dexterity.",energyModifier:1.15,statMultipliers:{strength:.82,defense:.82,speed:1.42,dexterity:1.28},unlockGymExp:350,streakBonus:.014},
  {id:"precision",name:"Precision Lab",description:"Lower-volume technical work with a major Dexterity focus.",energyModifier:.95,statMultipliers:{strength:.78,defense:.88,speed:1.08,dexterity:1.5},unlockGymExp:750,streakBonus:.018},
  {id:"ironwall",name:"Ironwall Conditioning",description:"Punishing conditioning designed around Defense and consistency.",energyModifier:1.35,statMultipliers:{strength:1.05,defense:1.55,speed:.78,dexterity:.72},unlockGymExp:1400,streakBonus:.02},
  {id:"hybrid",name:"Rift Hybrid",description:"Elite adaptive program with strong gains across all four stats.",energyModifier:1.4,statMultipliers:{strength:1.3,defense:1.3,speed:1.3,dexterity:1.3},unlockGymExp:3000,streakBonus:.022},
];

export function isJailGym(gym:Gym){return gym.jailOnly===true}
export function gymUnlocked(gym:Gym,gymExperience:number){return isJailGym(gym)||gymExperience>=gym.gymExpRequired}
export function canTrainStat(gym:Gym,stat:TrainingStat){return gym.gains[stat]!==null&&gym.gains[stat]!==undefined}
export function getNextGym(_gymExperience:number){return null}
export function getGymExperienceGain(energyCost:number){return Math.max(1,Math.floor(energyCost))}
export function getHappinessMultiplier(happiness:number){const c=Math.max(0,Math.min(100,happiness));return .5+c/200}
export function getTrainingProgram(id:string){return TRAINING_PROGRAMS.find(p=>p.id===id)??TRAINING_PROGRAMS[0]}
export function programUnlocked(program:TrainingProgram,gymExperience:number){return gymExperience>=program.unlockGymExp}
export function trainingEnergyCost(gym:Gym,program:TrainingProgram){return Math.max(1,Math.round(gym.energyCost*program.energyModifier))}
export function projectedTrainingGain(gym:Gym,stat:TrainingStat,program:TrainingProgram,happiness:number,streak:number,multiplier=1){
  const base=gym.gains[stat]??0;
  const streakMult=1+Math.min(10,Math.max(0,streak))*program.streakBonus;
  return base*program.statMultipliers[stat]*getHappinessMultiplier(happiness)*streakMult*Math.max(0,multiplier);
}
export function applyTraining(stats:CombatStats,gym:Gym,stat:TrainingStat,happiness=100,educationMultiplier=1,program:TrainingProgram=TRAINING_PROGRAMS[0],streak=0):TrainingResult{
  const gain=projectedTrainingGain(gym,stat,program,happiness,streak,educationMultiplier);
  return {stats:{...stats,[stat]:stats[stat]+gain},gain};
}
