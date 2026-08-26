// RiftCity Phase 12 — Commerce Street authored scene plate.
// The panoramic art is presentation only. Collision, doors and routes remain data.
export const BLOCK1 = Object.freeze({
  id:'downtown-commercial-01',
  name:'Downtown — Commerce Street',
  width:3600,
  height:1440,
  spawn:{x:340,y:1280},
  road:{x:0,y:1080,width:3600,height:360},
  sidewalks:[
    {x:0,y:1000,width:3600,height:80}
  ],
  buildings:[
    {id:'corner-mart',name:'Corner Mart',locationId:'cornerstone-market',x:75,y:510,w:430,h:500,tone:'shop',sign:'CORNER MART',doorX:300,doorY:1010,style:'mart',detail:'24/7 • GROCERIES'},
    {id:'northside-warehouse',name:'Northside Warehouse',locationId:'warehouse-district',x:555,y:500,w:600,h:510,tone:'industrial',sign:'NORTHSIDE WAREHOUSE CO.',doorX:955,doorY:1010,style:'warehouse',detail:'WAREHOUSE DISTRICT'},
    {id:'redline-garage',name:'Redline Garage',locationId:'redline-garage',x:1170,y:505,w:520,h:505,tone:'garage',sign:'AUTO REPAIR',doorX:1515,doorY:1010,style:'garage',detail:'BRAKES • TIRES • SERVICE'},
    {id:'commerce-apartments',name:'Commerce Apartments',locationId:'keystone-realty',x:1740,y:430,w:610,h:580,tone:'apartment',sign:'APARTMENTS',doorX:2155,doorY:1010,style:'apartments',detail:'RESIDENTIAL'},
    {id:'pawn-exchange',name:'Second Chance Exchange',locationId:'second-chance-exchange',x:2450,y:520,w:420,h:490,tone:'pawn',sign:'PAWN SHOP',doorX:2670,doorY:1010,style:'pawn',detail:'BUY • SELL'},
    {id:'apartment-rentals',name:'Apartment Rentals',locationId:'keystone-realty',x:2960,y:480,w:440,h:530,tone:'apartment',sign:'APARTMENT RENTALS',doorX:3215,doorY:1010,style:'apartments',detail:'RENTALS'}
  ],
  props:[],
  alley:{x:0,y:0,width:0,height:0,details:[]},
  exits:[
    {id:'west',x:0,y:1010,w:90,h:430,label:'West Downtown — future block'},
    {id:'east',x:3510,y:1010,w:90,h:430,label:'East Downtown — future block'}
  ]
});

export const BLOCK_EDITOR_SCHEMA_VERSION = 1;
