// H2.00 authoritative dependency-driven BuildingProgram compiler.
// The former monolithic build implementation has been replaced; all existing
// imports now resolve to the staged plan -> validate -> build -> validate flow.
export {
  RIFT_BUILDING_PROGRAM_FORMAT,
  RIFT_BUILDING_PROGRAM_VERSION,
  RIFT_BUILDING_PIPELINE_VERSION,
  compileRiftBuildingProgram,
  compileRiftBuildingProgramJson,
  planRiftBuildingProgram,
  getRiftBuildingRepairManifest,
  diffRiftBuildingPlans,
  getRiftBuildingAffectedStages
} from './rift-building-compiler.js';
