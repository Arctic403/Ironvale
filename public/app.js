const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const status = $('#status');
const authGrid = $('#auth-grid');
const playerDashboard = $('#player-dashboard');
const accountName = $('#account-name');
const accountRole = $('#account-role');
const accountDetails = $('#account-details');
const message = $('#message');

let authenticated = false;
let currentView = 'overview';
let worldState = null;
let activeLocationId = null;
let inventoryState = null;
let selectedInventoryItemId = null;
let crimeState = null;
let crimeRequestInFlight = false;
let crimeInlineResult = null;

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  await submitAuth('/api/auth/register', data);
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  await submitAuth('/api/auth/login', data);
});

$('#logout-btn').addEventListener('click', async () => {
  const result = await api('/api/auth/logout', { method: 'POST' });
  if (result.ok) {
    worldState = null;
    inventoryState = null;
    crimeState = null;
    authenticated = false;
    showMessage('Logged out.');
    window.location.hash = '#overview';
    await refreshSession();
  }
});

$$('[data-view-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const view = link.dataset.viewLink;
    if (!authenticated && view !== 'overview') {
      event.preventDefault();
      showMessage('Sign in to enter RiftCity.', true);
      return;
    }
  });
});

window.addEventListener('hashchange', () => {
  const requested = getRequestedView();
  if (!authenticated && requested !== 'overview') {
    window.location.hash = '#overview';
    return;
  }
  switchView(requested);
});

async function submitAuth(path, data) {
  const result = await api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: data.get('username'), password: data.get('password') })
  });

  if (!result.ok) {
    return showMessage(
      result.errorId ? `${result.error || 'Request failed'} — Error ID: ${result.errorId}` : (result.error || 'Request failed'),
      true
    );
  }

  showMessage(path.endsWith('register') ? 'Account created.' : 'Logged in.');
  await refreshSession();
}

async function refreshSession() {
  status.textContent = 'Checking session…';
  const result = await api('/api/auth/me');

  if (!result.ok || !result.authenticated) {
    authenticated = false;
    status.textContent = 'Not signed in.';
    authGrid.classList.remove('hidden');
    playerDashboard.classList.add('hidden');
    switchView('overview');
    return;
  }

  authenticated = true;
  const user = result.user;
  const player = result.player;
  status.textContent = `Connected as ${user.username}. Player state synced with D1.`;
  authGrid.classList.add('hidden');
  playerDashboard.classList.remove('hidden');

  renderAccount(user);
  renderPlayer(player);
  if (result.location) renderCurrentLocation(result.location);

  switchView(getRequestedView());
}

function getRequestedView() {
  const hash = window.location.hash || '#overview';
  if (hash.startsWith('#city/')) return 'location';
  if (hash === '#city') return 'city';
  if (hash === '#inventory') return 'inventory';
  if (hash === '#crimes') return 'crimes';
  return 'overview';
}

