import {
  NPC_OPPONENTS, COMBAT_SETTINGS, getNpcOpponent, getCombatWeapon, WEAPON_SKILL_CLASSES,
  TRAVEL_DESTINATIONS, getTravelDestination,
  ACHIEVEMENT_REGISTRY, getAchievementDefinition,
  DAILY_CHALLENGE_TEMPLATES, WEEKLY_CHALLENGE_TEMPLATES,
  PRODUCTION_FACILITIES, PRODUCTION_RECIPES, getProductionFacility, getProductionRecipe,
  EDUCATION_REGISTRY, getEducationDefinition,
  PROPERTY_REGISTRY, getPropertyDefinition,
  getActiveWorldEvent,
  getItemDefinition, toPublicItemDefinition
} from '../plugins/index.js';
import { simulateFullFight, skillLevelFromXp, skillXpForNextLevel, UNARMED_WEAPON } from './combat-engine.js';
import { getMeritModifiers, getPropertyUpgradeModifiers, recordActivity, grantMeritPoints } from './living-city.js';

const ADVANCED_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS player_travel (
  user_id TEXT PRIMARY KEY,
  current_region TEXT NOT NULL DEFAULT 'riftcity',
  traveling_to TEXT,
  departed_at INTEGER,
  arrives_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_offshore_accounts (
  user_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),
  lifetime_deposits INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_deposits>=0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,region_id)
);
CREATE TABLE IF NOT EXISTS player_bank_security (
  user_id TEXT PRIMARY KEY,
  frozen_until INTEGER,
  protection_until INTEGER,
  last_risk_event_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS combat_history (
  id TEXT PRIMARY KEY,
  attacker_user_id TEXT NOT NULL,
  defender_user_id TEXT,
  opponent_type TEXT NOT NULL,
  opponent_id TEXT NOT NULL,
  winner TEXT NOT NULL,
  rounds INTEGER NOT NULL,
  attacker_damage INTEGER NOT NULL DEFAULT 0,
  defender_damage INTEGER NOT NULL DEFAULT 0,
  xp_gain INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS combat_turns (
  fight_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  side TEXT NOT NULL,
  log_json TEXT NOT NULL,
  PRIMARY KEY(fight_id,turn_index)
);
CREATE TABLE IF NOT EXISTS player_weapon_skills (
  user_id TEXT NOT NULL,
  weapon_class TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,weapon_class)
);
CREATE TABLE IF NOT EXISTS player_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER,
  PRIMARY KEY(user_id,achievement_id)
);
CREATE TABLE IF NOT EXISTS player_challenges (
  user_id TEXT NOT NULL,
  challenge_key TEXT NOT NULL,
  cadence TEXT NOT NULL,
  period_key TEXT NOT NULL,
  template_id TEXT NOT NULL,
  baseline_value INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,challenge_key)
);
CREATE TABLE IF NOT EXISTS player_production_facilities (
  user_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  purchased_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,facility_id)
);
CREATE TABLE IF NOT EXISTS production_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completes_at INTEGER NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER
);
CREATE TABLE IF NOT EXISTS player_property_effects (
  user_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL DEFAULT 'shack',
  applied_max_health INTEGER NOT NULL DEFAULT 0,
  applied_max_nerve INTEGER NOT NULL DEFAULT 0,
  last_income_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS property_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
`;

let ensured = false;

export async function ensureAdvancedTables(env) {
  if (ensured) return;
  for (const statement of ADVANCED_TABLE_SQL.split(';').map(value => value.trim()).filter(Boolean)) {
    await env.DB.prepare(statement).run();
  }
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_combat_attacker ON combat_history(attacker_user_id,created_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_combat_defender ON combat_history(defender_user_id,created_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_production_user ON production_batches(user_id,completes_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_production_unclaimed ON production_batches(user_id,claimed,completes_at)').run();
  ensured = true;
}

function now() { return Date.now(); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function positiveInt(value, maximum = 100000000) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, maximum) : 0;
}
function randomFloat() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 4294967296;
}
function randomInt(minimum, maximum) {
  const min = Math.ceil(minimum);
  const max = Math.floor(maximum);
  if (max <= min) return min;
  return min + Math.floor(randomFloat() * (max - min + 1));
}
async function getCounter(userId, metric, env) {
  const row = await env.DB.prepare('SELECT value FROM player_progress_counters WHERE user_id=? AND metric=?').bind(userId, metric).first();
  return Number(row?.value) || 0;
}
async function incrementCounter(userId, metric, amount, env) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (!value) return;
  const timestamp = now();
  await env.DB.prepare(`
    INSERT INTO player_progress_counters(user_id,metric,value,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,metric) DO UPDATE SET value=value+excluded.value,updated_at=excluded.updated_at
  `).bind(userId, metric, value, timestamp).run();
}
async function setCounterAtLeast(userId, metric, amount, env) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  const timestamp = now();
  await env.DB.prepare(`
    INSERT INTO player_progress_counters(user_id,metric,value,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,metric) DO UPDATE SET value=MAX(value,excluded.value),updated_at=excluded.updated_at
  `).bind(userId, metric, value, timestamp).run();
}

async function finalizeEducation(userId, env) {
  const timestamp = now();
  const due = await env.DB.prepare(`
    SELECT course_id FROM player_education
    WHERE user_id=? AND status='studying' AND completes_at<=?
  `).bind(userId, timestamp).all();
  const rows = due.results || [];
  for (const row of rows) {
    const result = await env.DB.prepare(`
      UPDATE player_education SET status='completed',completed_at=?
      WHERE user_id=? AND course_id=? AND status='studying'
    `).bind(timestamp, userId, row.course_id).run();
    if (result.meta?.changes) await incrementCounter(userId, 'education_complete', 1, env);
  }
  return rows.length;
}

export async function getGameplayModifiers(userId, env) {
  await ensureAdvancedTables(env);
  await finalizeEducation(userId, env);

  const educationRows = await env.DB.prepare(`
    SELECT course_id FROM player_education WHERE user_id=? AND status='completed'
  `).bind(userId).all();
  const homeRow = await env.DB.prepare(`
    SELECT property_id FROM player_properties WHERE user_id=? AND is_home=1 LIMIT 1
  `).bind(userId).first();

  const modifiers = {
    crimeChanceBonus: 0,
    gymGainMultiplier: 1,
    combatMultiplier: 1,
    jobPayMultiplier: 1,
    marketVolatilityMultiplier: 1,
    maxHealthBonus: 0,
    maxNerveBonus: 0,
    event: getActiveWorldEvent()
  };

  for (const row of educationRows.results || []) {
    const course = getEducationDefinition(row.course_id);
    if (!course?.bonus) continue;
    const amount = Number(course.bonus.amount) || 0;
    if (course.bonus.type === 'crime') modifiers.crimeChanceBonus += amount / 100;
    if (course.bonus.type === 'gym') modifiers.gymGainMultiplier *= 1 + amount / 100;
    if (course.bonus.type === 'combat') modifiers.combatMultiplier *= 1 + amount / 100;
    if (course.bonus.type === 'job') modifiers.jobPayMultiplier *= 1 + amount / 100;
  }

  const property = getPropertyDefinition(homeRow?.property_id || 'shack');
  if (property?.bonuses) {
    modifiers.maxHealthBonus = Number(property.bonuses.maxHealth) || 0;
    modifiers.maxNerveBonus = Number(property.bonuses.nerve) || 0;
  }

  const merits = await getMeritModifiers(userId, env);
  const propertyUpgrades = await getPropertyUpgradeModifiers(userId, env);
  modifiers.crimeChanceBonus += Number(merits.crimeChanceBonus)||0;
  modifiers.gymGainMultiplier *= Number(merits.gymGainMultiplier)||1;
  modifiers.gymGainMultiplier *= Number(propertyUpgrades.gymGainMultiplier)||1;
  modifiers.jobPayMultiplier *= Number(merits.jobPayMultiplier)||1;
  modifiers.marketVolatilityMultiplier *= Number(merits.marketVolatilityMultiplier)||1;

  const eventEffects = modifiers.event?.effects || {};
  modifiers.crimeChanceBonus += Number(eventEffects.crimeChance) || 0;
  modifiers.gymGainMultiplier *= Number(eventEffects.gymGain) || 1;
  modifiers.jobPayMultiplier *= Number(eventEffects.jobPay) || 1;
  modifiers.combatMultiplier *= Number(eventEffects.combatPower) || 1;
  modifiers.marketVolatilityMultiplier *= Number(eventEffects.marketVolatility) || 1;

  return modifiers;
}

export async function reconcilePropertyBonuses(userId, env) {
  await ensureAdvancedTables(env);
  const timestamp = now();
  const home = await env.DB.prepare(`
    SELECT property_id FROM player_properties WHERE user_id=? AND is_home=1 LIMIT 1
  `).bind(userId).first();
  const property = getPropertyDefinition(home?.property_id || 'shack') || getPropertyDefinition('shack');
  const nextHealth = Number(property?.bonuses?.maxHealth) || 0;
  const nextNerve = Number(property?.bonuses?.nerve) || 0;
  const previous = await env.DB.prepare('SELECT * FROM player_property_effects WHERE user_id=?').bind(userId).first();
  const oldHealth = Number(previous?.applied_max_health) || 0;
  const oldNerve = Number(previous?.applied_max_nerve) || 0;

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE player_state SET
        max_health=MAX(1,max_health-?+?),
        health=MIN(MAX(1,max_health-?+?),health),
        max_nerve=MAX(1,max_nerve-?+?),
        nerve=MIN(MAX(1,max_nerve-?+?),nerve),
        updated_at=?
      WHERE user_id=?
    `).bind(oldHealth,nextHealth,oldHealth,nextHealth,oldNerve,nextNerve,oldNerve,nextNerve,timestamp,userId),
    env.DB.prepare(`
      INSERT INTO player_property_effects(user_id,property_id,applied_max_health,applied_max_nerve,updated_at)
      VALUES(?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
        property_id=excluded.property_id,
        applied_max_health=excluded.applied_max_health,
        applied_max_nerve=excluded.applied_max_nerve,
        updated_at=excluded.updated_at
    `).bind(userId, property?.id || 'shack', nextHealth, nextNerve, timestamp)
  ]);
  return { propertyId: property?.id || 'shack', maxHealthBonus: nextHealth, maxNerveBonus: nextNerve };
}

