export const WORLD_EVENT_REGISTRY = Object.freeze([
 {id:'quiet-streets',name:'Quiet Streets',description:'Lower street activity changes the risk/reward mix.',durationMinutes:60,effects:{crimeChance:0.02}},
 {id:'rush-hour',name:'Rush Hour',description:'Crowded transit and busy streets create more opportunities.',durationMinutes:60,effects:{travelActivity:1.15}},
 {id:'market-surge',name:'Market Surge',description:'City trading volume spikes for a short window.',durationMinutes:60,effects:{marketVolatility:1.2}},
 {id:'training-drive',name:'Training Drive',description:'Forge Athletics is running a citywide training campaign.',durationMinutes:60,effects:{gymGain:1.1}}
]);
export function getActiveWorldEvent(now=Date.now()){
 const index=Math.floor(now/(60*60*1000))%WORLD_EVENT_REGISTRY.length;
 return WORLD_EVENT_REGISTRY[index];
}
