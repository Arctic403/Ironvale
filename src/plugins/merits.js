export const MERIT_UPGRADES = Object.freeze([
  {id:'energy-cap',name:'Expanded Energy',description:'Increase maximum Energy by 5 per rank.',maxRank:10,baseCost:1,effect:{type:'maxEnergy',amount:5}},
  {id:'nerve-cap',name:'Expanded Nerve',description:'Increase maximum Nerve by 1 per rank.',maxRank:10,baseCost:1,effect:{type:'maxNerve',amount:1}},
  {id:'crime-instinct',name:'Crime Instinct',description:'Small server-side bonus to crime success chance.',maxRank:10,baseCost:1,effect:{type:'crimeChance',amount:.003}},
  {id:'training-focus',name:'Training Focus',description:'Increase gym gains by 2% per rank.',maxRank:10,baseCost:1,effect:{type:'gymGain',amount:.02}},
  {id:'career-drive',name:'Career Drive',description:'Increase job pay by 2% per rank.',maxRank:10,baseCost:1,effect:{type:'jobPay',amount:.02}},
  {id:'market-read',name:'Market Read',description:'Slightly reduce fictional city-market volatility per rank.',maxRank:5,baseCost:2,effect:{type:'marketStability',amount:.02}}
]);
export const getMeritUpgrade=id=>MERIT_UPGRADES.find(x=>x.id===id)||null;
