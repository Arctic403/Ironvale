export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[ch]);
}

export function money(value) {
  return new Intl.NumberFormat(undefined, { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(Number(value)||0);
}

export function number(value) {
  return new Intl.NumberFormat().format(Number(value)||0);
}

export function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value)||0)); }

export function progress(current, target) {
  const max = Number(target)||0;
  return max > 0 ? clamp((Number(current)||0) / max * 100, 0, 100) : 0;
}

export function duration(ms) {
  const value = Math.max(0, Number(ms)||0);
  if (!value) return 'Ready';
  const total = Math.ceil(value / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function timeUntil(timestamp) {
  if (!timestamp) return 'Ready';
  return duration(Number(timestamp) - Date.now());
}

export function dateTime(timestamp) {
  if (!timestamp) return '—';
  const value = Number(timestamp);
  const date = Number.isFinite(value) ? new Date(value) : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function meter(label, current, max, extra='') {
  const pct = progress(current,max);
  return `<div class="rc-meter-block">
    <div class="rc-meter-label"><span>${escapeHtml(label)}</span><strong>${escapeHtml(current)}${max != null ? ` / ${escapeHtml(max)}` : ''}${extra}</strong></div>
    <div class="rc-meter"><span style="width:${pct}%"></span></div>
  </div>`;
}

export function badge(text, tone='neutral') {
  return `<span class="rc-badge ${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

export function empty(title, text='') {
  return `<div class="rc-empty"><strong>${escapeHtml(title)}</strong>${text?`<span>${escapeHtml(text)}</span>`:''}</div>`;
}

export function panel(title, content, opts={}) {
  return `<section class="rc-panel ${opts.className||''}">
    <header class="rc-panel-head">
      <div>${opts.eyebrow?`<span class="eyebrow">${escapeHtml(opts.eyebrow)}</span>`:''}<h2>${escapeHtml(title)}</h2></div>
      ${opts.aside||''}
    </header>
    ${content}
  </section>`;
}

export function actionButton(label, attrs={}, className='') {
  const dataset = Object.entries(attrs).map(([k,v])=>`data-${k.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}="${escapeHtml(v)}"`).join(' ');
  return `<button class="rc-button ${className}" ${dataset}>${escapeHtml(label)}</button>`;
}

export function jsonData(value) {
  return encodeURIComponent(JSON.stringify(value));
}
export function parseJsonData(value) {
  try { return JSON.parse(decodeURIComponent(value)); } catch { return {}; }
}
