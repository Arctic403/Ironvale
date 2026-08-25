export const DAILY_CHALLENGE_TEMPLATES = Object.freeze([
  {id:'daily-crime',name:'Street Work',metric:'crime',target:3,reward:{cash:450,xp:25}},
  {id:'daily-gym',name:'Training Day',metric:'gym',target:3,reward:{cash:300,xp:25}},
  {id:'daily-job',name:'Clock In',metric:'job',target:2,reward:{cash:400,xp:20}},
  {id:'daily-travel',name:'Move Around',metric:'travel',target:2,reward:{cash:300,xp:20}},
  {id:'daily-combat',name:'Win a Fight',metric:'combat_win',target:1,reward:{cash:500,xp:30}}
]);

export const WEEKLY_CHALLENGE_TEMPLATES = Object.freeze([
  {id:'weekly-crime',name:'City Hustle',metric:'crime',target:20,reward:{cash:3500,xp:150}},
  {id:'weekly-gym',name:'Training Block',metric:'gym',target:20,reward:{cash:2500,xp:150}},
  {id:'weekly-job',name:'Full Week',metric:'job',target:12,reward:{cash:3000,xp:125}},
  {id:'weekly-combat',name:'Fight Card',metric:'combat_win',target:7,reward:{cash:4000,xp:175}},
  {id:'weekly-production',name:'Keep It Running',metric:'production',target:5,reward:{cash:3000,xp:150}}
]);