export async function getBankSecurity(userId, env) {
  await ensureAdvancedTables(env);
  const timestamp = now();
  await env.DB.prepare('INSERT OR IGNORE INTO player_bank_security(user_id,updated_at) VALUES(?,?)').bind(userId,timestamp).run();
  const state = await env.DB.prepare('SELECT * FROM player_bank_security WHERE user_id=?').bind(userId).first();
  return {
    frozenUntil: state?.frozen_until || null,
    protectionUntil: state?.protection_until || null,
    frozen: Boolean(state?.frozen_until && Number(state.frozen_until) > timestamp),
    protected: Boolean(state?.protection_until && Number(state.protection_until) > timestamp)
  };
}

export async function getAdvancedService(service, userId, env, deps, url) {
  await ensureAdvancedTables(env);
  switch (service) {
    case 'combat': return getCombat(userId, env, deps);
    case 'travel': return getTravel(userId, env, deps);
    case 'offshore': return getOffshore(userId, env, deps);
    case 'achievements': return getAchievements(userId, env, deps);
    case 'challenges': return getChallenges(userId, env, deps);
    case 'production': return getProduction(userId, env, deps);
    default: return null;
  }
}

export async function postAdvancedService(service, body, userId, env, deps, requestId) {
  await ensureAdvancedTables(env);
  switch (service) {
    case 'combat': return combatAction(body, userId, env, deps, requestId);
    case 'travel': return travelAction(body, userId, env, deps);
    case 'offshore': return offshoreAction(body, userId, env, deps);
    case 'achievements': return achievementAction(body, userId, env, deps);
    case 'challenges': return challengeAction(body, userId, env, deps);
    case 'production': return productionAction(body, userId, env, deps);
    default: return null;
  }
}

