// RiftCity Phase 12.1 — Commerce Street wide authored scene plate.
// The panoramic art is presentation only. Collision, doors and routes remain editable data.
export const BLOCK1 = Object.freeze({
  id:'downtown-commercial-01',
  name:'Downtown — Commerce Street',
  width:3600,
  height:1800,
  scenePlate:{src:'/assets/blocks/commerce-street.svg',x:0,y:0,width:3600,height:1800,scale:1},
  spawn:{x:340,y:1600},
  walkable:{x:0,y:1238,width:3600,height:562},
  road:{x:0,y:1350,width:3600,height:450},
  sidewalks:[
    {x:0,y:1250,width:3600,height:100}
  ],
  buildings:[
    {id:'corner-mart',name:'Corner Mart',locationId:'cornerstone-market',x:75,y:638,w:430,h:625,tone:'shop',sign:'CORNER MART',doorX:300,doorY:1263,style:'mart',detail:'24/7 • GROCERIES'},
    {id:'northside-warehouse',name:'Northside Warehouse',locationId:'warehouse-district',x:555,y:625,w:600,h:638,tone:'industrial',sign:'NORTHSIDE WAREHOUSE CO.',doorX:955,doorY:1263,style:'warehouse',detail:'WAREHOUSE DISTRICT'},
    {id:'redline-garage',name:'Redline Garage',locationId:'redline-garage',x:1170,y:631,w:520,h:632,tone:'garage',sign:'AUTO REPAIR',doorX:1515,doorY:1263,style:'garage',detail:'BRAKES • TIRES • SERVICE'},
    {id:'commerce-apartments',name:'Commerce Apartments',locationId:'keystone-realty',x:1740,y:538,w:610,h:725,tone:'apartment',sign:'APARTMENTS',doorX:2155,doorY:1263,style:'apartments',detail:'RESIDENTIAL'},
    {id:'pawn-exchange',name:'Second Chance Exchange',locationId:'second-chance-exchange',x:2450,y:650,w:420,h:613,tone:'pawn',sign:'PAWN SHOP',doorX:2670,doorY:1263,style:'pawn',detail:'BUY • SELL'},
    {id:'apartment-rentals',name:'Apartment Rentals',locationId:'keystone-realty',x:2960,y:600,w:440,h:663,tone:'apartment',sign:'APARTMENT RENTALS',doorX:3215,doorY:1263,style:'apartments',detail:'RENTALS'}
  ],
  props:[],
  alley:{x:0,y:0,width:0,height:0,details:[]},
  exits:[
    {id:'west',x:0,y:1263,w:110,h:537,label:'West Downtown — future block'},
    {id:'east',x:3490,y:1263,w:110,h:537,label:'East Downtown — future block'}
  ]
});

export const BLOCK_EDITOR_SCHEMA_VERSION = 2;
