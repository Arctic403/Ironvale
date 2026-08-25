export const PRODUCTION_FACILITIES = Object.freeze([
  {id:'garage-bench',name:'Garage Workbench',description:'A small workshop for basic repair and tool batches.',price:5000,levelRequired:5,slots:1},
  {id:'industrial-bay',name:'Industrial Bay',description:'A larger workshop with room for two simultaneous batches.',price:30000,levelRequired:12,slots:2},
  {id:'fabrication-floor',name:'Fabrication Floor',description:'A high-capacity production space for advanced batches.',price:125000,levelRequired:25,slots:3}
]);

export const PRODUCTION_RECIPES = Object.freeze([
  {id:'basic-tools',name:'Basic Tool Batch',facilityLevel:0,durationSeconds:5*60,cashCost:100,inputs:[],outputs:[{itemId:'screwdriver',quantity:1}]},
  {id:'medical-pack',name:'Medical Supply Batch',facilityLevel:1,durationSeconds:10*60,cashCost:250,inputs:[],outputs:[{itemId:'first_aid_kit',quantity:1}]},
  {id:'energy-crate',name:'Energy Drink Crate',facilityLevel:1,durationSeconds:15*60,cashCost:180,inputs:[],outputs:[{itemId:'energy_drink',quantity:3}]}
]);

export const getProductionFacility = id => PRODUCTION_FACILITIES.find(entry => entry.id === id) || null;
export const getProductionRecipe = id => PRODUCTION_RECIPES.find(entry => entry.id === id) || null;