// COMBAT
async function equippedWeapon(userId, env) {
  const row = await env.DB.prepare(`
    SELECT item_id FROM player_inventory
    WHERE user_id=? AND equipped_slot='weapon' AND quantity>0 LIMIT 1
  `).bind(userId).first();
  const item = row?.item_id ? getItemDefinition(row.item_id) : null;
  const weapon = item?.combat?.weaponId ? getCombatWeapon(item.combat.weaponId) : UNARMED_WEAPON;
  return item ? { item: toPublicItemDefinition(item), weapon } : { item:null, weapon:UNARMED_WEAPON };
}

async function getWeaponSkills(userId, env) {
  const rows = await env.DB.prepare('SELECT weapon_class,xp FROM player_weapon_skills WHERE user_id=?').bind(userId).all();
  const xpMap = Object.fromEntries((rows.results||[]).map(row=>[row.weapon_class,Number(row.xp)||0]));
  return Object.fromEntries(WEAPON_SKILL_CLASSES.map(cls=>{
    const xp=xpMap[cls]||0, level=skillLevelFromXp(xp);
    return [cls,{xp,level,nextLevelXp:level>=100?null:skillXpForNextLevel(level)}];
  }));
}

function fighterFromPlayer(player, loadout, skillState, modifiers={}, name='Player') {
  return {
    id:player.user_id,name,health:Number(player.health)||1,maxHealth:Number(player.max_health)||100,
    stats:{strength:Number(player.strength)||1,defense:Number(player.defense)||1,speed:Number(player.speed)||1,dexterity:Number(player.dexterity)||1},
    weapon:loadout?.weapon||UNARMED_WEAPON,
    weaponSkills:Object.fromEntries(Object.entries(skillState||{}).map(([k,v])=>[k,Number(v.level)||1])),
    armorProtection:0,zone:'Mid',inCover:false,
    multiplier:Number(modifiers.combatMultiplier)||1
  };
}

function fighterFromNpc(npc) {
  return {
    id:npc.id,name:npc.name,health:npc.health,maxHealth:npc.health,stats:{...npc.stats},
    weapon:getCombatWeapon(npc.weaponId),weaponSkills:{[getCombatWeapon(npc.weaponId).weaponClass]:Math.min(100,Math.max(1,npc.level*2))},
    armorProtection:Number(npc.armorProtection)||0,zone:npc.zone||'Mid',inCover:Boolean(npc.inCover)
  };
}

async function getCombat(userId, env, deps) {
  const history = await env.DB.prepare(`
    SELECT * FROM combat_history
    WHERE attacker_user_id=? OR defender_user_id=?
    ORDER BY created_at DESC LIMIT 20
  `).bind(userId,userId).all();
  const playerRow=await deps.ensureActivePlayerState(env,userId);
  return {
    ok:true,
    settings:{...COMBAT_SETTINGS,energyCostMode:'per-fight'},
    npcs:NPC_OPPONENTS.map(npc=>({...npc,weapon:getCombatWeapon(npc.weaponId)})),
    equippedWeapon:await equippedWeapon(userId,env),
    weaponSkills:await getWeaponSkills(userId,env),
    history:history.results||[],
    player:deps.toPublicPlayerState(playerRow)
  };
}

