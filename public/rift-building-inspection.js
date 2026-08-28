import { compileRiftBuildingProgram } from './rift-building-program.js';
import { riftWorldToChunk } from './rift-world-coordinates.js';

const canvas = document.querySelector('#plan');
const ctx = canvas.getContext('2d');
const floorSel = document.querySelector('#floor');
const wireBtn = document.querySelector('#wire');
const gridBtn = document.querySelector('#grid');
const xrayBtn = document.querySelector('#xray');
const coords = document.querySelector('#coords');
const title = document.querySelector('#title');
const status = document.querySelector('#status');
const stats = document.querySelector('#stats');
const diagnostics = document.querySelector('#diagnostics');
const params = new URLSearchParams(location.search);

let result = null;
let floor = 1;
let wire = false;
let grid = true;
let xray = false;
let view = null;

function safeUrl(value) {
  const raw = String(value || './riftcity-buildings/building-program-smoke-001.json').trim();
  if (/^(?:[a-z]+:)?\/\//i.test(raw)) throw new Error('Building inspector only loads local source-controlled JSON.');
  const url = new URL(raw, import.meta.url);
  if (url.origin !== location.origin) throw new Error('Building inspector program must stay on the current origin.');
  return url;
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`BuildingProgram request failed with HTTP ${response.status}.`);
  return response.json();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(Math.max(1, devicePixelRatio || 1), 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function setupView() {
  const bounds = result.document.bounds;
  const rect = canvas.getBoundingClientRect();
  const pad = 28;
  const width = bounds.max[0] - bounds.min[0] + 1;
  const depth = bounds.max[2] - bounds.min[2] + 1;
  const scale = Math.max(.5, Math.min((rect.width - pad * 2) / width, (rect.height - pad * 2) / depth));
  view = {
    minX: bounds.min[0],
    minZ: bounds.min[2],
    scale,
    ox: (rect.width - width * scale) / 2,
    oy: (rect.height - depth * scale) / 2,
    depth
  };
}

function sx(x) { return view.ox + (x - view.minX) * view.scale; }
function sy(z) { return view.oy + (z - view.minZ) * view.scale; }

function roleStyle(role) {
  if (role === 'window') return ['#63bce8', '#1a6388'];
  if (role === 'stair') return ['#e7b74d', '#8a6418'];
  if (role === 'interior-wall') return ['#c98bff', '#7f44a8'];
  if (role === 'roof' || role === 'floor') return ['#ba9f74', '#786342'];
  if (role === 'site') return ['#747c81', '#464d51'];
  return ['#d0d6da', '#59636a'];
}

function drawGrid() {
  if (!grid) return;
  const bounds = result.document.bounds;
  ctx.lineWidth = 1;
  for (let x = bounds.min[0]; x <= bounds.max[0] + 1; x += 1) {
    ctx.strokeStyle = x % 8 === 0 ? '#7fc5ef30' : '#ffffff0b';
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(bounds.min[2]));
    ctx.lineTo(sx(x), sy(bounds.max[2] + 1));
    ctx.stroke();
  }
  for (let z = bounds.min[2]; z <= bounds.max[2] + 1; z += 1) {
    ctx.strokeStyle = z % 8 === 0 ? '#7fc5ef30' : '#ffffff0b';
    ctx.beginPath();
    ctx.moveTo(sx(bounds.min[0]), sy(z));
    ctx.lineTo(sx(bounds.max[0] + 1), sy(z));
    ctx.stroke();
  }
}

function opVisible(op, y) {
  return Number(op.min?.[1]) <= y && Number(op.max?.[1]) >= y;
}

function drawOps() {
  const floors = result.semantics.floors;
  const ys = xray ? floors.map(item => item.localY + 1) : [(floors[floor - 1]?.localY ?? 0) + 1];
  for (const y of ys) {
    for (const op of result.document.ops) {
      if (op.op !== 'fill_box' || !opVisible(op, y)) continue;
      const x = op.min[0];
      const z = op.min[2];
      const width = op.max[0] - x + 1;
      const depth = op.max[2] - z + 1;
      const [fill, stroke] = roleStyle(op._semanticRole);
      ctx.globalAlpha = xray ? .22 : 1;
      ctx.lineWidth = Math.max(1, Math.min(2, view.scale * .08));
      ctx.strokeStyle = stroke;
      if (!wire) {
        ctx.fillStyle = fill;
        ctx.fillRect(sx(x), sy(z), width * view.scale, depth * view.scale);
      }
      ctx.strokeRect(sx(x), sy(z), width * view.scale, depth * view.scale);
    }
  }
  ctx.globalAlpha = 1;
}

function sourcePointToLocal([x, z]) {
  const masses = result.semantics.masses || [];
  const minX = Math.min(...masses.map(mass => mass.origin[0]));
  const minZ = Math.min(...masses.map(mass => mass.origin[2]));
  const maxX = Math.max(...masses.map(mass => mass.origin[0] + mass.size[0] - 1));
  const maxZ = Math.max(...masses.map(mass => mass.origin[2] + mass.size[1] - 1));
  const width = maxX - minX + 1;
  const depth = maxZ - minZ + 1;
  const buildingOrigin = result.program.building?.origin || [0, 0, 0];
  const turns = ['north', 'east', 'south', 'west'].indexOf(result.semantics.rotation);
  x -= minX;
  z -= minZ;
  const point = turns === 1 ? [depth - 1 - z, x]
    : turns === 2 ? [width - 1 - x, depth - 1 - z]
      : turns === 3 ? [z, width - 1 - x]
        : [x, z];
  return [buildingOrigin[0] + point[0], buildingOrigin[2] + point[1]];
}

function sourceRectToLocal(item) {
  if (item.local) return item.local;
  const corners = [
    sourcePointToLocal(item.min),
    sourcePointToLocal([item.min[0], item.max[1]]),
    sourcePointToLocal([item.max[0], item.min[1]]),
    sourcePointToLocal(item.max)
  ];
  return {
    min: [Math.min(...corners.map(point => point[0])), 0, Math.min(...corners.map(point => point[1]))],
    max: [Math.max(...corners.map(point => point[0])), 0, Math.max(...corners.map(point => point[1]))]
  };
}

function drawRooms() {
  for (const room of result.semantics.rooms || []) {
    if (!xray && room.floor !== floor) continue;
    const bounds = sourceRectToLocal(room);
    const width = bounds.max[0] - bounds.min[0] + 1;
    const depth = bounds.max[2] - bounds.min[2] + 1;
    ctx.globalAlpha = xray ? .35 : 1;
    ctx.strokeStyle = '#68bb6f';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sx(bounds.min[0]), sy(bounds.min[2]), width * view.scale, depth * view.scale);
    ctx.setLineDash([]);
    ctx.fillStyle = '#bde7c0';
    ctx.font = '10px system-ui';
    ctx.fillText(room.name || room.id, sx(bounds.min[0]) + 4, sy(bounds.min[2]) + 12);
  }
  ctx.globalAlpha = 1;
}

