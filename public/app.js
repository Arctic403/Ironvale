const $ = (selector) => document.querySelector(selector);

const status = $('#status');
const authGrid = $('#auth-grid');
const accountCard = $('#account-card');
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

  if (!result.ok) return showMessage(result.errorId ? `${result.error || 'Request failed'} — Error ID: ${result.errorId}` : (result.error || 'Request failed'), true);
  showMessage(path.endsWith('register') ? 'Account created.' : 'Logged in.');
  await refreshSession();
}

async function refreshSession() {
  status.textContent = 'Checking session…';
  const result = await api('/api/auth/me');

  if (!result.ok || !result.authenticated) {
    status.textContent = 'Not signed in.';
    authGrid.classList.remove('hidden');
    accountCard.classList.add('hidden');
    return;
  }

  const user = result.user;
  status.textContent = `Connected as ${user.username}.`;
  authGrid.classList.add('hidden');
  accountCard.classList.remove('hidden');
  accountName.textContent = user.username;
  accountRole.textContent = user.role;
  accountDetails.innerHTML = `
    <dt>User ID</dt><dd>${escapeHtml(user.id)}</dd>
    <dt>Role</dt><dd>${escapeHtml(user.role)}</dd>
    <dt>Created</dt><dd>${new Date(user.createdAt).toLocaleString()}</dd>
    <dt>Last active</dt><dd>${new Date(user.lastActiveAt).toLocaleString()}</dd>
    <dt>Status</dt><dd>Online</dd>
  `;
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
