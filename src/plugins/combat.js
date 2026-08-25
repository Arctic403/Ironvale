export const COMBAT_SETTINGS = Object.freeze({
  energyCost: 10,
  pvpCooldownSeconds: 10,
  maxRounds: 20,
  hospitalSeconds: 5 * 60
});

export const WEAPON_SKILL_CLASSES = Object.freeze([
  'unarmed','blade','blunt','handgun','smg','shotgun','rifle'
]);

export const COMBAT_WEAPONS = Object.freeze([
  {id:'unarmed',name:'Unarmed',type:'melee',weaponClass:'unarmed',baseDamage:6,accuracy:52,critChance:4,optimalZone:'Close',coverPenetration:0},
  {id:'knife',name:'Street Knife',type:'melee',weaponClass:'blade',baseDamage:9,accuracy:45,critChance:7,optimalZone:'Close',coverPenetration:.05},
  {id:'bat',name:'Composite Bat',type:'melee',weaponClass:'blunt',baseDamage:13,accuracy:42,critChance:6,optimalZone:'Close',coverPenetration:.12},
  {id:'crowbar',name:'Heavy Crowbar',type:'melee',weaponClass:'blunt',baseDamage:16,accuracy:36,critChance:7,optimalZone:'Close',coverPenetration:.16},
  {id:'machete',name:'Machete',type:'melee',weaponClass:'blade',baseDamage:18,accuracy:37,critChance:9,optimalZone:'Close',coverPenetration:.12},
  {id:'pistol',name:'9mm Pistol',type:'secondary',weaponClass:'handgun',baseDamage:22,accuracy:38,critChance:7,optimalZone:'Mid',coverPenetration:.32},
  {id:'heavy-pistol',name:'Heavy Pistol',type:'secondary',weaponClass:'handgun',baseDamage:29,accuracy:31,critChance:10,optimalZone:'Mid',coverPenetration:.42},
  {id:'machine-pistol',name:'Machine Pistol',type:'secondary',weaponClass:'smg',baseDamage:24,accuracy:33,critChance:6,optimalZone:'Close',coverPenetration:.34},
  {id:'smg',name:'Compact SMG',type:'primary',weaponClass:'smg',baseDamage:27,accuracy:35,critChance:7,optimalZone:'Mid',coverPenetration:.38},
  {id:'shotgun',name:'Pump Shotgun',type:'primary',weaponClass:'shotgun',baseDamage:40,accuracy:29,critChance:9,optimalZone:'Close',coverPenetration:.48},
  {id:'carbine',name:'Street Carbine',type:'primary',weaponClass:'rifle',baseDamage:33,accuracy:34,critChance:9,optimalZone:'Mid',coverPenetration:.52},
  {id:'rifle',name:'Rift Rifle',type:'primary',weaponClass:'rifle',baseDamage:38,accuracy:31,critChance:11,optimalZone:'Long',coverPenetration:.62},
  {id:'syndicate-blade',name:'Syndicate Blade',type:'melee',weaponClass:'blade',baseDamage:24,accuracy:43,critChance:12,optimalZone:'Close',coverPenetration:.2}
]);

const WEAPON_LOOKUP = new Map(COMBAT_WEAPONS.map(w=>[w.id,w]));
export const getCombatWeapon = id => WEAPON_LOOKUP.get(id) || WEAPON_LOOKUP.get('unarmed');

export const NPC_OPPONENTS = Object.freeze([
  {id:'street-rookie',name:'Street Rookie',level:1,health:70,stats:{strength:2,defense:2,speed:2,dexterity:2},weaponId:'unarmed',zone:'Close',inCover:false,armorProtection:0},
  {id:'dock-enforcer',name:'Dock Enforcer',level:6,health:110,stats:{strength:8,defense:7,speed:5,dexterity:6},weaponId:'knife',zone:'Close',inCover:false,armorProtection:1},
  {id:'syndicate-guard',name:'Syndicate Guard',level:14,health:165,stats:{strength:16,defense:15,speed:12,dexterity:14},weaponId:'bat',zone:'Mid',inCover:true,armorProtection:4},
  {id:'armed-runner',name:'Armed Runner',level:20,health:190,stats:{strength:18,defense:17,speed:22,dexterity:20},weaponId:'pistol',zone:'Mid',inCover:false,armorProtection:5}
]);

export const getNpcOpponent = id => NPC_OPPONENTS.find(opponent => opponent.id === id) || null;
