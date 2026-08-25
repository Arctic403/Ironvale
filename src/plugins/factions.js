export const FACTION_REGISTRY = Object.freeze([
 {id:'iron-syndicate',name:'Iron Syndicate',description:'A hard-edged network controlling black-market routes and high-risk scores.',specialty:'Crime payouts and contraband',ranks:[{name:'Associate',reputation:0},{name:'Enforcer',reputation:75},{name:'Lieutenant',reputation:200},{name:'Captain',reputation:500}]},
 {id:'rift-guard',name:'Rift Guard',description:'Private security contractors trading discipline for access and influence.',specialty:'Defense and heat reduction',ranks:[{name:'Recruit',reputation:0},{name:'Officer',reputation:75},{name:'Sergeant',reputation:200},{name:'Commander',reputation:500}]},
 {id:'dock-union',name:'Dock Union',description:'Dockworkers, haulers and fixers who know where everything in RiftCity moves.',specialty:'Market and logistics',ranks:[{name:'Hand',reputation:0},{name:'Steward',reputation:75},{name:'Foreman',reputation:200},{name:'Boss',reputation:500}]}
]);
export const getFactionDefinition=id=>FACTION_REGISTRY.find(f=>f.id===id)||null;
export function getFactionRank(faction,reputation=0){return [...faction.ranks].reverse().find(rank=>reputation>=rank.reputation)||faction.ranks[0];}
