// RiftCity H1.16 — reusable 2.5D sub-area registry.
// Scene artwork is presentation only. Walkable bounds, collision, entry/exit and
// future interaction hotspots remain separate gameplay data.
export const SUBAREAS = Object.freeze({
  'alley-commerce-01': Object.freeze({
    id:'alley-commerce-01',
    name:'Commerce Alley',
    parentBlock:'downtown-commercial-01',
    width:1920,
    height:1080,
    scenePlate:{src:'/assets/blocks/commerce-alley.webp',x:0,y:0,width:1920,height:1080,scale:1},
    spawn:{x:330,y:850},
    walkable:{x:70,y:590,width:1780,height:420},
    exit:{id:'street-exit',x:45,y:610,width:230,height:360,label:'Commerce Street'},
    obstacles:[
      {id:'left-clutter',x:330,y:545,width:300,height:210},
      {id:'dumpster',x:930,y:505,width:360,height:265},
      {id:'right-steps',x:1370,y:505,width:390,height:275}
    ],
    // Reserved for the next pass. These are intentionally non-functional until
    // scavenging is wired to the existing server-authoritative crime engine.
    interactions:[]
  })
});

export function getSubarea(id){
  return SUBAREAS[String(id||'')] || null;
}
