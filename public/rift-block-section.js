import { RIFT_BLOCK_FACE_DEFS } from './rift-block-world.js';
import { buildRiftPartialShapeGeometry, riftBlockStateHasPartialShape } from './rift-block-shapes.js';

export const RIFT_SECTION_SIZE = 16;
export const RIFT_SECTION_VOLUME = RIFT_SECTION_SIZE ** 3;
export const RIFT_SECTION_AIR = 0;
export const RIFT_SECTION_SOLID = 1;

export function riftSectionIndex(x, y, z) {
  x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
  if (x < 0 || x >= RIFT_SECTION_SIZE || y < 0 || y >= RIFT_SECTION_SIZE || z < 0 || z >= RIFT_SECTION_SIZE) {
    return -1;
  }
  return (y << 8) | (z << 4) | x;
}

const RIFT_SECTION_VERTEX_STRIDE = 9;

function normalizeFaceColor(color) {
  if (!Array.isArray(color) && !(color instanceof Float32Array)) return [1, 1, 1];
  return [
    Math.max(0, Math.min(1, Number(color[0]) || 0)),
    Math.max(0, Math.min(1, Number(color[1]) || 0)),
    Math.max(0, Math.min(1, Number(color[2]) || 0))
  ];
}

function appendSectionFace(buffer, worldX, worldY, worldZ, face, color = [1, 1, 1]) {
  const base = buffer.vertices.length / RIFT_SECTION_VERTEX_STRIDE;
  const faceColor = normalizeFaceColor(color);
  for (const corner of face.corners) {
    buffer.vertices.push(
      worldX + corner[0],
      worldY + corner[1],
      worldZ + corner[2],
      face.n[0],
      face.n[1],
      face.n[2],
      faceColor[0],
      faceColor[1],
      faceColor[2]
    );
  }
  buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function sectionVisibilityLayerBuffer(layerBuffers, key) {
  const layerKey = String(key || 'base');
  let buffer = layerBuffers.get(layerKey);
  if (!buffer) {
    buffer = { vertices: [], indices: [], faces: 0 };
    layerBuffers.set(layerKey, buffer);
  }
  return buffer;
}

function finalizeSectionVisibilityLayers(layerBuffers) {
  if (!(layerBuffers instanceof Map) || layerBuffers.size === 0) return [];
  return [...layerBuffers.entries()].map(([key, buffer]) => {
    const vertexCount = buffer.vertices.length / RIFT_SECTION_VERTEX_STRIDE;
    const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
    return {
      key,
      geometry: {
        vertices: new Float32Array(buffer.vertices),
        vertexStride: RIFT_SECTION_VERTEX_STRIDE,
        indices: new IndexArray(buffer.indices),
        visibleFaces: buffer.faces,
        quads: buffer.faces,
        vertexCount,
        triangles: buffer.faces * 2
      }
    };
  }).filter(layer => layer.geometry.indices.length > 0);
}

export class RiftBlockSection {
  constructor({ sx = 0, sy = 0, sz = 0, states = null } = {}) {
    this.sx = Math.trunc(sx);
    this.sy = Math.trunc(sy);
    this.sz = Math.trunc(sz);
    this.states = new Uint16Array(RIFT_SECTION_VOLUME);
    if (states != null) {
      const source = states instanceof Uint16Array ? states : Uint16Array.from(states);
      if (source.length !== RIFT_SECTION_VOLUME) {
        throw new Error(`RiftBlockSection requires exactly ${RIFT_SECTION_VOLUME} block states.`);
      }
      this.states.set(source);
    }
    this.revision = 0;
    this.meshRevision = -1;
    this.dirty = true;
  }

  origin() {
    return {
      x: this.sx * RIFT_SECTION_SIZE,
      y: this.sy * RIFT_SECTION_SIZE,
      z: this.sz * RIFT_SECTION_SIZE
    };
  }

  inBounds(x, y, z) {
    return riftSectionIndex(x, y, z) >= 0;
  }

  getBlock(x, y, z) {
    const index = riftSectionIndex(x, y, z);
    return index < 0 ? RIFT_SECTION_AIR : this.states[index];
  }

  setBlock(x, y, z, state = RIFT_SECTION_SOLID) {
    const index = riftSectionIndex(x, y, z);
    if (index < 0) return false;
    state = Math.max(0, Math.min(65535, Math.trunc(Number(state) || 0)));
    if (this.states[index] === state) return false;
    this.states[index] = state;
    this.revision += 1;
    this.dirty = true;
    return true;
  }

  eraseBlock(x, y, z) {
    return this.setBlock(x, y, z, RIFT_SECTION_AIR);
  }

  markDirty() {
    const changed = !this.dirty;
    this.dirty = true;
    return changed;
  }

  clear() {
    let changed = false;
    for (let i = 0; i < this.states.length; i += 1) {
      if (this.states[i] !== RIFT_SECTION_AIR) {
        changed = true;
        break;
      }
    }
    if (!changed) return false;
    this.states.fill(RIFT_SECTION_AIR);
    this.revision += 1;
    this.dirty = true;
    return true;
  }

  fillBox(x0, y0, z0, x1, y1, z1, state = RIFT_SECTION_SOLID) {
    const minX = Math.max(0, Math.min(RIFT_SECTION_SIZE - 1, Math.trunc(Math.min(x0, x1))));
    const maxX = Math.max(0, Math.min(RIFT_SECTION_SIZE - 1, Math.trunc(Math.max(x0, x1))));
    const minY = Math.max(0, Math.min(RIFT_SECTION_SIZE - 1, Math.trunc(Math.min(y0, y1))));
    const maxY = Math.max(0, Math.min(RIFT_SECTION_SIZE - 1, Math.trunc(Math.max(y0, y1))));
    const minZ = Math.max(0, Math.min(RIFT_SECTION_SIZE - 1, Math.trunc(Math.min(z0, z1))));
    const maxZ = Math.max(0, Math.min(RIFT_SECTION_SIZE - 1, Math.trunc(Math.max(z0, z1))));
    state = Math.max(0, Math.min(65535, Math.trunc(Number(state) || 0)));
    let changed = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const index = riftSectionIndex(x, y, z);
          if (this.states[index] === state) continue;
          this.states[index] = state;
          changed += 1;
        }
      }
    }
    if (changed > 0) {
      this.revision += 1;
      this.dirty = true;
    }
    return changed;
  }

  countSolid() {
    let count = 0;
    for (let i = 0; i < this.states.length; i += 1) {
      if (this.states[i] !== RIFT_SECTION_AIR) count += 1;
    }
    return count;
  }

  buildGeometry({ getOutsideBlock = null, getBlockColor = null, classifyBlockFace = null } = {}) {
    const origin = this.origin();

    // H1.56 shape-aware path. Legacy material-only states still use the proven
    // full-block fast path below, so the street renderer keeps its exact face
    // counts/performance until a section actually contains a slab or stair.
    let containsPartialShape = false;
    for (let i = 0; i < this.states.length; i += 1) {
      if (riftBlockStateHasPartialShape(this.states[i])) {
        containsPartialShape = true;
        break;
      }
    }

    if (containsPartialShape) {
      const cells = [];
      for (let y = 0; y < RIFT_SECTION_SIZE; y += 1) {
        for (let z = 0; z < RIFT_SECTION_SIZE; z += 1) {
          for (let x = 0; x < RIFT_SECTION_SIZE; x += 1) {
            const state = this.getBlock(x, y, z);
            if (state === RIFT_SECTION_AIR) continue;
            cells.push({ x: origin.x + x, y: origin.y + y, z: origin.z + z, state });
          }
        }
      }

      const geometry = buildRiftPartialShapeGeometry({
        cells,
        getStateAt: (worldX, worldY, worldZ) => {
          const localX = worldX - origin.x;
          const localY = worldY - origin.y;
          const localZ = worldZ - origin.z;
          if (this.inBounds(localX, localY, localZ)) return this.getBlock(localX, localY, localZ);
          return typeof getOutsideBlock === 'function'
            ? Math.trunc(Number(getOutsideBlock(worldX, worldY, worldZ)) || 0)
            : RIFT_SECTION_AIR;
        },
        getBlockColor: info => typeof getBlockColor === 'function'
          ? getBlockColor({
              ...info,
              localX: info.worldX - origin.x,
              localY: info.worldY - origin.y,
              localZ: info.worldZ - origin.z,
              section: this
            })
          : [1, 1, 1],
        classifyFace: typeof classifyBlockFace === 'function'
          ? info => classifyBlockFace({
              ...info,
              localX: info.worldX - origin.x,
              localY: info.worldY - origin.y,
              localZ: info.worldZ - origin.z,
              section: this
            })
          : null
      });

      this.meshRevision = this.revision;
      this.dirty = false;
      return {
        ...geometry,
        section: [this.sx, this.sy, this.sz],
        revision: this.revision,
        stateBytes: this.states.byteLength,
        shapeAware: true,
        visibleSurfaceTiles: geometry.visibleMicroFaces,
        culledSurfaceTiles: geometry.culledMicroFaces
      };
    }

    const buffer = { vertices: [], indices: [] };
    const layerBuffers = typeof classifyBlockFace === 'function' ? new Map() : null;
    let blocks = 0;
    let visibleFaces = 0;
    let culledFaces = 0;

    for (let y = 0; y < RIFT_SECTION_SIZE; y += 1) {
      for (let z = 0; z < RIFT_SECTION_SIZE; z += 1) {
        for (let x = 0; x < RIFT_SECTION_SIZE; x += 1) {
          const state = this.getBlock(x, y, z);
          if (state === RIFT_SECTION_AIR) continue;
          blocks += 1;

          for (const face of RIFT_BLOCK_FACE_DEFS) {
            const nx = x + face.d[0];
            const ny = y + face.d[1];
            const nz = z + face.d[2];
            let neighbor = RIFT_SECTION_AIR;

            if (this.inBounds(nx, ny, nz)) {
              neighbor = this.getBlock(nx, ny, nz);
            } else if (typeof getOutsideBlock === 'function') {
              neighbor = Math.trunc(Number(getOutsideBlock(
                origin.x + nx,
                origin.y + ny,
                origin.z + nz,
                face
              )) || 0);
            }

            if (neighbor !== RIFT_SECTION_AIR) {
              culledFaces += 1;
              continue;
            }

            const worldX = origin.x + x;
            const worldY = origin.y + y;
            const worldZ = origin.z + z;
            const color = typeof getBlockColor === 'function'
              ? getBlockColor({
                  state,
                  face,
                  worldX,
                  worldY,
                  worldZ,
                  localX: x,
                  localY: y,
                  localZ: z,
                  section: this
                })
              : [1, 1, 1];

            appendSectionFace(
              buffer,
              worldX,
              worldY,
              worldZ,
              face,
              color
            );
            if (layerBuffers) {
              const layerKey = classifyBlockFace({
                state,
                shape: 0,
                rotation: 0,
                face,
                worldX,
                worldY,
                worldZ,
                localX: x,
                localY: y,
                localZ: z,
                section: this
              }) || 'base';
              const layerBuffer = sectionVisibilityLayerBuffer(layerBuffers, layerKey);
              appendSectionFace(layerBuffer, worldX, worldY, worldZ, face, color);
              layerBuffer.faces += 1;
            }
            visibleFaces += 1;
          }
        }
      }
    }

    const vertexCount = visibleFaces * 4;
    const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
    this.meshRevision = this.revision;
    this.dirty = false;

    return {
      vertices: new Float32Array(buffer.vertices),
      vertexStride: RIFT_SECTION_VERTEX_STRIDE,
      indices: new IndexArray(buffer.indices),
      section: [this.sx, this.sy, this.sz],
      blocks,
      visibleFaces,
      culledFaces,
      theoreticalFaces: blocks * 6,
      vertexCount,
      triangles: visibleFaces * 2,
      revision: this.revision,
      stateBytes: this.states.byteLength,
      visibilityLayers: finalizeSectionVisibilityLayers(layerBuffers)
    };
  }
}


