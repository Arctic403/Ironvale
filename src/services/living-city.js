import {
  HEAT_DECAY_PER_HOUR, LAY_LOW_ENERGY_COST, LAY_LOW_HEAT_REDUCTION, LAY_LOW_COOLDOWN_MS, getHeatTier,
  NIGHTCLUB_ACTIVITIES, NIGHTCLUB_TIERS, getNightclubTier, getNightclubEvent,
  MERIT_UPGRADES, getMeritUpgrade,
  CITY_ACTIVITIES, getCityActivity,
  getItemDefinition
} from '../plugins/index.js';

const SQL=`
CREATE TABLE IF NOT EXISTS player_law(
 user_id TEXT PRIMARY KEY,heat INTEGER NOT NULL DEFAULT 0,fine_balance INTEGER NOT NULL DEFAULT 0,
 last_heat_at INTEGER,last_lay_low_at INTEGER,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS law_history(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,heat_delta INTEGER NOT NULL DEFAULT 0,
 fine_delta INTEGER NOT NULL DEFAULT 0,note TEXT,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS crime_career_state(
 user_id TEXT PRIMARY KEY,reputation INTEGER NOT NULL DEFAULT 0,operations_completed INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS crime_operations(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,operation_id TEXT NOT NULL,started_at INTEGER NOT NULL,completes_at INTEGER NOT NULL,
 risk INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'active',reward_cash INTEGER,reward_xp INTEGER,completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS player_nightclub(
 user_id TEXT PRIMARY KEY,reputation INTEGER NOT NULL DEFAULT 0,visits INTEGER NOT NULL DEFAULT 0,last_activity_at INTEGER,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_merits(
 user_id TEXT PRIMARY KEY,points INTEGER NOT NULL DEFAULT 0,lifetime_points INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_merit_upgrades(
 user_id TEXT NOT NULL,upgrade_id TEXT NOT NULL,rank INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,upgrade_id)
);
CREATE TABLE IF NOT EXISTS property_upgrades(
 user_id TEXT NOT NULL,property_id TEXT NOT NULL,upgrade_id TEXT NOT NULL,rank INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,property_id,upgrade_id)
);
CREATE TABLE IF NOT EXISTS rental_units(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,tier TEXT NOT NULL,purchase_price INTEGER NOT NULL,rent_per_hour INTEGER NOT NULL,
 upkeep_per_hour INTEGER NOT NULL,last_collect_at INTEGER NOT NULL,total_income INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rental_ledger(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,unit_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_feed(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,category TEXT NOT NULL,title TEXT NOT NULL,detail TEXT,
 route TEXT,read INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS city_activity_state(
 user_id TEXT NOT NULL,activity_id TEXT NOT NULL,last_used_at INTEGER,uses INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,activity_id)
);
CREATE TABLE IF NOT EXISTS job_history(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,job_id TEXT NOT NULL,event_id TEXT,pay INTEGER NOT NULL,skill_xp INTEGER NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS faction_reward_purchases(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,faction_id TEXT NOT NULL,reward_id TEXT NOT NULL,cost INTEGER NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_faction_ext(
 user_id TEXT PRIMARY KEY,last_left_at INTEGER,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS casino_history(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL,game_id TEXT NOT NULL,wager INTEGER NOT NULL,payout INTEGER NOT NULL,result_text TEXT,created_at INTEGER NOT NULL
);
`;
let ensured=false;
const now=()=>Date.now();
const rand=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/0x100000000;};
const randInt=(a,b)=>Math.floor(a+rand()*(b-a+1));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));

export async function ensureLivingCityTables(env){
 if(ensured)return;
 for(const s of SQL.split(';').map(x=>x.trim()).filter(Boolean)) await env.DB.prepare(s).run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id,created_at DESC)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON activity_feed(user_id,read,created_at DESC)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_law_history_user ON law_history(user_id,created_at DESC)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_crime_operations_user ON crime_operations(user_id,status,completes_at)').run();
 ensured=true;
}

async function activePlayer(userId,env,deps){return deps.ensureActivePlayerState(env,userId);}
export async function recordActivity(userId,category,title,detail,route,env){
 await ensureLivingCityTables(env);
 await env.DB.prepare('INSERT INTO activity_feed(id,user_id,category,title,detail,route,created_at) VALUES(?,?,?,?,?,?,?)')
  .bind(crypto.randomUUID(),userId,category,title,detail||null,route||null,now()).run();
}

