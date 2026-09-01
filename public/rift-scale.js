export const RIFT_SCALE_FORMAT = 'rift-scale-v1';
export const RIFT_ASSET_SCALE_FORMAT = 'rift-asset-scale-v1';
export const RIFT_WORLD_UNITS = 'meters';
export const RIFT_METERS_PER_WORLD_UNIT = 1;
export const RIFT_REFERENCE_CHARACTER_HEIGHT_METERS = 1.82;
export const RIFT_REFERENCE_COLLIDER_HEIGHT_METERS = 1.8;
export const RIFT_GLTF_DEFAULT_UNITS = 'meters';

const UNIT_TO_METERS = Object.freeze({
  meters: 1,
  centimeters: 0.01,
  millimeters: 0.001,
  feet: 0.3048,
  inches: 0.0254
});

function finitePositive(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function scaleVector(value, fallback = [1, 1, 1]) {
  const source = Array.isArray(value) && value.length >= 3 ? value : fallback;
  const result = source.slice(0, 3).map(Number);
  if (!result.every(item => Number.isFinite(item) && item > 0)) throw new Error('Asset placement scale must contain three positive finite values.');
  return result;
}

export function validateWorldScaleContract(world) {
  const errors = [];
  const contract = world?.scale;
  const assetPolicy = contract?.assetPolicy;
  if (world?.units !== RIFT_WORLD_UNITS) errors.push(`world.units must be ${RIFT_WORLD_UNITS}`);
  if (contract?.format !== RIFT_SCALE_FORMAT) errors.push(`scale.format must be ${RIFT_SCALE_FORMAT}`);
  if (contract?.worldUnits !== RIFT_WORLD_UNITS) errors.push(`scale.worldUnits must be ${RIFT_WORLD_UNITS}`);
  if (Number(contract?.metersPerWorldUnit) !== RIFT_METERS_PER_WORLD_UNIT) errors.push('scale.metersPerWorldUnit must be 1');
  if (Math.abs(Number(contract?.referenceCharacterHeightMeters) - RIFT_REFERENCE_CHARACTER_HEIGHT_METERS) > 1e-6) errors.push('reference character height must be 1.82m');
  if (Math.abs(Number(contract?.referenceColliderHeightMeters) - RIFT_REFERENCE_COLLIDER_HEIGHT_METERS) > 1e-6) errors.push('reference collider height must be 1.8m');
  if (assetPolicy?.format !== RIFT_ASSET_SCALE_FORMAT) errors.push(`assetPolicy.format must be ${RIFT_ASSET_SCALE_FORMAT}`);
  if (assetPolicy?.gltfDefaultUnits !== RIFT_GLTF_DEFAULT_UNITS) errors.push('glTF assets must default to meter units');
  if (assetPolicy?.preserveAuthoredScale !== true) errors.push('generic assets must preserve authored scale');
  if (assetPolicy?.autoGuessScale !== false) errors.push('asset scale auto-guessing must remain disabled');
  if (assetPolicy?.allowMetadataUnitConversion !== true) errors.push('asset metadata unit conversion must be enabled');
  if (assetPolicy?.allowMetadataCorrectionScale !== true) errors.push('asset metadata correction scale must be enabled');
  try { scaleVector(assetPolicy?.placementScaleDefault); } catch (error) { errors.push(error.message); }
  return { ok: errors.length === 0, errors, contract };
}

export function resolveAssetScale(metadata = {}, placementScale = [1, 1, 1]) {
  const sourceUnits = String(metadata.units || metadata.sourceUnits || RIFT_GLTF_DEFAULT_UNITS).toLowerCase();
  const metersPerSourceUnit = UNIT_TO_METERS[sourceUnits];
  if (!metersPerSourceUnit) throw new Error(`Unsupported asset source units: ${sourceUnits}. Add explicit scale metadata instead of guessing.`);
  const correctionScale = finitePositive(metadata.scaleCorrection ?? metadata.correctionScale, 1);
  const authoredToWorldScale = metersPerSourceUnit / RIFT_METERS_PER_WORLD_UNIT * correctionScale;
  const placement = scaleVector(placementScale);
  return {
    format: RIFT_ASSET_SCALE_FORMAT,
    sourceUnits,
    metersPerSourceUnit,
    correctionScale,
    authoredToWorldScale,
    placementScale: placement,
    finalScale: placement.map(value => value * authoredToWorldScale)
  };
}

export function assetBoundsToWorldMeters(bounds, scaleInfo) {
  if (!bounds?.min || !bounds?.max) return null;
  const finalScale = scaleVector(scaleInfo?.finalScale || [1, 1, 1]);
  const min = bounds.min.slice(0, 3).map(Number);
  const max = bounds.max.slice(0, 3).map(Number);
  if (![...min, ...max].every(Number.isFinite)) return null;
  const size = max.map((value, index) => Math.abs(value - min[index]) * finalScale[index]);
  return { min, max, sizeMeters: size };
}
