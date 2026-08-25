import {
  ensureAdvancedTables, getAdvancedService, postAdvancedService,
  getGameplayModifiers, reconcilePropertyBonuses, getBankSecurity, collectPropertyIncome
} from './advanced.js';
import {
  ensureLivingCityTables, getLivingCityService, postLivingCityService,
  getCasinoExperience, playCasinoGame, evaluateBankRisk, maybeTriggerBankRisk, recordActivity,
  canJoinFaction, noteFactionLeave
} from './living-city.js';

import {
  JOB_REGISTRY, JOB_SHIFT_EVENTS, getJobDefinition, getJobPosition,
  EDUCATION_REGISTRY, getEducationDefinition,
  GYM_PROGRAMS, TRAINING_STATS, getGymProgram,
  BANK_INVESTMENT_TIERS, getBankTier, SAVINGS_WITHDRAWAL_FEE_RATE, SAVINGS_WITHDRAWAL_MIN_FEE,
  PROPERTY_REGISTRY, getPropertyDefinition,
  FACTION_REGISTRY, getFactionDefinition, getFactionRank,
  MISSION_REGISTRY, getMissionDefinition,
  MARKET_ASSETS, getMarketAsset, getMarketPrice,
  WORLD_EVENT_REGISTRY, getActiveWorldEvent,
  SHOP_REGISTRY, getShopDefinition,
  CASINO_GAMES, DAILY_CHIP_GRANT,
  getItemDefinition, toPublicItemDefinition
} from '../plugins/index.js';

