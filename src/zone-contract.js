export const ZONE_AUTHORITY_FORMAT = 'rift-survival-zone-authority-v1';
export const ZONE_NEARBY_FORMAT = 'rift-survival-zone-nearby-v1';
export const ZONE_WORLD_ID = 'rift-survival-terrain';
export const ZONE_SIZE_METERS = 128;
export const ZONE_PRESENCE_TTL_MS = 45_000;
export const ZONE_MOVEMENT_SYNC_MS = 10_000;
export const ZONE_CLIENT_HEARTBEAT_MS = 15_000;
export const ZONE_DEFAULT_INTEREST_RADIUS_METERS = 96;
export const ZONE_MAX_INTEREST_RADIUS_METERS = 192;
export const ZONE_MAX_NEARBY = 64;
export const ZONE_WORLD_MIN = 0;
export const ZONE_WORLD_MAX = 640;

const ZONE_AXIS_COUNT = Math.ceil((ZONE_WORLD_MAX - ZONE_WORLD_MIN) / ZONE_SIZE_METERS);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clampZoneWorldCoordinate(value) {
  const number = finite(value, ZONE_WORLD_MIN);
  return Math.max(ZONE_WORLD_MIN, Math.min(ZONE_WORLD_MAX - 1e-6, number));
}

export function zoneAxisForCoordinate(value) {
  const clamped = clampZoneWorldCoordinate(value);
  return Math.max(0, Math.min(ZONE_AXIS_COUNT - 1, Math.floor((clamped - ZONE_WORLD_MIN) / ZONE_SIZE_METERS)));
}

export function zoneIdForPosition(x, z) {
  return `${ZONE_WORLD_ID}:${zoneAxisForCoordinate(x)}:${zoneAxisForCoordinate(z)}`;
}

export function zoneBounds(zoneId) {
  const parts = String(zoneId || '').split(':');
  if (parts.length !== 3 || parts[0] !== ZONE_WORLD_ID) return null;
  const zoneX = Number(parts[1]);
  const zoneZ = Number(parts[2]);
  if (!Number.isInteger(zoneX) || !Number.isInteger(zoneZ) || zoneX < 0 || zoneZ < 0 || zoneX >= ZONE_AXIS_COUNT || zoneZ >= ZONE_AXIS_COUNT) return null;
  const minX = ZONE_WORLD_MIN + zoneX * ZONE_SIZE_METERS;
  const minZ = ZONE_WORLD_MIN + zoneZ * ZONE_SIZE_METERS;
  return {
    zoneId,
    zoneX,
    zoneZ,
    minX,
    minZ,
    maxX: Math.min(ZONE_WORLD_MAX, minX + ZONE_SIZE_METERS),
    maxZ: Math.min(ZONE_WORLD_MAX, minZ + ZONE_SIZE_METERS)
  };
}

export function normalizedInterestRadius(value) {
  return Math.max(1, Math.min(ZONE_MAX_INTEREST_RADIUS_METERS, finite(value, ZONE_DEFAULT_INTEREST_RADIUS_METERS)));
}

export function zoneIdsForInterest(x, z, radius = ZONE_DEFAULT_INTEREST_RADIUS_METERS) {
  const r = normalizedInterestRadius(radius);
  const minZoneX = zoneAxisForCoordinate(finite(x) - r);
  const maxZoneX = zoneAxisForCoordinate(finite(x) + r);
  const minZoneZ = zoneAxisForCoordinate(finite(z) - r);
  const maxZoneZ = zoneAxisForCoordinate(finite(z) + r);
  const ids = [];
  for (let zoneZ = minZoneZ; zoneZ <= maxZoneZ; zoneZ += 1) {
    for (let zoneX = minZoneX; zoneX <= maxZoneX; zoneX += 1) ids.push(`${ZONE_WORLD_ID}:${zoneX}:${zoneZ}`);
  }
  return ids;
}

export function distanceSquared2d(ax, az, bx, bz) {
  const dx = finite(ax) - finite(bx);
  const dz = finite(az) - finite(bz);
  return dx * dx + dz * dz;
}
