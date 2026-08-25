// Server-authoritative resource regeneration tuning.
// Values are intentionally data-driven so balance changes do not require engine rewrites.
export const RESOURCE_REGEN = Object.freeze({
  health: Object.freeze({ amount: 5, intervalSeconds: 300 }),
  energy: Object.freeze({ amount: 5, intervalSeconds: 300 }),
  nerve: Object.freeze({ amount: 1, intervalSeconds: 300 })
});

export function getResourceRegen(resource) {
  return RESOURCE_REGEN[resource] || null;
}
