import { DurableObject } from 'cloudflare:workers';
import {
  ZONE_AUTHORITY_FORMAT,
  ZONE_NEARBY_FORMAT,
  ZONE_PRESENCE_TTL_MS,
  ZONE_DEFAULT_INTEREST_RADIUS_METERS,
  ZONE_MAX_NEARBY,
  distanceSquared2d,
  normalizedInterestRadius,
  zoneIdForPosition
} from './zone-contract.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export class ZoneState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.zoneId = null;
    this.members = new Map();
    this.totalUpserts = 0;
    this.totalLeaves = 0;
    this.totalNearbyReads = 0;
    this.createdAt = Date.now();
  }

  cleanup(now = Date.now()) {
    const cutoff = now - ZONE_PRESENCE_TTL_MS;
    for (const [userId, member] of this.members) {
      if (Number(member?.seenAt || 0) < cutoff) this.members.delete(userId);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/presence') return this.upsertPresence(request);
    if (request.method === 'POST' && url.pathname === '/leave') return this.leave(request);
    if (request.method === 'POST' && url.pathname === '/nearby') return this.nearby(request);
    if (request.method === 'GET' && url.pathname === '/status') return this.status();
    return json({ ok: false, error: 'Not found' }, 404);
  }

  async upsertPresence(request) {
    const body = await readJson(request);
    const userId = String(body?.userId || '');
    const sessionId = String(body?.sessionId || '');
    const x = finite(body?.x);
    const y = finite(body?.y);
    const z = finite(body?.z);
    const yaw = finite(body?.yaw);
    const requestedZoneId = String(body?.zoneId || '');
    if (!userId || !sessionId || [x, y, z, yaw].some(value => value === null)) return json({ ok: false, error: 'Invalid zone presence' }, 400);
    const actualZoneId = zoneIdForPosition(x, z);
    if (!requestedZoneId || requestedZoneId !== actualZoneId) return json({ ok: false, error: 'Zone mismatch', zoneId: actualZoneId }, 409);
    if (this.zoneId && this.zoneId !== requestedZoneId) return json({ ok: false, error: 'Durable Object zone mismatch' }, 409);
    this.zoneId = requestedZoneId;
    const now = Date.now();
    this.cleanup(now);
    this.members.set(userId, {
      userId,
      username: String(body?.username || 'Player').slice(0, 24),
      sessionId,
      x,
      y,
      z,
      yaw,
      seq: Math.max(0, Math.trunc(finite(body?.seq, 0))),
      acceptedAt: Math.max(0, finite(body?.acceptedAt, now)),
      seenAt: now
    });
    this.totalUpserts += 1;
    return json({ ok: true, format: ZONE_AUTHORITY_FORMAT, zoneId: this.zoneId, memberCount: this.members.size, seenAt: now });
  }

  async leave(request) {
    const body = await readJson(request);
    const userId = String(body?.userId || '');
    const sessionId = String(body?.sessionId || '');
    const current = this.members.get(userId);
    if (current && (!sessionId || current.sessionId === sessionId)) {
      this.members.delete(userId);
      this.totalLeaves += 1;
    }
    return json({ ok: true, format: ZONE_AUTHORITY_FORMAT, zoneId: this.zoneId, memberCount: this.members.size });
  }

  async nearby(request) {
    const body = await readJson(request);
    const x = finite(body?.x);
    const z = finite(body?.z);
    if (x === null || z === null) return json({ ok: false, error: 'Invalid interest origin' }, 400);
    const radius = normalizedInterestRadius(body?.radius ?? ZONE_DEFAULT_INTEREST_RADIUS_METERS);
    const limit = Math.max(1, Math.min(ZONE_MAX_NEARBY, Math.trunc(finite(body?.limit, ZONE_MAX_NEARBY))));
    const excludeUserId = String(body?.excludeUserId || '');
    const now = Date.now();
    this.cleanup(now);
    const radiusSq = radius * radius;
    const members = [];
    for (const member of this.members.values()) {
      if (excludeUserId && member.userId === excludeUserId) continue;
      const distanceSq = distanceSquared2d(x, z, member.x, member.z);
      if (distanceSq > radiusSq) continue;
      members.push({
        userId: member.userId,
        username: member.username,
        x: member.x,
        y: member.y,
        z: member.z,
        yaw: member.yaw,
        seq: member.seq,
        distanceMeters: Math.round(Math.sqrt(distanceSq) * 100) / 100,
        snapshotAgeMs: Math.max(0, now - Number(member.seenAt || now))
      });
    }
    members.sort((a, b) => a.distanceMeters - b.distanceMeters);
    this.totalNearbyReads += 1;
    return json({
      ok: true,
      format: ZONE_NEARBY_FORMAT,
      zoneId: this.zoneId,
      radiusMeters: radius,
      memberCount: this.members.size,
      nearby: members.slice(0, limit)
    });
  }

  status() {
    const now = Date.now();
    this.cleanup(now);
    return json({
      ok: true,
      format: ZONE_AUTHORITY_FORMAT,
      zoneId: this.zoneId,
      memberCount: this.members.size,
      createdAt: this.createdAt,
      totalUpserts: this.totalUpserts,
      totalLeaves: this.totalLeaves,
      totalNearbyReads: this.totalNearbyReads,
      presenceTtlMs: ZONE_PRESENCE_TTL_MS,
      storagePolicy: 'ram-only-ephemeral-presence',
      d1Writes: false,
      durableStorageWrites: false
    });
  }
}