function getRequestedLocationId() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#city/')) return null;
  const encoded = hash.slice('#city/'.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

async function switchView(view) {
  currentView = ['overview', 'city', 'location', 'inventory', 'crimes'].includes(view) ? view : 'overview';
  $('#overview-view').classList.toggle('hidden', currentView !== 'overview');
  $('#city-view').classList.toggle('hidden', currentView !== 'city');
  $('#inventory-view').classList.toggle('hidden', currentView !== 'inventory');
  $('#crimes-view').classList.toggle('hidden', currentView !== 'crimes');
  $('#location-view').classList.toggle('hidden', currentView !== 'location');

  $$('[data-view-link]').forEach((link) => {
    const linkView = link.dataset.viewLink;
    const active = linkView === currentView || (linkView === 'city' && currentView === 'location');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if (currentView === 'city') {
    $('#page-eyebrow').textContent = 'WORLD NETWORK';
    $('#page-title-text').textContent = 'City';
    if (authenticated) await loadWorld();
    return;
  }

  if (currentView === 'inventory') {
    $('#page-eyebrow').textContent = 'PLAYER STORAGE';
    $('#page-title-text').textContent = 'Inventory';
    if (authenticated) await loadInventory();
    return;
  }


  if (currentView === 'crimes') {
    $('#page-eyebrow').textContent = 'SERVER ACTIONS';
    $('#page-title-text').textContent = 'Crimes';
    if (authenticated) await loadCrimes();
    return;
  }

  if (currentView === 'location') {
    $('#page-eyebrow').textContent = 'CITY LOCATION';
    $('#page-title-text').textContent = 'Location';
    const locationId = getRequestedLocationId();
    if (!locationId) {
      window.location.hash = '#city';
      return;
    }
    if (authenticated) await renderLocationPage(locationId);
    return;
  }

  $('#page-eyebrow').textContent = 'PLAYER CORE';
  $('#page-title-text').textContent = 'Overview';
}

function renderAccount(user) {
  accountName.textContent = user.username;
  accountRole.textContent = user.role;
  accountDetails.innerHTML = `
    <dt>User ID</dt><dd>${escapeHtml(user.id)}</dd>
    <dt>Role</dt><dd>${escapeHtml(user.role)}</dd>
    <dt>Created</dt><dd>${new Date(user.createdAt).toLocaleString()}</dd>
    <dt>Last active</dt><dd>${new Date(user.lastActiveAt).toLocaleString()}</dd>
    <dt>Session</dt><dd>Online</dd>
  `;
}

function renderPlayer(player) {
  if (!player) return;

  const resources = player.resources || {};
  const progression = player.progression || {};
  const stats = player.stats || {};
  const playerStatus = player.status || {};

  setText('#health-value', resources.health ?? 0);
  setText('#health-max', resources.maxHealth ?? 0);
  setMeter('#health-meter', resources.health, resources.maxHealth);

  setText('#nerve-value', resources.nerve ?? 0);
  setText('#nerve-max', resources.maxNerve ?? 0);
  setMeter('#nerve-meter', resources.nerve, resources.maxNerve);

  setText('#energy-value', resources.energy ?? 0);
  setText('#energy-max', resources.maxEnergy ?? 0);
  setMeter('#energy-meter', resources.energy, resources.maxEnergy);

  setText('#cash-value', formatMoney(resources.cash ?? 0));

  setText('#level-value', progression.level ?? 1);
  setText('#xp-value', progression.xp ?? 0);
  setText('#xp-next', progression.xpToNextLevel ?? 100);
  setMeter('#xp-meter', progression.xp, progression.xpToNextLevel);

  setText('#strength-value', stats.strength ?? 1);
  setText('#defense-value', stats.defense ?? 1);
  setText('#speed-value', stats.speed ?? 1);
  setText('#dexterity-value', stats.dexterity ?? 1);

  const type = String(playerStatus.type || 'active').toUpperCase();
  const badge = $('#player-status-badge');
  badge.textContent = type;
  badge.className = `badge status-${String(playerStatus.type || 'active').toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;

  let detail = 'Player is active in RiftCity.';
  if (playerStatus.type && playerStatus.type !== 'active') {
    detail = playerStatus.reason || `Current status: ${playerStatus.type}.`;
    if (playerStatus.until) detail += ` Until ${new Date(playerStatus.until).toLocaleString()}.`;
  }
  setText('#status-detail', detail);
}


async function loadCrimes(force = false) {
  if (crimeState && !force) {
    renderCrimes();
    return;
  }
  setText('#crime-count', '00');
  $('#crime-list').innerHTML = '<div class="world-loading">Loading crime engine…</div>';
  $('#crime-history').innerHTML = '<div class="world-loading">Loading attempt history…</div>';
  const result = await api('/api/crimes');
  if (!result.ok) {
    $('#crime-list').innerHTML = '<div class="world-loading error-text">Could not load crimes.</div>';
    return showMessage(result.error || 'Could not load crimes.', true);
  }
  crimeState = result;
  if (result.player) renderPlayer(result.player);
  renderCrimes();
}

function renderCrimeInlineResult(crimeId) {
  if (!crimeInlineResult || crimeInlineResult.crimeId !== crimeId) return '';

  const result = crimeInlineResult;
  const tone = result.error ? 'error' : (result.success ? 'success' : 'failure');
  const details = [];

  if (!result.error) {
    if (Number(result.cashDelta)) details.push(`${result.cashDelta > 0 ? '+' : ''}${formatMoney(result.cashDelta)} cash`);
    if (Number(result.xpDelta)) details.push(`+${result.xpDelta} XP`);
    if (Number(result.masteryDelta)) details.push(`+${result.masteryDelta} mastery`);
    if (Number(result.nerveSpent)) details.push(`-${result.nerveSpent} nerve`);
    if (result.itemReward?.name) details.push(`Found ${result.itemReward.name}${Number(result.itemReward.quantity) > 1 ? ` x${result.itemReward.quantity}` : ''}`);
    if (Number(result.levelUps)) details.push(`+${result.levelUps} level${Number(result.levelUps) === 1 ? '' : 's'}`);
  }

  return `
    <div class="crime-inline-result ${tone}" role="status">
      <div class="crime-result-heading">
        <strong>${result.error ? 'ATTEMPT BLOCKED' : (result.success ? 'SUCCESS' : 'FAILED')}</strong>
        ${result.chance != null && !result.error ? `<span>${Math.round((Number(result.chance) || 0) * 100)}% roll</span>` : ''}
      </div>
      <p>${escapeHtml(result.text || 'Crime resolved.')}</p>
      ${details.length ? `<div class="crime-result-details">${details.map(detail => `<span>${escapeHtml(detail)}</span>`).join('')}</div>` : ''}
    </div>
  `;
}

function renderCrimes() {
  if (!crimeState) return;
  const crimes = crimeState.crimes || [];
  const history = crimeState.history || [];
  setText('#crime-count', String(crimes.length).padStart(2, '0'));

  $('#crime-list').innerHTML = crimes.length ? crimes.map(crime => {
    const chance = Math.round((Number(crime.successChance) || 0) * 100);
    const requirement = crime.requiredItem
      ? `<span class="crime-requirement ${crime.requiredItem.owned > 0 ? 'met' : 'missing'}">${escapeHtml(crime.requiredItem.name)} · ${crime.requiredItem.owned > 0 ? 'OWNED' : 'REQUIRED'}</span>`
      : '<span class="crime-requirement met">NO TOOL REQUIRED</span>';
    const lockText = (crime.lockedReasons || []).join(' · ');
    return `
      <article class="crime-card ${crime.available ? '' : 'locked'}" data-crime-id="${escapeHtml(crime.id)}">
        <div class="crime-card-top">
          <div>
            <span class="eyebrow">${escapeHtml(crime.category.toUpperCase())}</span>
            <h3>${escapeHtml(crime.name)}</h3>
          </div>
          <span class="crime-chance">${chance}%</span>
        </div>
        <p>${escapeHtml(crime.description)}</p>
        <div class="crime-metrics">
          <span><small>NERVE</small><strong>${escapeHtml(crime.nerveCost)}</strong></span>
          <span><small>MASTERY</small><strong>${escapeHtml(crime.mastery)}/100</strong></span>
          <span><small>ATTEMPTS</small><strong>${escapeHtml(crime.attempts)}</strong></span>
          <span><small>RECORD</small><strong>${escapeHtml(crime.successes)}W / ${escapeHtml(crime.failures)}L</strong></span>
        </div>
        <div class="crime-card-bottom">
          ${requirement}
          <button class="crime-run-button" data-run-crime="${escapeHtml(crime.id)}" ${crime.available || !(crime.lockedReasons || []).length ? '' : 'disabled'}>
            ${crime.available ? `Attempt · ${escapeHtml(crime.nerveCost)} nerve` : escapeHtml(lockText || 'Unavailable')}
          </button>
        </div>
        ${renderCrimeInlineResult(crime.id)}
      </article>
    `;
  }).join('') : '<div class="world-loading">No crimes installed.</div>';

  $('#crime-history').innerHTML = history.length ? history.map(entry => `
    <article class="crime-history-row ${entry.success ? 'success' : 'failure'}">
      <div>
        <strong>${escapeHtml(entry.crimeName)}</strong>
        <small>${new Date(entry.createdAt).toLocaleString()}</small>
      </div>
      <span>${entry.success ? 'SUCCESS' : 'FAILED'}</span>
      <p>${escapeHtml(entry.text)}</p>
    </article>
  `).join('') : '<div class="world-loading">No crime attempts yet.</div>';

  $$('[data-run-crime]').forEach(button => {
    button.addEventListener('click', () => runCrime(button.dataset.runCrime));
  });
}

async function runCrime(crimeId) {
  if (crimeRequestInFlight) return;
  crimeRequestInFlight = true;
  crimeInlineResult = null;
  const button = $(`[data-run-crime="${cssEscape(crimeId)}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = 'Resolving on server…';
  }

  const result = await api('/api/crimes/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crimeId })
  });
  crimeRequestInFlight = false;

  if (!result.ok) {
    if (result.player) renderPlayer(result.player);
    crimeInlineResult = {
      crimeId,
      success: false,
      error: true,
      text: result.error || 'Crime attempt failed.'
    };
    crimeState = null;
    await loadCrimes(true);
    return;
  }

  if (result.player) renderPlayer(result.player);
  inventoryState = null;
  crimeInlineResult = result.result ? { ...result.result, crimeId } : {
    crimeId,
    success: false,
    error: true,
    text: 'Crime resolved without a result payload.'
  };
  crimeState = null;
  await loadCrimes(true);
}

async function loadInventory(force = false) {
  if (inventoryState && !force) {
    renderInventory();
    return;
  }

  $('#inventory-owned-list').innerHTML = '<div class="world-loading">Loading inventory…</div>';
  $('#inventory-catalog-list').innerHTML = '<div class="world-loading">Loading item registry…</div>';
  const result = await api('/api/inventory');
  if (!result.ok) {
    $('#inventory-owned-list').innerHTML = '<div class="world-loading error-text">Could not load inventory.</div>';
    return showMessage(result.error || 'Could not load inventory.', true);
  }

  inventoryState = result;
  renderInventory();
}

function renderInventory() {
  if (!inventoryState) return;
  const owned = inventoryState.inventory || [];
  const catalog = inventoryState.catalog || [];
  const summary = inventoryState.summary || {};

  setText('#inventory-unique-count', String(summary.uniqueItems || 0).padStart(2, '0'));
  setText('#inventory-total-count', String(summary.totalQuantity || 0).padStart(2, '0'));
  setText('#inventory-registry-count', String(summary.registryItems || catalog.length || 0).padStart(2, '0'));
  setText('#inventory-owned-label', `${summary.uniqueItems || 0} OWNED`);

  $('#inventory-owned-list').innerHTML = owned.length
    ? owned.map(item => renderInventoryRow(item, true)).join('')
    : `<div class="inventory-empty-row">
        <strong>Inventory empty</strong>
        <span>Shops, crimes and rewards will add items here in later phases.</span>
      </div>`;

  $('#inventory-catalog-list').innerHTML = catalog.map(item => {
    const ownedItem = owned.find(entry => entry.id === item.id);
    return renderInventoryRow({ ...item, quantity: ownedItem?.quantity || 0, equipped: ownedItem?.equipped || false, equippedSlot: ownedItem?.equippedSlot || null }, false);
  }).join('');

  $$('.inventory-item-row').forEach(button => {
    button.addEventListener('click', () => selectInventoryItem(button.dataset.itemId));
  });

  if (selectedInventoryItemId && catalog.some(item => item.id === selectedInventoryItemId)) {
    selectInventoryItem(selectedInventoryItemId, false);
  }
}

function renderInventoryRow(item, ownedList) {
  const quantity = Number(item.quantity) || 0;
  const categoryCode = inventoryCategoryCode(item.category);
  const stateLabel = item.equipped ? 'EQUIPPED' : (ownedList ? `x${quantity}` : (quantity > 0 ? `OWNED x${quantity}` : 'REGISTRY'));
  return `
    <button class="inventory-item-row ${item.equipped ? 'equipped' : ''}" data-item-id="${escapeHtml(item.id)}">
      <span class="item-code">${escapeHtml(categoryCode)}</span>
      <span class="item-row-main">
        <strong>${escapeHtml(item.name)}</strong>
        <small>${escapeHtml(item.category)} · ${escapeHtml(item.rarity)}</small>
      </span>
      <span class="item-row-state">${escapeHtml(stateLabel)}</span>
    </button>
  `;
}

function selectInventoryItem(itemId, updateSelection = true) {
  if (!inventoryState) return;
  const catalogItem = (inventoryState.catalog || []).find(item => item.id === itemId);
  if (!catalogItem) return;
  const ownedItem = (inventoryState.inventory || []).find(item => item.id === itemId);
  const item = { ...catalogItem, ...(ownedItem || {}), quantity: ownedItem?.quantity || 0 };
  if (updateSelection) selectedInventoryItemId = itemId;

  $$('.inventory-item-row').forEach(row => row.classList.toggle('selected', row.dataset.itemId === itemId));
  renderInventoryDetail(item);
}

function renderInventoryDetail(item) {
  const detail = $('#inventory-detail');
  if (!detail) return;
  const owned = Number(item.quantity) > 0;
  const effectEntries = Object.entries(item.effects || {}).filter(([, value]) => Number(value));
  const effectMarkup = effectEntries.length
    ? effectEntries.map(([resource, value]) => `<span>${escapeHtml(resource.toUpperCase())} <strong>+${escapeHtml(value)}</strong></span>`).join('')
    : '<span>NO DIRECT EFFECT</span>';
  const tags = (item.tags || []).map(tag => `<span class="world-tag">${escapeHtml(tag)}</span>`).join('');

  let actions = '';
  if (owned && item.usable) actions += `<button class="inventory-action primary" data-item-action="use" data-item-id="${escapeHtml(item.id)}">Use item</button>`;
  if (owned && item.equipable && !item.equipped) actions += `<button class="inventory-action" data-item-action="equip" data-item-id="${escapeHtml(item.id)}">Equip${item.equipmentSlot ? ` · ${escapeHtml(item.equipmentSlot)}` : ''}</button>`;
  if (owned && item.equipable && item.equipped) actions += `<button class="inventory-action" data-item-action="unequip" data-item-id="${escapeHtml(item.id)}">Unequip</button>`;
  if (!owned) actions = '<div class="inventory-not-owned">NOT CURRENTLY OWNED</div>';
  if (owned && !actions) actions = '<div class="inventory-not-owned">NO DIRECT ACTION</div>';

  detail.innerHTML = `
    <div class="item-detail-head">
      <span class="item-code large">${escapeHtml(inventoryCategoryCode(item.category))}</span>
      <div>
        <span class="eyebrow">${escapeHtml(item.category.toUpperCase())} / ${escapeHtml(item.rarity.toUpperCase())}</span>
        <h3>${escapeHtml(item.name)}</h3>
      </div>
    </div>
    <p class="item-detail-description">${escapeHtml(item.description)}</p>
    <div class="world-tags">${tags}</div>
    <dl class="item-spec-grid">
      <dt>Quantity</dt><dd>${owned ? escapeHtml(item.quantity) : '0'}</dd>
      <dt>Value</dt><dd>${formatMoney(item.baseValue || 0)}</dd>
      <dt>Stack</dt><dd>${item.stackable ? `YES / ${escapeHtml(item.maxStack)}` : 'NO'}</dd>
      <dt>Tradeable</dt><dd>${item.tradeable ? 'YES' : 'NO'}</dd>
      <dt>Consumable</dt><dd>${item.consumable ? 'YES' : 'NO'}</dd>
      <dt>Equipment</dt><dd>${item.equipable ? escapeHtml((item.equipmentSlot || 'YES').toUpperCase()) : 'NO'}</dd>
    </dl>
    <div class="item-effects">
      <span class="system-label">EFFECTS</span>
      <div>${effectMarkup}</div>
    </div>
    <div class="inventory-actions">${actions}</div>
  `;

  $$('.inventory-action').forEach(button => {
    button.addEventListener('click', () => runInventoryAction(button.dataset.itemAction, button.dataset.itemId));
  });
}

async function runInventoryAction(action, itemId) {
  const endpoint = action === 'use' ? '/api/inventory/use' : action === 'equip' ? '/api/inventory/equip' : '/api/inventory/unequip';
  const result = await api(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId })
  });

  if (!result.ok) {
    return showMessage(result.errorId ? `${result.error || 'Item action failed'} — ${result.errorId}` : (result.error || 'Item action failed'), true);
  }

  if (result.player) renderPlayer(result.player);
  showMessage(result.message || 'Inventory updated.');
  inventoryState = null;
  selectedInventoryItemId = itemId;
  await loadInventory(true);
}

