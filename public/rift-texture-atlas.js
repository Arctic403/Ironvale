// RiftCity Base Texture Atlas v2
// All tiles are generated procedurally at runtime. No third-party texture art is bundled.
//
// Safari/iOS compatibility: the atlas is built as a raw RGBA byte buffer instead
// of a Canvas2D TexImageSource. WebKit can throw IndexSizeError while converting a
// canvas source during texImage2D(); the narrow upload bridge below intercepts only
// RiftCity's marked atlas source and uses the explicit raw RGBA overload instead.

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

const ATLAS_SOURCE_MARKER = '__riftAtlasRawRgbaV2';
const ATLAS_UPLOAD_PATCH = Symbol.for('riftcity.textureAtlas.rawRgbaUpload.v2');

const BASES = Object.freeze([
  [67, 112, 51],
  [121, 84, 50],
  [82, 59, 43],
  [153, 112, 67],
  [112, 116, 116],
  [154, 157, 153],
  [73, 78, 81],
  [104, 106, 101],
  [94, 103, 91],
  [137, 91, 48],
  [172, 132, 78],
  [109, 104, 91],
  [196, 174, 121],
  [112, 108, 99],
  [150, 91, 69],
  [74, 58, 42]
]);

const clamp8 = value => Math.max(0, Math.min(255, Math.round(value)));

function hash2(x, y, seed = 0) {
  let n = (Math.imul((x | 0) + 374761393, 668265263) ^ Math.imul((y | 0) + 1442695041, 2246822519) ^ Math.imul((seed | 0) + 1013904223, 3266489917)) >>> 0;
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177) >>> 0;
  n ^= n >>> 16;
  return n / 4294967295;
}

function noise(x, y, seed, spread = 20) {
  const broad = (hash2(Math.floor(x / 5), Math.floor(y / 5), seed + 91) - 0.5) * spread * 0.65;
  const fine = (hash2(x, y, seed) - 0.5) * spread;
  return broad + fine;
}

function tint(base, amount) {
  return [clamp8(base[0] + amount), clamp8(base[1] + amount), clamp8(base[2] + amount)];
}

function mixColor(a, b, t) {
  const u = Math.max(0, Math.min(1, t));
  return [
    clamp8(a[0] + (b[0] - a[0]) * u),
    clamp8(a[1] + (b[1] - a[1]) * u),
    clamp8(a[2] + (b[2] - a[2]) * u)
  ];
}

function grassPixel(x, y) {
  let color = tint(BASES[0], noise(x, y, 1001, 34));
  const tuft = hash2(Math.floor(x / 2), Math.floor(y / 3), 1002);
  if (tuft > 0.83) color = mixColor(color, [116, 151, 70], 0.46);
  else if (tuft < 0.13) color = mixColor(color, [35, 76, 31], 0.42);
  const blade = hash2(x, Math.floor(y / 4), 1003);
  if (blade > 0.965) color = mixColor(color, [132, 164, 79], 0.38);
  return color;
}

function dirtPixel(index, x, y) {
  const spreads = [0, 30, 26, 32];
  const seeds = [0, 2001, 2101, 2201];
  let color = tint(BASES[index], noise(x, y, seeds[index], spreads[index]));
  const speck = hash2(x * 3, y * 5, seeds[index] + 1);
  if (speck > 0.94) color = mixColor(color, [178, 132, 82], 0.34);
  else if (speck < 0.055) color = mixColor(color, [55, 40, 29], 0.36);
  return color;
}

function stonePixel(index, x, y) {
  const seed = 3001 + (index - 4) * 100;
  let color = tint(BASES[index], noise(x, y, seed, 24));
  const pore = hash2(x * 7, y * 11, seed + 1);
  if (pore > 0.965) color = mixColor(color, [35, 38, 39], 0.24);
  if (((x + Math.floor(hash2(Math.floor(y / 7), index, seed + 2) * 11)) % 29) === 0 && hash2(y, x, seed + 3) > 0.48) {
    color = mixColor(color, [42, 45, 45], 0.24);
  }
  return color;
}

function cobblePixel(x, y) {
  const cellW = 16;
  const cellH = 12;
  const row = Math.floor(y / cellH);
  const shiftedX = x + ((row & 1) ? cellW * 0.5 : 0);
  const localX = ((shiftedX % cellW) + cellW) % cellW;
  const localY = y % cellH;
  if (localX < 1.4 || localY < 1.4) return [54, 56, 53];
  const col = Math.floor(shiftedX / cellW);
  const variation = (hash2(col, row, 4001) - 0.5) * 30 + noise(x, y, 4002, 8);
  return tint(BASES[7], variation);
}

function mossyStonePixel(x, y) {
  let color = stonePixel(4, x, y);
  color = mixColor(color, BASES[8], 0.34);
  const patch = hash2(Math.floor(x / 7), Math.floor(y / 7), 3304);
  if (patch > 0.64) color = mixColor(color, [57, 96, 43], Math.min(0.62, (patch - 0.64) * 1.6));
  return color;
}

