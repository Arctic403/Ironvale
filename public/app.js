const $ = (selector) => document.querySelector(selector);

const status = $('#status');
const authGrid = $('#auth-grid');
const playerDashboard = $('#player-dashboard');
const accountName = $('#account-name');
const accountRole = $('#account-role');
const accountDetails = $('#account-details');
const message = $('#message');

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
    showMessage('Logged out.');
    await refreshSession();
  }
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
    status.textContent = 'Not signed in.';
    authGrid.classList.remove('hidden');
    playerDashboard.classList.add('hidden');
    return;
  }

  const user = result.user;
  const player = result.player;
  status.textContent = `Connected as ${user.username}. Player state synced with D1.`;
  authGrid.classList.add('hidden');
  playerDashboard.classList.remove('hidden');

  renderAccount(user);
  renderPlayer(player);
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
