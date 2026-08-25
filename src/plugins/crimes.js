// Server-owned RiftCity crime careers. Definitions stay abstract/game-mechanical;
// the Worker owns outcomes, rewards, Heat and consequences.
const base=[
 ['street_scavenging','Street Scavenging','Street','scavenging','Search overlooked city spaces for small finds.',1,.86,2,12,4,8,2,4,null],
 ['parcel_theft','Parcel Theft','Theft','target','Grab an unattended fictional delivery target.',2,.69,8,30,8,14,4,7,null],
 ['crowd_pickpocket','Crowd Pickpocket','Theft','pickpocket','Choose a passing target from a rotating crowd stream.',2,.66,10,36,9,15,5,8,null],
 ['retail_lift','Retail Lift','Theft','shoplifting','Read the store conditions and choose when to make an attempt.',3,.63,18,55,11,18,6,10,null],
 ['service_alley_breakin','Service Alley Break-In','Burglary','target','Work a fictional service entrance for a better score.',3,.55,18,58,12,22,7,12,'screwdriver'],
 ['graffiti_run','Graffiti Run','Street','graffiti','Build a recognizable tag across legal game zones while managing attention.',2,.75,6,22,8,14,4,7,null],
 ['garage_parts_score','Garage Parts Score','Vehicle','target','Target unattended fictional vehicle parts in a rotating opportunity board.',4,.52,45,110,18,30,9,14,'screwdriver'],
 ['card_skimming_job','Card Skimming','Fraud','memory','Run an abstract pattern-matching fraud minigame.',4,.50,55,140,20,34,10,16,null],
 ['email_fraud_run','Email Fraud','Fraud','choice','Resolve a fictional social-engineering scenario through branching game choices.',5,.47,80,180,24,38,12,18,null],
 ['signal_trace','Signal Trace','Cyber','memory','Complete an abstract signal-memory sequence before the trace meter fills.',5,.49,90,210,25,42,12,19,null],
 ['cargo_diversion','Cargo Diversion','Organized','operation','Coordinate a fictional cargo diversion with higher Heat and payout.',6,.42,150,360,34,55,16,24,'key'],
 ['crew_score','Crew Score','Organized','choice','Take on a larger multi-stage score with branching risk choices.',7,.38,240,520,42,70,20,30,'ticket']
];
const pools={
 street_scavenging:[['candy_bar',40],['cheap_watch',26],['energy_drink',20],['screwdriver',10],['first_aid_kit',4]],
 parcel_theft:[['candy_bar',28],['energy_drink',24],['cheap_watch',24],['ticket',14],['first_aid_kit',10]],
 service_alley_breakin:[['cheap_watch',35],['first_aid_kit',25],['energy_drink',18],['key',12],['ticket',10]]
};
export const CRIME_REGISTRY=Object.freeze(base.map(([id,name,category,uiType,description,nerveCost,baseChance,cashMin,cashMax,xpMin,xpMax,heatSuccess,heatFailure,requiredItemId])=>({
 id,name,category,uiType,career:category,description,nerveCost,baseChance,cashMin,cashMax,xpMin,xpMax,heatSuccess,heatFailure,
 requiredItemId,requiredLocationId:null,itemChance:pools[id]?.length?.45:0,itemPool:(pools[id]||[]).map(([itemId,weight])=>({itemId,weight,quantity:1})),
 failure:{jailChance:Math.min(.28,.02+nerveCost*.025),hospitalChance:Math.min(.10,.01+nerveCost*.008),minSeconds:30+nerveCost*12,maxSeconds:60+nerveCost*30}
})));
const CRIME_LOOKUP=new Map(CRIME_REGISTRY.map(c=>[c.id,c]));
export const getCrimeDefinition=id=>CRIME_LOOKUP.get(id)||null;