const SERVICE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS player_bank_accounts (
  user_id TEXT PRIMARY KEY,
  checking INTEGER NOT NULL DEFAULT 0 CHECK(checking>=0),
  savings INTEGER NOT NULL DEFAULT 0 CHECK(savings>=0),
  lifetime_deposits INTEGER NOT NULL DEFAULT 0 CHECK(lifetime_deposits>=0),
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_ledger (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,amount INTEGER NOT NULL,
  fee INTEGER NOT NULL DEFAULT 0,balance_after INTEGER NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_investments (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL,tier_id TEXT NOT NULL,principal INTEGER NOT NULL,
  rate REAL NOT NULL,matures_at INTEGER NOT NULL,claimed INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_jobs (
  user_id TEXT PRIMARY KEY,job_id TEXT,skill_level INTEGER NOT NULL DEFAULT 0,
  skill_xp INTEGER NOT NULL DEFAULT 0,shifts INTEGER NOT NULL DEFAULT 0,last_work_at INTEGER,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_education (
  user_id TEXT NOT NULL,course_id TEXT NOT NULL,status TEXT NOT NULL,
  started_at INTEGER,completes_at INTEGER,completed_at INTEGER,
  PRIMARY KEY(user_id,course_id)
);
CREATE TABLE IF NOT EXISTS player_gym (
  user_id TEXT PRIMARY KEY,gym_exp INTEGER NOT NULL DEFAULT 0,streak INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,last_train_at INTEGER,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_properties (
  user_id TEXT NOT NULL,property_id TEXT NOT NULL,is_home INTEGER NOT NULL DEFAULT 0,
  purchased_at INTEGER NOT NULL,PRIMARY KEY(user_id,property_id)
);
CREATE TABLE IF NOT EXISTS player_factions (
  user_id TEXT PRIMARY KEY,faction_id TEXT,reputation INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,jobs_done INTEGER NOT NULL DEFAULT 0,last_work_at INTEGER,updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_progress_counters (
  user_id TEXT NOT NULL,metric TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,metric)
);
CREATE TABLE IF NOT EXISTS player_missions (
  user_id TEXT NOT NULL,mission_id TEXT NOT NULL,claimed INTEGER NOT NULL DEFAULT 0,claimed_at INTEGER,
  PRIMARY KEY(user_id,mission_id)
);
CREATE TABLE IF NOT EXISTS player_market_positions (
  user_id TEXT NOT NULL,asset_id TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 0,
  average_cost INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,asset_id)
);
CREATE TABLE IF NOT EXISTS auction_listings (
  id TEXT PRIMARY KEY,seller_user_id TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'active',buyer_user_id TEXT,
  created_at INTEGER NOT NULL,completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS player_casino (
  user_id TEXT PRIMARY KEY,chips INTEGER NOT NULL DEFAULT 0,last_daily_grant INTEGER,updated_at INTEGER NOT NULL
);
`;

let ensured = false;

export async function ensureGameplayTables(env) {
  await ensureAdvancedTables(env);
  await ensureLivingCityTables(env);
  if (ensured) return;
  for (const statement of SERVICE_TABLE_SQL.split(';').map(v => v.trim()).filter(Boolean)) {
    await env.DB.prepare(statement).run();
  }
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bank_ledger_user ON bank_ledger(user_id,created_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_investments_user ON player_investments(user_id,matures_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auction_active ON auction_listings(status,created_at)').run();
  ensured = true;
}

export async function handleGameplayApi(request, env, url, requestId, deps) {
  if (!url.pathname.startsWith('/api/services')) return null;
  const auth = await deps.authenticate(request, env);
  if (!auth) return deps.json({ok:false,error:'Authentication required'},401);
  await ensureGameplayTables(env);

  const path = url.pathname.replace(/^\/api\/services\/?/, '');
  if (!path) return deps.json({ok:true,services:serviceCatalog()});

  const [service] = path.split('/');
  if (request.method === 'GET') return getService(service, auth.user.id, env, deps, url);
  if (request.method === 'POST') {
    const body = await deps.readJson(request);
    return postService(service, body || {}, auth.user.id, env, deps, requestId);
  }
  return deps.json({ok:false,error:'Method not allowed'},405);
}

function serviceCatalog() {
  return [
    ['bank','Banking'],['jobs','Employment'],['education','Education'],['gym','Gym'],
    ['properties','Properties'],['factions','Factions'],['missions','Missions'],
    ['market','City Market'],['shop','Shops'],['auction','Black Market Auction'],
    ['status','Jail / Hospital'],['events','World Events'],['casino','Casino'],
    ['combat','Combat'],['travel','Travel'],['offshore','Offshore Banking'],
    ['achievements','Achievements'],['challenges','Challenges'],['production','Production'],
    ['law','Police / Heat'],['crime-careers','Crime Careers'],['nightclub','Nightclub'],['merits','Merits'],
    ['property-portfolio','Rental Portfolio'],['faction-shop','Faction Rewards'],['city-activities','City Activities'],['activity','Activity Feed']
  ].map(([id,name])=>({id,name}));
}

async function getService(service, userId, env, deps, url) {
  switch(service) {
    case 'bank': return deps.json(await getBank(userId,env,deps));
    case 'jobs': return deps.json(await getJobs(userId,env));
    case 'education': return deps.json(await getEducation(userId,env,deps));
    case 'gym': return deps.json(await getGym(userId,env,deps));
    case 'properties': return deps.json(await getProperties(userId,env));
    case 'factions': return deps.json(await getFactions(userId,env));
    case 'missions': return deps.json(await getMissions(userId,env,deps));
    case 'market': return deps.json(await getMarket(userId,env));
    case 'shop': return deps.json(await getShop(userId,env,deps,url.searchParams.get('shopId')));
    case 'auction': return deps.json(await getAuction(userId,env,deps));
    case 'status': return deps.json(await getStatus(userId,env,deps));
    case 'events': return deps.json({ok:true,active:getActiveWorldEvent(),catalog:WORLD_EVENT_REGISTRY});
    case 'casino': return deps.json(await getCasino(userId,env));
    default: {
      const living = await getLivingCityService(service,userId,env,deps,url);
      if (living) return deps.json(living);
      const advanced = await getAdvancedService(service,userId,env,deps,url);
      return advanced ? deps.json(advanced) : deps.json({ok:false,error:'Unknown service'},404);
    }
  }
}

async function postService(service, body, userId, env, deps, requestId) {
  let result;
  switch(service) {
    case 'bank': result=await bankAction(body,userId,env,deps); break;
    case 'jobs': result=await jobAction(body,userId,env,deps); break;
    case 'education': result=await educationAction(body,userId,env,deps); break;
    case 'gym': result=await gymAction(body,userId,env,deps); break;
    case 'properties': result=await propertyAction(body,userId,env,deps); break;
    case 'factions': result=await factionAction(body,userId,env,deps); break;
    case 'missions': result=await missionAction(body,userId,env,deps); break;
    case 'market': result=await marketAction(body,userId,env,deps); break;
    case 'shop': result=await shopAction(body,userId,env,deps); break;
    case 'auction': result=await auctionAction(body,userId,env,deps); break;
    case 'casino': result=await casinoAction(body,userId,env,deps); break;
    default: {
      result=await postLivingCityService(service,body,userId,env,deps);
      if(!result) result=await postAdvancedService(service,body,userId,env,deps,requestId);
      break;
    }
  }
  if (!result) return deps.json({ok:false,error:'Unknown service'},404);
  if (result?.ok) await deps.writeAudit(env,userId,`service.${service}.${String(body.action||'action')}`,userId,{requestId});
  return deps.json(result,result?.status||200);
}

async function getPlayer(userId,env,deps){return deps.ensureActivePlayerState(env,userId);}
function positiveInt(value,max=100000000){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?Math.min(n,max):0;}
function now(){return Date.now();}

// BANKING
async function ensureBank(userId,env){await env.DB.prepare('INSERT OR IGNORE INTO player_bank_accounts(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();}
async function getBank(userId,env,deps){
  await ensureBank(userId,env);
  const account=await env.DB.prepare('SELECT * FROM player_bank_accounts WHERE user_id=?').bind(userId).first();
  const investments=await env.DB.prepare('SELECT * FROM player_investments WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(userId).all();
  const ledger=await env.DB.prepare('SELECT * FROM bank_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 25').bind(userId).all();
  return {ok:true,account,tiers:BANK_INVESTMENT_TIERS,investments:investments.results||[],ledger:ledger.results||[],security:await getBankSecurity(userId,env),risk:await evaluateBankRisk(userId,env)};
}
async function bankAction(body,userId,env,deps){
  await ensureBank(userId,env);
  const action=String(body.action||'');
  const amount=positiveInt(body.amount);
  const player=await getPlayer(userId,env,deps);
  const account=await env.DB.prepare('SELECT * FROM player_bank_accounts WHERE user_id=?').bind(userId).first();
  const t=now();
  const security=await getBankSecurity(userId,env);
  if(security.frozen) return {ok:false,error:'Bank account is temporarily frozen.',status:409,security};
  const riskEvent=await maybeTriggerBankRisk(userId,env);if(riskEvent.triggered)return {ok:false,error:'High Heat triggered a temporary bank security review.',status:409,security:{frozen:true,frozenUntil:riskEvent.until},risk:riskEvent.risk};
  if(action==='deposit'){
    if(!amount) return {ok:false,error:'Enter a valid deposit amount',status:400};
    if(Number(player.cash)<amount) return {ok:false,error:'Not enough cash on hand',status:409};
    await env.DB.batch([
      env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=? AND cash>=?').bind(amount,t,userId,amount),
      env.DB.prepare('UPDATE player_bank_accounts SET checking=checking+?,lifetime_deposits=lifetime_deposits+?,updated_at=? WHERE user_id=?').bind(amount,amount,t,userId),
      env.DB.prepare('INSERT INTO bank_ledger(id,user_id,kind,amount,fee,balance_after,created_at) VALUES(?,?,?,?,0,?,?)').bind(crypto.randomUUID(),userId,'deposit',amount,Number(account.checking)+amount,t)
    ]);
    await incrementProgress(userId,'bank_deposit',amount,env);
    await syncCashMetric(userId,env,deps);
    return {ok:true,message:`Deposited $${amount}.`,bank:(await getBank(userId,env,deps)).account,player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};
  }
  if(action==='withdraw'){
    if(!amount) return {ok:false,error:'Enter a valid withdrawal amount',status:400};
    if(Number(account.checking)<amount) return {ok:false,error:'Not enough checking balance',status:409};
    await env.DB.batch([
      env.DB.prepare('UPDATE player_bank_accounts SET checking=checking-?,updated_at=? WHERE user_id=? AND checking>=?').bind(amount,t,userId,amount),
      env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(amount,t,userId),
      env.DB.prepare('INSERT INTO bank_ledger(id,user_id,kind,amount,fee,balance_after,created_at) VALUES(?,?,?,?,0,?,?)').bind(crypto.randomUUID(),userId,'withdraw',amount,Number(account.checking)-amount,t)
    ]);
    await syncCashMetric(userId,env,deps);
    return {ok:true,message:`Withdrew $${amount}.`,bank:(await getBank(userId,env,deps)).account,player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};
  }
  if(action==='to-savings'){
    if(!amount||Number(account.checking)<amount) return {ok:false,error:'Not enough checking balance',status:409};
    await env.DB.prepare('UPDATE player_bank_accounts SET checking=checking-?,savings=savings+?,updated_at=? WHERE user_id=?').bind(amount,amount,t,userId).run();
    return {ok:true,message:`Moved $${amount} to savings.`,bank:(await getBank(userId,env,deps)).account};
  }
  if(action==='from-savings'){
    if(!amount||Number(account.savings)<amount) return {ok:false,error:'Not enough savings balance',status:409};
    const fee=Math.max(SAVINGS_WITHDRAWAL_MIN_FEE,Math.ceil(amount*SAVINGS_WITHDRAWAL_FEE_RATE));
    const credit=Math.max(0,amount-fee);
    await env.DB.prepare('UPDATE player_bank_accounts SET savings=savings-?,checking=checking+?,updated_at=? WHERE user_id=?').bind(amount,credit,t,userId).run();
    return {ok:true,message:`Moved $${credit} to checking after a $${fee} fee.`,fee,bank:(await getBank(userId,env,deps)).account};
  }
  if(action==='invest'){
    const tier=getBankTier(String(body.tierId||''));
    if(!tier) return {ok:false,error:'Unknown investment tier',status:404};
    if(!amount||amount>tier.cap) return {ok:false,error:`Investment must be between $1 and $${tier.cap}`,status:400};
    if(Number(account.checking)<amount) return {ok:false,error:'Not enough checking balance',status:409};
    if(Number(account.lifetime_deposits)<tier.unlockDeposit) return {ok:false,error:`Unlock requires $${tier.unlockDeposit} lifetime deposits`,status:409};
    const roll=(Math.random()+Math.random()+Math.random())/3;
    const rate=tier.minRate+(tier.maxRate-tier.minRate)*roll;
    const id=crypto.randomUUID(), matures=t+tier.termSeconds*1000;
    await env.DB.batch([
      env.DB.prepare('UPDATE player_bank_accounts SET checking=checking-?,updated_at=? WHERE user_id=?').bind(amount,t,userId),
      env.DB.prepare('INSERT INTO player_investments(id,user_id,tier_id,principal,rate,matures_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,userId,tier.id,amount,rate,matures,t)
    ]);
    return {ok:true,message:`Started ${tier.name}.`,investment:{id,tierId:tier.id,principal:amount,rate,maturesAt:matures}};
  }
  if(action==='claim-investment'){
    const id=String(body.investmentId||'');
    const investment=await env.DB.prepare('SELECT * FROM player_investments WHERE id=? AND user_id=?').bind(id,userId).first();
    if(!investment) return {ok:false,error:'Investment not found',status:404};
    if(investment.claimed) return {ok:false,error:'Investment already claimed',status:409};
    if(Number(investment.matures_at)>t) return {ok:false,error:'Investment has not matured yet',status:409};
    const payout=Math.max(0,Math.round(Number(investment.principal)*(1+Number(investment.rate))));
    await env.DB.batch([
      env.DB.prepare('UPDATE player_investments SET claimed=1 WHERE id=?').bind(id),
      env.DB.prepare('UPDATE player_bank_accounts SET checking=checking+?,updated_at=? WHERE user_id=?').bind(payout,t,userId)
    ]);
    return {ok:true,message:`Investment returned $${payout}.`,payout};
  }
  return {ok:false,error:'Unknown bank action',status:400};
}

// JOBS
async function ensureJob(userId,env){await env.DB.prepare('INSERT OR IGNORE INTO player_jobs(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();}
async function getJobs(userId,env){
 await ensureJob(userId,env); const state=await env.DB.prepare('SELECT * FROM player_jobs WHERE user_id=?').bind(userId).first();
 const job=state.job_id?getJobDefinition(state.job_id):null;
 const history=await env.DB.prepare('SELECT * FROM job_history WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(userId).all();
 return {ok:true,jobs:JOB_REGISTRY,state,position:job?getJobPosition(job,Number(state.skill_level)):null,history:history.results||[]};
}
async function jobAction(body,userId,env,deps){
 await ensureJob(userId,env); const state=await env.DB.prepare('SELECT * FROM player_jobs WHERE user_id=?').bind(userId).first(); const t=now();
 if(body.action==='join'){const job=getJobDefinition(String(body.jobId||''));if(!job)return {ok:false,error:'Unknown job',status:404};await env.DB.prepare('UPDATE player_jobs SET job_id=?,skill_level=0,skill_xp=0,updated_at=? WHERE user_id=?').bind(job.id,t,userId).run();return {ok:true,message:`Joined ${job.company} as ${job.title}.`};}
 if(body.action==='work'){
   const job=getJobDefinition(state.job_id); if(!job)return {ok:false,error:'Join a job first',status:409};
   if(state.last_work_at&&t-Number(state.last_work_at)<60_000)return {ok:false,error:'Your next shift is not ready yet',status:429};
   const player=await getPlayer(userId,env,deps); if(player.status!=='active')return {ok:false,error:`You cannot work while ${player.status}.`,status:409};
   if(Number(player.energy)<job.energyCost)return {ok:false,error:`You need ${job.energyCost} energy.`,status:409};
   const position=getJobPosition(job,Number(state.skill_level)); const modifiers=await getGameplayModifiers(userId,env);
   const totalWeight=JOB_SHIFT_EVENTS.reduce((n,e)=>n+e.weight,0);let roll=Math.random()*totalWeight,event=JOB_SHIFT_EVENTS[0];for(const candidate of JOB_SHIFT_EVENTS){roll-=candidate.weight;if(roll<=0){event=candidate;break;}}
   const pay=Math.max(1,Math.round(position.pay*modifiers.jobPayMultiplier*event.payMultiplier));
   const skillGain=Number(event.skillXp)||1; const nextXp=Number(state.skill_xp)+skillGain; const nextLevel=Math.floor(nextXp/5);
   await env.DB.batch([
     env.DB.prepare('UPDATE player_state SET energy=energy-?,cash=cash+?,updated_at=? WHERE user_id=?').bind(job.energyCost,pay,t,userId),
     env.DB.prepare('UPDATE player_jobs SET skill_xp=?,skill_level=?,shifts=shifts+1,last_work_at=?,updated_at=? WHERE user_id=?').bind(nextXp,nextLevel,t,t,userId),
     env.DB.prepare('INSERT INTO job_history(id,user_id,job_id,event_id,pay,skill_xp,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),userId,job.id,event.id,pay,skillGain,t)
   ]);
   await incrementProgress(userId,'job',1,env); await syncCashMetric(userId,env,deps); await recordActivity(userId,'job',event.name,`${job.company}: +$${pay}, +${skillGain} skill XP.`,'jobs',env);
   return {ok:true,message:`${event.name}. Earned $${pay}.`,pay,skillGain,event,skillLevel:nextLevel,player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};
 }
 return {ok:false,error:'Unknown job action',status:400};
}

// EDUCATION
async function getEducation(userId,env,deps){
 await getGameplayModifiers(userId,env);
 const rows=await env.DB.prepare('SELECT * FROM player_education WHERE user_id=?').bind(userId).all();
 return {ok:true,courses:EDUCATION_REGISTRY,enrollments:rows.results||[],player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};
}
async function educationAction(body,userId,env,deps){
 if(body.action!=='enroll')return {ok:false,error:'Unknown education action',status:400};
 const course=getEducationDefinition(String(body.courseId||'')); if(!course)return {ok:false,error:'Unknown course',status:404};
 const existing=await env.DB.prepare('SELECT * FROM player_education WHERE user_id=? AND course_id=?').bind(userId,course.id).first();
 if(existing)return {ok:false,error:'Course already started or completed',status:409};
 const player=await getPlayer(userId,env,deps); if(Number(player.level)<course.levelRequired)return {ok:false,error:`Requires level ${course.levelRequired}`,status:409};
 if(Number(player.cash)<course.cost)return {ok:false,error:'Not enough cash',status:409};
 const t=now(), completes=t+course.durationSeconds*1000;
 await env.DB.batch([
   env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(course.cost,t,userId),
   env.DB.prepare("INSERT INTO player_education(user_id,course_id,status,started_at,completes_at) VALUES(?,?,'studying',?,?)").bind(userId,course.id,t,completes)
 ]);
 await syncCashMetric(userId,env,deps);
 return {ok:true,message:`Enrolled in ${course.name}.`,completesAt:completes};
}

// GYM
async function ensureGym(userId,env){await env.DB.prepare('INSERT OR IGNORE INTO player_gym(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();}
async function getGym(userId,env,deps){await ensureGym(userId,env);return {ok:true,programs:GYM_PROGRAMS,stats:TRAINING_STATS,state:await env.DB.prepare('SELECT * FROM player_gym WHERE user_id=?').bind(userId).first(),player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};}
async function gymAction(body,userId,env,deps){
 if(body.action!=='train')return {ok:false,error:'Unknown gym action',status:400}; await ensureGym(userId,env);
 const program=getGymProgram(String(body.programId||'balanced')); const stat=String(body.stat||''); if(!program||!TRAINING_STATS.includes(stat))return {ok:false,error:'Invalid training selection',status:400};
 const state=await env.DB.prepare('SELECT * FROM player_gym WHERE user_id=?').bind(userId).first(); if(Number(state.gym_exp)<program.unlockExp)return {ok:false,error:`Program unlocks at ${program.unlockExp} gym XP`,status:409};
 const player=await getPlayer(userId,env,deps); if(player.status!=='active')return {ok:false,error:`You cannot train while ${player.status}.`,status:409}; if(Number(player.energy)<program.energyCost)return {ok:false,error:`You need ${program.energyCost} energy.`,status:409};
 const t=now(); const continued=state.last_train_at&&t-Number(state.last_train_at)<24*60*60*1000; const streak=continued?Math.min(30,Number(state.streak)+1):1;
 const mult=Number(program.multipliers[stat]||1); const modifiers=await getGameplayModifiers(userId,env); const gain=Math.max(1,Math.round(mult*(1+Math.min(10,streak)*.02)*modifiers.gymGainMultiplier));
 await env.DB.batch([
   env.DB.prepare(`UPDATE player_state SET energy=energy-?,${stat}=${stat}+?,updated_at=? WHERE user_id=?`).bind(program.energyCost,gain,t,userId),
   env.DB.prepare('UPDATE player_gym SET gym_exp=gym_exp+?,streak=?,sessions=sessions+1,last_train_at=?,updated_at=? WHERE user_id=?').bind(program.energyCost,streak,t,t,userId)
 ]);
 await incrementProgress(userId,'gym',1,env);
 return {ok:true,message:`Training complete: +${gain} ${stat}.`,gain,stat,streak,player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};
}

// PROPERTIES
async function ensureStarterProperty(userId,env){
 const t=now();
 await env.DB.prepare("INSERT OR IGNORE INTO player_properties(user_id,property_id,is_home,purchased_at) VALUES(?,'shack',1,?)").bind(userId,t).run();
 await setProgressAtLeast(userId,'property_owned',1,env);
}
async function getProperties(userId,env){await ensureStarterProperty(userId,env);const rows=await env.DB.prepare('SELECT * FROM player_properties WHERE user_id=?').bind(userId).all();return {ok:true,properties:PROPERTY_REGISTRY,owned:rows.results||[]};}
async function propertyAction(body,userId,env,deps){
 await ensureStarterProperty(userId,env); const property=getPropertyDefinition(String(body.propertyId||'')); if(!property)return {ok:false,error:'Unknown property',status:404}; const t=now();
 if(body.action==='buy'){const owned=await env.DB.prepare('SELECT 1 FROM player_properties WHERE user_id=? AND property_id=?').bind(userId,property.id).first();if(owned)return {ok:false,error:'Property already owned',status:409};const player=await getPlayer(userId,env,deps);if(Number(player.cash)<property.price)return {ok:false,error:'Not enough cash',status:409};await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(property.price,t,userId),env.DB.prepare('INSERT INTO player_properties(user_id,property_id,is_home,purchased_at) VALUES(?,?,0,?)').bind(userId,property.id,t)]);await incrementProgress(userId,'property_owned',1,env);await syncCashMetric(userId,env,deps);return {ok:true,message:`Purchased ${property.name}.`};}
 if(body.action==='set-home'){const owned=await env.DB.prepare('SELECT 1 FROM player_properties WHERE user_id=? AND property_id=?').bind(userId,property.id).first();if(!owned)return {ok:false,error:'You do not own this property',status:409};await env.DB.batch([env.DB.prepare('UPDATE player_properties SET is_home=0 WHERE user_id=?').bind(userId),env.DB.prepare('UPDATE player_properties SET is_home=1 WHERE user_id=? AND property_id=?').bind(userId,property.id)]);const applied=await reconcilePropertyBonuses(userId,env);return {ok:true,message:`${property.name} is now your home.`,bonuses:property.bonuses,applied};}
 if(body.action==='collect-income') return collectPropertyIncome(userId,property.id,env,deps);
 return {ok:false,error:'Unknown property action',status:400};
}

// FACTIONS
async function ensureFaction(userId,env){await env.DB.prepare('INSERT OR IGNORE INTO player_factions(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();}
async function getFactions(userId,env){await ensureFaction(userId,env);const state=await env.DB.prepare('SELECT * FROM player_factions WHERE user_id=?').bind(userId).first();const faction=state.faction_id?getFactionDefinition(state.faction_id):null;return {ok:true,factions:FACTION_REGISTRY,state,rank:faction?getFactionRank(faction,Number(state.reputation)):null};}
async function factionAction(body,userId,env,deps){
 await ensureFaction(userId,env); const state=await env.DB.prepare('SELECT * FROM player_factions WHERE user_id=?').bind(userId).first(); const t=now();
 if(body.action==='join'){const faction=getFactionDefinition(String(body.factionId||''));if(!faction)return {ok:false,error:'Unknown faction',status:404};const gate=await canJoinFaction(userId,env);if(!gate.ok)return {ok:false,error:`Faction leave cooldown: ${Math.ceil(gate.remainingMs/60000)}m remaining.`,status:409};if(state.faction_id&&state.faction_id!==faction.id)return {ok:false,error:'Leave your current faction before joining another',status:409};await env.DB.prepare('UPDATE player_factions SET faction_id=?,updated_at=? WHERE user_id=?').bind(faction.id,t,userId).run();return {ok:true,message:`Joined ${faction.name}.`};}
 if(body.action==='work'){const faction=getFactionDefinition(state.faction_id);if(!faction)return {ok:false,error:'Join a faction first',status:409};if(state.last_work_at&&t-Number(state.last_work_at)<90_000)return {ok:false,error:'Faction work is cooling down',status:429};const player=await getPlayer(userId,env,deps);if(Number(player.energy)<5)return {ok:false,error:'You need 5 energy',status:409};const cash=150+Math.floor(Number(state.reputation)*.5),rep=10,points=3;await env.DB.batch([env.DB.prepare('UPDATE player_state SET energy=energy-5,cash=cash+?,updated_at=? WHERE user_id=?').bind(cash,t,userId),env.DB.prepare('UPDATE player_factions SET reputation=reputation+?,points=points+?,jobs_done=jobs_done+1,last_work_at=?,updated_at=? WHERE user_id=?').bind(rep,points,t,t,userId)]);await incrementProgress(userId,'faction',rep,env);await syncCashMetric(userId,env,deps);return {ok:true,message:`Faction work complete: +${rep} reputation, +$${cash}.`,reputationGain:rep,cash};}
 if(body.action==='leave'){await env.DB.prepare('UPDATE player_factions SET faction_id=NULL,reputation=0,points=0,updated_at=? WHERE user_id=?').bind(t,userId).run();await noteFactionLeave(userId,env);return {ok:true,message:'Left faction. Rejoining is temporarily locked.'};}
 return {ok:false,error:'Unknown faction action',status:400};
}

// MISSIONS / SHARED PROGRESS
export async function incrementProgress(userId,metric,amount,env){
 const t=now(); const n=Math.max(0,Math.floor(Number(amount)||0)); if(!n)return;
 await env.DB.prepare(`INSERT INTO player_progress_counters(user_id,metric,value,updated_at) VALUES(?,?,?,?)
 ON CONFLICT(user_id,metric) DO UPDATE SET value=value+excluded.value,updated_at=excluded.updated_at`).bind(userId,metric,n,t).run();
}
export async function setProgressAtLeast(userId,metric,value,env){
 const t=now(),n=Math.max(0,Math.floor(Number(value)||0));
 await env.DB.prepare(`INSERT INTO player_progress_counters(user_id,metric,value,updated_at) VALUES(?,?,?,?)
 ON CONFLICT(user_id,metric) DO UPDATE SET value=MAX(value,excluded.value),updated_at=excluded.updated_at`).bind(userId,metric,n,t).run();
}
async function syncCashMetric(userId,env,deps){const p=await getPlayer(userId,env,deps);await setProgressAtLeast(userId,'cash',Number(p.cash),env);}
async function getMissions(userId,env,deps){
 await syncCashMetric(userId,env,deps);
 const counters=await env.DB.prepare('SELECT metric,value FROM player_progress_counters WHERE user_id=?').bind(userId).all();
 const claimed=await env.DB.prepare('SELECT mission_id,claimed,claimed_at FROM player_missions WHERE user_id=?').bind(userId).all();
 const map=Object.fromEntries((counters.results||[]).map(r=>[r.metric,Number(r.value)])); const claimedMap=new Map((claimed.results||[]).map(r=>[r.mission_id,r]));
 const missions=MISSION_REGISTRY.map(m=>{const progress=map[m.metric]||0;const prereqOk=!m.prerequisite||claimedMap.get(m.prerequisite)?.claimed===1;const row=claimedMap.get(m.id);return {...m,progress,complete:progress>=m.target&&prereqOk,claimed:row?.claimed===1,prerequisiteMet:prereqOk};});
 return {ok:true,counters:map,missions};
}
async function missionAction(body,userId,env,deps){
 if(body.action!=='claim')return {ok:false,error:'Unknown mission action',status:400}; const mission=getMissionDefinition(String(body.missionId||'')); if(!mission)return {ok:false,error:'Unknown mission',status:404};
 const state=await getMissions(userId,env,deps); const publicMission=state.missions.find(m=>m.id===mission.id); if(!publicMission.complete)return {ok:false,error:'Mission is not complete',status:409}; if(publicMission.claimed)return {ok:false,error:'Mission already claimed',status:409};
 const player=await getPlayer(userId,env,deps); const level=deps.applyXpAndLevels(Number(player.level),Number(player.xp),mission.reward.xp); const t=now();
 await env.DB.batch([env.DB.prepare('INSERT OR REPLACE INTO player_missions(user_id,mission_id,claimed,claimed_at) VALUES(?,?,1,?)').bind(userId,mission.id,t),env.DB.prepare('UPDATE player_state SET cash=cash+?,level=?,xp=?,updated_at=? WHERE user_id=?').bind(mission.reward.cash,level.level,level.xp,t,userId)]);
 await syncCashMetric(userId,env,deps); return {ok:true,message:`Claimed ${mission.name}.`,reward:mission.reward,player:deps.toPublicPlayerState(await getPlayer(userId,env,deps))};
}

// FICTIONAL CITY MARKET
async function getMarket(userId,env){const rows=await env.DB.prepare('SELECT * FROM player_market_positions WHERE user_id=?').bind(userId).all();const modifiers=await getGameplayModifiers(userId,env);return {ok:true,assets:MARKET_ASSETS.map(asset=>({...asset,price:getMarketPrice(asset,Date.now(),modifiers.marketVolatilityMultiplier)})),positions:rows.results||[],modifiers:{marketVolatilityMultiplier:modifiers.marketVolatilityMultiplier,event:modifiers.event}};}
async function marketAction(body,userId,env,deps){
 const asset=getMarketAsset(String(body.assetId||'')); if(!asset)return {ok:false,error:'Unknown market asset',status:404}; const qty=positiveInt(body.quantity,10000);if(!qty)return {ok:false,error:'Enter a valid quantity',status:400};const modifiers=await getGameplayModifiers(userId,env);const price=getMarketPrice(asset,Date.now(),modifiers.marketVolatilityMultiplier),total=price*qty,t=now();
 const position=await env.DB.prepare('SELECT * FROM player_market_positions WHERE user_id=? AND asset_id=?').bind(userId,asset.id).first(); const player=await getPlayer(userId,env,deps);
 if(body.action==='buy'){if(Number(player.cash)<total)return {ok:false,error:'Not enough cash',status:409};const oldQty=Number(position?.quantity)||0,oldCost=Number(position?.average_cost)||0,newQty=oldQty+qty,newAvg=Math.round(((oldQty*oldCost)+total)/newQty);await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(total,t,userId),env.DB.prepare(`INSERT INTO player_market_positions(user_id,asset_id,quantity,average_cost,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,asset_id) DO UPDATE SET quantity=excluded.quantity,average_cost=excluded.average_cost,updated_at=excluded.updated_at`).bind(userId,asset.id,newQty,newAvg,t)]);await incrementProgress(userId,'market_trade',1,env);await syncCashMetric(userId,env,deps);return {ok:true,message:`Bought ${qty} ${asset.symbol} at $${price}.`,price,total};}
 if(body.action==='sell'){if((Number(position?.quantity)||0)<qty)return {ok:false,error:'Not enough units to sell',status:409};const remaining=Number(position.quantity)-qty;await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(total,t,userId),env.DB.prepare('UPDATE player_market_positions SET quantity=?,updated_at=? WHERE user_id=? AND asset_id=?').bind(remaining,t,userId,asset.id)]);await incrementProgress(userId,'market_trade',1,env);await syncCashMetric(userId,env,deps);return {ok:true,message:`Sold ${qty} ${asset.symbol} at $${price}.`,price,total};}
 return {ok:false,error:'Unknown market action',status:400};
}

// SHOPS
async function getShop(userId,env,deps,shopId){const shops=SHOP_REGISTRY.map(shop=>({...shop,items:shop.items.map(id=>{const item=getItemDefinition(id);return item?{...toPublicItemDefinition(item),price:Math.max(1,Math.ceil(item.baseValue*shop.markup)),buyback:Math.max(0,Math.floor(item.baseValue*shop.buyback))}:null}).filter(Boolean)}));return {ok:true,shops,selected:shopId?shops.find(s=>s.id===shopId)||null:null};}
async function shopAction(body,userId,env,deps){
 const shop=getShopDefinition(String(body.shopId||'')),item=getItemDefinition(String(body.itemId||'')),qty=positiveInt(body.quantity||1,50);if(!shop||!item||!shop.items.includes(item.id))return {ok:false,error:'Item is not sold by this shop',status:404};const t=now();
 if(body.action==='buy'){const unit=Math.max(1,Math.ceil(item.baseValue*shop.markup)),total=unit*qty,player=await getPlayer(userId,env,deps);if(Number(player.cash)<total)return {ok:false,error:'Not enough cash',status:409};await env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(total,t,userId).run();const added=await deps.addItemToInventory(env,userId,item.id,qty);if(added.added<=0){await env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(total,t,userId).run();return {ok:false,error:'Inventory stack is full',status:409};}if(added.added<qty){const refund=unit*(qty-added.added);await env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(refund,t,userId).run();}await syncCashMetric(userId,env,deps);return {ok:true,message:`Bought ${added.added} ${item.name}.`,quantity:added.added};}
 if(body.action==='sell'){if(!item.tradeable)return {ok:false,error:'Item is not tradeable',status:409};const removed=await deps.removeItemFromInventory(env,userId,item.id,qty);if(removed.removed<=0)return {ok:false,error:'You do not own this item',status:409};const unit=Math.max(0,Math.floor(item.baseValue*shop.buyback)),total=unit*removed.removed;await env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(total,t,userId).run();await syncCashMetric(userId,env,deps);return {ok:true,message:`Sold ${removed.removed} ${item.name} for $${total}.`,total};}
 return {ok:false,error:'Unknown shop action',status:400};
}

// PLAYER AUCTION / BLACK MARKET
async function getAuction(userId,env,deps){const rows=await env.DB.prepare("SELECT * FROM auction_listings WHERE status='active' ORDER BY created_at DESC LIMIT 100").all();return {ok:true,listings:(rows.results||[]).map(r=>({...r,item:toPublicItemDefinition(getItemDefinition(r.item_id))})),mine:(rows.results||[]).filter(r=>r.seller_user_id===userId)};}
async function auctionAction(body,userId,env,deps){
 const t=now();
 if(body.action==='list'){const item=getItemDefinition(String(body.itemId||'')),qty=positiveInt(body.quantity,50),price=positiveInt(body.unitPrice,10000000);if(!item||!item.tradeable)return {ok:false,error:'Item cannot be listed',status:409};if(!qty||!price)return {ok:false,error:'Invalid quantity or price',status:400};const removed=await deps.removeItemFromInventory(env,userId,item.id,qty);if(removed.removed!==qty){if(removed.removed)await deps.addItemToInventory(env,userId,item.id,removed.removed);return {ok:false,error:'Not enough quantity to list',status:409};}const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO auction_listings(id,seller_user_id,item_id,quantity,unit_price,status,created_at) VALUES(?,?,?,?,?,'active',?)").bind(id,userId,item.id,qty,price,t).run();return {ok:true,message:'Listing created.',listingId:id};}
 if(body.action==='cancel'){const id=String(body.listingId||'');const listing=await env.DB.prepare("SELECT * FROM auction_listings WHERE id=? AND seller_user_id=? AND status='active'").bind(id,userId).first();if(!listing)return {ok:false,error:'Active listing not found',status:404};await env.DB.prepare("UPDATE auction_listings SET status='cancelled',completed_at=? WHERE id=? AND status='active'").bind(t,id).run();await deps.addItemToInventory(env,userId,listing.item_id,Number(listing.quantity));return {ok:true,message:'Listing cancelled and item returned.'};}
 if(body.action==='buy'){const id=String(body.listingId||'');const listing=await env.DB.prepare("SELECT * FROM auction_listings WHERE id=? AND status='active'").bind(id).first();if(!listing)return {ok:false,error:'Listing is no longer available',status:404};if(listing.seller_user_id===userId)return {ok:false,error:'You cannot buy your own listing',status:409};const total=Number(listing.quantity)*Number(listing.unit_price),player=await getPlayer(userId,env,deps);if(Number(player.cash)<total)return {ok:false,error:'Not enough cash',status:409};
   // Reserve the listing first so duplicate buys cannot both complete.
   const reserved=await env.DB.prepare("UPDATE auction_listings SET status='sold',buyer_user_id=?,completed_at=? WHERE id=? AND status='active'").bind(userId,t,id).run();
   if(!reserved.meta?.changes)return {ok:false,error:'Listing was purchased by someone else',status:409};
   const add=await deps.addItemToInventory(env,userId,listing.item_id,Number(listing.quantity)); if(add.added!==Number(listing.quantity)){await env.DB.prepare("UPDATE auction_listings SET status='active',buyer_user_id=NULL,completed_at=NULL WHERE id=? AND buyer_user_id=?").bind(id,userId).run();if(add.added)await deps.removeItemFromInventory(env,userId,listing.item_id,add.added);return {ok:false,error:'Your inventory cannot hold this listing',status:409};}
   await env.DB.batch([env.DB.prepare('UPDATE player_state SET cash=cash-?,updated_at=? WHERE user_id=?').bind(total,t,userId),env.DB.prepare('UPDATE player_state SET cash=cash+?,updated_at=? WHERE user_id=?').bind(total,t,listing.seller_user_id)]);
   await syncCashMetric(userId,env,deps);return {ok:true,message:`Purchased listing for $${total}.`,total};
 }
 return {ok:false,error:'Unknown auction action',status:400};
}

// STATUS
async function getStatus(userId,env,deps){const player=await getPlayer(userId,env,deps);const remaining=player.status_until?Math.max(0,Number(player.status_until)-now()):0;return {ok:true,status:{type:player.status,reason:player.status_reason,until:player.status_until,remainingMs:remaining},player:deps.toPublicPlayerState(player)};}

// CASINO FOUNDATION
async function ensureCasino(userId,env){await env.DB.prepare('INSERT OR IGNORE INTO player_casino(user_id,updated_at) VALUES(?,?)').bind(userId,now()).run();}
async function getCasino(userId,env){await ensureCasino(userId,env);const state=await env.DB.prepare('SELECT * FROM player_casino WHERE user_id=?').bind(userId).first();const experience=await getCasinoExperience(userId,env);return {ok:true,realMoney:false,games:CASINO_GAMES,dailyChipGrant:DAILY_CHIP_GRANT,state,...experience};}
async function casinoAction(body,userId,env,deps){
 await ensureCasino(userId,env);
 if(body.action==='play') return playCasinoGame(body,userId,env,deps);
 if(body.action!=='claim-daily')return {ok:false,error:'Unknown casino action',status:400};
 const state=await env.DB.prepare('SELECT * FROM player_casino WHERE user_id=?').bind(userId).first();const t=now(),day=Math.floor(t/86400000),last=state.last_daily_grant?Math.floor(Number(state.last_daily_grant)/86400000):-1;if(day===last)return {ok:false,error:'Daily chips already claimed',status:409};await env.DB.prepare('UPDATE player_casino SET chips=chips+?,last_daily_grant=?,updated_at=? WHERE user_id=?').bind(DAILY_CHIP_GRANT,t,t,userId).run();await incrementProgress(userId,'casino',1,env);await recordActivity(userId,'casino','Daily chips',`Claimed ${DAILY_CHIP_GRANT} in-game chips.`,'casino',env);return {ok:true,message:`Claimed ${DAILY_CHIP_GRANT} in-game chips.`,chips:Number(state.chips)+DAILY_CHIP_GRANT};
}

export { getGameplayModifiers, reconcilePropertyBonuses };
