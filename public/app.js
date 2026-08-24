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
let selectedLocationId = null;

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
  return window.location.hash === '#city' ? 'city' : 'overview';
}

async function switchView(view) {
  currentView = view === 'city' ? 'city' : 'overview';
  $('#overview-view').classList.toggle('hidden', currentView !== 'overview');
  $('#city-view').classList.toggle('hidden', currentView !== 'city');

  $$('[data-view-link]').forEach((link) => {
    const active = link.dataset.viewLink === currentView;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  $('#page-eyebrow').textContent = currentView === 'city' ? 'WORLD NETWORK' : 'PLAYER CORE';
  $('#page-title-text').textContent = currentView === 'city' ? 'City' : 'Overview';

  if (currentView === 'city' && authenticated) await loadWorld();
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

async function loadWorld(force = false) {
  if (worldState && !force) {
    renderWorld();
    return;
  }

  $('#city-directory').innerHTML = '<div class="world-loading">Loading city directory…</div>';
  $('#location-inspector').innerHTML = '<div class="world-loading">Select a location.</div>';
  const result = await api('/api/world');

  if (!result.ok) {
    $('#city-directory').innerHTML = '<div class="world-loading error-text">Could not load RiftCity.</div>';
    return showMessage(result.error || 'Could not load city.', true);
  }

  worldState = result.world;
  selectedLocationId ||= worldState.current?.locationId || worldState.locations?.[0]?.id || null;
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
    button.addEventListener('click', () => inspectLocation(button.dataset.locationId));
  });

  if (selectedLocationId) inspectLocation(selectedLocationId);
}

function renderLocationTile(location, current) {
  const currentHere = current?.locationId === location.id;
  const selected = selectedLocationId === location.id;
  return `
    <button class="city-location-tile ${selected ? 'selected' : ''} ${currentHere ? 'current' : ''}" data-location-id="${escapeHtml(location.id)}">
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

async function inspectLocation(locationId) {
  if (!locationId) return;
  selectedLocationId = locationId;
  $$('.city-location-tile').forEach((button) => {
    button.classList.toggle('selected', button.dataset.locationId === locationId);
  });

  const inspector = $('#location-inspector');
  if (!inspector) return;
  inspector.innerHTML = '<div class="world-loading">Opening location…</div>';

  const result = await api(`/api/world/locations/${encodeURIComponent(locationId)}`);
  if (!result.ok) {
    inspector.innerHTML = '<div class="world-loading error-text">Location unavailable.</div>';
    return;
  }

  const location = result.location;
  const category = result.category;
  const currentHere = result.current?.locationId === location.id;
  const tags = (location.tags || []).map(tag => `<span class="world-tag">${escapeHtml(tag)}</span>`).join('');
  const requirements = location.requirements?.length
    ? `<div class="location-requirements"><span>REQUIREMENTS</span><strong>${location.requirements.map(escapeHtml).join(' · ')}</strong></div>`
    : '';

  inspector.innerHTML = `
    <div class="inspector-head">
      <div>
        <span class="location-code">${escapeHtml(location.code)}</span>
        <span class="inspector-category">${escapeHtml(category?.name || location.categoryId || '')}</span>
      </div>
      <span class="location-status">${currentHere ? 'CURRENT LOCATION' : escapeHtml(location.status)}</span>
    </div>
    <span class="location-kind">${escapeHtml(location.type)}</span>
    <h4>${escapeHtml(location.name)}</h4>
    <p>${escapeHtml(location.description)}</p>
    <div class="world-tags">${tags}</div>
    ${requirements}
    <div class="location-actions">
      <button id="enter-location-btn" ${currentHere ? 'disabled' : ''}>${currentHere ? 'You are here' : 'Open location'}</button>
      ${(location.actions || []).map(action => `
        <button class="secondary location-action" data-action-label="${escapeHtml(action.label)}" data-action-note="${escapeHtml(action.note || '')}" ${action.enabled ? '' : 'disabled'}>
          ${escapeHtml(action.label)}${action.enabled ? '' : ' · LOCKED'}
        </button>
      `).join('')}
    </div>
    ${(location.actions || []).some(action => action.note) ? `
      <div class="future-note">SYSTEM HOOKS READY — gameplay modules can attach here without changing the city directory.</div>
    ` : ''}
  `;

  const enterButton = $('#enter-location-btn');
  if (enterButton && !currentHere) enterButton.addEventListener('click', () => travelTo(location.id));

  $$('.location-action:not([disabled])').forEach((button) => {
    button.addEventListener('click', () => showMessage(`${button.dataset.actionLabel}: ${location.shortDescription}`));
  });
}

async function travelTo(locationId) {
  const button = $('#enter-location-btn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Opening…';
  }

  const result = await api('/api/world/travel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId })
  });

  if (!result.ok) {
    if (button) {
      button.disabled = false;
      button.textContent = 'Open location';
    }
    return showMessage(result.error || 'Could not open location.', true);
  }

  worldState.current = result.current;
  selectedLocationId = result.current.locationId;
  renderCurrentLocation(result.current);
  showMessage(`Opened ${result.current.locationName}.`);
  renderWorld();
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
