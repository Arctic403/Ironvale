export const WORLD3D_CONFIG = Object.freeze({
  chunkSize: 84,
  activeChunkRadius: 1,
  worldSize: 620
});

export const WORLD3D_DISTRICTS = Object.freeze([
  { id: 'downtown', name: 'Downtown Core', x: 0, z: 0 },
  { id: 'northside', name: 'Northside', x: 0, z: -210 },
  { id: 'harbor', name: 'Harbour & Coast', x: -210, z: 210 },
  { id: 'industrial', name: 'Industrial East', x: 210, z: 210 },
  { id: 'westend', name: 'West End', x: 210, z: -210 }
]);

const DISTRICT_LOCATION_IDS = Object.freeze({
  downtown: new Set([
    'rift-national-bank','rift-civic-hall','courthouse','company-plaza','downtown-core',
    'meridian-casino','the-exchange','rift-mall','aurelia-jewelers'
  ]),
  northside: new Set([
    'mercy-point-medical','blackridge-detention','rift-metropolitan-institute','forge-athletics',
    'rift-employment-bureau','rift-central-precinct','northside-pharmacy','cornerstone-market','riftcity-park'
  ]),
  harbor: new Set([
    'greywater-docks','breakwater-beach','afterdark','central-transit','rift-international-airport'
  ]),
  industrial: new Set([
    'warehouse-district','redline-garage','blacktop-motors','ironline-armory',
    'district-supply-co','circuit-house','safehouse'
  ]),
  westend: new Set([
    'keystone-realty','second-chance-exchange','saint-vesper-cemetery'
  ])
});

const FALLBACK_DISTRICT_BY_CATEGORY = Object.freeze({
  services: 'downtown',
  shops: 'westend',
  entertainment: 'downtown',
  transport: 'harbor',
  other: 'industrial'
});

const LOCAL_PADS = Object.freeze([
  [-42,-42],[-14,-42],[14,-42],[42,-42],
  [-42,-14],[-14,-14],[14,-14],[42,-14],
  [-42,14],[-14,14],[14,14],[42,14],
  [-42,42],[-14,42],[14,42],[42,42]
]);

export function buildWorldLayout(locations = [], locationOverrides = {}) {
  const grouped = new Map(WORLD3D_DISTRICTS.map(d => [d.id, []]));

  for (const location of [...locations].sort((a,b) => String(a.id).localeCompare(String(b.id)))) {
    const districtId = resolveDistrict(location);
    grouped.get(districtId)?.push(location);
  }

  const output = [];
  for (const district of WORLD3D_DISTRICTS) {
    const rows = grouped.get(district.id) || [];
    rows.forEach((location, index) => {
      const pad = LOCAL_PADS[index % LOCAL_PADS.length];
      const ring = Math.floor(index / LOCAL_PADS.length);
      const generatedX = district.x + pad[0] + ring * 18;
      const generatedZ = district.z + pad[1] + ring * 18;
      const override = locationOverrides?.[location.id] || {};
      const x = Number.isFinite(Number(override.x)) ? Number(override.x) : generatedX;
      const z = Number.isFinite(Number(override.z)) ? Number(override.z) : generatedZ;
      output.push({
        ...location,
        districtId: district.id,
        districtName: district.name,
        baseX: generatedX,
        baseZ: generatedZ,
        x,
        z,
        chunkKey: getChunkKey(x, z)
      });
    });
  }
  return output;
}

export function getChunkKey(x, z) {
  const size = WORLD3D_CONFIG.chunkSize;
  return `${Math.floor(x / size)}:${Math.floor(z / size)}`;
}

export function getNearbyChunkKeys(x, z, radius = WORLD3D_CONFIG.activeChunkRadius) {
  const size = WORLD3D_CONFIG.chunkSize;
  const cx = Math.floor(x / size);
  const cz = Math.floor(z / size);
  const keys = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) keys.push(`${cx + dx}:${cz + dz}`);
  }
  return keys;
}

export function getDistrictById(id) {
  return WORLD3D_DISTRICTS.find(d => d.id === id) || WORLD3D_DISTRICTS[0];
}

function resolveDistrict(location) {
  for (const [districtId, ids] of Object.entries(DISTRICT_LOCATION_IDS)) {
    if (ids.has(location.id)) return districtId;
  }
  return FALLBACK_DISTRICT_BY_CATEGORY[location.categoryId] || 'downtown';
}