const RIFT_SECTION_NEIGHBOR_OFFSETS = Object.freeze([
  Object.freeze([1, 0, 0]),
  Object.freeze([-1, 0, 0]),
  Object.freeze([0, 1, 0]),
  Object.freeze([0, -1, 0]),
  Object.freeze([0, 0, 1]),
  Object.freeze([0, 0, -1])
]);

export function riftSectionKey(sx = 0, sy = 0, sz = 0) {
  return `${Math.trunc(sx)},${Math.trunc(sy)},${Math.trunc(sz)}`;
}

export function riftWorldCellToSection(value = 0) {
  const cell = Math.trunc(Number(value) || 0);
  const section = Math.floor(cell / RIFT_SECTION_SIZE);
  return {
    section,
    local: cell - section * RIFT_SECTION_SIZE
  };
}

export class RiftSectionGrid {
  constructor(sections = []) {
    this.sections = new Map();
    for (const section of sections || []) this.addSection(section);
  }

  get size() {
    return this.sections.size;
  }

  addSection(section) {
    if (!(section instanceof RiftBlockSection)) throw new Error('RiftSectionGrid accepts RiftBlockSection instances only.');
    const key = riftSectionKey(section.sx, section.sy, section.sz);
    this.sections.set(key, section);
    section.markDirty();
    for (const neighbor of this.getAdjacentSections(section)) neighbor.markDirty();
    return section;
  }