async function combatAction(body, userId, env, deps, requestId) {
  if (body.action !== 'attack') return {ok:false,error:'Unknown combat action',status:400};
  const timestamp=now();
  const attackerPlayer=await deps.ensureActivePlayerState(env,userId);
  if (attackerPlayer.status!=='active') return {ok:false,error:`You cannot fight while ${attackerPlayer.status}.`,status:409};
  if (Number(attackerPlayer.energy)<COMBAT_SETTINGS.energyCost) return {ok:false,error:`You need ${COMBAT_SETTINGS.energyCost} energy to start a fight.`,status:409};

  const last=await env.DB.prepare('SELECT created_at FROM combat_history WHERE attacker_user_id=? ORDER BY created_at DESC LIMIT 1').bind(userId).first();
  if(last?.created_at&&timestamp-Number(last.created_at)<COMBAT_SETTINGS.pvpCooldownSeconds*1000) return {ok:false,error:'Combat is cooling down.',status:429};

  const attackerLoadout=await equippedWeapon(userId,env);
  const attackerSkills=await getWeaponSkills(userId,env);
  const attackerMods=await getGameplayModifiers(userId,env);
  const attacker=fighterFromPlayer(attackerPlayer,attackerLoadout,attackerSkills,attackerMods,'You');

  let defender,defenderUserId=null,opponentType='npc',opponentId='',opponentName='',defenderPlayer=null;
  if(body.npcId){
    const npc=getNpcOpponent(String(body.npcId));
    if(!npc) return {ok:false,error:'Unknown NPC opponent',status:404};
    defender=fighterFromNpc(npc);opponentId=npc.id;opponentName=npc.name;
  } else {
    const username=String(body.targetUsername||'').trim(),targetUserId=String(body.targetUserId||'').trim();
    let user=null;
    if(targetUserId) user=await env.DB.prepare('SELECT id,username FROM users WHERE id=?').bind(targetUserId).first();
    else if(username) user=await env.DB.prepare('SELECT id,username FROM users WHERE username=? COLLATE NOCASE').bind(username).first();
    if(!user) return {ok:false,error:'Player not found',status:404};
    if(user.id===userId) return {ok:false,error:'You cannot attack yourself',status:409};
    defenderPlayer=await deps.ensureActivePlayerState(env,user.id);
    if(defenderPlayer.status!=='active') return {ok:false,error:'That player is currently unavailable for combat.',status:409};
    const defenderLoadout=await equippedWeapon(user.id,env);
    const defenderSkills=await getWeaponSkills(user.id,env);
    const defenderMods=await getGameplayModifiers(user.id,env);
    defender=fighterFromPlayer(defenderPlayer,defenderLoadout,defenderSkills,defenderMods,user.username);
    defenderUserId=user.id;opponentType='player';opponentId=user.id;opponentName=user.username;
  }

  const result=simulateFullFight(attacker,defender,COMBAT_SETTINGS.maxRounds);
  const attackerWon=result.winner==='attacker';
  const xpGain=attackerWon?(opponentType==='player'?45:25):8;
  const levelResult=deps.applyXpAndLevels(Number(attackerPlayer.level),Number(attackerPlayer.xp),xpGain);
  const hospitalUntil=timestamp+COMBAT_SETTINGS.hospitalSeconds*1000;
  const weaponClass=attacker.weapon.weaponClass;
  const skillXpGain=Math.max(1,result.logs.filter(log=>log.side==='attacker').reduce((sum,log)=>sum+(log.isMiss?1:3)+(log.isCrit?2:0),0));

  const statements=[
    env.DB.prepare(`UPDATE player_state SET energy=MAX(0,energy-?),energy_regen_at=?,health=?,level=?,xp=?,
      status=?,status_until=?,status_reason=?,updated_at=? WHERE user_id=?`)
      .bind(COMBAT_SETTINGS.energyCost,timestamp,result.attackerHealth,levelResult.level,levelResult.xp,
        result.attackerHealth<=0?'hospitalized':'active',result.attackerHealth<=0?hospitalUntil:null,
        result.attackerHealth<=0?`Combat loss against ${opponentName}`:null,timestamp,userId),
    env.DB.prepare(`INSERT INTO player_weapon_skills(user_id,weapon_class,xp,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(user_id,weapon_class) DO UPDATE SET xp=xp+excluded.xp,updated_at=excluded.updated_at`)
      .bind(userId,weaponClass,skillXpGain,timestamp)
  ];

  if(defenderUserId){
    statements.push(env.DB.prepare(`UPDATE player_state SET health=?,health_regen_at=?,status=?,status_until=?,status_reason=?,updated_at=? WHERE user_id=?`)
      .bind(result.defenderHealth,timestamp,result.defenderHealth<=0?'hospitalized':'active',
        result.defenderHealth<=0?hospitalUntil:null,result.defenderHealth<=0?'Combat defeat':null,timestamp,defenderUserId));
  }

  const historyId=crypto.randomUUID();
  statements.push(env.DB.prepare(`INSERT INTO combat_history
    (id,attacker_user_id,defender_user_id,opponent_type,opponent_id,winner,rounds,attacker_damage,defender_damage,xp_gain,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(historyId,userId,defenderUserId,opponentType,opponentId,result.winner,result.rounds,result.attackerDamage,result.defenderDamage,xpGain,timestamp));
  result.logs.forEach((log,index)=>statements.push(env.DB.prepare(
    `INSERT INTO combat_turns(fight_id,turn_index,round_number,side,log_json) VALUES(?,?,?,?,?)`
  ).bind(historyId,index+1,log.round,log.side,JSON.stringify(log))));
  await env.DB.batch(statements);

  await incrementCounter(userId,'combat',1,env);
  if(attackerWon) await incrementCounter(userId,'combat_win',1,env);
  await unlockEligibleAchievements(userId,env);
  await recordActivity(userId,'combat',attackerWon?'Fight won':'Fight lost',`${opponentName} · ${result.rounds} rounds · ${xpGain} XP.`,'combat',env);
  if(defenderUserId) await recordActivity(defenderUserId,'combat','You were attacked',`${opponentName? 'Combat encounter':''} ${result.defenderHealth<=0?'You were hospitalized.':'Fight resolved.'}`,'combat',env);

  const updatedSkills=await getWeaponSkills(userId,env);
  return {
    ok:true,
    result:{
      id:historyId,opponentType,opponentId,opponentName,winner:result.winner,won:attackerWon,
      rounds:result.rounds,damageDealt:result.attackerDamage,damageTaken:result.defenderDamage,xpGain,
      energySpent:COMBAT_SETTINGS.energyCost,turns:result.logs,
      weapon:{...attacker.weapon},weaponSkill:updatedSkills[weaponClass],
      text:attackerWon?`You won the fight against ${opponentName}.`:`${opponentName} won the fight.`
    },
    player:deps.toPublicPlayerState(await deps.ensureActivePlayerState(env,userId))
  };
}

// TRAVEL
async function ensureTravel(userId,env) {
  await env.DB.prepare("INSERT OR IGNORE INTO player_travel(user_id,current_region,updated_at) VALUES(?,'riftcity',?)").bind(userId,now()).run();
}
async function settleTravel(userId,env) {
  await ensureTravel(userId,env);
  const timestamp = now();
  const state = await env.DB.prepare('SELECT * FROM player_travel WHERE user_id=?').bind(userId).first();
  if (state?.traveling_to && state.arrives_at && Number(state.arrives_at) <= timestamp) {
    const destination = getTravelDestination(state.traveling_to);
    await env.DB.batch([
      env.DB.prepare('UPDATE player_travel SET current_region=?,traveling_to=NULL,departed_at=NULL,arrives_at=NULL,updated_at=? WHERE user_id=?').bind(state.traveling_to,timestamp,userId),
      env.DB.prepare("UPDATE player_state SET status='active',status_until=NULL,status_reason=NULL,updated_at=? WHERE user_id=?").bind(timestamp,userId)
    ]);
    await incrementCounter(userId,'travel',1,env);
    await recordActivity(userId,'travel','Arrived',`Arrived in ${destination?.name||state.traveling_to}.`,'travel',env);
    return { ...(state || {}), current_region:destination?.id || state.traveling_to, traveling_to:null, arrives_at:null };
  }
  return state;
}
async function getTravel(userId,env,deps) {
  const state = await settleTravel(userId,env);
  return {ok:true,destinations:TRAVEL_DESTINATIONS,state,player:deps.toPublicPlayerState(await deps.ensureActivePlayerState(env,userId))};
}
async function travelAction(body,userId,env,deps) {
  if (body.action !== 'depart') return {ok:false,error:'Unknown travel action',status:400};
  const destination = getTravelDestination(String(body.destinationId || ''));
  if (!destination) return {ok:false,error:'Unknown destination',status:404};
  const state = await settleTravel(userId,env);
  if (state?.traveling_to) return {ok:false,error:'You are already traveling',status:409};
  if (state?.current_region === destination.id) return {ok:false,error:'You are already at that destination',status:409};
  const player = await deps.ensureActivePlayerState(env,userId);
  if (player.status !== 'active') return {ok:false,error:`You cannot travel while ${player.status}.`,status:409};
  if (Number(player.level) < destination.levelRequired) return {ok:false,error:`Requires level ${destination.levelRequired}`,status:409};
  if (Number(player.cash) < destination.fare) return {ok:false,error:'Not enough cash for the fare',status:409};
  const timestamp=now(), arrivesAt=timestamp+destination.durationSeconds*1000;
  await env.DB.batch([
    env.DB.prepare('UPDATE player_state SET cash=cash-?,status=?,status_until=?,status_reason=?,updated_at=? WHERE user_id=?').bind(destination.fare,'traveling',arrivesAt,`Traveling to ${destination.name}`,timestamp,userId),
    env.DB.prepare('UPDATE player_travel SET traveling_to=?,departed_at=?,arrives_at=?,updated_at=? WHERE user_id=?').bind(destination.id,timestamp,arrivesAt,timestamp,userId)
  ]);
  await recordActivity(userId,'travel','Travel started',`Departed for ${destination.name}.`,'travel',env);
  return {ok:true,message:`Departed for ${destination.name}.`,arrivesAt,destination,player:deps.toPublicPlayerState(await deps.ensureActivePlayerState(env,userId))};
}

// OFFSHORE BANKING
async function getOffshore(userId,env,deps) {
  const travel = await settleTravel(userId,env);
  const destination = getTravelDestination(travel?.current_region || 'riftcity');
  const accounts = await env.DB.prepare('SELECT * FROM player_offshore_accounts WHERE user_id=? ORDER BY region_id').bind(userId).all();
  return {ok:true,currentRegion:destination,available:Boolean(destination?.offshoreBanking),accounts:accounts.results||[],security:await getBankSecurity(userId,env)};
}
async function offshoreAction(body,userId,env,deps) {
  const travel = await settleTravel(userId,env);
  const destination = getTravelDestination(travel?.current_region || 'riftcity');
  if (!destination?.offshoreBanking) return {ok:false,error:'Offshore banking is only available from supported destinations.',status:409};
  const amount=positiveInt(body.amount);
  if (!amount) return {ok:false,error:'Enter a valid amount',status:400};
  const timestamp=now();
  const security=await getBankSecurity(userId,env);
  if (security.frozen) return {ok:false,error:'Bank account is temporarily frozen.',status:409,security};
  await env.DB.prepare('INSERT OR IGNORE INTO player_bank_accounts(user_id,updated_at) VALUES(?,?)').bind(userId,timestamp).run();
  await env.DB.prepare('INSERT OR IGNORE INTO player_offshore_accounts(user_id,region_id,updated_at) VALUES(?,?,?)').bind(userId,destination.id,timestamp).run();
  const account=await env.DB.prepare('SELECT * FROM player_offshore_accounts WHERE user_id=? AND region_id=?').bind(userId,destination.id).first();

  if (body.action === 'deposit') {
    const bank=await env.DB.prepare('SELECT checking FROM player_bank_accounts WHERE user_id=?').bind(userId).first();
    const fee=Math.max(5,Math.ceil(amount*.03));
    if (Number(bank?.checking) < amount+fee) return {ok:false,error:'Not enough checking balance for the transfer and fee',status:409};
    await env.DB.batch([
      env.DB.prepare('UPDATE player_bank_accounts SET checking=checking-?,updated_at=? WHERE user_id=?').bind(amount+fee,timestamp,userId),
      env.DB.prepare('UPDATE player_offshore_accounts SET balance=balance+?,lifetime_deposits=lifetime_deposits+?,updated_at=? WHERE user_id=? AND region_id=?').bind(amount,amount,timestamp,userId,destination.id)
    ]);
    return {ok:true,message:`Transferred $${amount} offshore.`,fee,balance:Number(account.balance)+amount};
  }
  if (body.action === 'withdraw') {
    const fee=Math.max(5,Math.ceil(amount*.04));
    if (Number(account.balance) < amount+fee) return {ok:false,error:'Not enough offshore balance',status:409};
    await env.DB.batch([
      env.DB.prepare('UPDATE player_offshore_accounts SET balance=balance-?,updated_at=? WHERE user_id=? AND region_id=?').bind(amount+fee,timestamp,userId,destination.id),
      env.DB.prepare('UPDATE player_bank_accounts SET checking=checking+?,updated_at=? WHERE user_id=?').bind(amount,timestamp,userId)
    ]);
    return {ok:true,message:`Transferred $${amount} back to checking.`,fee,balance:Number(account.balance)-amount-fee};
  }
  return {ok:false,error:'Unknown offshore action',status:400};
}

// ACHIEVEMENTS
async function unlockEligibleAchievements(userId,env) {
  const timestamp=now();
  const unlocked=[];
  for (const achievement of ACHIEVEMENT_REGISTRY) {
    const progress=await getCounter(userId,achievement.metric,env);
    if (progress < achievement.target) continue;
    const result=await env.DB.prepare(`
      INSERT OR IGNORE INTO player_achievements(user_id,achievement_id,unlocked_at) VALUES(?,?,?)
    `).bind(userId,achievement.id,timestamp).run();
    if (result.meta?.changes) unlocked.push(achievement.id);
  }
  return unlocked;
}
async function getAchievements(userId,env,deps) {
  await unlockEligibleAchievements(userId,env);
  const rows=await env.DB.prepare('SELECT * FROM player_achievements WHERE user_id=?').bind(userId).all();
  const unlockedMap=new Map((rows.results||[]).map(row=>[row.achievement_id,row]));
  const achievements=[];
  for (const definition of ACHIEVEMENT_REGISTRY) {
    const progress=await getCounter(userId,definition.metric,env);
    const row=unlockedMap.get(definition.id);
    achievements.push({...definition,progress,unlocked:Boolean(row),claimed:Boolean(row?.claimed),unlockedAt:row?.unlocked_at||null});
  }
  return {ok:true,achievements};
}
async function achievementAction(body,userId,env,deps) {
  if (body.action !== 'claim') return {ok:false,error:'Unknown achievement action',status:400};
  const achievement=getAchievementDefinition(String(body.achievementId||''));
  if (!achievement) return {ok:false,error:'Unknown achievement',status:404};
  await unlockEligibleAchievements(userId,env);
  const row=await env.DB.prepare('SELECT * FROM player_achievements WHERE user_id=? AND achievement_id=?').bind(userId,achievement.id).first();
  if (!row) return {ok:false,error:'Achievement is not unlocked',status:409};
  if (row.claimed) return {ok:false,error:'Achievement reward already claimed',status:409};
  const player=await deps.ensureActivePlayerState(env,userId);
  const level=deps.applyXpAndLevels(Number(player.level),Number(player.xp),Number(achievement.reward?.xp)||0);
  const timestamp=now();
  await env.DB.batch([
    env.DB.prepare('UPDATE player_achievements SET claimed=1,claimed_at=? WHERE user_id=? AND achievement_id=? AND claimed=0').bind(timestamp,userId,achievement.id),
    env.DB.prepare('UPDATE player_state SET level=?,xp=?,updated_at=? WHERE user_id=?').bind(level.level,level.xp,timestamp,userId)
  ]);
  await grantMeritPoints(userId,1,env,achievement.name);
  await recordActivity(userId,'achievement','Achievement claimed',achievement.name,'achievements',env);
  return {ok:true,message:`Claimed ${achievement.name} and earned 1 Merit point.`,reward:{...achievement.reward,merits:1},player:deps.toPublicPlayerState(await deps.ensureActivePlayerState(env,userId))};
}

// CHALLENGES
function periodKey(cadence,timestamp=now()) {
  const date=new Date(timestamp);
  if (cadence==='daily') return date.toISOString().slice(0,10);
  const start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));
  const day=(start.getUTCDay()+6)%7;
  start.setUTCDate(start.getUTCDate()-day);
  return start.toISOString().slice(0,10);
}
function rotationOffset(key,length) {
  let hash=2166136261;
  for (const char of key) { hash^=char.charCodeAt(0); hash=Math.imul(hash,16777619); }
  return (hash>>>0)%Math.max(1,length);
}
async function ensureChallenges(userId,cadence,env) {
  const templates=cadence==='daily'?DAILY_CHALLENGE_TEMPLATES:WEEKLY_CHALLENGE_TEMPLATES;
  const key=periodKey(cadence);
  const count=cadence==='daily'?3:2;
  const offset=rotationOffset(`${userId}:${cadence}:${key}`,templates.length);
  for (let index=0;index<count;index+=1) {
    const template=templates[(offset+index)%templates.length];
    const challengeKey=`${cadence}:${key}:${template.id}`;
    const baseline=await getCounter(userId,template.metric,env);
    await env.DB.prepare(`
      INSERT OR IGNORE INTO player_challenges
        (user_id,challenge_key,cadence,period_key,template_id,baseline_value,created_at)
      VALUES(?,?,?,?,?,?,?)
    `).bind(userId,challengeKey,cadence,key,template.id,baseline,now()).run();
  }
  return {key,templates};
}
async function getChallenges(userId,env,deps) {
  const daily=await ensureChallenges(userId,'daily',env);
  const weekly=await ensureChallenges(userId,'weekly',env);
  const rows=await env.DB.prepare(`
    SELECT * FROM player_challenges WHERE user_id=? AND
      ((cadence='daily' AND period_key=?) OR (cadence='weekly' AND period_key=?))
    ORDER BY cadence,created_at
  `).bind(userId,daily.key,weekly.key).all();
  const templateMap=new Map([...DAILY_CHALLENGE_TEMPLATES,...WEEKLY_CHALLENGE_TEMPLATES].map(entry=>[entry.id,entry]));
  const challenges=[];
  for (const row of rows.results||[]) {
    const template=templateMap.get(row.template_id);
    if (!template) continue;
    const current=await getCounter(userId,template.metric,env);
    const progress=Math.max(0,current-Number(row.baseline_value||0));
    challenges.push({...template,challengeKey:row.challenge_key,cadence:row.cadence,periodKey:row.period_key,progress,complete:progress>=template.target,claimed:Boolean(row.claimed)});
  }
  return {ok:true,challenges,dailyPeriod:daily.key,weeklyPeriod:weekly.key};
}
async function challengeAction(body,userId,env,deps) {
  if (body.action !== 'claim') return {ok:false,error:'Unknown challenge action',status:400};
  const key=String(body.challengeKey||'');
  const state=await getChallenges(userId,env,deps);
  const challenge=state.challenges.find(entry=>entry.challengeKey===key);
  if (!challenge) return {ok:false,error:'Challenge not found for the active period',status:404};
  if (!challenge.complete) return {ok:false,error:'Challenge is not complete',status:409};
  if (challenge.claimed) return {ok:false,error:'Challenge already claimed',status:409};
  const player=await deps.ensureActivePlayerState(env,userId);
  const level=deps.applyXpAndLevels(Number(player.level),Number(player.xp),Number(challenge.reward.xp)||0);
  const timestamp=now();
  const result=await env.DB.prepare('UPDATE player_challenges SET claimed=1,claimed_at=? WHERE user_id=? AND challenge_key=? AND claimed=0').bind(timestamp,userId,key).run();
  if (!result.meta?.changes) return {ok:false,error:'Challenge already claimed',status:409};
  await env.DB.prepare('UPDATE player_state SET cash=cash+?,level=?,xp=?,updated_at=? WHERE user_id=?').bind(Number(challenge.reward.cash)||0,level.level,level.xp,timestamp,userId).run();
  await setCounterAtLeast(userId,'cash',Number((await deps.ensureActivePlayerState(env,userId)).cash)||0,env);
  return {ok:true,message:`Claimed ${challenge.name}.`,reward:challenge.reward,player:deps.toPublicPlayerState(await deps.ensureActivePlayerState(env,userId))};
}

// PRODUCTION
async function getProduction(userId,env,deps) {
  const facilities=await env.DB.prepare('SELECT * FROM player_production_facilities WHERE user_id=?').bind(userId).all();
  const batches=await env.DB.prepare('SELECT * FROM production_batches WHERE user_id=? ORDER BY started_at DESC LIMIT 30').bind(userId).all();
  return {ok:true,facilities:PRODUCTION_FACILITIES,recipes:PRODUCTION_RECIPES,ownedFacilities:facilities.results||[],batches:batches.results||[]};
}
async function productionAction(body,userId,env,deps) {
  const timestamp=now();
  if (body.action==='buy-facility') {
    const facility=getProductionFacility(String(body.facilityId||''));
    if (!facility) return {ok:false,error:'Unknown facility',status:404};
    const owned=await env.DB.prepare('SELECT 1 FROM player_production_facilities WHERE user_id=? AND facility_id=?').bind(userId,facility.id).first();
    if (owned) return {ok:false,error:'Facility already owned',status:409};
    const player=await deps.ensureActivePlayerState(env,userId);
    if (Number(player.level)<facility.levelRequired) return {ok:false,error:`Requires level ${facility.levelRequired}`,status:409};
    if (Number(player.cash)<facility.price) return {ok:false,error:'Not enough cash',status:409};
    await env.DB.batch([
      env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(facility.price,timestamp,userId),
      env.DB.prepare('INSERT INTO player_production_facilities(user_id,facility_id,purchased_at) VALUES(?,?,?)').bind(userId,facility.id,timestamp)
    ]);
    return {ok:true,message:`Purchased ${facility.name}.`};
  }
  if (body.action==='start') {
    const facility=getProductionFacility(String(body.facilityId||''));
    const recipe=getProductionRecipe(String(body.recipeId||''));
    if (!facility||!recipe) return {ok:false,error:'Unknown facility or recipe',status:404};
    const owned=await env.DB.prepare('SELECT 1 FROM player_production_facilities WHERE user_id=? AND facility_id=?').bind(userId,facility.id).first();
    if (!owned) return {ok:false,error:'You do not own that facility',status:409};
    const facilityIndex=PRODUCTION_FACILITIES.findIndex(entry=>entry.id===facility.id);
    if (facilityIndex<recipe.facilityLevel) return {ok:false,error:'Facility is not advanced enough for this recipe',status:409};
    const active=await env.DB.prepare('SELECT COUNT(*) AS count FROM production_batches WHERE user_id=? AND facility_id=? AND claimed=0').bind(userId,facility.id).first();
    if (Number(active?.count)>=facility.slots) return {ok:false,error:'All production slots are busy',status:409};
    const player=await deps.ensureActivePlayerState(env,userId);
    if (Number(player.cash)<recipe.cashCost) return {ok:false,error:'Not enough cash for production costs',status:409};
    for (const input of recipe.inputs||[]) {
      const row=await env.DB.prepare('SELECT quantity FROM player_inventory WHERE user_id=? AND item_id=?').bind(userId,input.itemId).first();
      if (Number(row?.quantity)<input.quantity) return {ok:false,error:`Missing required input: ${getItemDefinition(input.itemId)?.name||input.itemId}`,status:409};
    }
    const id=crypto.randomUUID(), completesAt=timestamp+recipe.durationSeconds*1000;
    const statements=[env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(recipe.cashCost,timestamp,userId)];
    for (const input of recipe.inputs||[]) statements.push(env.DB.prepare('UPDATE player_inventory SET quantity=quantity-?,updated_at=? WHERE user_id=? AND item_id=?').bind(input.quantity,timestamp,userId,input.itemId));
    statements.push(env.DB.prepare('INSERT INTO production_batches(id,user_id,facility_id,recipe_id,started_at,completes_at) VALUES(?,?,?,?,?,?)').bind(id,userId,facility.id,recipe.id,timestamp,completesAt));
    await env.DB.batch(statements);
    return {ok:true,message:`Started ${recipe.name}.`,batchId:id,completesAt};
  }
  if (body.action==='claim') {
    const batch=await env.DB.prepare('SELECT * FROM production_batches WHERE id=? AND user_id=? AND claimed=0').bind(String(body.batchId||''),userId).first();
    if (!batch) return {ok:false,error:'Active batch not found',status:404};
    if (Number(batch.completes_at)>timestamp) return {ok:false,error:'Production batch is not ready',status:409};
    const recipe=getProductionRecipe(batch.recipe_id);
    if (!recipe) return {ok:false,error:'Recipe definition is missing',status:500};
    for (const output of recipe.outputs||[]) {
      const item=getItemDefinition(output.itemId);
      if (!item) return {ok:false,error:'Production output definition is missing',status:500};
      const row=await env.DB.prepare('SELECT quantity FROM player_inventory WHERE user_id=? AND item_id=?').bind(userId,item.id).first();
      const current=Number(row?.quantity)||0;
      const max=item.stackable?Number(item.maxStack)||1:1;
      if (current+output.quantity>max) return {ok:false,error:`Not enough inventory capacity for ${item.name}`,status:409};
    }
    for (const output of recipe.outputs||[]) await deps.addItemToInventory(env,userId,output.itemId,output.quantity);
    await env.DB.prepare('UPDATE production_batches SET claimed=1,claimed_at=? WHERE id=? AND claimed=0').bind(timestamp,batch.id).run();
    await incrementCounter(userId,'production',1,env);
    await unlockEligibleAchievements(userId,env);
    await recordActivity(userId,'production','Production complete',`Collected ${recipe.name}.`,'production',env);
    return {ok:true,message:`Collected ${recipe.name}.`,outputs:recipe.outputs};
  }
  return {ok:false,error:'Unknown production action',status:400};
}

// PROPERTY PASSIVE ECONOMY
export async function collectPropertyIncome(userId,propertyId,env,deps) {
  await ensureAdvancedTables(env);
  const property=getPropertyDefinition(propertyId);
  if (!property) return {ok:false,error:'Unknown property',status:404};
  const owned=await env.DB.prepare('SELECT purchased_at FROM player_properties WHERE user_id=? AND property_id=?').bind(userId,property.id).first();
  if (!owned) return {ok:false,error:'You do not own this property',status:409};
  const effects=await env.DB.prepare('SELECT * FROM player_property_effects WHERE user_id=?').bind(userId).first();
  const timestamp=now();
  const last=Number(effects?.last_income_at)||Number(owned.purchased_at)||timestamp;
  const elapsedHours=Math.min(24,Math.floor((timestamp-last)/(60*60*1000)));
  if (elapsedHours<1) return {ok:false,error:'Property income is not ready yet',status:409};
  const gross=elapsedHours*(Number(property.incomePerHour)||0);
  const upkeep=Math.ceil((Number(property.upkeepPerDay)||0)*(elapsedHours/24));
  const net=Math.max(0,gross-upkeep);
  await env.DB.batch([
    env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(net,timestamp,userId),
    env.DB.prepare(`
      INSERT INTO player_property_effects(user_id,property_id,applied_max_health,applied_max_nerve,last_income_at,updated_at)
      VALUES(?,?,0,0,?,?)
      ON CONFLICT(user_id) DO UPDATE SET last_income_at=excluded.last_income_at,updated_at=excluded.updated_at
    `).bind(userId,property.id,timestamp,timestamp),
    env.DB.prepare('INSERT INTO property_ledger(id,user_id,property_id,kind,amount,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,property.id,'income',net,timestamp)
  ]);
  await setCounterAtLeast(userId,'cash',Number((await deps.ensureActivePlayerState(env,userId)).cash)||0,env);
  return {ok:true,message:`Collected $${net} net property income.`,gross,upkeep,net,hours:elapsedHours};
}
