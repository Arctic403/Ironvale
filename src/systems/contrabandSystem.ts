export type ProductionFacility={id:string;name:string;description:string;setupCost:number;capacity:number;heatShield:number;requiredCrimeExperience:number;icon:string};
export type ProductionRecipe={id:string;productId:string;name:string;description:string;facilityId:string;inputs:Record<string,number>;output:number;durationMs:number;heat:number;attention:number;requiredCrimeExperience:number};
export type ActiveProduction={id:string;recipeId:string;startedAt:number;finishesAt:number;quantity:number};

// BETA tuning: intentionally cheap setups and very short timers. Inputs are fictional game abstractions.
export const PRODUCTION_FACILITIES:ProductionFacility[]=[
  {id:"stash-bench",name:"Backroom Bench",description:"Tiny beta production bench for low-volume contraband. Cheap now for testing.",setupCost:2500,capacity:1,heatShield:0,requiredCrimeExperience:60,icon:"🧰"},
  {id:"garage-lab",name:"Garage Lab",description:"Mid-game setup with room for more valuable batches and modest concealment.",setupCost:7500,capacity:2,heatShield:2,requiredCrimeExperience:150,icon:"🏚️"},
  {id:"warehouse-lab",name:"Warehouse Lab",description:"End-game beta facility built for high-value production and larger operating risk.",setupCost:15000,capacity:3,heatShield:4,requiredCrimeExperience:300,icon:"🏭"},
];

export const PRODUCTION_SUPPLIES=[
  {id:"plant-material",name:"Plant Material Pack",price:180,description:"Fictional raw plant input used by the game economy."},
  {id:"chemical-pack-a",name:"Chemical Pack A",price:260,description:"Abstract chemical input; intentionally not a real-world recipe component."},
  {id:"chemical-pack-b",name:"Chemical Pack B",price:340,description:"Abstract high-tier process input."},
  {id:"tablet-base",name:"Tablet Base",price:220,description:"Generic fictional tablet-production material."},
  {id:"lab-catalyst",name:"Lab Catalyst",price:480,description:"Fictional catalyst used to gate higher-value recipes."},
  {id:"packaging-kit",name:"Packaging Kit",price:95,description:"Single batch packaging supplies."},
];

export const PRODUCTION_RECIPES:ProductionRecipe[]=[
  {id:"prod-weed",productId:"weed",name:"Cannabis Batch",description:"Process a fictional plant-material batch for underground resale.",facilityId:"stash-bench",inputs:{"plant-material":2,"packaging-kit":1},output:4,durationMs:30000,heat:3,attention:4,requiredCrimeExperience:60},
  {id:"prod-speed",productId:"speed",name:"Speed Batch",description:"Fictionalized stimulant production using abstract game supplies.",facilityId:"garage-lab",inputs:{"chemical-pack-a":2,"lab-catalyst":1,"packaging-kit":1},output:3,durationMs:45000,heat:6,attention:7,requiredCrimeExperience:150},
  {id:"prod-ecstasy",productId:"ecstasy",name:"Ecstasy Batch",description:"Fictionalized tablet batch; game ingredients do not correspond to real manufacturing.",facilityId:"garage-lab",inputs:{"tablet-base":2,"chemical-pack-a":1,"packaging-kit":1},output:3,durationMs:50000,heat:7,attention:8,requiredCrimeExperience:175},
  {id:"prod-xanax",productId:"xanax",name:"Counterfeit Xanax Batch",description:"Fictional counterfeit-pill production using abstract game materials.",facilityId:"garage-lab",inputs:{"tablet-base":3,"packaging-kit":1},output:4,durationMs:55000,heat:8,attention:9,requiredCrimeExperience:190},
  {id:"prod-coke",productId:"cocaine",name:"Cocaine Batch",description:"High-value fictionalized production represented only through abstract resources.",facilityId:"warehouse-lab",inputs:{"chemical-pack-b":3,"lab-catalyst":2,"packaging-kit":2},output:3,durationMs:75000,heat:11,attention:13,requiredCrimeExperience:300},
  {id:"prod-meth",productId:"meth",name:"Methamphetamine Batch",description:"High-risk fictionalized production using only abstract game resources.",facilityId:"warehouse-lab",inputs:{"chemical-pack-b":2,"lab-catalyst":2,"packaging-kit":2},output:3,durationMs:70000,heat:12,attention:14,requiredCrimeExperience:320},
  {id:"prod-heroin",productId:"heroin",name:"Heroin Batch",description:"High-value fictionalized batch represented without real-world production details.",facilityId:"warehouse-lab",inputs:{"chemical-pack-b":3,"plant-material":2,"packaging-kit":2},output:3,durationMs:75000,heat:13,attention:15,requiredCrimeExperience:340},
  {id:"prod-lsd",productId:"lsd",name:"LSD Batch",description:"Fictionalized batch using abstract game supplies only.",facilityId:"garage-lab",inputs:{"chemical-pack-a":2,"lab-catalyst":1,"packaging-kit":1},output:3,durationMs:55000,heat:8,attention:9,requiredCrimeExperience:210},
  {id:"prod-ketamine",productId:"ketamine",name:"Ketamine Batch",description:"Fictionalized production loop using abstract resources only.",facilityId:"garage-lab",inputs:{"chemical-pack-a":2,"chemical-pack-b":1,"packaging-kit":1},output:3,durationMs:60000,heat:9,attention:10,requiredCrimeExperience:230},
];

export const facilityRank=(id:string)=>PRODUCTION_FACILITIES.findIndex(f=>f.id===id);
export const canFacilityRun=(owned:string[],required:string)=>owned.some(id=>facilityRank(id)>=facilityRank(required));