  removeSection(sx, sy, sz) {
    const key = riftSectionKey(sx, sy, sz);
    const section = this.sections.get(key) || null;
    if (!section) return null;
    this.sections.delete(key);
    for (const [dx, dy, dz] of RIFT_SECTION_NEIGHBOR_OFFSETS) {
      this.getSection(section.sx + dx, section.sy + dy, section.sz + dz)?.markDirty();
    }
    return section;
  }

  getSection(sx, sy, sz) {
    return this.sections.get(riftSectionKey(sx, sy, sz)) || null;
  }

  getAdjacentSections(section) {
    if (!(section instanceof RiftBlockSection)) return [];
    const neighbors = [];
    for (const [dx, dy, dz] of RIFT_SECTION_NEIGHBOR_OFFSETS) {
      const neighbor = this.getSection(section.sx + dx, section.sy + dy, section.sz + dz);
      if (neighbor) neighbors.push(neighbor);
    }
    return neighbors;
  }

  locateWorldCell(worldX, worldY, worldZ) {
    const x = riftWorldCellToSection(worldX);
    const y = riftWorldCellToSection(worldY);
    const z = riftWorldCellToSection(worldZ);
    return {
      section: this.getSection(x.section, y.section, z.section),
      sx: x.section,
      sy: y.section,
      sz: z.section,
      x: x.local,
      y: y.local,
      z: z.local
    };
  }

  getBlockWorld(worldX, worldY, worldZ) {
    const location = this.locateWorldCell(worldX, worldY, worldZ);
    return location.section?.getBlock(location.x, location.y, location.z) ?? RIFT_SECTION_AIR;
  }

  setBlockWorld(worldX, worldY, worldZ, state = RIFT_SECTION_SOLID) {
    const location = this.locateWorldCell(worldX, worldY, worldZ);
    if (!location.section) {
      return { changed: false, section: null, dirtiedNeighbors: [], location };
    }

    const changed = location.section.setBlock(location.x, location.y, location.z, state);
    const dirtiedNeighbors = [];
    if (!changed) return { changed, section: location.section, dirtiedNeighbors, location };

    const boundaryNeighbors = [];
    if (location.x === 0) boundaryNeighbors.push([-1, 0, 0]);
    if (location.x === RIFT_SECTION_SIZE - 1) boundaryNeighbors.push([1, 0, 0]);
    if (location.y === 0) boundaryNeighbors.push([0, -1, 0]);
    if (location.y === RIFT_SECTION_SIZE - 1) boundaryNeighbors.push([0, 1, 0]);
    if (location.z === 0) boundaryNeighbors.push([0, 0, -1]);
    if (location.z === RIFT_SECTION_SIZE - 1) boundaryNeighbors.push([0, 0, 1]);

    for (const [dx, dy, dz] of boundaryNeighbors) {
      const neighbor = this.getSection(location.sx + dx, location.sy + dy, location.sz + dz);
      if (!neighbor) continue;
      neighbor.markDirty();
      dirtiedNeighbors.push(neighbor);
    }

    return { changed, section: location.section, dirtiedNeighbors, location };
  }

  eraseBlockWorld(worldX, worldY, worldZ) {
    return this.setBlockWorld(worldX, worldY, worldZ, RIFT_SECTION_AIR);
  }

  buildGeometryForSection(section, { getBlockColor = null, classifyBlockFace = null } = {}) {
    if (!(section instanceof RiftBlockSection)) throw new Error('Expected a RiftBlockSection.');
    return section.buildGeometry({
      getOutsideBlock: (worldX, worldY, worldZ) => this.getBlockWorld(worldX, worldY, worldZ),
      getBlockColor,
      classifyBlockFace
    });
  }
}

