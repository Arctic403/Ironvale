export const MISSION_REGISTRY = Object.freeze([
 {id:'first-crime',name:'First Score',description:'Successfully complete your first crime.',metric:'crime',target:1,reward:{cash:500,xp:50},chapter:1},
 {id:'street-criminal',name:'Street Criminal',description:'Build momentum with 10 successful crimes.',metric:'crime',target:10,reward:{cash:2500,xp:150},chapter:1,prerequisite:'first-crime'},
 {id:'city-runner',name:'Know the Streets',description:'Visit 5 different RiftCity locations.',metric:'travel',target:5,reward:{cash:1200,xp:100},chapter:1,prerequisite:'street-criminal'},
 {id:'gym-rat',name:'Gym Rat',description:'Complete 10 gym training sessions.',metric:'gym',target:10,reward:{cash:1500,xp:100},chapter:2},
 {id:'working-class',name:'Clocked In',description:'Complete 5 manual work shifts.',metric:'job',target:5,reward:{cash:2500,xp:125},chapter:2,prerequisite:'gym-rat'},
 {id:'faction-face',name:'Make a Name',description:'Reach 100 faction reputation.',metric:'faction',target:100,reward:{cash:4000,xp:200},chapter:3,prerequisite:'working-class'},
 {id:'money-maker',name:'Making Money',description:'Accumulate $10,000 cash.',metric:'cash',target:10000,reward:{cash:1000,xp:100},chapter:3},
 {id:'fighter',name:'Stand Your Ground',description:'Win 3 combat encounters.',metric:'combat_win',target:3,reward:{cash:2500,xp:175},chapter:3},
 {id:'student',name:'Course Work',description:'Complete 2 education courses.',metric:'education_complete',target:2,reward:{cash:2000,xp:150},chapter:3},
 {id:'home-owner',name:'Keys in Hand',description:'Own 2 properties.',metric:'property_owned',target:2,reward:{cash:3000,xp:175},chapter:4},
 {id:'international',name:'Beyond RiftCity',description:'Complete 3 international travel legs.',metric:'travel',target:3,reward:{cash:3500,xp:200},chapter:4},
 {id:'production-line',name:'Keep It Moving',description:'Complete 5 production batches.',metric:'production',target:5,reward:{cash:4000,xp:225},chapter:4},
 {id:'banker',name:'Money in the Bank',description:'Deposit $25,000 into Rift National Bank.',metric:'bank_deposit',target:25000,reward:{cash:2500,xp:150},chapter:4},
 {id:'market-player',name:'Market Player',description:'Complete 10 city-market trades.',metric:'market_trade',target:10,reward:{cash:3000,xp:175},chapter:4},
 {id:'casino-visitor',name:'House Account',description:'Claim casino chips on 3 different days.',metric:'casino',target:3,reward:{cash:1500,xp:100},chapter:4}
]);
export const getMissionDefinition=id=>MISSION_REGISTRY.find(m=>m.id===id)||null;