function drawInteriorVoids() {
  const interior = result.semantics.interior;
  if (!interior) return;
  for (const opening of interior.voids || []) {
    if (!xray && !opening.floors?.includes?.(floor)) continue;
    const bounds = sourceRectToLocal(opening);
    const width = bounds.max[0] - bounds.min[0] + 1;
    const depth = bounds.max[2] - bounds.min[2] + 1;
    ctx.save();
    ctx.globalAlpha = xray ? .25 : .65;
    ctx.fillStyle = '#071018';
    ctx.fillRect(sx(bounds.min[0]), sy(bounds.min[2]), width * view.scale, depth * view.scale);
    ctx.strokeStyle = '#ff7d7d';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(sx(bounds.min[0]), sy(bounds.min[2]), width * view.scale, depth * view.scale);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffb3b3';
    ctx.font = '900 10px system-ui';
    ctx.fillText(`VOID · ${opening.id}`, sx(bounds.min[0]) + 4, sy(bounds.min[2]) + 13);
    ctx.restore();
  }
}

function drawCoreOpenings() {
  const interior = result.semantics.interior;
  if (!interior) return;
  for (const core of interior.verticalCores || []) {
    if (!xray && core.toFloor !== floor) continue;
    const points = core.openingCellsLocal?.length
      ? core.openingCellsLocal.map(cell => [cell[0], cell[2]])
      : (core.openingCells || []).map(cell => sourcePointToLocal([cell[0], cell[2]]));
    if (!points.length) continue;
    ctx.save();
    ctx.globalAlpha = xray ? .3 : .8;
    for (const [x, z] of points) {
      ctx.fillStyle = '#ff9f43';
      ctx.fillRect(sx(x), sy(z), view.scale, view.scale);
    }
    const label = core.local ? [core.local[0], core.local[2]] : sourcePointToLocal(core.at);
    ctx.fillStyle = '#ffd2a3';
    ctx.font = '900 9px system-ui';
    ctx.fillText(`STAIR OPENING · ${core.id}`, sx(label[0]) + 4, sy(label[1]) - 5);
    ctx.restore();
  }
}