export function countRiftSectionSharedFacePairs(sectionA, sectionB) {
  if (!(sectionA instanceof RiftBlockSection) || !(sectionB instanceof RiftBlockSection)) {
    throw new Error('Expected two RiftBlockSection instances.');
  }

  const dx = sectionB.sx - sectionA.sx;
  const dy = sectionB.sy - sectionA.sy;
  const dz = sectionB.sz - sectionA.sz;
  if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) return 0;

  let pairs = 0;
  if (dx !== 0) {
    const ax = dx > 0 ? RIFT_SECTION_SIZE - 1 : 0;
    const bx = dx > 0 ? 0 : RIFT_SECTION_SIZE - 1;
    for (let y = 0; y < RIFT_SECTION_SIZE; y += 1) {
      for (let z = 0; z < RIFT_SECTION_SIZE; z += 1) {
        if (sectionA.getBlock(ax, y, z) !== RIFT_SECTION_AIR && sectionB.getBlock(bx, y, z) !== RIFT_SECTION_AIR) pairs += 1;
      }
    }
  } else if (dy !== 0) {
    const ay = dy > 0 ? RIFT_SECTION_SIZE - 1 : 0;
    const by = dy > 0 ? 0 : RIFT_SECTION_SIZE - 1;
    for (let x = 0; x < RIFT_SECTION_SIZE; x += 1) {
      for (let z = 0; z < RIFT_SECTION_SIZE; z += 1) {
        if (sectionA.getBlock(x, ay, z) !== RIFT_SECTION_AIR && sectionB.getBlock(x, by, z) !== RIFT_SECTION_AIR) pairs += 1;
      }
    }
  } else {
    const az = dz > 0 ? RIFT_SECTION_SIZE - 1 : 0;
    const bz = dz > 0 ? 0 : RIFT_SECTION_SIZE - 1;
    for (let x = 0; x < RIFT_SECTION_SIZE; x += 1) {
      for (let y = 0; y < RIFT_SECTION_SIZE; y += 1) {
        if (sectionA.getBlock(x, y, az) !== RIFT_SECTION_AIR && sectionB.getBlock(x, y, bz) !== RIFT_SECTION_AIR) pairs += 1;
      }
    }
  }
  return pairs;
}

export function createRiftCrossSectionDiagnosticPattern(sectionA, sectionB) {
  if (!(sectionA instanceof RiftBlockSection) || !(sectionB instanceof RiftBlockSection)) {
    throw new Error('Expected two RiftBlockSection instances.');
  }
  if (sectionB.sx !== sectionA.sx + 1 || sectionB.sy !== sectionA.sy || sectionB.sz !== sectionA.sz) {
    throw new Error('H1.52 diagnostic requires section B directly east of section A.');
  }

  sectionA.clear();
  sectionB.clear();

  // The H1.51 8x8 floor is split exactly across the X section boundary.
  sectionA.fillBox(12, 0, 4, 15, 0, 11, RIFT_SECTION_SOLID);
  sectionB.fillBox(0, 0, 4, 3, 0, 11, RIFT_SECTION_SOLID);

  // The 4x4x4 tower is also split across the boundary. Together, both
  // independently stored sections reconstruct the same continuous shape.
  sectionA.fillBox(14, 1, 6, 15, 4, 9, RIFT_SECTION_SOLID);
  sectionB.fillBox(0, 1, 6, 1, 4, 9, RIFT_SECTION_SOLID);
  return [sectionA, sectionB];
}

export function validateRiftSectionGrid() {
  const failures = [];
  const grid = new RiftSectionGrid();
  const left = grid.addSection(new RiftBlockSection({ sx: 0, sy: 0, sz: 0 }));
  const right = grid.addSection(new RiftBlockSection({ sx: 1, sy: 0, sz: 0 }));

  grid.buildGeometryForSection(left);
  grid.buildGeometryForSection(right);
  if (left.dirty || right.dirty) failures.push('initial grid mesh clean-up failed');

  const boundaryEdit = grid.setBlockWorld(15, 1, 1, 7);
  if (!boundaryEdit.changed || !left.dirty || !right.dirty || boundaryEdit.dirtiedNeighbors.length !== 1) {
    failures.push('boundary edit did not dirty both touching sections');
  }
  if (grid.getBlockWorld(15, 1, 1) !== 7) failures.push('world-space left-section read failed');

  grid.buildGeometryForSection(left);
  grid.buildGeometryForSection(right);
  const interiorEdit = grid.setBlockWorld(14, 1, 1, 3);
  if (!interiorEdit.changed || !left.dirty || right.dirty) failures.push('interior edit dirtied the wrong section set');

  grid.buildGeometryForSection(left);
  const rightEdit = grid.setBlockWorld(16, 1, 1, 9);
  if (!rightEdit.changed || grid.getBlockWorld(16, 1, 1) !== 9 || right.getBlock(0, 1, 1) !== 9) {
    failures.push('world-to-local mapping at X=16 failed');
  }

  grid.buildGeometryForSection(left);
  grid.buildGeometryForSection(right);
  grid.removeSection(1, 0, 0);
  if (!left.dirty) failures.push('neighbor unload did not invalidate exposed boundary mesh');

  return {
    ok: failures.length === 0,
    failures,
    cellsPerSection: RIFT_SECTION_VOLUME,
    bytesPerSection: left.states.byteLength
  };
}

export function createRiftSectionDiagnosticPattern(section = new RiftBlockSection()) {
  if (!(section instanceof RiftBlockSection)) throw new Error('Expected a RiftBlockSection.');
  section.clear();

  // 8x8 one-block floor centered in the 16x16x16 section.
  section.fillBox(4, 0, 4, 11, 0, 11, RIFT_SECTION_SOLID);

  // 4x4 tower rising four blocks above the floor. The entire test pattern is
  // logical block data first; its GPU mesh is compiled only after the cells exist.
  section.fillBox(6, 1, 6, 9, 4, 9, RIFT_SECTION_SOLID);
  return section;
}

export function applyRiftSectionDiagnosticMutation(section) {
  if (!(section instanceof RiftBlockSection)) throw new Error('Expected a RiftBlockSection.');

  // Four new rooftop blocks prove AIR -> SOLID edits. One carved wall cell proves
  // SOLID -> AIR. All changes mark this section dirty and require one mesh rebuild.
  section.fillBox(7, 5, 7, 8, 5, 8, RIFT_SECTION_SOLID);
  section.eraseBlock(6, 2, 7);
  return section;
}

