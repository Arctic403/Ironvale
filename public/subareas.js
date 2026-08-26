// RiftCity H1.20 — reusable 2.5D room/sub-area registry.
// Scene artwork is presentation only. Walkable bounds, collision, entry/exit,
// camera framing and future interaction hotspots remain separate gameplay data.
export const SUBAREAS = Object.freeze({
  'alley-commerce-01': Object.freeze({
    id:'alley-commerce-01',
    name:'Commerce Alley',
    kicker:'DOWNTOWN / BLOCK 01',
    parentBlock:'downtown-commercial-01',

    // Match the shipped alley scene plate's native 16:9-ish canvas so the
    // sub-area camera never inherits Commerce Street's much wider world size.
    width:1672,
    height:941,
    scenePlate:{
      src:'/assets/blocks/commerce-alley.webp',
      fallbackSrc:'/assets/blocks/commerce-alley-fallback.svg',
      x:0,y:0,width:1672,height:941,scale:1
    },

    // Spawn is intentionally clear of the left-side mobile joystick. The exit
    // still occupies the visible street opening, but the player starts just
    // outside its activation radius so entering the alley does not instantly
    // offer EXIT again.
    spawn:{x:380,y:790},
    walkable:{x:70,y:560,width:1530,height:330},
    exit:{id:'street-exit',x:18,y:535,width:250,height:355,label:'Commerce Street'},

    // A compact alley behaves like a self-contained room. The runtime shows
    // the entire authored scene and centers/letterboxes it if the viewport
    // aspect ratio differs, rather than inheriting or following the street camera.
    camera:{mode:'room',anchorX:.50,anchorY:.72,minScale:.18,maxScale:1.35},

    obstacles:[
      {id:'left-clutter',x:330,y:500,width:245,height:205},
      {id:'dumpster',x:805,y:455,width:355,height:245},
      {id:'right-steps',x:1235,y:455,width:360,height:255}
    ],

    // Reserved for the scavenging pass. These stay non-functional until wired
    // to the existing server-authoritative crime engine.
    interactions:[]
  })
});

export function getSubarea(id){
  return SUBAREAS[String(id||'')] || null;
}
