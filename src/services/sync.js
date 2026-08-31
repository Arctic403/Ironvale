import { getActiveWorldEvent, getEducationDefinition } from '../plugins/index.js';
import { ensureGameplayTables } from './gameplay.js';
import { getLawState } from './living-city.js';

export const RIFT_SYNC_VERSION = 'rift-sync-v1';
export const RIFT_SYNC_POLL_MS = 120_000;

const first = result => result?.results?.[0] || null;
const number = value => Number(value) || 0;

function batchUsage(results) {
  return (results || []).reduce((usage, result) => {
    usage.batchRowsRead += number(result?.meta?.rows_read);
    usage.batchRowsWritten += number(result?.meta?.rows_written);
    return usage;
  }, { batchQueries: (results || []).length, batchRowsRead: 0, batchRowsWritten: 0 });
}

export async function buildRiftSyncSnapshot(userId, env, deps) {
  await ensureGameplayTables(env);
  const generatedAt = Date.now();
  const playerRow = await deps.ensureActivePlayerState(env, userId);
  const locationRow = await deps.ensurePlayerLocation(env, userId);
  const law = await getLawState(userId, env);

  const results = await env.DB.batch([
    env.DB.prepare('SELECT current_region, traveling_to, arrives_at, updated_at FROM player_travel WHERE user_id=?').bind(userId),
    env.DB.prepare("SELECT course_id, completes_at FROM player_education WHERE user_id=? AND status='studying' AND completes_at>? ORDER BY completes_at ASC LIMIT 6").bind(userId, generatedAt),
    env.DB.prepare('SELECT COUNT(*) AS count, MIN(completes_at) AS next_at FROM production_batches WHERE user_id=? AND claimed=0').bind(userId),
    env.DB.prepare('SELECT frozen_until, protection_until, updated_at FROM player_bank_security WHERE user_id=?').bind(userId),
    env.DB.prepare('SELECT COUNT(*) AS count FROM activity_feed WHERE user_id=? AND read=0').bind(userId),
    env.DB.prepare('SELECT points, lifetime_points, updated_at FROM player_merits WHERE user_id=?').bind(userId)
  ]);

  const travelRow = first(results[0]);
  const educationRows = results[1]?.results || [];
  const productionRow = first(results[2]);
  const bankRow = first(results[3]);
  const activityRow = first(results[4]);
  const meritRow = first(results[5]);
  const player = deps.toPublicPlayerState(playerRow);
  const location = deps.toPublicPlayerLocation(locationRow);
  const frozenUntil = number(bankRow?.frozen_until);
  const travelActive = travelRow?.traveling_to && number(travelRow.arrives_at) > generatedAt;

  return {
    ok: true,
    syncVersion: RIFT_SYNC_VERSION,
    generatedAt,
    pollAfterMs: RIFT_SYNC_POLL_MS,
    player,
    location,
    effects: {
      status: player.status,
      event: getActiveWorldEvent() || null,
      travel: travelActive ? {
        currentRegion: travelRow.current_region || 'riftcity',
        travelingTo: travelRow.traveling_to,
        arrivesAt: number(travelRow.arrives_at),
        updatedAt: number(travelRow.updated_at) || null
      } : null,
      education: educationRows.map(row => {
        const course = getEducationDefinition(row.course_id);
        return { courseId: row.course_id, name: course?.name || row.course_id, completesAt: number(row.completes_at) };
      }),
      production: { activeCount: number(productionRow?.count), nextAt: number(productionRow?.next_at) || null },
      bank: {
        frozen: frozenUntil > generatedAt,
        frozenUntil: frozenUntil > generatedAt ? frozenUntil : null,
        protectionUntil: number(bankRow?.protection_until) || null
      },
      law,
      activity: { unread: number(activityRow?.count) },
      merits: { points: number(meritRow?.points), lifetimePoints: number(meritRow?.lifetime_points), updatedAt: number(meritRow?.updated_at) || null }
    },
    usage: batchUsage(results)
  };
}
