import { api } from './ui/api.js';
import { state } from './ui/state.js';
import { riftNativeResolveCombat } from './rift-wasm-core.js';

const distanceXZ = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[2] || 0) - (b?.[2] || 0));
const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function objectiveProgress(quest, objective) {
  const key = objective.type + ':' + objective.targetId;
  return Math.min(objective.count, Number(quest?.progress?.[key]) || 0);
}

function makeHumanoid(engine, npc) {
  const color = npc.color || '#6f6a60';
  const parts = [
    engine.addBox({ name: npc.id + '-body', color, dynamic: true, blockGrid: 0, scale: [0.56,0.78,0.38] }),
    engine.addBox({ name: npc.id + '-head', color: '#c99772', dynamic: true, blockGrid: 0, scale: [0.44,0.44,0.44] }),
    engine.addBox({ name: npc.id + '-legs', color: '#302b26', dynamic: true, blockGrid: 0, scale: [0.44,0.72,0.34] }),
    engine.addBox({ name: npc.id + '-quest', color: '#d7ad4b', dynamic: true, blockGrid: 0, scale: [0.18,0.34,0.18] })
  ];
  const [x,y,z] = npc.position;
  engine.setTransform(parts[0], [x,y+1.05,z], 0, parts[0].scale);
  engine.setTransform(parts[1], [x,y+1.68,z], 0, parts[1].scale);
  engine.setTransform(parts[2], [x,y+0.38,z], 0, parts[2].scale);
  engine.setTransform(parts[3], [x,y+2.28,z], 0, parts[3].scale);
  parts[3].visible = false;
  return { npc, parts, marker: parts[3], position: npc.position, destroy: () => engine.removeDrawables(parts) };
}

function makeTrainingDummy(engine, poi) {
  const parts = [
    engine.addBox({ name: 'training-dummy-post', color: '#6a4b2c', dynamic: true, blockGrid: 0, scale: [0.24,1.5,0.24] }),
    engine.addBox({ name: 'training-dummy-cross', color: '#80603b', dynamic: true, blockGrid: 0, scale: [1.15,0.22,0.22] }),
    engine.addBox({ name: 'training-dummy-head', color: '#8b704d', dynamic: true, blockGrid: 0, scale: [0.48,0.48,0.40] })
  ];
  const [x,y,z] = poi.position;
  engine.setTransform(parts[0], [x,y+0.75,z], 0, parts[0].scale);
  engine.setTransform(parts[1], [x,y+1.25,z], 0, parts[1].scale);
  engine.setTransform(parts[2], [x,y+1.67,z], 0, parts[2].scale);
  return { poi, parts, position: poi.position, destroy: () => engine.removeDrawables(parts) };
}