function inventoryCategoryCode(category) {
  const codes = {
    medical: 'MED', weapon: 'WPN', drink: 'DRK', food: 'FOD',
    valuable: 'VAL', tool: 'TLS', key: 'KEY', ticket: 'TKT'
  };
  return codes[String(category || '').toLowerCase()] || 'ITM';
}

async function loadWorld(force = false) {
  if (worldState && !force) {
    renderWorld();
    return;
  }

  $('#city-directory').innerHTML = '<div class="world-loading">Loading city directory…</div>';
  const result = await api('/api/world');

  if (!result.ok) {
    $('#city-directory').innerHTML = '<div class="world-loading error-text">Could not load RiftCity.</div>';
    return showMessage(result.error || 'Could not load city.', true);
  }

  worldState = result.world;
  renderCurrentLocation(worldState.current);
  renderWorld();
}

function renderWorld() {
  if (!worldState) return;
  const categories = worldState.categories || [];
  const locations = worldState.locations || [];
  setText('#location-count', String(locations.length).padStart(2, '0'));

  $('#city-directory').innerHTML = categories.map((category) => {
    const categoryLocations = locations.filter(location => location.categoryId === category.id);
    if (!categoryLocations.length) return '';
    return `
      <section class="city-category" data-category-id="${escapeHtml(category.id)}">
        <div class="category-heading">
          <div>
            <span class="category-code">${escapeHtml(category.code)}</span>
            <h3>${escapeHtml(category.name)}</h3>
          </div>
          <small>${String(categoryLocations.length).padStart(2, '0')}</small>
        </div>
        <div class="city-location-grid">
          ${categoryLocations.map(location => renderLocationTile(location, worldState.current)).join('')}
        </div>
      </section>
    `;
  }).join('');

  $$('.city-location-tile').forEach((button) => {
    button.addEventListener('click', () => openLocation(button.dataset.locationId));
  });
}