export function validateRiftBlockSectionStorage() {
  const failures = [];
  const expectedIndices = [
    [0, 0, 0, 0],
    [15, 0, 0, 15],
    [0, 0, 15, 240],
    [0, 15, 0, 3840],
    [15, 15, 15, 4095]
  ];

  for (const [x, y, z, expected] of expectedIndices) {
    const actual = riftSectionIndex(x, y, z);
    if (actual !== expected) failures.push(`index ${x},${y},${z}: ${actual} != ${expected}`);
  }
  if (riftSectionIndex(-1, 0, 0) !== -1 || riftSectionIndex(16, 0, 0) !== -1) {
    failures.push('out-of-bounds index guard failed');
  }

  const section = new RiftBlockSection();
  if (!(section.states instanceof Uint16Array)) failures.push('state storage is not Uint16Array');
  if (section.states.length !== 4096) failures.push(`state length ${section.states.length} != 4096`);
  if (section.states.byteLength !== 8192) failures.push(`state bytes ${section.states.byteLength} != 8192`);

  section.setBlock(0, 0, 0, 7);
  section.setBlock(15, 15, 15, 9);
  if (section.getBlock(0, 0, 0) !== 7 || section.getBlock(15, 15, 15) !== 9) {
    failures.push('boundary state read/write failed');
  }
  if (!section.dirty || section.revision !== 2) failures.push('dirty/revision tracking failed');

  return {
    ok: failures.length === 0,
    failures,
    cells: RIFT_SECTION_VOLUME,
    bytes: section.states.byteLength
  };
}

const RIFT_STREAM_POSITIVE_NEIGHBORS = Object.freeze([
  Object.freeze([1, 0, 0]),
  Object.freeze([0, 1, 0]),
  Object.freeze([0, 0, 1])
]);

export function createRiftStreamingDiagnosticSection({ sx = 0, sy = 0, sz = 0 } = {}) {
  const section = new RiftBlockSection({ sx, sy, sz });
  section.fillBox(0, 0, 0, 15, 0, 15, RIFT_SECTION_SOLID);

  const parityX = Math.abs(Math.trunc(sx)) % 2;
  const parityZ = Math.abs(Math.trunc(sz)) % 2;
  const pillarX = parityX ? 10 : 4;
  const pillarZ = parityZ ? 10 : 4;
  section.fillBox(pillarX, 1, pillarZ, pillarX + 1, 3, pillarZ + 1, RIFT_SECTION_SOLID);
  return section;
}

export function countRiftGridSharedFacePairs(grid) {
  if (!(grid instanceof RiftSectionGrid)) throw new Error('Expected a RiftSectionGrid.');
  let pairs = 0;
  for (const section of grid.sections.values()) {
    for (const [dx, dy, dz] of RIFT_STREAM_POSITIVE_NEIGHBORS) {
      const neighbor = grid.getSection(section.sx + dx, section.sy + dy, section.sz + dz);
      if (neighbor) pairs += countRiftSectionSharedFacePairs(section, neighbor);
    }
  }
  return pairs;
}

export class RiftSectionWorldSource {
  constructor({
    generator = createRiftStreamingDiagnosticSection,
    baseBlockResolver = null
  } = {}) {
    this.generator = typeof generator === 'function' ? generator : createRiftStreamingDiagnosticSection;
    this.baseBlockResolver = typeof baseBlockResolver === 'function' ? baseBlockResolver : null;
    this.overrides = new Map();
    this.revision = 0;
    this.writeCount = 0;
  }

  _location(worldX, worldY, worldZ) {
    const x = riftWorldCellToSection(worldX);
    const y = riftWorldCellToSection(worldY);
    const z = riftWorldCellToSection(worldZ);
    return {
      sx: x.section,
      sy: y.section,
      sz: z.section,
      x: x.local,
      y: y.local,
      z: z.local,
      index: riftSectionIndex(x.local, y.local, z.local),
      key: riftSectionKey(x.section, y.section, z.section)
    };
  }

  get overrideCount() {
    let count = 0;
    for (const sectionOverrides of this.overrides.values()) count += sectionOverrides.size;
    return count;
  }

  get overrideSectionCount() {
    return this.overrides.size;
  }

  getSectionOverrideCount(sx, sy, sz) {
    return this.overrides.get(riftSectionKey(sx, sy, sz))?.size ?? 0;
  }

  getBaseBlockWorld(worldX, worldY, worldZ) {
    const location = this._location(worldX, worldY, worldZ);
    if (this.baseBlockResolver) {
      return Math.max(0, Math.min(65535, Math.trunc(Number(this.baseBlockResolver({
        worldX: Math.trunc(worldX),
        worldY: Math.trunc(worldY),
        worldZ: Math.trunc(worldZ),
        ...location
      })) || 0)));
    }
    const section = this.generator({ sx: location.sx, sy: location.sy, sz: location.sz });
    if (!(section instanceof RiftBlockSection)) {
      throw new Error('RiftSectionWorldSource generator must return RiftBlockSection.');
    }
    return section.getBlock(location.x, location.y, location.z);
  }

  getBlockWorld(worldX, worldY, worldZ) {
    const location = this._location(worldX, worldY, worldZ);
    const sectionOverrides = this.overrides.get(location.key);
    if (sectionOverrides?.has(location.index)) return sectionOverrides.get(location.index);
    return this.getBaseBlockWorld(worldX, worldY, worldZ);
  }

  setBlockWorld(worldX, worldY, worldZ, state = RIFT_SECTION_SOLID) {
    const location = this._location(worldX, worldY, worldZ);
    state = Math.max(0, Math.min(65535, Math.trunc(Number(state) || 0)));
    const baseState = this.getBaseBlockWorld(worldX, worldY, worldZ);
    const previousState = this.getBlockWorld(worldX, worldY, worldZ);
    if (previousState === state) {
      return { changed: false, previousState, state, baseState, location, overrideCount: this.overrideCount };
    }

    let sectionOverrides = this.overrides.get(location.key);
    if (state === baseState) {
      if (sectionOverrides) {
        sectionOverrides.delete(location.index);
        if (sectionOverrides.size === 0) this.overrides.delete(location.key);
      }
    } else {
      if (!sectionOverrides) {
        sectionOverrides = new Map();
        this.overrides.set(location.key, sectionOverrides);
      }
      sectionOverrides.set(location.index, state);
    }

    this.revision += 1;
    this.writeCount += 1;
    return {
      changed: true,
      previousState,
      state,
      baseState,
      location,
      overrideCount: this.overrideCount,
      revision: this.revision
    };
  }

