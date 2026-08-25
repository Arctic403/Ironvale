// Phase 10.2 — Safari-safe Downtown ground manifest.
export const DOWNTOWN_GROUND=Object.freeze({
  sourcePixelWidth:1329,
  sourcePixelHeight:1183,
  renderedPixelWidth:4096,
  renderedPixelHeight:3646,
  worldWidth:6400,
  worldHeight:5697,
  columns:4,
  rows:4,
  fallback:'/assets/downtown/fallback.svg',
  tiles:Object.freeze([
  Object.freeze({id:'0_0',col:0,row:0,x:0.000,y:0.000,width:1600.000,height:1424.250,src:'/assets/downtown/tile-0-0.svg'}),
  Object.freeze({id:'1_0',col:1,row:0,x:1600.000,y:0.000,width:1600.000,height:1424.250,src:'/assets/downtown/tile-1-0.svg'}),
  Object.freeze({id:'2_0',col:2,row:0,x:3200.000,y:0.000,width:1600.000,height:1424.250,src:'/assets/downtown/tile-2-0.svg'}),
  Object.freeze({id:'3_0',col:3,row:0,x:4800.000,y:0.000,width:1600.000,height:1424.250,src:'/assets/downtown/tile-3-0.svg'}),
  Object.freeze({id:'0_1',col:0,row:1,x:0.000,y:1424.250,width:1600.000,height:1424.250,src:'/assets/downtown/tile-0-1.svg'}),
  Object.freeze({id:'1_1',col:1,row:1,x:1600.000,y:1424.250,width:1600.000,height:1424.250,src:'/assets/downtown/tile-1-1.svg'}),
  Object.freeze({id:'2_1',col:2,row:1,x:3200.000,y:1424.250,width:1600.000,height:1424.250,src:'/assets/downtown/tile-2-1.svg'}),
  Object.freeze({id:'3_1',col:3,row:1,x:4800.000,y:1424.250,width:1600.000,height:1424.250,src:'/assets/downtown/tile-3-1.svg'}),
  Object.freeze({id:'0_2',col:0,row:2,x:0.000,y:2848.500,width:1600.000,height:1424.250,src:'/assets/downtown/tile-0-2.svg'}),
  Object.freeze({id:'1_2',col:1,row:2,x:1600.000,y:2848.500,width:1600.000,height:1424.250,src:'/assets/downtown/tile-1-2.svg'}),
  Object.freeze({id:'2_2',col:2,row:2,x:3200.000,y:2848.500,width:1600.000,height:1424.250,src:'/assets/downtown/tile-2-2.svg'}),
  Object.freeze({id:'3_2',col:3,row:2,x:4800.000,y:2848.500,width:1600.000,height:1424.250,src:'/assets/downtown/tile-3-2.svg'}),
  Object.freeze({id:'0_3',col:0,row:3,x:0.000,y:4272.750,width:1600.000,height:1424.250,src:'/assets/downtown/tile-0-3.svg'}),
  Object.freeze({id:'1_3',col:1,row:3,x:1600.000,y:4272.750,width:1600.000,height:1424.250,src:'/assets/downtown/tile-1-3.svg'}),
  Object.freeze({id:'2_3',col:2,row:3,x:3200.000,y:4272.750,width:1600.000,height:1424.250,src:'/assets/downtown/tile-2-3.svg'}),
  Object.freeze({id:'3_3',col:3,row:3,x:4800.000,y:4272.750,width:1600.000,height:1424.250,src:'/assets/downtown/tile-3-3.svg'})
  ])
});

export function getDowntownTilesForRect(left,top,right,bottom,padding=0){
  const l=left-padding,t=top-padding,r=right+padding,b=bottom+padding;
  return DOWNTOWN_GROUND.tiles.filter(tile=>(
    tile.x<r && tile.x+tile.width>l && tile.y<b && tile.y+tile.height>t
  ));
}