function renderLocationTile(location, current) {
  const currentHere = current?.locationId === location.id;
  return `
    <button class="city-location-tile ${currentHere ? 'current' : ''}" data-location-id="${escapeHtml(location.id)}" aria-label="Open ${escapeHtml(location.name)}">
      <span class="tile-topline">
        <span class="location-code">${escapeHtml(location.code)}</span>
        <span class="tile-state">${currentHere ? 'HERE' : escapeHtml(location.status)}</span>
      </span>
      <strong>${escapeHtml(location.name)}</strong>
      <small class="location-type">${escapeHtml(location.type)}</small>
      <span class="tile-description">${escapeHtml(location.shortDescription)}</span>
    </button>
  `;
}

async function openLocation(locationId) {
  if (!locationId) return;

  const currentHere = worldState?.current?.locationId === locationId;
  if (!currentHere) {
    const tile = $(`.city-location-tile[data-location-id="${cssEscape(locationId)}"]`);
    if (tile) {
      tile.disabled = true;
      tile.classList.add('opening');
    }

    const result = await api('/api/world/travel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId })
    });

    if (!result.ok) {
      if (tile) {
        tile.disabled = false;
        tile.classList.remove('opening');
      }
      return showMessage(result.error || 'Could not open location.', true);
    }

    if (worldState) worldState.current = result.current;
    renderCurrentLocation(result.current);
  }

  activeLocationId = locationId;
  window.location.hash = `#city/${encodeURIComponent(locationId)}`;
}

