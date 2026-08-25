export const ACHIEVEMENT_REGISTRY = Object.freeze([
  {id:'first-score',name:'First Score',description:'Complete a successful crime.',metric:'crime',target:1,reward:{xp:25}},
  {id:'ten-scores',name:'Repeat Offender',description:'Complete 10 successful crimes.',metric:'crime',target:10,reward:{xp:75}},
  {id:'road-tested',name:'Road Tested',description:'Complete 10 city or international travel actions.',metric:'travel',target:10,reward:{xp:75}},
  {id:'fighter',name:'First Fight',description:'Win a combat encounter.',metric:'combat_win',target:1,reward:{xp:50}},
  {id:'career-builder',name:'Career Builder',description:'Complete 25 job shifts.',metric:'job',target:25,reward:{xp:100}},
  {id:'trained',name:'Built Different',description:'Complete 50 gym sessions.',metric:'gym',target:50,reward:{xp:125}},
  {id:'property-ladder',name:'Moving Up',description:'Own 3 properties.',metric:'property_owned',target:3,reward:{xp:100}},
  {id:'producer',name:'Production Line',description:'Complete 10 production batches.',metric:'production',target:10,reward:{xp:100}}
]);
export const getAchievementDefinition = id => ACHIEVEMENT_REGISTRY.find(entry => entry.id === id) || null;
