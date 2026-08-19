export type DistanceZone = "Close" | "Mid" | "Long";
export type Item = { id:string; name:string; description:string; type:"weapon"|"armor"|"medical"|"energy"|"nerve"|"misc"; price:number; effect?:number; optimalRange?:DistanceZone; accuracy?:number; moveCost?:number; coverPenetration?:number };
export type Mission = { id:string; name:string; description:string; requirement:"crime"|"combat"|"gym"|"cash"; target:number; rewardCash:number; rewardXp:number };
export type EducationCourse = { id:string; name:string; description:string; cost:number; durationHours:number; levelRequired:number; bonus:"crime"|"gym"|"combat"|"energy"|"nerve"; bonusAmount:number };
export type Property = { id:string; name:string; description:string; price:number; maxHealthBonus:number; gymBonus:number; nerveBonus:number; maxHappiness:number };
