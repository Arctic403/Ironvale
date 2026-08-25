export const WORLD_EVENT_REGISTRY = Object.freeze([
 {id:'quiet-streets',name:'Quiet Streets',description:'Lower street activity changes the risk/reward mix.',durationMinutes:60,effects:{crimeChance:0.02}},
 {id:'rush-hour',name:'Rush Hour',description:'Crowded transit and busy streets create more opportunities.',durationMinutes:60,effects:{travelActivity:1.15}},
 {id:'market-surge',name:'Market Surge',description:'City trading volume spikes for a short window.',durationMinutes:60,effects:{marketVolatility:1.2}},
 {id:'training-drive',name:'Training Drive',description:'Forge Athletics is running a citywide training campaign.',durationMinutes:60,effects:{gymGain:1.1}},
 {id:'overtime-boom',name:'Overtime Boom',description:'Employers are paying extra during a citywide labor surge.',durationMinutes:60,effects:{jobPay:1.1}},
 {id:'fight-night',name:'Fight Night',description:'Combat venues are drawing tougher crowds and sharper competitors.',durationMinutes:60,effects:{combatPower:1.05}}
]);
export function getActiveWorldEvent(now=Date.now()){
 const index=Math.floor(now/(60*60*1000))%WORLD_EVENT_REGISTRY.length;
 return WORLD_EVENT_REGISTRY[index];
}
