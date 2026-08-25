export const HEAT_TIERS = Object.freeze([
  {min:0,max:19,id:'clear',name:'Clear',chancePenalty:0,fineMultiplier:1},
  {min:20,max:39,id:'noticed',name:'Noticed',chancePenalty:.01,fineMultiplier:1.1},
  {min:40,max:59,id:'watched',name:'Watched',chancePenalty:.03,fineMultiplier:1.25},
  {min:60,max:79,id:'wanted',name:'Wanted',chancePenalty:.06,fineMultiplier:1.5},
  {min:80,max:100,id:'priority',name:'Priority Target',chancePenalty:.10,fineMultiplier:2}
]);
export const HEAT_DECAY_PER_HOUR = 4;
export const LAY_LOW_ENERGY_COST = 8;
export const LAY_LOW_HEAT_REDUCTION = 12;
export const LAY_LOW_COOLDOWN_MS = 10*60*1000;
export function getHeatTier(heat=0){const value=Math.max(0,Math.min(100,Number(heat)||0));return HEAT_TIERS.find(t=>value>=t.min&&value<=t.max)||HEAT_TIERS[0];}
