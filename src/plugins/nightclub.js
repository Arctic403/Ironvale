export const NIGHTCLUB_TIERS = Object.freeze([
  {id:'guest',name:'Guest',reputation:0,bonus:0},
  {id:'regular',name:'Regular',reputation:25,bonus:.02},
  {id:'vip',name:'VIP',reputation:80,bonus:.04},
  {id:'inner-circle',name:'Inner Circle',reputation:180,bonus:.06}
]);
export const NIGHTCLUB_ACTIVITIES = Object.freeze([
  {id:'visit-floor',name:'Visit the Floor',energyCost:3,reputation:3,cooldownMs:60_000,description:'Spend some time in Afterdark and build nightlife reputation.'},
  {id:'event-night',name:'Event Night',energyCost:6,reputation:7,cooldownMs:5*60_000,description:'Join the current featured event for a larger reputation gain.'},
  {id:'vip-lounge',name:'VIP Lounge',energyCost:5,reputation:5,cooldownMs:3*60_000,requiredTier:'vip',description:'A quieter high-tier activity unlocked through nightlife reputation.'}
]);
export const NIGHTCLUB_EVENTS = Object.freeze([
  {id:'neon-session',name:'Neon Session',description:'The club is packed for a citywide music night.',repMultiplier:1.2},
  {id:'industry-night',name:'Industry Night',description:'Local crews and businesses are circulating through Afterdark.',repMultiplier:1.1},
  {id:'late-shift',name:'Late Shift',description:'A calmer night with steady regular traffic.',repMultiplier:1.0}
]);
export function getNightclubTier(rep=0){return [...NIGHTCLUB_TIERS].reverse().find(t=>Number(rep)>=t.reputation)||NIGHTCLUB_TIERS[0];}
export function getNightclubEvent(now=Date.now()){return NIGHTCLUB_EVENTS[Math.floor(now/(60*60*1000))%NIGHTCLUB_EVENTS.length];}
