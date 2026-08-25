export const CITY_ACTIVITIES = Object.freeze([
  {id:'park-streetball',locationId:'riftcity-park',name:'Streetball Run',description:'Join a short competitive run at the park courts.',energyCost:5,cooldownMs:3*60_000,reward:{xp:[4,8],cash:[0,25]}},
  {id:'downtown-courier',locationId:'downtown-core',name:'Downtown Courier Rush',description:'Take a timed city delivery contract through the downtown core.',energyCost:6,cooldownMs:4*60_000,reward:{xp:[5,10],cash:[30,70]}},
  {id:'harbour-shift',locationId:'greywater-docks',name:'Harbour Shift',description:'Pick up a short logistics shift moving legal freight through the harbour.',energyCost:7,cooldownMs:5*60_000,reward:{xp:[6,11],cash:[45,90]}},
  {id:'transit-run',locationId:'central-transit',name:'Transit Rush',description:'Help route passengers during a busy transit surge.',energyCost:5,cooldownMs:3*60_000,reward:{xp:[4,8],cash:[25,55]}},
  {id:'warehouse-sort',locationId:'warehouse-district',name:'Warehouse Sort',description:'Take a short sorting contract in the warehouse district.',energyCost:6,cooldownMs:4*60_000,reward:{xp:[5,9],cash:[35,75]}},
  {id:'safehouse-recovery',locationId:'safehouse',name:'Safehouse Recovery',description:'Spend time recovering in a quiet safehouse room.',energyCost:0,cooldownMs:10*60_000,reward:{health:[10,20],xp:[1,3]}},
  {id:'mall-promo',locationId:'rift-mall',name:'Mall Promo Shift',description:'Help a storefront with a short promotional shift.',energyCost:4,cooldownMs:4*60_000,reward:{xp:[3,7],cash:[20,50]}},
  {id:'courthouse-records',locationId:'courthouse',name:'Public Records Run',description:'Complete a small civic records errand at the courthouse.',energyCost:3,cooldownMs:5*60_000,reward:{xp:[4,7],cash:[15,40]}},
  {id:'company-plaza-task',locationId:'company-plaza',name:'Corporate Temp Task',description:'Pick up a short temporary office task in Company Plaza.',energyCost:5,cooldownMs:5*60_000,reward:{xp:[5,9],cash:[40,85]}},
  {id:'dealer-showcase',locationId:'blacktop-motors',name:'Showroom Showcase',description:'Assist with a vehicle showroom event without owning a car.',energyCost:4,cooldownMs:5*60_000,reward:{xp:[4,8],cash:[25,60]}}
]);
export const getCityActivity=id=>CITY_ACTIVITIES.find(x=>x.id===id)||null;
