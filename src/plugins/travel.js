export const TRAVEL_DESTINATIONS = Object.freeze([
  {id:'riftcity',name:'RiftCity',country:'Home',fare:0,durationSeconds:0,levelRequired:1,offshoreBanking:false},
  {id:'northport',name:'Northport',country:'Norland',fare:500,durationSeconds:5*60,levelRequired:3,offshoreBanking:false},
  {id:'solara',name:'Solara',country:'Solara Republic',fare:1250,durationSeconds:10*60,levelRequired:8,offshoreBanking:true},
  {id:'haven-isle',name:'Haven Isle',country:'Haven',fare:3000,durationSeconds:20*60,levelRequired:15,offshoreBanking:true}
]);

export const getTravelDestination = id => TRAVEL_DESTINATIONS.find(destination => destination.id === id) || null;