export async function createIronvaleStarterRuntime({ root, shell, engine, player, playerController, getImported }) {
  let destroyed = false;
  let nearest = null;
  let scanClock = 0;
  let panelOpen = null;
  let strikeReadyAt = 0;
  let guardReadyAt = 0;
  let rallyReadyAt = 0;
  let guardUntil = 0;
  const entities = [];

  const ui = document.createElement('div');
  ui.className = 'ironvale-gameplay-ui';
  ui.innerHTML = `
    <section class="iv-player-hud" data-iv-player-hud></section>
    <aside class="iv-quest-tracker" data-iv-quest-tracker></aside>
    <div class="iv-interact-prompt" data-iv-interact hidden><button type="button"><span>E</span><b>INTERACT</b><small data-iv-interact-name></small></button></div>
    <div class="iv-actionbar" data-iv-actionbar>
      <button data-iv-ability="knight-strike"><span>1</span><b>Strike</b><small>Lv 1</small></button>
      <button data-iv-ability="knight-guard"><span>2</span><b>Guard</b><small>Lv 2</small></button>
      <button data-iv-ability="knight-rally"><span>3</span><b>Rally</b><small>Lv 4</small></button>
      <button class="utility" data-iv-panel="character"><span>C</span><b>Character</b></button>
      <button class="utility" data-iv-panel="quests"><span>L</span><b>Quests</b></button>
      <button class="utility" data-iv-panel="bags"><span>B</span><b>Bags</b></button>
    </div>
    <div class="iv-combat-float" data-iv-combat-float></div>
    <div class="iv-game-panel" data-iv-game-panel hidden><section><header><div><span data-iv-panel-eyebrow>IRONVALE</span><strong data-iv-panel-title></strong></div><button data-iv-panel-close type="button">×</button></header><div data-iv-panel-body></div></section></div>
    <div class="iv-character-create" data-iv-character-create hidden>
      <section>
        <span class="eyebrow">IRONVALE · NEW CHARACTER</span>
        <h1>Begin your oath.</h1>
        <p>H3.0 starts deliberately small: one people, one class and one real starting region. More choices come after this slice feels right.</p>
        <div class="iv-choice-grid">
          <article><small>RACE</small><h2>Valeborn</h2><p>Frontier people of the Ironvale Marches. Practical, oath-bound and accustomed to defending isolated roads and settlements.</p><b>Marcher Resolve · Oathbound</b></article>
          <article><small>CLASS</small><h2>Knight</h2><p>Armored melee fighter built around swordwork, shields and disciplined defensive stances.</p><b>Tank · Melee Damage</b></article>
        </div>
        <label>CHARACTER NAME<input data-iv-character-name maxlength="20" autocomplete="off" /></label>
        <button class="primary" data-iv-create-character type="button">ENTER BRACKENFORD</button>
        <small data-iv-create-status></small>
      </section>
    </div>`;
  shell.appendChild(ui);

  const hud = ui.querySelector('[data-iv-player-hud]');
  const tracker = ui.querySelector('[data-iv-quest-tracker]');
  const interactPrompt = ui.querySelector('[data-iv-interact]');
  const interactName = ui.querySelector('[data-iv-interact-name]');
  const panel = ui.querySelector('[data-iv-game-panel]');
  const panelTitle = ui.querySelector('[data-iv-panel-title]');
  const panelEyebrow = ui.querySelector('[data-iv-panel-eyebrow]');
  const panelBody = ui.querySelector('[data-iv-panel-body]');
  const creation = ui.querySelector('[data-iv-character-create]');
  const creationName = ui.querySelector('[data-iv-character-name]');
  const creationStatus = ui.querySelector('[data-iv-create-status]');
  const combatFloat = ui.querySelector('[data-iv-combat-float]');

  const showFloat = (text, tone = '') => {
    combatFloat.textContent = text;
    combatFloat.className = 'iv-combat-float show ' + tone;
    clearTimeout(showFloat.timer);
    showFloat.timer = setTimeout(() => { combatFloat.className = 'iv-combat-float'; }, 900);
  };

  function renderHud() {
    const c = state.character;
    if (!c || state.needsCharacterCreation) { hud.hidden = true; return; }
    hud.hidden = false;
    const identity = state.profile || c.identity || {};
    const r = c.resources || {};
    hud.innerHTML = `<div class="iv-portrait">IV</div><div class="iv-hud-copy"><strong>${escapeHtml(c.name)}</strong><small>Level ${c.level} ${escapeHtml(identity.class?.name || 'Knight')} · ${escapeHtml(identity.race?.name || 'Valeborn')}</small><div class="iv-bar health"><i style="width:${Math.max(0,Math.min(100,(r.health||0)/(r.maxHealth||1)*100))}%"></i><span>${r.health}/${r.maxHealth}</span></div><div class="iv-bar stamina"><i style="width:${Math.max(0,Math.min(100,(r.stamina||0)/(r.maxStamina||1)*100))}%"></i><span>${r.stamina}/${r.maxStamina} stamina</span></div></div>`;
    for (const button of ui.querySelectorAll('[data-iv-ability]')) {
      const ability = state.world?.abilities?.find(item => item.id === button.dataset.ivAbility);
      const locked = !ability || c.level < ability.level;
      button.classList.toggle('locked', locked);
      button.disabled = locked;
      button.title = locked ? 'Unlocks at level ' + (ability?.level || '?') : ability.description;
    }
  }

  function activeQuest() { return state.journal?.quests?.find(quest => quest.status === 'active') || null; }
  function renderTracker() {
    const quest = activeQuest();
    if (!quest || state.needsCharacterCreation) { tracker.hidden = true; updateNpcMarkers(); return; }
    tracker.hidden = false;
    tracker.innerHTML = `<span>THE BROKEN OATH</span><strong>${escapeHtml(quest.name)}</strong>${quest.objectives.map(objective => `<div><i></i><b>${escapeHtml(objective.label)}</b><small>${objectiveProgress(quest,objective)}/${objective.count}</small></div>`).join('')}`;
    updateNpcMarkers();
  }

  function updateNpcMarkers() {
    for (const entity of entities.filter(item => item.npc)) {
      const available = state.journal?.quests?.some(quest => quest.status === 'available' && quest.giverNpcId === entity.npc.id);
      const speakActive = state.journal?.quests?.some(quest => quest.status === 'active' && quest.objectives.some(objective => objective.type === 'speak' && objective.targetId === entity.npc.id));
      entity.marker.visible = !!(available || speakActive) && !state.needsCharacterCreation;
    }
  }

  function applyBootstrap(bootstrap) {
    state.character = bootstrap.character; state.profile = bootstrap.profile; state.needsCharacterCreation = !!bootstrap.needsCharacterCreation;
    state.creationOptions = bootstrap.creationOptions; state.world = bootstrap.world; state.journal = bootstrap.journal; state.inventory = bootstrap.inventory; state.equipment = bootstrap.equipment;
    renderHud(); renderTracker();
  }

  function closePanel() {
    panel.hidden = true; panelOpen = null;
    if (!state.needsCharacterCreation) playerController.setEnabled(true);
  }

  function openPanel(name, extra = null) {
    if (state.needsCharacterCreation) return;
    panelOpen = name; panel.hidden = false; playerController.setEnabled(false);
    if (name === 'character') {
      const c = state.character, a = c?.attributes || {}, r = c?.resources || {}, p = state.profile || {};
      panelEyebrow.textContent = 'CHARACTER'; panelTitle.textContent = c?.name || 'Valeborn Knight';
      panelBody.innerHTML = `<div class="iv-sheet"><div><span>Race</span><b>${escapeHtml(p.race?.name || 'Valeborn')}</b></div><div><span>Class</span><b>${escapeHtml(p.class?.name || 'Knight')}</b></div><div><span>Role</span><b>${escapeHtml((p.class?.roles || ['Tank','Melee Damage']).join(' / '))}</b></div><div><span>Level</span><b>${c?.level || 1}</b></div><div><span>Strength</span><b>${a.strength || 0}</b></div><div><span>Agility</span><b>${a.agility || 0}</b></div><div><span>Vitality</span><b>${a.vitality || 0}</b></div><div><span>Willpower</span><b>${a.willpower || 0}</b></div><div><span>Health</span><b>${r.health}/${r.maxHealth}</b></div><div><span>Stamina</span><b>${r.stamina}/${r.maxStamina}</b></div></div>`;
    } else if (name === 'quests') {
      panelEyebrow.textContent = 'QUEST LOG'; panelTitle.textContent = 'The Broken Oath';
      panelBody.innerHTML = `<div class="iv-quest-log">${(state.journal?.quests || []).filter(q => q.status !== 'locked').map(q => `<article class="${q.status}"><small>${q.status.toUpperCase()} · LEVEL ${q.level}</small><h3>${escapeHtml(q.name)}</h3><p>${escapeHtml(q.summary)}</p>${q.objectives.map(o => `<div>${escapeHtml(o.label)} <b>${objectiveProgress(q,o)}/${o.count}</b></div>`).join('')}</article>`).join('')}</div>`;
    } else if (name === 'bags') {
      panelEyebrow.textContent = 'INVENTORY'; panelTitle.textContent = 'Bags';
      panelBody.innerHTML = `<div class="iv-bag-grid">${(state.inventory?.items || []).map(item => `<article><span>${escapeHtml(item.name.slice(0,2).toUpperCase())}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.type)} · ${item.quantity}×</small><p>${escapeHtml(item.description)}</p></div></article>`).join('')}</div>`;
    } else if (name === 'dialogue') {
      panelEyebrow.textContent = extra?.eyebrow || 'BRACKENFORD'; panelTitle.textContent = extra?.title || 'Conversation';
      panelBody.innerHTML = `<div class="iv-dialogue"><p>${escapeHtml(extra?.text || '')}</p><button data-iv-dialogue-continue type="button">Continue</button></div>`;
      panelBody.querySelector('[data-iv-dialogue-continue]')?.addEventListener('click', closePanel);
    }
  }

  async function progressEvent(type, targetId, amount = 1) {
    const result = await api('/api/ironvale/quests/progress', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ type, targetId, amount }) });
    if (!result.ok) return result;
    if (result.character) state.character = result.character;
    if (result.journal) state.journal = result.journal;
    if (result.completedQuest) showFloat('Quest complete · ' + result.completedQuest.name, 'quest');
    renderHud(); renderTracker();
    return result;
  }

  async function interact() {
    if (!nearest || panelOpen || state.needsCharacterCreation) return;
    if (nearest.npc) {
      const available = state.journal?.quests?.find(quest => quest.status === 'available' && quest.giverNpcId === nearest.npc.id);
      if (available) {
        const accepted = await api('/api/ironvale/quests/accept', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ questId: available.id }) });
        if (accepted.ok) { state.journal = accepted.journal; renderTracker(); openPanel('dialogue', { title: nearest.npc.name, eyebrow: nearest.npc.role, text: available.summary }); }
        return;
      }
      const progressed = await progressEvent('speak', nearest.npc.id, 1);
      const text = progressed?.completedQuest ? 'Good. Remember what was asked of you. The road will test the rest.' : nearest.npc.dialogue;
      openPanel('dialogue', { title: nearest.npc.name, eyebrow: nearest.npc.role, text });
      return;
    }
    if (nearest.poi && nearest.poi.kind === 'quest-object') {
      const result = await progressEvent('inspect', nearest.poi.id, 1);
      showFloat(result?.changed ? 'Objective updated' : 'Nothing new here.', result?.changed ? 'quest' : '');
    }
  }

  async function strike() {
    if (state.needsCharacterCreation || panelOpen || Date.now() < strikeReadyAt) return;
    const ability = state.world?.abilities?.find(item => item.id === 'knight-strike');
    if (!ability || (state.character?.level || 1) < ability.level) return;
    const dummy = entities.find(item => item.poi?.id === 'training-dummy');
    if (!dummy || distanceXZ(player.position, dummy.position) > ability.range) { showFloat('No target in range'); return; }
    strikeReadyAt = Date.now() + ability.cooldownMs;
    const c = state.character, weapon = state.equipment?.mainHand || state.inventory?.items?.find(item => item.id === 'recruit-longsword') || {};
    const roll = riftNativeResolveCombat({ attackerPower: c?.attributes?.strength || 8, attackerAccuracy: 75 + (c?.attributes?.agility || 6) * 2, defenderArmor: 2, defenderEvasion: 0, weaponMin: weapon.weaponMin || 7, weaponMax: weapon.weaponMax || 11, critPermille: 80, seed: (Date.now() ^ ((c?.level || 1) * 2654435761)) >>> 0 });
    showFloat(roll.hit ? (roll.critical ? 'CRIT ' : '') + roll.damage : 'MISS', roll.critical ? 'crit' : '');
    await progressEvent('train', 'training-dummy', 1);
  }

  function guard() {
    const ability = state.world?.abilities?.find(item => item.id === 'knight-guard');
    if (!ability || (state.character?.level || 1) < ability.level || Date.now() < guardReadyAt || panelOpen) return;
    guardReadyAt = Date.now() + ability.cooldownMs; guardUntil = Date.now() + ability.durationMs; showFloat('GUARD', 'guard');
  }

  function rally() {
    const ability = state.world?.abilities?.find(item => item.id === 'knight-rally');
    if (!ability || (state.character?.level || 1) < ability.level || Date.now() < rallyReadyAt || panelOpen) return;
    rallyReadyAt = Date.now() + ability.cooldownMs;
    if (state.character?.resources) state.character.resources.stamina = Math.min(state.character.resources.maxStamina, state.character.resources.stamina + 25);
    renderHud(); showFloat('RALLY +25 STA', 'guard');
  }

  async function createCharacter() {
    const name = String(creationName.value || state.user?.username || '').trim();
    creationStatus.textContent = 'Creating Valeborn Knight…';
    const result = await api('/api/ironvale/character/create', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, raceId:'valeborn', classId:'knight' }) });
    if (!result.ok) { creationStatus.textContent = result.error || 'Could not create character.'; return; }
    applyBootstrap(result.bootstrap);
    creation.hidden = true; document.body.classList.remove('ironvale-character-creation-active');
    player.setVisible(true); playerController.teleport(state.world?.currentZone?.spawn?.position || [20,2,22]); playerController.setEnabled(true);
    showFloat('Welcome to Brackenford', 'quest');
  }

  function mountEntities() {
    for (const entity of entities) entity.destroy?.();
    entities.length = 0;
    for (const npc of state.world?.npcs || []) entities.push(makeHumanoid(engine, npc));
    const dummy = state.world?.pointsOfInterest?.find(item => item.id === 'training-dummy');
    if (dummy) entities.push(makeTrainingDummy(engine, dummy));
    updateNpcMarkers();
  }

  function scanInteractions() {
    nearest = null;
    const candidates = [];
    for (const entity of entities.filter(item => item.npc)) candidates.push({ ...entity, name: entity.npc.name, range: 2.8 });
    for (const poi of state.world?.pointsOfInterest || []) if (poi.kind === 'quest-object') candidates.push({ poi, position: poi.position, name: poi.name, range: poi.interactRange || 2.8 });
    let best = Infinity;
    for (const candidate of candidates) {
      const distance = distanceXZ(player.position, candidate.position);
      if (distance <= candidate.range && distance < best) { nearest = candidate; best = distance; }
    }
    interactPrompt.hidden = !nearest || state.needsCharacterCreation || !!panelOpen;
    if (nearest) interactName.textContent = nearest.name;
  }

  function onKeyDown(event) {
    if (destroyed || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    if (event.code === 'KeyE') { interact(); event.preventDefault(); }
    else if (event.code === 'Digit1') { strike(); event.preventDefault(); }
    else if (event.code === 'Digit2') { guard(); event.preventDefault(); }
    else if (event.code === 'Digit3') { rally(); event.preventDefault(); }
    else if (event.code === 'KeyC') { panelOpen === 'character' ? closePanel() : openPanel('character'); event.preventDefault(); }
    else if (event.code === 'KeyL') { panelOpen === 'quests' ? closePanel() : openPanel('quests'); event.preventDefault(); }
    else if (event.code === 'KeyB') { panelOpen === 'bags' ? closePanel() : openPanel('bags'); event.preventDefault(); }
    else if (event.code === 'Escape' && panelOpen) { closePanel(); }
  }

  ui.querySelector('[data-iv-interact] button')?.addEventListener('click', interact);
  ui.querySelector('[data-iv-ability="knight-strike"]')?.addEventListener('click', strike);
  ui.querySelector('[data-iv-ability="knight-guard"]')?.addEventListener('click', guard);
  ui.querySelector('[data-iv-ability="knight-rally"]')?.addEventListener('click', rally);
  ui.querySelectorAll('[data-iv-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.ivPanel)));
  ui.querySelector('[data-iv-panel-close]')?.addEventListener('click', closePanel);
  ui.querySelector('[data-iv-create-character]')?.addEventListener('click', createCharacter);
  window.addEventListener('keydown', onKeyDown, { capture: true });
  const onStateSync = () => { renderHud(); renderTracker(); };
  window.addEventListener('ironvale:state-sync', onStateSync);

  mountEntities();
  renderHud(); renderTracker();
  if (state.needsCharacterCreation || !state.profile) {
    creation.hidden = false; document.body.classList.add('ironvale-character-creation-active');
    creationName.value = state.user?.username || ''; playerController.setEnabled(false); player.setVisible(false);
  } else {
    creation.hidden = true; player.setVisible(true); playerController.teleport(state.world?.currentZone?.spawn?.position || [20,2,22]);
  }

  const apiHandle = Object.freeze({ openPanel, closePanels: closePanel, interact, strike, get guardActive() { return Date.now() < guardUntil; } });
  window.IronvaleGameplay = apiHandle;

  return {
    update(dt) {
      if (destroyed) return;
      scanClock -= Math.max(0, Number(dt) || 0);
      if (scanClock <= 0) { scanClock = 0.10; scanInteractions(); }
    },
    onWorldChanged(document) {
      const active = document?.id === 'brackenford-lowlands-001';
      for (const entity of entities) for (const drawable of entity.parts || []) drawable.visible = active && (drawable !== entity.marker || drawable.visible);
      if (!active) interactPrompt.hidden = true;
    },
    destroy() {
      if (destroyed) return; destroyed = true;
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('ironvale:state-sync', onStateSync);
      for (const entity of entities) entity.destroy?.();
      clearTimeout(showFloat.timer);
      ui.remove(); document.body.classList.remove('ironvale-character-creation-active');
      if (window.IronvaleGameplay === apiHandle) delete window.IronvaleGameplay;
    }
  };
}
