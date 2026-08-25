// Phase 10.1 — high-resolution streamed Downtown ground manifest.
// Tile payloads are split into multiple modules to stay below mobile workspace patch limits.
import { DOWNTOWN_GROUND_TILES_0 } from './downtown-ground-tiles-0.js';
import { DOWNTOWN_GROUND_TILES_1 } from './downtown-ground-tiles-1.js';
import { DOWNTOWN_GROUND_TILES_2 } from './downtown-ground-tiles-2.js';
import { DOWNTOWN_GROUND_TILES_3 } from './downtown-ground-tiles-3.js';

const tiles=Object.freeze([
  ...DOWNTOWN_GROUND_TILES_0,
  ...DOWNTOWN_GROUND_TILES_1,
  ...DOWNTOWN_GROUND_TILES_2,
  ...DOWNTOWN_GROUND_TILES_3
]);

export const DOWNTOWN_GROUND=Object.freeze({
  sourcePixelWidth:1329,
  sourcePixelHeight:1183,
  renderedPixelWidth:4096,
  renderedPixelHeight:3646,
  worldWidth:6400,
  worldHeight:5697,
  columns:4,
  rows:4,
  tiles
});

export function getDowntownTilesForRect(left,top,right,bottom,padding=0){
  const l=left-padding,t=top-padding,r=right+padding,b=bottom+padding;
  return tiles.filter(tile=>(
    tile.x<r && tile.x+tile.width>l && tile.y<b && tile.y+tile.height>t
  ));
}
