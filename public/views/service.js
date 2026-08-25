import { getService } from '../ui/api.js';
import { setPageTitle } from '../ui/shell.js';
import { escapeHtml } from '../ui/helpers.js';
import { renderFinanceService } from './services/finance.js';
import { renderProgressionService } from './services/progression.js';
import { renderWorldService } from './services/world.js';
import { renderCombatService } from './services/combat.js';

const FINANCE = new Set(['bank','market','shop','auction','offshore']);
const PROGRESSION = new Set(['gym','jobs','education','properties','factions','missions','achievements','challenges']);
const WORLD = new Set(['travel','production','status','events','casino']);


const STATIC = {
  nightclub:{title:'Afterdark',eyebrow:'NIGHTLIFE',text:'The nightclub shell is restored from the V1 destination model. Reputation, VIP ranks, rotating events and NPC encounters will plug into this page when the server module is enabled.'},
  police:{title:'Rift Central Precinct',eyebrow:'LAW',text:'Police, bounties, warrants, fines and wanted-state tools are reserved for the next law-system backend pass. Current jail and status consequences remain server-authoritative.'},
  park:{title:'RiftCity Park',eyebrow:'PUBLIC SPACE',text:'The park is restored as a destination shell for future encounters, events and location-specific crime opportunities.'},
  downtown:{title:'Downtown',eyebrow:'CITY DISTRICT',text:'Downtown is restored as a district shell for events, shops, encounters and future high-traffic crime opportunities.'}
};

const TITLES = {
  bank:['Rift National Bank','FINANCE'],
  market:['City Market','ECONOMY'],
  shop:['Shops','RETAIL'],
  auction:['Black Market','PLAYER EXCHANGE'],
  offshore:['Offshore Banking','INTERNATIONAL FINANCE'],
  gym:['Forge Athletics','TRAINING'],
  jobs:['Employment Bureau','CAREERS'],
  education:['Rift Metropolitan Institute','EDUCATION'],
  properties:['Keystone Realty','PROPERTY'],
  factions:['Factions','CITY INFLUENCE'],
  missions:['Missions','PROGRESSION'],
  achievements:['Awards','ACHIEVEMENTS'],
  challenges:['Challenges','DAILY / WEEKLY'],
  travel:['Rift International Airport','TRAVEL'],
  production:['Production','WORKSHOPS'],
  status:['Hospital / Jail','PLAYER STATUS'],
  events:['World Events','CITY CONDITIONS'],
  casino:['Meridian Casino','IN-GAME CHIPS'],
  combat:['Combat','BATTLE NETWORK']
};

export async function renderService(root, service, query=new URLSearchParams()) {
  if (STATIC[service]) {
    const entry=STATIC[service];
    setPageTitle(entry.title,entry.eyebrow);
    root.innerHTML=`<section class="service-hero"><div><span class="eyebrow">${escapeHtml(entry.eyebrow)}</span><h2>${escapeHtml(entry.title)}</h2><p>${escapeHtml(entry.text)}</p></div></section><div class="info-banner">This destination exists in the restored frontend but does not fake server outcomes. Its gameplay controls stay locked until the matching backend engine is installed.</div><a class="rc-button" href="#city" data-route="city">Return to City</a>`;
    return;
  }
  const title=TITLES[service]||[service,'RIFTCITY SERVICE'];
  setPageTitle(title[0],title[1]);

  root.innerHTML='<div class="rc-loading"><span></span><strong>Loading service…</strong></div>';
  const params=service==='shop'&&query.get('location')?`?shopId=${encodeURIComponent(shopIdForLocation(query.get('location')))}`:'';
  const data=await getService(service,params);
  if (!data.ok) {
    root.innerHTML=`<div class="rc-error"><strong>${escapeHtml(title[0])} unavailable</strong><p>${escapeHtml(data.error||'Could not load service')}</p><a class="rc-button" href="#city" data-route="city">Return to City</a></div>`;
    return;
  }
  if (FINANCE.has(service)) return renderFinanceService(root,service,data,query);
  if (PROGRESSION.has(service)) return renderProgressionService(root,service,data,query);
  if (WORLD.has(service)) return renderWorldService(root,service,data,query);
  if (service==='combat') return renderCombatService(root,data);
  root.innerHTML=`<div class="rc-empty"><strong>${escapeHtml(title[0])}</strong><span>Frontend module not installed.</span></div>`;
}

function shopIdForLocation(locationId) {
  return ({
    'cornerstone-market':'corner-store',
    'district-supply-co':'hardware',
    'second-chance-exchange':'pawn',
    'northside-pharmacy':'corner-store',
    'ironline-armory':'pawn',
    'aurelia-jewelers':'pawn',
    'circuit-house':'hardware'
  })[locationId]||'';
}
