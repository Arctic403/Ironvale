export const MISSION_REGISTRY = Object.freeze([
 {id:'first-crime',name:'First Score',description:'Successfully complete your first crime.',metric:'crime',target:1,reward:{cash:500,xp:50},chapter:1},
 {id:'street-criminal',name:'Street Criminal',description:'Build momentum with 10 successful crimes.',metric:'crime',target:10,reward:{cash:2500,xp:150},chapter:1,prerequisite:'first-crime'},
 {id:'city-runner',name:'Know the Streets',description:'Visit 5 different RiftCity locations.',metric:'travel',target:5,reward:{cash:1200,xp:100},chapter:1,prerequisite:'street-criminal'},
 {id:'gym-rat',name:'Gym Rat',description:'Complete 10 gym training sessions.',metric:'gym',target:10,reward:{cash:1500,xp:100},chapter:2},
 {id:'working-class',name:'Clocked In',description:'Complete 5 manual work shifts.',metric:'job',target:5,reward:{cash:2500,xp:125},chapter:2,prerequisite:'gym-rat'},
 {id:'faction-face',name:'Make a Name',description:'Reach 100 faction reputation.',metric:'faction',target:100,reward:{cash:4000,xp:200},chapter:3,prerequisite:'working-class'},
 {id:'money-maker',name:'Making Money',description:'Accumulate $10,000 cash.',metric:'cash',target:10000,reward:{cash:1000,xp:100},chapter:3}
]);
export const getMissionDefinition=id=>MISSION_REGISTRY.find(m=>m.id===id)||null;
