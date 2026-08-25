// RiftCity Phase 11 — authored 2.5D block world.
// Block 1 is intentionally spacious: a single commercial street with six destinations.
export const BLOCK1 = Object.freeze({
  id:'downtown-commercial-01',
  name:'Downtown — Commerce Street',
  width:3600,
  height:1500,
  spawn:{x:340,y:1080},
  road:{x:0,y:650,width:3600,height:430},
  sidewalks:[
    {x:0,y:510,width:3600,height:140},
    {x:0,y:1080,width:3600,height:150}
  ],
  buildings:[
    {id:'corner-mart',name:'Corner Mart',locationId:'mall',x:260,y:180,w:430,h:330,tone:'shop',sign:'CORNER MART'},
    {id:'rift-pharmacy',name:'Rift Pharmacy',locationId:'hospital',x:780,y:160,w:430,h:350,tone:'pharmacy',sign:'RIFT PHARMACY'},
    {id:'keystone',name:'Keystone Realty',locationId:'keystone-realty',x:1300,y:200,w:450,h:310,tone:'office',sign:'KEYSTONE REALTY'},
    {id:'noodle-house',name:'Noodle House',locationId:'nightclub',x:1860,y:170,w:430,h:340,tone:'food',sign:'NOODLE HOUSE'},
    {id:'pawn-exchange',name:'Rift Exchange',locationId:'black-market',x:2390,y:190,w:440,h:320,tone:'pawn',sign:'RIFT EXCHANGE'},
    {id:'apartments',name:'Mercer Apartments',locationId:'properties',x:2940,y:130,w:470,h:380,tone:'apartment',sign:'MERCER APARTMENTS'}
  ],
  props:[
    {kind:'tree',x:120,y:570},{kind:'lamp',x:720,y:590},{kind:'tree',x:1240,y:570},
    {kind:'lamp',x:1780,y:590},{kind:'tree',x:2310,y:570},{kind:'lamp',x:2870,y:590},
    {kind:'tree',x:3470,y:570},{kind:'lamp',x:520,y:1150},{kind:'tree',x:1510,y:1160},
    {kind:'lamp',x:2140,y:1150},{kind:'tree',x:3180,y:1160}
  ],
  alley:{x:1760,y:170,width:80,height:340},
  exits:[
    {id:'west',x:0,y:650,w:90,h:580,label:'West Downtown — future block'},
    {id:'east',x:3510,y:650,w:90,h:580,label:'East Downtown — future block'}
  ]
});