function woodPixel(index, x, y) {
  const seed = 5001 + (index - 9) * 100;
  const aged = index === 11;
  const grain = Math.sin(x * 0.48 + Math.sin(y * 0.11 + seed) * 1.8) * (aged ? 8 : 11);
  const broad = noise(Math.floor(x / 2), Math.floor(y / 4), seed, aged ? 13 : 10);
  let color = tint(BASES[index], grain + broad);
  const knot = hash2(Math.floor(x / 9), Math.floor(y / 11), seed + 7);
  if (knot > 0.965) color = mixColor(color, aged ? [55, 53, 48] : [79, 48, 27], 0.42);
  return color;
}

function sandPixel(x, y) {
  let color = tint(BASES[12], noise(x, y, 6001, 20));
  const grain = hash2(x * 5, y * 7, 6002);
  if (grain > 0.91) color = mixColor(color, [234, 215, 160], 0.5);
  else if (grain < 0.08) color = mixColor(color, [131, 115, 80], 0.28);
  return color;
}

function gravelPixel(x, y) {
  const gx = Math.floor(x / 4), gy = Math.floor(y / 4);
  const rock = hash2(gx, gy, 7001);
  const palette = rock > 0.75 ? [166, 160, 146] : rock < 0.25 ? [74, 72, 68] : BASES[13];
  return tint(palette, noise(x, y, 7002, 16));
}

function clayPixel(x, y) {
  let color = tint(BASES[14], noise(x, y, 8001, 18));
  if (((x + Math.floor(hash2(y, 8, 8002) * 9)) % 37) === 0 && hash2(x, y, 8003) > 0.42) {
    color = mixColor(color, [88, 52, 43], 0.30);
  }
  return color;
}

function mudPixel(x, y) {
  let color = tint(BASES[15], noise(x, y, 9001, 18));
  const puddle = hash2(Math.floor(x / 9), Math.floor(y / 6), 9002);
  if (puddle > 0.72) color = mixColor(color, [103, 81, 57], 0.32);
  else if (puddle < 0.16) color = mixColor(color, [41, 35, 29], 0.28);
  return color;
}

function tilePixel(index, x, y) {
  if (index === 0) return grassPixel(x, y);
  if (index >= 1 && index <= 3) return dirtPixel(index, x, y);
  if (index >= 4 && index <= 6) return stonePixel(index, x, y);
  if (index === 7) return cobblePixel(x, y);
  if (index === 8) return mossyStonePixel(x, y);
  if (index >= 9 && index <= 11) return woodPixel(index, x, y);
  if (index === 12) return sandPixel(x, y);
  if (index === 13) return gravelPixel(x, y);
  if (index === 14) return clayPixel(x, y);
  return mudPixel(x, y);
}

function installRawAtlasUploadBridge() {
  const proto = globalThis.WebGL2RenderingContext?.prototype;
  if (!proto || proto[ATLAS_UPLOAD_PATCH]) return;
  const nativeTexImage2D = proto.texImage2D;
  if (typeof nativeTexImage2D !== 'function') return;

  const patchedTexImage2D = function (...args) {
    const source = args.length === 6 ? args[5] : null;
    if (!source || source[ATLAS_SOURCE_MARKER] !== true) {
      return nativeTexImage2D.apply(this, args);
    }

    const previousFlip = this.getParameter(this.UNPACK_FLIP_Y_WEBGL);
    const previousPremultiply = this.getParameter(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
    const previousAlignment = this.getParameter(this.UNPACK_ALIGNMENT);
    try {
      // Raw ArrayBufferView uploads avoid Safari/WebKit's Canvas TexImageSource
      // conversion path. RGBA is also the most reliable upload format on Safari.
      this.pixelStorei(this.UNPACK_FLIP_Y_WEBGL, false);
      this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.pixelStorei(this.UNPACK_ALIGNMENT, 1);
      return nativeTexImage2D.call(
        this,
        args[0],
        args[1],
        this.RGBA,
        source.width,
        source.height,
        0,
        this.RGBA,
        this.UNSIGNED_BYTE,
        source.data
      );
    } finally {
      this.pixelStorei(this.UNPACK_FLIP_Y_WEBGL, previousFlip);
      this.pixelStorei(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL, previousPremultiply);
      this.pixelStorei(this.UNPACK_ALIGNMENT, previousAlignment);
    }
  };

  try {
    Object.defineProperty(proto, 'texImage2D', {
      value: patchedTexImage2D,
      configurable: true,
      writable: true
    });
    Object.defineProperty(proto, ATLAS_UPLOAD_PATCH, { value: true });
  } catch (_) {
    try {
      proto.texImage2D = patchedTexImage2D;
      proto[ATLAS_UPLOAD_PATCH] = true;
    } catch (_) {}
  }
}

installRawAtlasUploadBridge();

export function createRiftTextureAtlasCanvas() {
  const tile = RIFT_TEXTURE_TILE_SIZE;
  const width = tile * RIFT_TEXTURE_ATLAS_COLUMNS;
  const height = tile * RIFT_TEXTURE_ATLAS_ROWS;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const tileY = Math.floor(y / tile);
    const localY = y % tile;
    for (let x = 0; x < width; x += 1) {
      const tileX = Math.floor(x / tile);
      const localX = x % tile;
      const tileIndex = tileY * RIFT_TEXTURE_ATLAS_COLUMNS + tileX;
      const color = tilePixel(tileIndex, localX, localY);
      const offset = (y * width + x) * 4;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
    }
  }

  return {
    width,
    height,
    data,
    [ATLAS_SOURCE_MARKER]: true
  };
}
