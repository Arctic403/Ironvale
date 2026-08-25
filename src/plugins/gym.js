export const GYM_PROGRAMS = Object.freeze([
  {id:'balanced',name:'Balanced Foundation',description:'Reliable gains across every combat stat.',energyCost:8,unlockExp:0,multipliers:{strength:1,defense:1,speed:1,dexterity:1}},
  {id:'power',name:'Power Cycle',description:'Heavy sessions favoring Strength and Defense.',energyCost:10,unlockExp:150,multipliers:{strength:1.45,defense:1.2,speed:.8,dexterity:.78}},
  {id:'velocity',name:'Velocity Protocol',description:'Fast reactive work focused on Speed and Dexterity.',energyCost:9,unlockExp:350,multipliers:{strength:.82,defense:.82,speed:1.42,dexterity:1.28}},
  {id:'precision',name:'Precision Lab',description:'Technical work with a major Dexterity focus.',energyCost:8,unlockExp:750,multipliers:{strength:.78,defense:.88,speed:1.08,dexterity:1.5}},
  {id:'ironwall',name:'Ironwall Conditioning',description:'Punishing conditioning built around Defense.',energyCost:11,unlockExp:1400,multipliers:{strength:1.05,defense:1.55,speed:.78,dexterity:.72}},
  {id:'hybrid',name:'Rift Hybrid',description:'Elite adaptive training across all four stats.',energyCost:12,unlockExp:3000,multipliers:{strength:1.3,defense:1.3,speed:1.3,dexterity:1.3}}
]);
export const TRAINING_STATS = Object.freeze(['strength','defense','speed','dexterity']);
export const getGymProgram=id=>GYM_PROGRAMS.find(program=>program.id===id)||null;
