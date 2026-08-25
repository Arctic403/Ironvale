// RiftCity V1 combat rules, ported to the server-authoritative V2 backend.
// Browser code never decides hits, crits, damage, body parts or winners.

export const BODY_PARTS = Object.freeze([
  {part:'head', multiplier:1.45, label:'Head', weight:10},
  {part:'chest', multiplier:1.12, label:'Chest', weight:40},
  {part:'stomach', multiplier:1.05, label:'Stomach', weight:18},
  {part:'arms', multiplier:0.86, label:'Arm', weight:16},
  {part:'legs', multiplier:0.90, label:'Leg', weight:16}
]);

export const ZONE_DISTANCE_MAP = Object.freeze({ Close:1, Mid:2, Long:3 });

export const UNARMED_WEAPON = Object.freeze({
  id:'unarmed', name:'Unarmed', type:'melee', weaponClass:'unarmed',
  baseDamage:6, accuracy:52, critChance:4, optimalZone:'Close', coverPenetration:0
});

export function skillLevelFromXp(xp) {
  const safe=Math.max(0,Number(xp)||0);
  return Math.min(100,1+Math.floor(Math.sqrt(safe/12)));
}

export function skillXpForNextLevel(level) {
  const next=Math.min(100,Math.max(2,Math.floor(level)+1));
  return Math.ceil(Math.pow(next-1,2)*12);
}

export function weaponSkillLevel(fighter, weapon) {
  return Math.max(1,Math.min(100,Number(fighter.weaponSkills?.[weapon.weaponClass])||1));
}

function randomFloat() {
  const values=new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0]/0x100000000;
}

function weightedBodyPart() {
  const roll=randomFloat()*100;
  let cursor=0;
  for (const part of BODY_PARTS) {
    cursor+=part.weight;
    if (roll<cursor) return part;
  }
  return BODY_PARTS[1];
}

export function calculateAccuracy(attacker,defender,weapon) {
  const optimal=weapon.optimalZone||'Close';
  const defenderZone=defender.zone||optimal;
  const skill=weaponSkillLevel(attacker,weapon);
  let accuracy=Number(weapon.accuracy||0)+(skill-1)*0.48+attacker.stats.dexterity*0.72-defender.stats.speed*0.46;
  const delta=Math.abs((ZONE_DISTANCE_MAP[optimal]||1)-(ZONE_DISTANCE_MAP[defenderZone]||1));
  accuracy-=delta*(weapon.weaponClass==='unarmed'?23:17);
  if(defender.inCover) accuracy-=18*(1-Number(weapon.coverPenetration||0));
  return Math.min(92,Math.max(8,accuracy));
}

export function calculateDamage(attacker,defender,weapon,target,isCrit) {
  const skill=weaponSkillLevel(attacker,weapon);
  const physical=['unarmed','blade','blunt'].includes(weapon.weaponClass);
  const statPower=physical?attacker.stats.strength*0.48:attacker.stats.dexterity*0.18;
  const armor=Math.max(0,Number(defender.armorProtection)||0);
  const mitigation=defender.stats.defense*(physical?0.32:0.24)+armor*(physical?0.28:0.38);
  let raw=(Number(weapon.baseDamage||1)+statPower-mitigation)*target.multiplier*(isCrit?1.5:1);
  raw*=1+Math.min(0.28,(skill-1)*0.003);
  const optimal=weapon.optimalZone||'Close';
  const defenderZone=defender.zone||optimal;
  raw*=optimal===defenderZone?1.08:0.9;
  if(defender.inCover) raw*=0.62+Number(weapon.coverPenetration||0)*0.25;
  raw*=0.88+randomFloat()*0.24;
  return Math.max(1,Math.floor(raw));
}

export function executeTurn(attacker,defender) {
  const weapon=attacker.weapon||UNARMED_WEAPON;
  const hitChance=calculateAccuracy(attacker,defender,weapon);
  if(randomFloat()*100>hitChance) {
    return {
      defender,
      log:{
        attacker:attacker.name,defender:defender.name,weaponId:weapon.id,weaponName:weapon.name,
        weaponClass:weapon.weaponClass,hitChance:Math.round(hitChance),damage:0,isMiss:true,isCrit:false,
        text:weapon.id==='unarmed'
          ?`${attacker.name} attacked ${defender.name} unarmed but missed.`
          :`${attacker.name} attacked with ${weapon.name} but missed.`
      }
    };
  }
  const target=weightedBodyPart();
  const skill=weaponSkillLevel(attacker,weapon);
  const isCrit=randomFloat()*100<Math.min(22,Number(weapon.critChance||0)+(skill-1)*0.035);
  const damage=calculateDamage(attacker,defender,weapon,target,isCrit);
  const updated={...defender,health:Math.max(0,defender.health-damage)};
  return {
    defender:updated,
    log:{
      attacker:attacker.name,defender:defender.name,weaponId:weapon.id,weaponName:weapon.name,
      weaponClass:weapon.weaponClass,hitChance:Math.round(hitChance),damage,isMiss:false,isCrit,
      hitPart:target.part,hitPartLabel:target.label,
      text:`${attacker.name} hit ${defender.name} in the ${target.label.toLowerCase()} with ${weapon.name} for ${damage} damage${isCrit?' — CRITICAL':''}.`
    }
  };
}

export function simulateFullFight(attackerInput,defenderInput,maxRounds=20) {
  let attacker={...attackerInput,zone:attackerInput.zone||'Mid'};
  let defender={...defenderInput,zone:defenderInput.zone||'Mid'};
  const logs=[];
  let rounds=0;
  let attackerDamage=0,defenderDamage=0;

  while(attacker.health>0&&defender.health>0&&rounds<maxRounds) {
    rounds++;
    const a=executeTurn(attacker,defender);
    defender=a.defender;
    logs.push({...a.log,round:rounds,side:'attacker'});
    attackerDamage+=a.log.damage||0;
    if(defender.health<=0) break;

    const d=executeTurn(defender,attacker);
    attacker=d.defender;
    logs.push({...d.log,round:rounds,side:'defender'});
    defenderDamage+=d.log.damage||0;
  }

  let winner='attacker';
  if(attacker.health<=0&&defender.health>0) winner='defender';
  else if(defender.health<=0&&attacker.health>0) winner='attacker';
  else winner=(attacker.health/attacker.maxHealth)>=(defender.health/defender.maxHealth)?'attacker':'defender';

  return {
    winner,rounds,logs,
    attackerDamage,defenderDamage,
    attackerHealth:attacker.health,defenderHealth:defender.health
  };
}
