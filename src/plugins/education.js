export const EDUCATION_REGISTRY = Object.freeze([
  {id:'street-smarts',name:'Street Smarts',description:'Learn how to keep your head down and spot opportunities.',cost:1000,durationSeconds:2*60*60,levelRequired:1,bonus:{type:'crime',amount:3}},
  {id:'fitness-basics',name:'Fitness Fundamentals',description:'Learn the basics of effective training.',cost:2500,durationSeconds:4*60*60,levelRequired:5,bonus:{type:'gym',amount:5}},
  {id:'self-defense',name:'Self Defense',description:'Learn practical fighting fundamentals.',cost:5000,durationSeconds:8*60*60,levelRequired:10,bonus:{type:'combat',amount:5}},
  {id:'criminal-psychology',name:'Criminal Psychology',description:'Understand how criminals and investigators think.',cost:10000,durationSeconds:12*60*60,levelRequired:15,bonus:{type:'crime',amount:7}},
  {id:'advanced-fitness',name:'Sports Science',description:'Learn how to get more from every training session.',cost:25000,durationSeconds:24*60*60,levelRequired:20,bonus:{type:'gym',amount:10}}
]);
export const getEducationDefinition=id=>EDUCATION_REGISTRY.find(course=>course.id===id)||null;
