export const COMBAT_SETTINGS = Object.freeze({
  energyCost: 10,
  pvpCooldownSeconds: 10,
  maxRounds: 6,
  hospitalSeconds: 5 * 60,
  baseAccuracy: 0.72,
  minAccuracy: 0.20,
  maxAccuracy: 0.96
});

export const NPC_OPPONENTS = Object.freeze([
  {id:'street-rookie',name:'Street Rookie',level:1,health:70,stats:{strength:2,defense:2,speed:2,dexterity:2},weapon:{name:'Unarmed',damageMin:3,damageMax:7,accuracy:0}},
  {id:'dock-enforcer',name:'Dock Enforcer',level:6,health:110,stats:{strength:8,defense:7,speed:5,dexterity:6},weapon:{name:'Work Knife',damageMin:5,damageMax:11,accuracy:0.02}},
  {id:'syndicate-guard',name:'Syndicate Guard',level:14,health:165,stats:{strength:16,defense:15,speed:12,dexterity:14},weapon:{name:'Baton',damageMin:7,damageMax:15,accuracy:0.03}}
]);

export const getNpcOpponent = id => NPC_OPPONENTS.find(opponent => opponent.id === id) || null;
