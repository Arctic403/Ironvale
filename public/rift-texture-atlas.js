// RiftCity Base Texture Atlas v1
// All tiles are generated procedurally at runtime. No third-party texture art is bundled.

export const RIFT_TEXTURE_TILE_SIZE = 64;
export const RIFT_TEXTURE_ATLAS_COLUMNS = 4;
export const RIFT_TEXTURE_ATLAS_ROWS = 4;

export const RIFT_TEXTURE_TILES = Object.freeze([
  'grass', 'dirt', 'dirt_dark', 'dirt_dry',
  'stone', 'stone_light', 'stone_dark', 'cobblestone',
  'mossy_stone', 'oak_wood', 'pine_wood', 'aged_wood',
  'sand', 'gravel', 'clay', 'mud'
]);

export const RIFT_TEXTURE_INDEX = Object.freeze(Object.fromEntries(
  RIFT_TEXTURE_TILES.map((name, index) => [name, index])
));

const clamp8 = value => Math.max(0, Math.min(255, Math.round(value)));
const rgb = (r, g, b) => `rgb(${clamp8(r)},${clamp8(g)},${clamp8(b)})`;

function hash2(x, y, seed = 0) {
  let n = (Math.imul(x + 374761393, 668265263) ^ Math.imul(y + 1442695041, 2246822519) ^ Math.imul(seed + 1013904223, 3266489917)) >>> 0;
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177) >>> 0;
  n ^= n >>> 16;
  return n / 4294967295;
}

function paintNoise(ctx, x0, y0, size, base, spread, seed, grain = 1) {
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const broad = (hash2(Math.floor(x / 5), Math.floor(y / 5), seed + 91) - 0.5) * spread * 0.65;
      const fine = (hash2(x * grain, y * grain, seed) - 0.5) * spread;
      const i = (y * size + x) * 4;
      image.data[i] = clamp8(base[0] + broad + fine);
      image.data[i + 1] = clamp8(base[1] + broad + fine);
      image.data[i + 2] = clamp8(base[2] + broad + fine);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, x0, y0);
}

