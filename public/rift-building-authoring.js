import {
  RIFT_BUILDING_PROGRAM_FORMAT,
  RIFT_BUILDING_PROGRAM_VERSION,
  RIFT_BUILDING_PIPELINE_VERSION,
  compileRiftBuildingProgram,
  compileRiftBuildingProgramJson,
  planRiftBuildingProgram,
  getRiftBuildingRepairManifest,
  diffRiftBuildingPlans,
  getRiftBuildingAffectedStages
} from './rift-building-program.js';
import { RIFT_INTERIOR_ARCHITECTURE_VERSION } from './rift-interior-architecture.js';
import {
  RIFT_WORLD_CHUNK_SIZE,
  createRiftCoordinateFrame,
  describeRiftCoordinate,
  riftWorldToChunk
} from './rift-world-coordinates.js';

const api = Object.freeze({
  version: 'H2.00-dependency-driven-building-compiler',
  format: RIFT_BUILDING_PROGRAM_FORMAT,
  formatVersion: RIFT_BUILDING_PROGRAM_VERSION,
  buildingPipelineVersion: RIFT_BUILDING_PIPELINE_VERSION,
  interiorArchitectureVersion: RIFT_INTERIOR_ARCHITECTURE_VERSION,
  chunkSize: RIFT_WORLD_CHUNK_SIZE,
  plan(program) { return planRiftBuildingProgram(program); },
  compile(program, options = {}) { return compileRiftBuildingProgram(program, options); },
  compileJson(program, options = {}) { return compileRiftBuildingProgramJson(program, options); },
  diagnose(program) { return getRiftBuildingRepairManifest(program); },
  diffPlans(previousPlan, nextPlan) { return diffRiftBuildingPlans(previousPlan, nextPlan); },
  affectedStages(changedPaths = []) { return getRiftBuildingAffectedStages(changedPaths); },
  createCoordinateFrame,
  describeCoordinate: describeRiftCoordinate,
  worldToChunk: riftWorldToChunk
});

Object.defineProperty(window, 'RiftCityBuildingPipeline', { value: api, configurable: true });
window.dispatchEvent(new CustomEvent('riftbuildingpipelineready', { detail: { version: api.version } }));