  resetBlockWorld(worldX, worldY, worldZ) {
    return this.setBlockWorld(worldX, worldY, worldZ, this.getBaseBlockWorld(worldX, worldY, worldZ));
  }

  createSection({ sx = 0, sy = 0, sz = 0 } = {}) {
    sx = Math.trunc(sx); sy = Math.trunc(sy); sz = Math.trunc(sz);
    const section = this.generator({ sx, sy, sz });
    if (!(section instanceof RiftBlockSection)) {
      throw new Error('RiftSectionWorldSource generator must return RiftBlockSection.');
    }
    if (section.sx !== sx || section.sy !== sy || section.sz !== sz) {
      throw new Error(`RiftSectionWorldSource generator returned ${riftSectionKey(section.sx, section.sy, section.sz)} for ${riftSectionKey(sx, sy, sz)}.`);
    }

    const sectionOverrides = this.overrides.get(riftSectionKey(sx, sy, sz));
    if (sectionOverrides?.size) {
      for (const [index, state] of sectionOverrides) section.states[index] = state;
      section.revision += 1;
      section.dirty = true;
    }
    section.sourceRevision = this.revision;
    return section;
  }

  sectionMatchesSource(section) {
    if (!(section instanceof RiftBlockSection)) return false;
    const expected = this.createSection({ sx: section.sx, sy: section.sy, sz: section.sz });
    for (let i = 0; i < RIFT_SECTION_VOLUME; i += 1) {
      if (expected.states[i] !== section.states[i]) return false;
    }
    return true;
  }

  exportOverrides() {
    const records = [];
    for (const [key, sectionOverrides] of this.overrides) {
      const [sx, sy, sz] = key.split(',').map(Number);
      for (const [index, state] of sectionOverrides) records.push({ sx, sy, sz, index, state });
    }
    records.sort((a, b) => a.sz - b.sz || a.sx - b.sx || a.sy - b.sy || a.index - b.index);
    return records;
  }
}

export function resolveRiftStreamingDiagnosticBaseBlock({ sx = 0, sz = 0, x = 0, y = 0, z = 0 } = {}) {
  x = Math.trunc(x); y = Math.trunc(y); z = Math.trunc(z);
  if (x < 0 || x >= RIFT_SECTION_SIZE || y < 0 || y >= RIFT_SECTION_SIZE || z < 0 || z >= RIFT_SECTION_SIZE) {
    return RIFT_SECTION_AIR;
  }
  if (y === 0) return RIFT_SECTION_SOLID;

  const parityX = Math.abs(Math.trunc(sx)) % 2;
  const parityZ = Math.abs(Math.trunc(sz)) % 2;
  const pillarX = parityX ? 10 : 4;
  const pillarZ = parityZ ? 10 : 4;
  if (y >= 1 && y <= 3 && x >= pillarX && x <= pillarX + 1 && z >= pillarZ && z <= pillarZ + 1) {
    return RIFT_SECTION_SOLID;
  }
  return RIFT_SECTION_AIR;
}

export class RiftSectionStreamWindow {
  constructor({ radius = 1, sy = 0, generator = createRiftStreamingDiagnosticSection, worldSource = null } = {}) {
    this.radius = Math.max(0, Math.trunc(radius));
    this.sy = Math.trunc(sy);
    this.worldSource = worldSource instanceof RiftSectionWorldSource ? worldSource : null;
    this.generator = this.worldSource
      ? coord => this.worldSource.createSection(coord)
      : (typeof generator === 'function' ? generator : createRiftStreamingDiagnosticSection);
    this.grid = new RiftSectionGrid();
    this.center = null;
    this.shifts = 0;
    this.totalLoads = 0;
    this.totalUnloads = 0;
  }

  desiredCoordinates(centerSx = 0, centerSz = 0) {
    centerSx = Math.trunc(centerSx);
    centerSz = Math.trunc(centerSz);
    const coords = [];
    for (let dz = -this.radius; dz <= this.radius; dz += 1) {
      for (let dx = -this.radius; dx <= this.radius; dx += 1) {
        coords.push({ sx: centerSx + dx, sy: this.sy, sz: centerSz + dz });
      }
    }
    return coords;
  }

  sync(centerSx = 0, centerSz = 0) {
    centerSx = Math.trunc(centerSx);
    centerSz = Math.trunc(centerSz);
    const desired = this.desiredCoordinates(centerSx, centerSz);
    const desiredKeys = new Set(desired.map(coord => riftSectionKey(coord.sx, coord.sy, coord.sz)));
    const unloaded = [];
    const retained = [];
    const loaded = [];

    for (const section of [...this.grid.sections.values()]) {
      const key = riftSectionKey(section.sx, section.sy, section.sz);
      if (desiredKeys.has(key)) {
        retained.push(section);
        continue;
      }
      const removed = this.grid.removeSection(section.sx, section.sy, section.sz);
      if (removed) unloaded.push(removed);
    }

    for (const coord of desired) {
      if (this.grid.getSection(coord.sx, coord.sy, coord.sz)) continue;
      const section = this.generator(coord);
      if (!(section instanceof RiftBlockSection)) {
        throw new Error('RiftSectionStreamWindow generator must return RiftBlockSection.');
      }
      if (section.sx !== coord.sx || section.sy !== coord.sy || section.sz !== coord.sz) {
        throw new Error(`Streaming generator returned ${riftSectionKey(section.sx, section.sy, section.sz)} for ${riftSectionKey(coord.sx, coord.sy, coord.sz)}.`);
      }
      this.grid.addSection(section);
      loaded.push(section);
    }

    const changedCenter = !this.center || this.center.sx !== centerSx || this.center.sz !== centerSz;
    if (changedCenter && this.center) this.shifts += 1;
    this.center = { sx: centerSx, sy: this.sy, sz: centerSz };
    this.totalLoads += loaded.length;
    this.totalUnloads += unloaded.length;

    const sections = this.loadedSections();
    return {
      center: { ...this.center },
      loaded,
      unloaded,
      retained,
      sections,
      dirtySections: sections.filter(section => section.dirty),
      expectedCount: (this.radius * 2 + 1) ** 2
    };
  }

