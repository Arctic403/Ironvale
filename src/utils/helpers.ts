/**
 * Game Utility Functions
 */

export function money(n: number): string {
  return `$${Math.max(0, Math.floor(n)).toLocaleString()}`;
}

export function timeLeft(until: number | null): number {
  return until ? Math.max(0, until - Date.now()) : 0;
}

export function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function randomMarketPrice(current: number): number {
  const volatility = 0.92 + Math.random() * 0.16;
  return Math.max(1, Math.floor(current * volatility));
}
