import {
  RIFT_BUILDING_PROGRAM_FORMAT,
  RIFT_BUILDING_PROGRAM_VERSION,
  compileRiftBuildingProgram,
  compileRiftBuildingProgramJson,
  getRiftBuildingRepairManifest
} from './rift-building-program.js';
import {
  RIFT_WORLD_CHUNK_SIZE,
  createRiftCoordinateFrame,
  describeRiftCoordinate,
  riftWorldToChunk
} from './rift-world-coordinates.js';

const api = Object.freeze({
  version: 'H1.85-ai-building-pipeline',
  format: RIFT_BUILDING_PROGRAM_FORMAT,
  formatVersion: RIFT_BUILDING_PROGRAM_VERSION,
  chunkSize: RIFT_WORLD_CHUNK_SIZE,
  compile(program, options = {}) { return compileRiftBuildingProgram(program, options); },
  compileJson(program, options = {}) { return compileRiftBuildingProgramJson(program, options); },
  diagnose(program) { return getRiftBuildingRepairManifest(program); },
  createCoordinateFrame,
  describeCoordinate: describeRiftCoordinate,
  worldToChunk: riftWorldToChunk
});

Object.defineProperty(window, 'RiftCityBuildingPipeline', { value: api, configurable: true });
window.dispatchEvent(new CustomEvent('riftbuildingpipelineready', { detail: { version: api.version } }));