  moveToWorld(worldX = 0, worldZ = 0) {
    const x = riftWorldCellToSection(worldX);
    const z = riftWorldCellToSection(worldZ);
    return this.sync(x.section, z.section);
  }

  setBlockWorld(worldX, worldY, worldZ, state = RIFT_SECTION_SOLID) {
    const persistent = this.worldSource?.setBlockWorld(worldX, worldY, worldZ, state) ?? null;
    const resident = this.grid.setBlockWorld(worldX, worldY, worldZ, state);
    return {
      changed: Boolean(persistent?.changed || resident.changed),
      persistent,
      resident,
      isResident: Boolean(resident.section)
    };
  }

  resetBlockWorld(worldX, worldY, worldZ) {
    if (!this.worldSource) {
      return this.setBlockWorld(worldX, worldY, worldZ, RIFT_SECTION_AIR);
    }
    const baseState = this.worldSource.getBaseBlockWorld(worldX, worldY, worldZ);
    return this.setBlockWorld(worldX, worldY, worldZ, baseState);
  }

  getPersistentBlockWorld(worldX, worldY, worldZ) {
    return this.worldSource?.getBlockWorld(worldX, worldY, worldZ) ?? this.grid.getBlockWorld(worldX, worldY, worldZ);
  }

  get persistentOverrideCount() {
    return this.worldSource?.overrideCount ?? 0;
  }

  loadedSections() {
    return [...this.grid.sections.values()].sort((a, b) => a.sz - b.sz || a.sx - b.sx || a.sy - b.sy);
  }

  loadedStateBytes() {
    let bytes = 0;
    for (const section of this.grid.sections.values()) bytes += section.states.byteLength;
    return bytes;
  }
}

function summarizeStreamingGeometry(grid) {
  const totals = { blocks: 0, visibleFaces: 0, culledFaces: 0, vertexCount: 0, triangles: 0 };
  for (const section of grid.sections.values()) {
    const geometry = grid.buildGeometryForSection(section);
    totals.blocks += geometry.blocks;
    totals.visibleFaces += geometry.visibleFaces;
    totals.culledFaces += geometry.culledFaces;
    totals.vertexCount += geometry.vertexCount;
    totals.triangles += geometry.triangles;
  }
  return totals;
}

function countStreamingNaiveVisibleFaces(grid) {
  let faces = 0;
  for (const section of grid.sections.values()) {
    const clone = new RiftBlockSection({ sx: section.sx, sy: section.sy, sz: section.sz, states: section.states });
    faces += clone.buildGeometry().visibleFaces;
  }
  return faces;
}

export function validateRiftSectionPersistence() {
  const failures = [];
  const target = { worldX: 8, worldY: 1, worldZ: 8 };
  const worldSource = new RiftSectionWorldSource({
    generator: createRiftStreamingDiagnosticSection,
    baseBlockResolver: resolveRiftStreamingDiagnosticBaseBlock
  });
  const stream = new RiftSectionStreamWindow({ radius: 1, worldSource });

  const initial = stream.sync(0, 0);
  const originalSection = stream.grid.getSection(0, 0, 0);
  if (!originalSection || worldSource.overrideCount !== 0 || stream.getPersistentBlockWorld(target.worldX, target.worldY, target.worldZ) !== RIFT_SECTION_AIR) {
    failures.push('initial persistent source state is not clean');
  }

  const write = stream.setBlockWorld(target.worldX, target.worldY, target.worldZ, RIFT_SECTION_SOLID);
  if (!write.changed || !write.persistent?.changed || !write.resident.changed || worldSource.overrideCount !== 1) {
    failures.push('persistent marker write failed');
  }
  if (stream.grid.getBlockWorld(target.worldX, target.worldY, target.worldZ) !== RIFT_SECTION_SOLID || worldSource.getBlockWorld(target.worldX, target.worldY, target.worldZ) !== RIFT_SECTION_SOLID) {
    failures.push('resident/source marker state diverged');
  }

  const editedGeometry = summarizeStreamingGeometry(stream.grid);
  if (editedGeometry.blocks !== 2413 || editedGeometry.visibleFaces !== 5020 || editedGeometry.culledFaces !== 9458 || editedGeometry.vertexCount !== 20080 || editedGeometry.triangles !== 10040) {
    failures.push(`edited persistent geometry ${JSON.stringify(editedGeometry)}`);
  }

  stream.sync(1, 0);
  const away = stream.sync(2, 0);
  if (stream.grid.getSection(0, 0, 0)) failures.push('edited section did not unload after two east shifts');
  if (worldSource.getBlockWorld(target.worldX, target.worldY, target.worldZ) !== RIFT_SECTION_SOLID || worldSource.overrideCount !== 1) {
    failures.push('logical source forgot marker while section was unloaded');
  }
  const awayGeometry = summarizeStreamingGeometry(stream.grid);
  if (awayGeometry.blocks !== 2412 || awayGeometry.visibleFaces !== 5016 || awayGeometry.culledFaces !== 9456 || awayGeometry.vertexCount !== 20064 || awayGeometry.triangles !== 10032) {
    failures.push(`unloaded-window geometry ${JSON.stringify(awayGeometry)}`);
  }

  stream.sync(1, 0);
  const returned = stream.sync(0, 0);
  const reloadedSection = stream.grid.getSection(0, 0, 0);
  if (!reloadedSection || reloadedSection === originalSection) failures.push('section reload did not create a fresh resident section instance');
  if (reloadedSection?.getBlock(8, 1, 8) !== RIFT_SECTION_SOLID) failures.push('reloaded section did not hydrate persistent marker');
  if (!worldSource.sectionMatchesSource(reloadedSection)) failures.push('reloaded resident section differs from persistent source');

  const reloadedGeometry = summarizeStreamingGeometry(stream.grid);
  if (reloadedGeometry.blocks !== 2413 || reloadedGeometry.visibleFaces !== 5020 || reloadedGeometry.culledFaces !== 9458 || reloadedGeometry.vertexCount !== 20080 || reloadedGeometry.triangles !== 10040) {
    failures.push(`reloaded persistent geometry ${JSON.stringify(reloadedGeometry)}`);
  }

  const reset = stream.resetBlockWorld(target.worldX, target.worldY, target.worldZ);
  if (!reset.changed || worldSource.overrideCount !== 0 || stream.getPersistentBlockWorld(target.worldX, target.worldY, target.worldZ) !== RIFT_SECTION_AIR) {
    failures.push('persistent override cleanup failed');
  }
  const clearedGeometry = summarizeStreamingGeometry(stream.grid);
  if (clearedGeometry.blocks !== 2412 || clearedGeometry.visibleFaces !== 5016 || clearedGeometry.culledFaces !== 9456 || clearedGeometry.vertexCount !== 20064 || clearedGeometry.triangles !== 10032) {
    failures.push(`cleared persistent geometry ${JSON.stringify(clearedGeometry)}`);
  }

  const exported = worldSource.exportOverrides();
  if (exported.length !== 0) failures.push('cleared source still exports override records');

  return {
    ok: failures.length === 0,
    failures,
    target,
    residentStateBytes: stream.loadedStateBytes(),
    loadedSections: stream.grid.size,
    initialLoaded: initial.loaded.length,
    awayLoaded: away.loaded.length,
    returnedLoaded: returned.loaded.length,
    editedGeometry,
    awayGeometry,
    reloadedGeometry,
    clearedGeometry
  };
}