async function ensureLaw(userId,env){await ensureLivingCityTables(env);await env.DB.prepare('INSERT OR IGNORE INTO player_law(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();}
export async function getLawState(userId,env){
 await ensureLaw(userId,env);
 let row=await env.DB.prepare('SELECT * FROM player_law WHERE user_id=?').bind(userId).first();
 const t=now(),last=Number(row.last_heat_at)||t,hours=Math.floor((t-last)/3600000);
 if(hours>0&&Number(row.heat)>0){
  const heat=Math.max(0,Number(row.heat)-hours*HEAT_DECAY_PER_HOUR);
  await env.DB.prepare('UPDATE player_law SET heat=?,last_heat_at=?,updated_at=? WHERE user_id=?').bind(heat,last+hours*3600000,t,userId).run();
  row={...row,heat,last_heat_at:last+hours*3600000,updated_at:t};
 }
 const tier=getHeatTier(row.heat);
 return {...row,tier,wantedLevel:tier.id==='priority'?4:tier.id==='wanted'?3:tier.id==='watched'?2:tier.id==='noticed'?1:0};
}
export async function applyCrimeHeat(userId,crime,success,env){
 await ensureLaw(userId,env); const t=now();
 const delta=Math.max(0,Number(success?crime.heatSuccess:crime.heatFailure)|| (success?3:5));
 const fine=!success&&rand()<.18?Math.max(10,Math.round((Number(crime.nerveCost)||1)*25)):0;
 await env.DB.batch([
  env.DB.prepare('UPDATE player_law SET heat=MIN(100,heat+?),fine_balance=fine_balance+?,last_heat_at=?,updated_at=? WHERE user_id=?').bind(delta,fine,t,t,userId),
  env.DB.prepare('INSERT INTO law_history(id,user_id,kind,heat_delta,fine_delta,note,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,success?'crime-success':'crime-failure',delta,fine,crime.name,t)
 ]);
 return getLawState(userId,env);
}
export async function getLawChancePenalty(userId,env){return Number((await getLawState(userId,env)).tier?.chancePenalty)||0;}
async function lawAction(body,userId,env,deps){
 const state=await getLawState(userId,env),t=now();
 if(body.action==='lay-low'){
  if(state.last_lay_low_at&&t-Number(state.last_lay_low_at)<LAY_LOW_COOLDOWN_MS)return {ok:false,error:'You need more time before laying low again.',status:429};
  const p=await activePlayer(userId,env,deps);if(Number(p.energy)<LAY_LOW_ENERGY_COST)return {ok:false,error:`You need ${LAY_LOW_ENERGY_COST} Energy.`,status:409};
  const reduction=Math.min(Number(state.heat),LAY_LOW_HEAT_REDUCTION);
  await env.DB.batch([
   env.DB.prepare('UPDATE player_state SET energy=energy-?,updated_at=? WHERE user_id=?').bind(LAY_LOW_ENERGY_COST,t,userId),
   env.DB.prepare('UPDATE player_law SET heat=MAX(0,heat-?),last_lay_low_at=?,last_heat_at=?,updated_at=? WHERE user_id=?').bind(reduction,t,t,t,userId),
   env.DB.prepare('INSERT INTO law_history(id,user_id,kind,heat_delta,note,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,'lay-low',-reduction,'Laid low',t)
  ]);
  await recordActivity(userId,'law','Heat reduced',`Heat reduced by ${reduction}.`,'law',env);
  return {ok:true,message:`Heat reduced by ${reduction}.`,law:await getLawState(userId,env),player:deps.toPublicPlayerState(await activePlayer(userId,env,deps))};
 }
 if(body.action==='pay-fine'){
  const amount=Math.min(Number(state.fine_balance)||0,Math.max(0,Math.floor(Number(body.amount)||state.fine_balance)));
  if(!amount)return {ok:false,error:'No fine balance to pay.',status:409}; const p=await activePlayer(userId,env,deps);if(Number(p.cash)<amount)return {ok:false,error:'Not enough cash.',status:409};
  await env.DB.batch([
   env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(amount,t,userId),
   env.DB.prepare('UPDATE player_law SET fine_balance=fine_balance-?,updated_at=? WHERE user_id=?').bind(amount,t,userId),
   env.DB.prepare('INSERT INTO law_history(id,user_id,kind,fine_delta,note,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,'fine-paid',-amount,'Fine payment',t)
  ]);
  return {ok:true,message:`Paid $${amount} in fines.`,law:await getLawState(userId,env),player:deps.toPublicPlayerState(await activePlayer(userId,env,deps))};
 }
 return {ok:false,error:'Unknown law action',status:400};
}

const OPERATIONS=Object.freeze([
 {id:'fence-network',name:'Fence Network',description:'Coordinate a short underground resale operation.',durationMs:5*60_000,cash:[120,260],xp:[10,18],heat:6,level:3},
 {id:'courier-ring',name:'Courier Ring',description:'Coordinate a chain of anonymous dropoffs around the city.',durationMs:10*60_000,cash:[260,520],xp:[18,28],heat:9,level:7},
 {id:'signal-relay',name:'Signal Relay',description:'Run a fictional digital relay operation through RiftCity contacts.',durationMs:15*60_000,cash:[480,900],xp:[25,40],heat:12,level:12}
]);
async function getCrimeCareers(userId,env,deps){
 await ensureLivingCityTables(env);await env.DB.prepare('INSERT OR IGNORE INTO crime_career_state(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();
 const state=await env.DB.prepare('SELECT * FROM crime_career_state WHERE user_id=?').bind(userId).first();
 const ops=await env.DB.prepare('SELECT * FROM crime_operations WHERE user_id=? ORDER BY started_at DESC LIMIT 20').bind(userId).all();
 const slot=Math.floor(now()/(5*60_000)); const rotating=OPERATIONS.filter((_,i)=>(i+slot)%2===0);
 return {ok:true,state,operations:OPERATIONS,rotating,active:ops.results||[],law:await getLawState(userId,env)};
}
async function crimeCareerAction(body,userId,env,deps){
 await ensureLivingCityTables(env);const t=now();
 if(body.action==='start-operation'){
  const op=OPERATIONS.find(x=>x.id===String(body.operationId||''));if(!op)return {ok:false,error:'Unknown operation',status:404};
  const p=await activePlayer(userId,env,deps);if(Number(p.level)<op.level)return {ok:false,error:`Requires level ${op.level}.`,status:409};
  const active=await env.DB.prepare("SELECT COUNT(*) count FROM crime_operations WHERE user_id=? AND status='active'").bind(userId).first();if(Number(active?.count)>=2)return {ok:false,error:'You already have two active operations.',status:409};
  const id=crypto.randomUUID(),risk=randInt(20,65);
  await env.DB.prepare("INSERT INTO crime_operations(id,user_id,operation_id,started_at,completes_at,risk,status) VALUES(?,?,?,?,?,?,'active')").bind(id,userId,op.id,t,t+op.durationMs,risk).run();
  return {ok:true,message:`Started ${op.name}.`,operationId:id,completesAt:t+op.durationMs,risk};
 }
 if(body.action==='collect-operation'){
  const row=await env.DB.prepare("SELECT * FROM crime_operations WHERE id=? AND user_id=? AND status='active'").bind(String(body.id||''),userId).first();if(!row)return {ok:false,error:'Operation not found.',status:404};if(Number(row.completes_at)>t)return {ok:false,error:'Operation is not ready.',status:409};
  const op=OPERATIONS.find(x=>x.id===row.operation_id);if(!op)return {ok:false,error:'Operation definition missing.',status:500};
  const cash=randInt(...op.cash),xp=randInt(...op.xp);const p=await activePlayer(userId,env,deps);const leveled=deps.applyXpAndLevels(Number(p.level),Number(p.xp),xp);
  await env.DB.batch([
   env.DB.prepare('UPDATE player_state SET cash=cash+?,level=?,xp=?,updated_at=? WHERE user_id=?').bind(cash,leveled.level,leveled.xp,t,userId),
   env.DB.prepare("UPDATE crime_operations SET status='complete',reward_cash=?,reward_xp=?,completed_at=? WHERE id=?").bind(cash,xp,t,row.id),
   env.DB.prepare('UPDATE crime_career_state SET reputation=reputation+?,operations_completed=operations_completed+1,updated_at=? WHERE user_id=?').bind(Math.max(2,Math.round(op.heat/2)),t,userId)
  ]);
  await applyCrimeHeat(userId,{name:op.name,nerveCost:2,heatSuccess:op.heat},true,env);
  await recordActivity(userId,'crime','Operation completed',`${op.name}: +$${cash}, +${xp} XP.`,'crimes',env);
  return {ok:true,message:`Collected ${op.name}.`,cash,xp,player:deps.toPublicPlayerState(await activePlayer(userId,env,deps))};
 }
 return {ok:false,error:'Unknown crime-career action',status:400};
}

async function getNightclub(userId,env){
 await ensureLivingCityTables(env);await env.DB.prepare('INSERT OR IGNORE INTO player_nightclub(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();
 const state=await env.DB.prepare('SELECT * FROM player_nightclub WHERE user_id=?').bind(userId).first();
 return {ok:true,state,tier:getNightclubTier(state.reputation),tiers:NIGHTCLUB_TIERS,activities:NIGHTCLUB_ACTIVITIES,event:getNightclubEvent()};
}
async function nightclubAction(body,userId,env,deps){
 const data=await getNightclub(userId,env),activity=NIGHTCLUB_ACTIVITIES.find(a=>a.id===String(body.activityId||''));if(body.action!=='do'||!activity)return {ok:false,error:'Unknown nightclub action',status:400};
 const tier=data.tier;if(activity.requiredTier&&NIGHTCLUB_TIERS.findIndex(t=>t.id===tier.id)<NIGHTCLUB_TIERS.findIndex(t=>t.id===activity.requiredTier))return {ok:false,error:`Requires ${activity.requiredTier.toUpperCase()} status.`,status:409};
 const t=now();if(data.state.last_activity_at&&t-Number(data.state.last_activity_at)<activity.cooldownMs)return {ok:false,error:'That activity is still cooling down.',status:429};
 const p=await activePlayer(userId,env,deps);if(Number(p.energy)<activity.energyCost)return {ok:false,error:`You need ${activity.energyCost} Energy.`,status:409};const event=getNightclubEvent();const gain=Math.max(1,Math.round(activity.reputation*event.repMultiplier));
 await env.DB.batch([
  env.DB.prepare('UPDATE player_state SET energy=energy-?,updated_at=? WHERE user_id=?').bind(activity.energyCost,t,userId),
  env.DB.prepare('UPDATE player_nightclub SET reputation=reputation+?,visits=visits+1,last_activity_at=?,updated_at=? WHERE user_id=?').bind(gain,t,t,userId)
 ]);
 await recordActivity(userId,'nightclub','Afterdark reputation',`+${gain} nightlife reputation from ${activity.name}.`,'nightclub',env);
 return {ok:true,message:`${activity.name} complete. +${gain} reputation.`,player:deps.toPublicPlayerState(await activePlayer(userId,env,deps)),state:(await getNightclub(userId,env)).state};
}

async function ensureMerits(userId,env){await ensureLivingCityTables(env);await env.DB.prepare('INSERT OR IGNORE INTO player_merits(user_id,points,lifetime_points,updated_at) VALUES(?,3,3,?)').bind(userId,now()).run();}
export async function getMeritModifiers(userId,env){
 await ensureMerits(userId,env);const rows=await env.DB.prepare('SELECT upgrade_id,rank FROM player_merit_upgrades WHERE user_id=?').bind(userId).all();const m={crimeChanceBonus:0,gymGainMultiplier:1,jobPayMultiplier:1,marketVolatilityMultiplier:1};
 for(const r of rows.results||[]){const u=getMeritUpgrade(r.upgrade_id),rank=Number(r.rank)||0;if(!u)continue;const a=Number(u.effect.amount)||0;if(u.effect.type==='crimeChance')m.crimeChanceBonus+=a*rank;if(u.effect.type==='gymGain')m.gymGainMultiplier+=a*rank;if(u.effect.type==='jobPay')m.jobPayMultiplier+=a*rank;if(u.effect.type==='marketStability')m.marketVolatilityMultiplier=Math.max(.65,m.marketVolatilityMultiplier-a*rank);}
 return m;
}
async function getMerits(userId,env){await ensureMerits(userId,env);const state=await env.DB.prepare('SELECT * FROM player_merits WHERE user_id=?').bind(userId).first();const rows=await env.DB.prepare('SELECT * FROM player_merit_upgrades WHERE user_id=?').bind(userId).all();return {ok:true,state,upgrades:MERIT_UPGRADES,ranks:rows.results||[]};}
async function meritAction(body,userId,env,deps){
 if(body.action!=='upgrade')return {ok:false,error:'Unknown merit action',status:400};await ensureMerits(userId,env);const u=getMeritUpgrade(String(body.upgradeId||''));if(!u)return {ok:false,error:'Unknown merit upgrade',status:404};const state=await env.DB.prepare('SELECT * FROM player_merits WHERE user_id=?').bind(userId).first();const row=await env.DB.prepare('SELECT rank FROM player_merit_upgrades WHERE user_id=? AND upgrade_id=?').bind(userId,u.id).first();const rank=Number(row?.rank)||0;if(rank>=u.maxRank)return {ok:false,error:'Upgrade is already max rank.',status:409};const cost=u.baseCost+Math.floor(rank/3);if(Number(state.points)<cost)return {ok:false,error:`You need ${cost} Merit point${cost===1?'':'s'}.`,status:409};const t=now();const stmts=[env.DB.prepare('UPDATE player_merits SET points=points-?,updated_at=? WHERE user_id=?').bind(cost,t,userId),env.DB.prepare('INSERT INTO player_merit_upgrades(user_id,upgrade_id,rank,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id,upgrade_id) DO UPDATE SET rank=rank+1,updated_at=excluded.updated_at').bind(userId,u.id,t)];if(u.effect.type==='maxEnergy')stmts.push(env.DB.prepare('UPDATE player_state SET max_energy=max_energy+?,energy=MIN(max_energy+?,energy+?),updated_at=? WHERE user_id=?').bind(u.effect.amount,u.effect.amount,u.effect.amount,t,userId));if(u.effect.type==='maxNerve')stmts.push(env.DB.prepare('UPDATE player_state SET max_nerve=max_nerve+?,nerve=MIN(max_nerve+?,nerve+?),updated_at=? WHERE user_id=?').bind(u.effect.amount,u.effect.amount,u.effect.amount,t,userId));await env.DB.batch(stmts);await recordActivity(userId,'progression','Merit upgraded',`${u.name} reached rank ${rank+1}.`,'merits',env);return {ok:true,message:`${u.name} upgraded to rank ${rank+1}.`,player:deps.toPublicPlayerState(await activePlayer(userId,env,deps))};
}
export async function grantMeritPoints(userId,amount,env,reason='Progression reward'){await ensureMerits(userId,env);const n=Math.max(0,Math.floor(Number(amount)||0));if(!n)return;await env.DB.prepare('UPDATE player_merits SET points=points+?,lifetime_points=lifetime_points+?,updated_at=? WHERE user_id=?').bind(n,n,now(),userId).run();await recordActivity(userId,'progression','Merit earned',`+${n} Merit point${n===1?'':'s'} — ${reason}.`,'merits',env);}

const PROPERTY_UPGRADES=Object.freeze([
 {id:'storage',name:'Secure Storage',basePrice:1200,maxRank:5,description:'Expand property utility and storage value.'},
 {id:'security',name:'Security Suite',basePrice:1800,maxRank:5,description:'Reduce property and financial exposure.'},
 {id:'gym-room',name:'Home Training Room',basePrice:2500,maxRank:4,description:'Adds a small training support bonus.'},
 {id:'medical-room',name:'Recovery Room',basePrice:3000,maxRank:4,description:'Improves the home recovery environment.'}
]);
const RENTAL_TIERS=Object.freeze([
 {id:'studio',name:'Rental Studio',price:12000,rent:28,upkeep:6},
 {id:'duplex',name:'Rift Duplex',price:45000,rent:110,upkeep:24},
 {id:'loft',name:'Downtown Loft',price:110000,rent:260,upkeep:65}
]);
async function getPropertyPortfolio(userId,env){await ensureLivingCityTables(env);const properties=await env.DB.prepare('SELECT * FROM player_properties WHERE user_id=?').bind(userId).all();const upgrades=await env.DB.prepare('SELECT * FROM property_upgrades WHERE user_id=?').bind(userId).all();const rentals=await env.DB.prepare('SELECT * FROM rental_units WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();const ledger=await env.DB.prepare('SELECT * FROM rental_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 30').bind(userId).all();return {ok:true,properties:properties.results||[],upgrades:PROPERTY_UPGRADES,ownedUpgrades:upgrades.results||[],rentalTiers:RENTAL_TIERS,rentals:rentals.results||[],ledger:ledger.results||[]};}
async function propertyPortfolioAction(body,userId,env,deps){
 await ensureLivingCityTables(env);const t=now();
 if(body.action==='upgrade'){
  const id=String(body.upgradeId||''),propertyId=String(body.propertyId||'');const u=PROPERTY_UPGRADES.find(x=>x.id===id);if(!u)return {ok:false,error:'Unknown property upgrade',status:404};const owned=await env.DB.prepare('SELECT 1 FROM player_properties WHERE user_id=? AND property_id=?').bind(userId,propertyId).first();if(!owned)return {ok:false,error:'You do not own that property.',status:409};const row=await env.DB.prepare('SELECT rank FROM property_upgrades WHERE user_id=? AND property_id=? AND upgrade_id=?').bind(userId,propertyId,id).first();const rank=Number(row?.rank)||0;if(rank>=u.maxRank)return {ok:false,error:'Upgrade is already max rank.',status:409};const price=u.basePrice*(rank+1);const p=await activePlayer(userId,env,deps);if(Number(p.cash)<price)return {ok:false,error:'Not enough cash.',status:409};await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(price,t,userId),env.DB.prepare('INSERT INTO property_upgrades(user_id,property_id,upgrade_id,rank,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(user_id,property_id,upgrade_id) DO UPDATE SET rank=rank+1,updated_at=excluded.updated_at').bind(userId,propertyId,id,t)]);return {ok:true,message:`${u.name} upgraded to rank ${rank+1}.`};
 }
 if(body.action==='buy-rental'){
  const tier=RENTAL_TIERS.find(x=>x.id===String(body.tier||''));if(!tier)return {ok:false,error:'Unknown rental tier.',status:404};const p=await activePlayer(userId,env,deps);if(Number(p.cash)<tier.price)return {ok:false,error:'Not enough cash.',status:409};const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(tier.price,t,userId),env.DB.prepare('INSERT INTO rental_units(id,user_id,tier,purchase_price,rent_per_hour,upkeep_per_hour,last_collect_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,userId,tier.id,tier.price,tier.rent,tier.upkeep,t,t)]);return {ok:true,message:`Purchased ${tier.name}.`};
 }
 if(body.action==='collect-rent'){
  const row=await env.DB.prepare('SELECT * FROM rental_units WHERE id=? AND user_id=?').bind(String(body.unitId||''),userId).first();if(!row)return {ok:false,error:'Rental unit not found.',status:404};const hours=Math.min(48,Math.floor((t-Number(row.last_collect_at))/3600000));if(hours<1)return {ok:false,error:'Rent is not ready yet.',status:409};let gross=hours*Number(row.rent_per_hour),upkeep=hours*Number(row.upkeep_per_hour),event='normal';const r=rand();if(r<.08){gross=Math.round(gross*.72);event='maintenance';}else if(r<.15){gross=Math.round(gross*.85);event='vacancy';}const net=Math.max(0,gross-upkeep);await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(net,t,userId),env.DB.prepare('UPDATE rental_units SET last_collect_at=?,total_income=total_income+? WHERE id=?').bind(t,net,row.id),env.DB.prepare('INSERT INTO rental_ledger(id,user_id,unit_id,kind,amount,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,row.id,event,net,t)]);const note=event==='maintenance'?' after a maintenance expense':event==='vacancy'?' after a vacancy period':'';await recordActivity(userId,'property','Rent collected',`+$${net} net rental income${note}.`,'property-portfolio',env);return {ok:true,message:`Collected $${net} net rent${note}.`,net,hours,event,player:deps.toPublicPlayerState(await activePlayer(userId,env,deps))};
 }
 return {ok:false,error:'Unknown property portfolio action',status:400};
}

const FACTION_REWARDS=Object.freeze([
 {id:'field-kit',name:'Faction Field Kit',cost:20,itemId:'first_aid_kit',quantity:1},
 {id:'energy-pack',name:'Faction Energy Pack',cost:30,itemId:'energy_drink',quantity:2},
 {id:'utility-tool',name:'Faction Utility Tool',cost:45,itemId:'screwdriver',quantity:1}
]);
async function getFactionShop(userId,env){await ensureLivingCityTables(env);const f=await env.DB.prepare('SELECT * FROM player_factions WHERE user_id=?').bind(userId).first();const ext=await env.DB.prepare('SELECT * FROM player_faction_ext WHERE user_id=?').bind(userId).first();return {ok:true,faction:f,rewards:FACTION_REWARDS,lastLeftAt:ext?.last_left_at||null,leaveCooldownMs:15*60_000};}
async function factionShopAction(body,userId,env,deps){if(body.action!=='buy')return {ok:false,error:'Unknown faction shop action',status:400};const reward=FACTION_REWARDS.find(x=>x.id===String(body.rewardId||''));if(!reward)return {ok:false,error:'Unknown reward',status:404};const f=await env.DB.prepare('SELECT * FROM player_factions WHERE user_id=?').bind(userId).first();if(!f?.faction_id)return {ok:false,error:'Join a faction first.',status:409};if(Number(f.points)<reward.cost)return {ok:false,error:'Not enough faction points.',status:409};const item=getItemDefinition(reward.itemId);if(!item)return {ok:false,error:'Reward item missing.',status:500};await env.DB.prepare('UPDATE player_factions SET points=points-?,updated_at=? WHERE user_id=?').bind(reward.cost,now(),userId).run();const add=await deps.addItemToInventory(env,userId,reward.itemId,reward.quantity);if(add.added<reward.quantity){await env.DB.prepare('UPDATE player_factions SET points=points+?,updated_at=? WHERE user_id=?').bind(reward.cost,now(),userId).run();return {ok:false,error:'Inventory cannot hold the reward.',status:409};}await env.DB.prepare('INSERT INTO faction_reward_purchases(id,user_id,faction_id,reward_id,cost,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,f.faction_id,reward.id,reward.cost,now()).run();return {ok:true,message:`Purchased ${reward.name}.`};}
export async function noteFactionLeave(userId,env){await ensureLivingCityTables(env);await env.DB.prepare('INSERT INTO player_faction_ext(user_id,last_left_at,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_left_at=excluded.last_left_at,updated_at=excluded.updated_at').bind(userId,now(),now()).run();}
export async function canJoinFaction(userId,env){await ensureLivingCityTables(env);const row=await env.DB.prepare('SELECT last_left_at FROM player_faction_ext WHERE user_id=?').bind(userId).first();const wait=row?.last_left_at?15*60_000-(now()-Number(row.last_left_at)):0;return {ok:wait<=0,remainingMs:Math.max(0,wait)};}

async function getActivities(userId,env){await ensureLivingCityTables(env);const rows=await env.DB.prepare('SELECT * FROM city_activity_state WHERE user_id=?').bind(userId).all();return {ok:true,activities:CITY_ACTIVITIES,state:rows.results||[]};}
async function cityActivityAction(body,userId,env,deps){if(body.action!=='do')return {ok:false,error:'Unknown city activity action',status:400};const a=getCityActivity(String(body.activityId||''));if(!a)return {ok:false,error:'Unknown activity.',status:404};const loc=await env.DB.prepare('SELECT location_id FROM player_location WHERE user_id=?').bind(userId).first();if(loc?.location_id!==a.locationId)return {ok:false,error:'You must be at the matching city location.',status:409};const state=await env.DB.prepare('SELECT * FROM city_activity_state WHERE user_id=? AND activity_id=?').bind(userId,a.id).first(),t=now();if(state?.last_used_at&&t-Number(state.last_used_at)<a.cooldownMs)return {ok:false,error:'Activity is still cooling down.',status:429};const p=await activePlayer(userId,env,deps);if(Number(p.energy)<a.energyCost)return {ok:false,error:`You need ${a.energyCost} Energy.`,status:409};const xp=randInt(...(a.reward.xp||[0,0])),cash=randInt(...(a.reward.cash||[0,0])),health=randInt(...(a.reward.health||[0,0]));const lev=deps.applyXpAndLevels(Number(p.level),Number(p.xp),xp);await env.DB.batch([env.DB.prepare('UPDATE player_state SET energy=MAX(0,energy-?),cash=cash+?,health=MIN(max_health,health+?),level=?,xp=?,updated_at=? WHERE user_id=?').bind(a.energyCost,cash,health,lev.level,lev.xp,t,userId),env.DB.prepare('INSERT INTO city_activity_state(user_id,activity_id,last_used_at,uses) VALUES(?,?,?,1) ON CONFLICT(user_id,activity_id) DO UPDATE SET last_used_at=excluded.last_used_at,uses=uses+1').bind(userId,a.id,t)]);await recordActivity(userId,'city',a.name,`+$${cash}, +${xp} XP${health?`, +${health} Health`:''}.`,'city-activities',env);return {ok:true,message:`${a.name} complete.`,cash,xp,health,player:deps.toPublicPlayerState(await activePlayer(userId,env,deps))};}

async function getActivityFeed(userId,env){await ensureLivingCityTables(env);const rows=await env.DB.prepare('SELECT * FROM activity_feed WHERE user_id=? ORDER BY created_at DESC LIMIT 80').bind(userId).all();const unread=(rows.results||[]).filter(r=>!r.read).length;return {ok:true,items:rows.results||[],unread};}
async function activityAction(body,userId,env){if(body.action==='mark-read'){await ensureLivingCityTables(env);if(body.id)await env.DB.prepare('UPDATE activity_feed SET read=1 WHERE id=? AND user_id=?').bind(String(body.id),userId).run();else await env.DB.prepare('UPDATE activity_feed SET read=1 WHERE user_id=?').bind(userId).run();return {ok:true,message:'Activity updated.'};}return {ok:false,error:'Unknown activity action',status:400};}

const CASINO_GAMES=[
 {id:'blackjack',name:'Blackjack',minBet:1,maxBet:25},{id:'roulette',name:'Roulette',minBet:1,maxBet:25},{id:'baccarat',name:'Baccarat',minBet:1,maxBet:25},
 {id:'craps',name:'Craps',minBet:1,maxBet:25},{id:'war',name:'Casino War',minBet:1,maxBet:25},{id:'slots',name:'Slots',minBet:1,maxBet:20},
 {id:'horse-racing',name:'Horse Racing',minBet:1,maxBet:20},{id:'poker',name:'Hold’em Table',minBet:2,maxBet:25}
];
function casinoResolve(game,wager){
 let win=false,mult=0,text='';
 if(game==='roulette'){const n=randInt(0,36);win=rand()<.47;mult=win?2:0;text=`Wheel landed on ${n}. ${win?'Even-money ticket won.':'Ticket lost.'}`;}
 else if(game==='slots'){const r=rand();mult=r<.03?8:r<.12?3:r<.35?1.5:0;win=mult>0;text=mult>=8?'Jackpot line hit.':win?'Winning line.':'No matching line.';}
 else if(game==='horse-racing'){const horse=randInt(1,6),pick=randInt(1,6);win=horse===pick;mult=win?5:0;text=`Horse ${horse} crossed first; your ticket was Horse ${pick}.`;}
 else if(game==='poker'){const you=randInt(1,100),opp=randInt(1,100);win=you>opp;mult=win?2:you===opp?1:0;text=you===opp?'Table hand pushed.':win?'Your final hand ranked higher.':'Opponent hand ranked higher.';}
 else {const you=randInt(2,21),house=randInt(2,21);win=you>house;mult=you===house?1:win?2:0;text=you===house?'Push.':win?'You won the round.':'House won the round.';}
 return {payout:Math.floor(wager*mult),text,win,mult};
}
export async function getCasinoExperience(userId,env){await ensureLivingCityTables(env);const history=await env.DB.prepare('SELECT * FROM casino_history WHERE user_id=? ORDER BY created_at DESC LIMIT 25').bind(userId).all();return {games:CASINO_GAMES,history:history.results||[]};}
export async function playCasinoGame(body,userId,env,deps){await ensureLivingCityTables(env);const game=CASINO_GAMES.find(g=>g.id===String(body.gameId||''));if(!game)return {ok:false,error:'Unknown casino game.',status:404};const wager=Math.floor(Number(body.wager)||0);if(wager<game.minBet||wager>game.maxBet)return {ok:false,error:`Wager must be ${game.minBet}-${game.maxBet} chips.`,status:400};const state=await env.DB.prepare('SELECT * FROM player_casino WHERE user_id=?').bind(userId).first();if(!state||Number(state.chips)<wager)return {ok:false,error:'Not enough in-game chips.',status:409};const result=casinoResolve(game.id,wager),t=now();await env.DB.batch([env.DB.prepare('UPDATE player_casino SET chips=chips-?+?,updated_at=? WHERE user_id=?').bind(wager,result.payout,t,userId),env.DB.prepare('INSERT INTO casino_history(id,user_id,game_id,wager,payout,result_text,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,game.id,wager,result.payout,result.text,t)]);await recordActivity(userId,'casino',game.name,`${result.text} Net ${result.payout-wager} chips.`,'casino',env);return {ok:true,message:result.text,wager,payout:result.payout,net:result.payout-wager,chips:Number(state.chips)-wager+result.payout};}

export async function getPropertyUpgradeModifiers(userId,env){await ensureLivingCityTables(env);const rows=await env.DB.prepare(`SELECT pu.upgrade_id,pu.rank FROM property_upgrades pu JOIN player_properties pp ON pp.user_id=pu.user_id AND pp.property_id=pu.property_id WHERE pu.user_id=? AND pp.is_home=1`).bind(userId).all();const out={gymGainMultiplier:1,bankRiskReduction:0};for(const r of rows.results||[]){if(r.upgrade_id==='gym-room')out.gymGainMultiplier+=.015*Number(r.rank||0);if(r.upgrade_id==='security')out.bankRiskReduction+=.12*Number(r.rank||0);}return out;}
export async function evaluateBankRisk(userId,env){const law=await getLawState(userId,env);const heat=Number(law.heat)||0;const upgrades=await getPropertyUpgradeModifiers(userId,env);const base=heat>=80?.04:heat>=60?.015:0;return {heat,tier:law.tier,exposure:heat>=80?'severe':heat>=60?'high':heat>=40?'elevated':'normal',freezeChance:Math.max(0,base*(1-upgrades.bankRiskReduction)),securityReduction:upgrades.bankRiskReduction};}
export async function maybeTriggerBankRisk(userId,env){const risk=await evaluateBankRisk(userId,env);if(risk.freezeChance>0&&rand()<risk.freezeChance){const until=now()+5*60_000;await env.DB.prepare('INSERT INTO player_bank_security(user_id,frozen_until,last_risk_event_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET frozen_until=excluded.frozen_until,last_risk_event_at=excluded.last_risk_event_at,updated_at=excluded.updated_at').bind(userId,until,now(),now()).run();await recordActivity(userId,'bank','Account review',`High Heat triggered a temporary bank review.`,'bank',env);return {triggered:true,until,risk};}return {triggered:false,risk};}

export async function getLivingCityService(service,userId,env,deps,url){
 await ensureLivingCityTables(env);
 if(service==='law')return {ok:true,law:await getLawState(userId,env),history:(await env.DB.prepare('SELECT * FROM law_history WHERE user_id=? ORDER BY created_at DESC LIMIT 40').bind(userId).all()).results||[]};
 if(service==='crime-careers')return getCrimeCareers(userId,env,deps);
 if(service==='nightclub')return getNightclub(userId,env);
 if(service==='merits')return getMerits(userId,env);
 if(service==='property-portfolio')return getPropertyPortfolio(userId,env);
 if(service==='faction-shop')return getFactionShop(userId,env);
 if(service==='city-activities')return getActivities(userId,env);
 if(service==='activity')return getActivityFeed(userId,env);
 return null;
}
export async function postLivingCityService(service,body,userId,env,deps){
 await ensureLivingCityTables(env);
 if(service==='law')return lawAction(body,userId,env,deps);
 if(service==='crime-careers')return crimeCareerAction(body,userId,env,deps);
 if(service==='nightclub')return nightclubAction(body,userId,env,deps);
 if(service==='merits')return meritAction(body,userId,env,deps);
 if(service==='property-portfolio')return propertyPortfolioAction(body,userId,env,deps);
 if(service==='faction-shop')return factionShopAction(body,userId,env,deps);
 if(service==='city-activities')return cityActivityAction(body,userId,env,deps);
 if(service==='activity')return activityAction(body,userId,env);
 return null;
}