async function renderLocationPage(locationId) {
  activeLocationId = locationId;
  const container = $('#location-page-content');
  if (!container) return;

  container.innerHTML = '<div class="world-loading">Opening location…</div>';
  const result = await api(`/api/world/locations/${encodeURIComponent(locationId)}`);

  if (!result.ok) {
    container.innerHTML = `
      <div class="location-page-error">
        <span class="eyebrow">LOCATION ERROR</span>
        <h2>Location unavailable</h2>
        <p>${escapeHtml(result.error || 'This location could not be loaded.')}</p>
        <a class="location-back-link" href="#city">← Return to City</a>
      </div>
    `;
    return;
  }

  const location = result.location;
  const category = result.category;

  if (result.current?.locationId !== location.id) {
    const travelResult = await api('/api/world/travel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: location.id })
    });

    if (!travelResult.ok) {
      container.innerHTML = `
        <div class="location-page-error">
          <span class="eyebrow">LOCATION ERROR</span>
          <h2>Could not enter location</h2>
          <p>${escapeHtml(travelResult.error || 'This location could not be opened.')}</p>
          <a class="location-back-link" href="#city">← Return to City</a>
        </div>
      `;
      return;
    }
    result.current = travelResult.current;
  }

  const currentHere = result.current?.locationId === location.id;
  const tags = (location.tags || []).map(tag => `<span class="world-tag">${escapeHtml(tag)}</span>`).join('');
  const requirements = location.requirements?.length
    ? `<div class="location-requirements"><span>REQUIREMENTS</span><strong>${location.requirements.map(escapeHtml).join(' · ')}</strong></div>`
    : '';

  if (result.current) {
    if (worldState) worldState.current = result.current;
    renderCurrentLocation(result.current);
  }

  $('#page-title-text').textContent = location.name;

  container.innerHTML = `
    <div class="location-page-head">
      <a class="location-back-link" href="#city">← City</a>
      <div class="location-page-meta">
        <span class="location-code">${escapeHtml(location.code)}</span>
        <span>${escapeHtml(category?.name || location.categoryId || 'RiftCity')}</span>
        <span>${escapeHtml(location.type)}</span>
      </div>
      <span class="location-status">${currentHere ? 'CURRENT LOCATION' : escapeHtml(location.status)}</span>
    </div>

    <div class="location-page-body">
      <span class="eyebrow">${escapeHtml(location.type)}</span>
      <h2>${escapeHtml(location.name)}</h2>
      <p>${escapeHtml(location.description)}</p>
      <div class="world-tags">${tags}</div>
      ${requirements}

      <div class="location-module-shell">
        <div class="browser-heading">
          <span>AVAILABLE SERVICES</span>
          <small>${String((location.actions || []).length).padStart(2, '0')}</small>
        </div>
        <div class="location-module-list">
          ${(location.actions || []).length ? (location.actions || []).map(action => `
            <button class="location-service-button" data-action-label="${escapeHtml(action.label)}" data-action-note="${escapeHtml(action.note || '')}" ${action.enabled ? '' : 'disabled'}>
              <span>
                <strong>${escapeHtml(action.label)}</strong>
                <small>${escapeHtml(action.note || 'Service available.')}</small>
              </span>
              <b>${action.enabled ? 'OPEN' : 'LOCKED'}</b>
            </button>
          `).join('') : '<div class="world-loading">No services are installed at this location yet.</div>'}
        </div>
      </div>
    </div>
  `;

  $$('.location-service-button:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => {
      showMessage(`${button.dataset.actionLabel}: ${button.dataset.actionNote || location.shortDescription}`);
    });
  });
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/(["\\])/g, '\\$1');
}

function renderCurrentLocation(current) {
  if (!current) return;
  setText('#current-location-name', current.locationName || current.locationId || 'Unknown');
  setText('#current-location-category', current.categoryName || current.districtName || 'RiftCity');
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = String(value);
}

function setMeter(selector, current, maximum) {
  const element = $(selector);
  if (!element) return;
  const max = Number(maximum) || 0;
  const value = Number(current) || 0;
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  element.style.width = `${percent}%`;
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

async function api(path, options = {}) {
  try {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    const data = await response.json().catch(() => ({}));
    return { ...data, ok: response.ok && data.ok !== false };
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
  message.classList.remove('hidden');
  clearTimeout(showMessage.timer);
  showMessage.timer = setTimeout(() => message.classList.add('hidden'), 3200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[ch]);
}

refreshSession();