function drawPortals() {
  const interior = result.semantics.interior;
  if (!interior) return;
  for (const portal of interior.portals || []) {
    if (!xray && portal.floor !== floor) continue;
    const [x, z] = portal.local ? [portal.local[0], portal.local[2]] : sourcePointToLocal(portal.at);
    const half = portal.width * view.scale * .5;
    ctx.save();
    ctx.strokeStyle = '#54f0e2';
    ctx.fillStyle = '#b9fff9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (portal.axis === 'x') {
      ctx.moveTo(sx(x) - half, sy(z) + view.scale * .5);
      ctx.lineTo(sx(x) + half, sy(z) + view.scale * .5);
    } else {
      ctx.moveTo(sx(x) + view.scale * .5, sy(z) - half);
      ctx.lineTo(sx(x) + view.scale * .5, sy(z) + half);
    }
    ctx.stroke();
    ctx.font = '800 8px system-ui';
    ctx.fillText(portal.id, sx(x) + 5, sy(z) - 4);
    ctx.restore();
  }
}

function drawAnchors() {
  for (const anchor of result.semantics.anchors || []) {
    if (!xray && anchor.floor && anchor.floor !== floor) continue;
    ctx.fillStyle = '#68bb6f';
    ctx.beginPath();
    ctx.arc(sx(anchor.local[0] + .5), sy(anchor.local[2] + .5), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bde7c0';
    ctx.font = '9px system-ui';
    ctx.fillText(anchor.id, sx(anchor.local[0] + .5) + 6, sy(anchor.local[2] + .5) - 5);
  }
}

function drawLot() {
  const bounds = result.document.bounds;
  ctx.strokeStyle = '#8ecfff';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    sx(bounds.min[0]),
    sy(bounds.min[2]),
    (bounds.max[0] - bounds.min[0] + 1) * view.scale,
    (bounds.max[2] - bounds.min[2] + 1) * view.scale
  );
}

function draw() {
  if (!result || !canvas.width) return;
  setupView();
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#081018';
  ctx.fillRect(0, 0, rect.width, rect.height);
  drawGrid();
  drawOps();
  drawInteriorVoids();
  drawCoreOpenings();
  drawRooms();
  drawPortals();
  drawAnchors();
  drawLot();
}

function syncUi() {
  wireBtn.classList.toggle('active', wire);
  gridBtn.classList.toggle('active', grid);
  xrayBtn.classList.toggle('active', xray);
  floorSel.disabled = xray;
  draw();
}

function floorLabel(floorMeta) {
  const labels = result.program.building?.floor_labels || [];
  return labels[floorMeta.floor - 1] || `Floor ${floorMeta.floor}`;
}