export function validateRiftSectionStreaming() {
  const failures = [];
  const stream = new RiftSectionStreamWindow({ radius: 1 });

  const initial = stream.sync(0, 0);
  if (initial.loaded.length !== 9 || initial.unloaded.length !== 0 || initial.retained.length !== 0) {
    failures.push(`initial window counts ${initial.loaded.length}/${initial.unloaded.length}/${initial.retained.length} != 9/0/0`);
  }
  if (stream.grid.size !== 9 || stream.loadedStateBytes() !== 73728) {
    failures.push(`initial window storage ${stream.grid.size} sections / ${stream.loadedStateBytes()} bytes`);
  }

  const initialPairs = countRiftGridSharedFacePairs(stream.grid);
  const initialNaive = countStreamingNaiveVisibleFaces(stream.grid);
  const initialGeometry = summarizeStreamingGeometry(stream.grid);
  if (initialGeometry.blocks !== 2412 || initialGeometry.visibleFaces !== 5016 || initialGeometry.culledFaces !== 9456 || initialGeometry.vertexCount !== 20064 || initialGeometry.triangles !== 10032) {
    failures.push(`initial stream geometry ${JSON.stringify(initialGeometry)}`);
  }
  if (initialPairs !== 192 || initialNaive !== 5400 || initialNaive - initialGeometry.visibleFaces !== 384) {
    failures.push(`initial cross totals pairs=${initialPairs} naive=${initialNaive} saved=${initialNaive - initialGeometry.visibleFaces}`);
  }

  const east = stream.sync(1, 0);
  if (east.loaded.length !== 3 || east.unloaded.length !== 3 || east.retained.length !== 6 || stream.grid.size !== 9) {
    failures.push(`east shift counts ${east.loaded.length}/${east.unloaded.length}/${east.retained.length} != 3/3/6`);
  }
  if (stream.grid.getSection(-1, 0, 0) || !stream.grid.getSection(2, 0, 0)) failures.push('east shift column replacement failed');
  if (east.dirtySections.length !== 9) failures.push(`east shift dirty count ${east.dirtySections.length} != 9`);

  const eastPairs = countRiftGridSharedFacePairs(stream.grid);
  const eastNaive = countStreamingNaiveVisibleFaces(stream.grid);
  const eastGeometry = summarizeStreamingGeometry(stream.grid);
  if (eastGeometry.blocks !== 2412 || eastGeometry.visibleFaces !== 5016 || eastGeometry.culledFaces !== 9456 || eastGeometry.vertexCount !== 20064 || eastGeometry.triangles !== 10032 || eastPairs !== 192 || eastNaive - eastGeometry.visibleFaces !== 384) {
    failures.push(`east stream totals geometry=${JSON.stringify(eastGeometry)} pairs=${eastPairs} saved=${eastNaive - eastGeometry.visibleFaces}`);
  }

  const negativeWorld = new RiftSectionStreamWindow({ radius: 1 });
  const negative = negativeWorld.moveToWorld(-1, -1);
  if (negative.center.sx !== -1 || negative.center.sz !== -1) failures.push(`negative center ${negative.center.sx},${negative.center.sz} != -1,-1`);
  if (!negativeWorld.grid.getSection(-2, 0, -2) || !negativeWorld.grid.getSection(0, 0, 0)) failures.push('negative-world 3x3 coordinates failed');

  return {
    ok: failures.length === 0,
    failures,
    loadedSections: stream.grid.size,
    loadedCells: stream.grid.size * RIFT_SECTION_VOLUME,
    stateBytes: stream.loadedStateBytes(),
    baseGeometry: initialGeometry,
    sharedPairs: initialPairs,
    naiveVisibleFaces: initialNaive,
    crossFacesSaved: initialNaive - initialGeometry.visibleFaces,
    eastShift: { loaded: east.loaded.length, unloaded: east.unloaded.length, retained: east.retained.length, dirty: east.dirtySections.length }
  };
}