function flecks(ctx, x0, y0, size, colors, count, seed, maxRadius = 1.7) {
  for (let i = 0; i < count; i += 1) {
    const px = x0 + hash2(i, 7, seed) * size;
    const py = y0 + hash2(i, 19, seed + 1) * size;
    const radius = 0.35 + hash2(i, 29, seed + 2) * maxRadius;
    ctx.fillStyle = colors[Math.floor(hash2(i, 43, seed + 3) * colors.length) % colors.length];
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function cracks(ctx, x0, y0, size, seed, stroke = 'rgba(35,35,35,.25)', count = 5) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.7;
  for (let i = 0; i < count; i += 1) {
    let x = x0 + hash2(i, 1, seed) * size;
    let y = y0 + hash2(i, 2, seed) * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 2 + Math.floor(hash2(i, 3, seed) * 4);
    for (let s = 0; s < segments; s += 1) {
      x += (hash2(i * 13 + s, 4, seed) - 0.5) * 10;
      y += (hash2(i * 17 + s, 5, seed) - 0.5) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function grass(ctx, x, y, s) {
  paintNoise(ctx, x, y, s, [67, 112, 51], 34, 1001);
  flecks(ctx, x, y, s, ['rgba(39,76,31,.65)', 'rgba(113,145,65,.62)', 'rgba(74,94,41,.5)'], 180, 1002, 1.1);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 85; i += 1) {
    const px = x + hash2(i, 1, 1003) * s;
    const py = y + hash2(i, 2, 1003) * s;
    const len = 1.5 + hash2(i, 3, 1003) * 4.5;
    ctx.strokeStyle = hash2(i, 4, 1003) > 0.45 ? 'rgba(128,159,74,.55)' : 'rgba(31,74,35,.55)';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (hash2(i, 5, 1003) - .5) * 2, py - len); ctx.stroke();
  }
}

function dirt(ctx, x, y, s, base, spread, seed) {
  paintNoise(ctx, x, y, s, base, spread, seed);
  flecks(ctx, x, y, s, ['rgba(74,50,31,.5)', 'rgba(166,120,75,.36)', 'rgba(42,31,23,.32)'], 120, seed + 1, 1.35);
}

function stone(ctx, x, y, s, base, seed, moss = false) {
  paintNoise(ctx, x, y, s, base, 24, seed);
  flecks(ctx, x, y, s, ['rgba(255,255,255,.10)', 'rgba(22,25,27,.12)', 'rgba(112,118,118,.16)'], 85, seed + 1, 1.15);
  cracks(ctx, x, y, s, seed + 2, 'rgba(32,35,37,.24)', 5);
  if (moss) {
    for (let i = 0; i < 14; i += 1) {
      const px = x + hash2(i, 11, seed + 3) * s;
      const py = y + hash2(i, 12, seed + 3) * s;
      const r = 2 + hash2(i, 13, seed + 3) * 6;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, 'rgba(62,102,44,.58)');
      grad.addColorStop(1, 'rgba(62,102,44,0)');
      ctx.fillStyle = grad; ctx.fillRect(px-r, py-r, r*2, r*2);
    }
  }
}

function cobblestone(ctx, x, y, s) {
  paintNoise(ctx, x, y, s, [104, 106, 101], 18, 4001);
  const cell = 16;
  ctx.lineWidth = 2;
  for (let row = -1; row < 5; row += 1) {
    for (let col = -1; col < 5; col += 1) {
      const off = (row & 1) ? cell * .5 : 0;
      const px = x + col * cell + off + (hash2(col, row, 4002) - .5) * 3;
      const py = y + row * cell + (hash2(row, col, 4003) - .5) * 3;
      const w = 13 + hash2(col, row, 4004) * 5;
      const h = 11 + hash2(col, row, 4005) * 5;
      ctx.fillStyle = rgb(92 + hash2(col,row,4006)*34, 94 + hash2(col,row,4007)*31, 90 + hash2(col,row,4008)*29);
      ctx.strokeStyle = 'rgba(48,50,48,.72)';
      ctx.beginPath();
      ctx.roundRect(px, py, w, h, 3);
      ctx.fill(); ctx.stroke();
    }
  }
  flecks(ctx, x, y, s, ['rgba(255,255,255,.09)', 'rgba(15,15,15,.10)'], 70, 4009, .8);
}

function wood(ctx, x, y, s, base, seed, aged = false) {
  paintNoise(ctx, x, y, s, base, aged ? 18 : 15, seed);
  for (let i = 0; i < 18; i += 1) {
    const px = x + hash2(i, 1, seed + 1) * s;
    const amp = 1 + hash2(i, 2, seed + 1) * 3;
    ctx.strokeStyle = aged ? 'rgba(58,56,49,.34)' : 'rgba(88,53,28,.28)';
    ctx.lineWidth = .7 + hash2(i, 3, seed + 1) * 1.2;
    ctx.beginPath();
    for (let yy = 0; yy <= s; yy += 4) {
      const xx = px + Math.sin((yy + i * 7) * .12) * amp;
      if (yy === 0) ctx.moveTo(xx, y + yy); else ctx.lineTo(xx, y + yy);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 4; i += 1) {
    const px = x + 8 + hash2(i, 4, seed + 2) * (s - 16);
    const py = y + 8 + hash2(i, 5, seed + 2) * (s - 16);
    ctx.strokeStyle = aged ? 'rgba(49,47,41,.5)' : 'rgba(79,45,24,.48)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(px, py, 3.5 + hash2(i,6,seed)*3, 1.7 + hash2(i,7,seed)*2, 0, 0, Math.PI*2); ctx.stroke();
  }
}

function sand(ctx, x, y, s) {
  paintNoise(ctx, x, y, s, [196, 174, 121], 20, 6001);
  flecks(ctx, x, y, s, ['rgba(236,218,163,.7)','rgba(133,115,78,.42)','rgba(82,76,64,.18)'], 260, 6002, .7);
}

function gravel(ctx, x, y, s) {
  paintNoise(ctx, x, y, s, [112, 108, 99], 18, 7001);
  flecks(ctx, x, y, s, ['rgba(154,150,139,.9)','rgba(72,70,67,.85)','rgba(123,111,93,.8)','rgba(184,177,160,.58)'], 190, 7002, 1.8);
}

function clay(ctx, x, y, s) {
  paintNoise(ctx, x, y, s, [150, 91, 69], 18, 8001);
  flecks(ctx, x, y, s, ['rgba(186,118,90,.30)','rgba(88,51,42,.22)'], 90, 8002, 1.0);
  cracks(ctx, x, y, s, 8003, 'rgba(83,49,42,.18)', 3);
}

function mud(ctx, x, y, s) {
  paintNoise(ctx, x, y, s, [74, 58, 42], 18, 9001);
  for (let i = 0; i < 18; i += 1) {
    const px = x + hash2(i, 1, 9002) * s;
    const py = y + hash2(i, 2, 9002) * s;
    const rx = 2 + hash2(i, 3, 9002) * 8;
    const ry = 1 + hash2(i, 4, 9002) * 4;
    ctx.fillStyle = hash2(i, 5, 9002) > .5 ? 'rgba(104,82,56,.32)' : 'rgba(42,36,29,.28)';
    ctx.beginPath(); ctx.ellipse(px, py, rx, ry, hash2(i,6,9002)*Math.PI, 0, Math.PI*2); ctx.fill();
  }
}

export function createRiftTextureAtlasCanvas() {
  const tile = RIFT_TEXTURE_TILE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = tile * RIFT_TEXTURE_ATLAS_COLUMNS;
  canvas.height = tile * RIFT_TEXTURE_ATLAS_ROWS;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Rift texture atlas requires Canvas2D.');
  ctx.imageSmoothingEnabled = false;

  const at = (index, draw) => {
    const x = (index % RIFT_TEXTURE_ATLAS_COLUMNS) * tile;
    const y = Math.floor(index / RIFT_TEXTURE_ATLAS_COLUMNS) * tile;
    draw(ctx, x, y, tile);
  };

  at(0, grass);
  at(1, (c,x,y,s)=>dirt(c,x,y,s,[121,84,50],30,2001));
  at(2, (c,x,y,s)=>dirt(c,x,y,s,[82,59,43],26,2101));
  at(3, (c,x,y,s)=>dirt(c,x,y,s,[153,112,67],32,2201));
  at(4, (c,x,y,s)=>stone(c,x,y,s,[112,116,116],3001));
  at(5, (c,x,y,s)=>stone(c,x,y,s,[154,157,153],3101));
  at(6, (c,x,y,s)=>stone(c,x,y,s,[73,78,81],3201));
  at(7, cobblestone);
  at(8, (c,x,y,s)=>stone(c,x,y,s,[94,103,91],3301,true));
  at(9, (c,x,y,s)=>wood(c,x,y,s,[137,91,48],5001,false));
  at(10, (c,x,y,s)=>wood(c,x,y,s,[172,132,78],5101,false));
  at(11, (c,x,y,s)=>wood(c,x,y,s,[109,104,91],5201,true));
  at(12, sand);
  at(13, gravel);
  at(14, clay);
  at(15, mud);

  return canvas;
}
