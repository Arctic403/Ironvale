// Rift Native Core Cloudflare bridge v4.
// Wrangler bundles the same C++ WASM binary used by Safari/Chromium. Request and
// storage I/O stay JavaScript; deterministic hot gameplay kernels are shared.
import riftCoreModule from './wasm/rift-core.wasm';

const instance = new WebAssembly.Instance(riftCoreModule, {});
const api = instance.exports;

if (api.rift_core_version?.() !== 4) throw new Error('Ironvale Worker native core version mismatch.');
if (api.rift_section_index?.(15,15,15) !== 4095 || api.rift_floor_div?.(-17,16) !== -2 || (api.rift_section_slot_capacity?.()||0) < 16 || !api.rift_player_step_world || !api.rift_pathfind_world || !api.rift_spatial_query_sphere || !api.rift_combat_resolve) throw new Error('Ironvale Worker native core v4 self-test failed.');

export const RIFT_SERVER_NATIVE_CORE = Object.freeze({
  version: api.rift_core_version(), wasm: true, memoryBytes: api.memory?.buffer?.byteLength || 0,
  sectionSlotCapacity: api.rift_section_slot_capacity(), batchCapacity: api.rift_batch_capacity(),
  sectionIndex: (x,y,z) => api.rift_section_index(x,y,z), floorDiv: (v,d) => api.rift_floor_div(v,d), positiveMod: (v,d) => api.rift_positive_mod(v,d),
  aabbIntersects: (...args) => api.rift_aabb_intersects(...args) === 1, distanceSq3: (...args) => api.rift_distance_sq3(...args), hash3: (x,y,z,seed=0) => api.rift_hash3(x,y,z,seed) >>> 0,
  crossedSupport: (...args) => api.rift_crossed_support(...args) === 1, groundStepCode: (...args) => api.rift_ground_step_classify(...args), stairTop: (...args) => api.rift_stair_top(...args), shapeTop: (...args) => api.rift_shape_top(...args), stateShapeTop: (...args) => api.rift_state_shape_top(...args),
  resolveCombat(options={}) { api.rift_combat_resolve(Math.trunc(options.attackerPower||0),Math.trunc(options.attackerAccuracy||0),Math.trunc(options.defenderArmor||0),Math.trunc(options.defenderEvasion||0),Math.trunc(options.weaponMin||0),Math.trunc(options.weaponMax??options.weaponMin??0),Math.max(0,Math.min(1000,Math.trunc(options.critPermille||0))),Math.trunc(options.seed||0)>>>0); const r=new Int32Array(api.memory.buffer,api.rift_combat_result_ptr()>>>0,6); return { hit:Boolean(r[0]),damage:r[1],critical:Boolean(r[2]),hitRoll:r[3],damageRoll:r[4],seed:r[5]>>>0 }; },
  get metrics() { return Object.freeze({ meshBuilds:api.rift_metric_mesh_builds()>>>0,facesEmitted:api.rift_metric_faces_emitted()>>>0,batchCalls:api.rift_metric_batch_calls()>>>0,batchCells:api.rift_metric_batch_cells()>>>0,raycasts:api.rift_metric_raycasts()>>>0,raycastSteps:api.rift_metric_raycast_steps()>>>0,playerSteps:api.rift_metric_player_steps()>>>0,collisionProbes:api.rift_metric_collision_probes()>>>0,mutations:api.rift_metric_mutations()>>>0,pathfinds:api.rift_metric_pathfinds()>>>0,pathNodes:api.rift_metric_path_nodes()>>>0,spatialQueries:api.rift_metric_spatial_queries()>>>0,agentSteps:api.rift_metric_agent_steps()>>>0,combatResolves:api.rift_metric_combat_resolves()>>>0 }); }
});

globalThis.__RIFT_SERVER_NATIVE_CORE__ = RIFT_SERVER_NATIVE_CORE;