function buildSidebar() {
  title.textContent = result.semantics.name;
  const reportStats = result.report.stats;
  const interior = result.semantics.interior;
  status.textContent = `${result.report.ok ? 'PASS' : 'FAIL'} · ${result.semantics.district || 'unassigned district'} · chunk ${result.semantics.chunk.id}`;
  floorSel.innerHTML = result.semantics.floors
    .map(item => `<option value="${item.floor}">${floorLabel(item)} · Y ${item.worldY}</option>`)
    .join('');
  floorSel.value = String(floor);
  stats.innerHTML = [
    ['World origin', result.document.origin.join(', ')],
    ['World bounds', `${result.semantics.worldBounds.min.join(', ')} → ${result.semantics.worldBounds.max.join(', ')}`],
    ['Structural cells', reportStats.structuralCells.toLocaleString()],
    ['Canonical ops', reportStats.operations.toLocaleString()],
    ['Masses / floors', `${reportStats.masses} / ${reportStats.floors}`],
    ['Spaces / portals', `${reportStats.spaces || reportStats.rooms} / ${reportStats.portals || 0}`],
    ['Voids / stair cores', `${reportStats.voids || 0} / ${reportStats.verticalCores || 0}`],
    ['Reachability', interior ? `${interior.graph?.reachable?.length || 0}/${interior.spaces?.length || 0} spaces` : 'legacy metadata'],
    ['Blocked / invalid cores', `${reportStats.blockedPortals || 0} / ${reportStats.invalidVerticalCores || 0}`],
    ['Entrances / connectors', `${reportStats.entrances} / ${reportStats.connectors}`],
    ['Errors / warnings', `${reportStats.errors} / ${reportStats.warnings}`]
  ].map(([label, value]) => `<div class="stat"><span>${label}</span><b>${value}</b></div>`).join('');
  diagnostics.innerHTML = (result.report.diagnostics.length
    ? result.report.diagnostics
    : [{ severity: 'notice', message: 'No diagnostics. BuildingProgram is clean.' }])
    .map(item => `<div class="diag ${item.severity}"><b>${String(item.severity).toUpperCase()} · ${item.code || 'clean'}</b><br>${item.message}</div>`)
    .join('');
}

function pointer(event) {
  if (!result || !view) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left - view.ox) / view.scale + view.minX);
  const z = Math.floor((event.clientY - rect.top - view.oy) / view.scale + view.minZ);
  const y = result.semantics.floors[floor - 1]?.localY || 0;
  const bounds = result.document.bounds;
  if (x < bounds.min[0] || x > bounds.max[0] || z < bounds.min[2] || z > bounds.max[2]) {
    coords.textContent = 'LOCAL —\nWORLD —\nCHUNK —';
    return;
  }
  const world = [
    result.document.origin[0] + x,
    result.document.origin[1] + y,
    result.document.origin[2] + z
  ];
  const chunk = riftWorldToChunk(world);
  coords.textContent = `LOCAL ${x}, ${y}, ${z}\nWORLD ${world.join(', ')}\nCHUNK ${chunk.id} · ${chunk.local.join(', ')}`;
}

async function boot() {
  const program = await loadJson(safeUrl(params.get('program')));
  result = compileRiftBuildingProgram(program, { strict: false });
  floor = Number(params.get('floor') || 1);
  if (floor < 1 || floor > result.semantics.floors.length) floor = 1;
  xray = params.get('xray') === '1' || params.get('xray') === 'true';
  buildSidebar();
  resize();
  document.documentElement.dataset.riftBuildingInspectionReady = '1';
  document.documentElement.dataset.riftInteriorArchitecture = result.semantics.interior ? '1' : '0';
  document.title = `READY · ${result.semantics.name} · ${floorLabel(result.semantics.floors[floor - 1])}`;
  window.RiftCityBuildingInspection = Object.freeze({
    version: 2,
    report: result.report,
    semantics: result.semantics,
    setFloor(next) {
      floor = Math.max(1, Math.min(result.semantics.floors.length, Number(next) || 1));
      floorSel.value = String(floor);
      syncUi();
      return floor;
    },
    setWireframe(next = true) {
      wire = !!next;
      syncUi();
      return wire;
    },
    setXray(next = true) {
      xray = !!next;
      syncUi();
      return xray;
    },
    capturePng() {
      draw();
      return canvas.toDataURL('image/png');
    }
  });
}

floorSel.onchange = event => {
  floor = Number(event.target.value) || 1;
  syncUi();
};
wireBtn.onclick = () => {
  wire = !wire;
  syncUi();
};
gridBtn.onclick = () => {
  grid = !grid;
  syncUi();
};
xrayBtn.onclick = () => {
  xray = !xray;
  syncUi();
};
canvas.addEventListener('pointermove', pointer);
window.addEventListener('resize', resize);

boot().catch(error => {
  console.error(error);
  status.textContent = error?.message || String(error);
  document.documentElement.dataset.riftBuildingInspectionError = '1';
  document.title = 'ERROR · RiftCity Building Inspector';
});
