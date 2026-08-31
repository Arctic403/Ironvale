const aliases = Object.freeze({ city: 'world', overview: 'character', quests: 'journal', equipment: 'inventory', wiki: 'codex' });
const routes = new Set(['world', 'character', 'journal', 'inventory', 'codex']);

export function parseRoute() {
  const raw = (location.hash || '#world').slice(1);
  const [path, query = ''] = raw.split('?');
  const requested = decodeURIComponent(path.split('/').filter(Boolean)[0] || 'world');
  const name = aliases[requested] || requested;
  return { name: routes.has(name) ? name : 'world', params: {}, query: new URLSearchParams(query) };
}

export function go(route) {
  const target = String(route || 'world');
  location.hash = target.startsWith('#') ? target : `#${target}`;
}
