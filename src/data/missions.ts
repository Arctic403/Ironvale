import type { Mission } from "./dataTypes";

export const MISSIONS: Mission[] = [
  { id:"first-crime", name:"First Score", description:"Successfully complete your first crime.", requirement:"crime", target:1, rewardCash:500, rewardXp:50, chapter:1 },
  { id:"street-criminal", name:"Street Criminal", description:"Build momentum with 10 successful crimes.", requirement:"crime", target:10, rewardCash:2500, rewardXp:150, chapter:1, prerequisite:"first-crime", rewardPoints:5 },
  { id:"city-runner", name:"Know the Streets", description:"Visit 5 different RiftCity locations.", requirement:"travel", target:5, rewardCash:1200, rewardXp:100, chapter:1, prerequisite:"street-criminal", rewardPoints:5 },
  { id:"fighter", name:"First Blood", description:"Win your first fight.", requirement:"combat", target:1, rewardCash:750, rewardXp:75, chapter:2 },
  { id:"gym-rat", name:"Gym Rat", description:"Complete 10 gym training sessions.", requirement:"gym", target:10, rewardCash:1500, rewardXp:100, chapter:2, prerequisite:"fighter" },
  { id:"working-class", name:"Clocked In", description:"Complete 5 manual work shifts.", requirement:"job", target:5, rewardCash:2500, rewardXp:125, chapter:2, prerequisite:"gym-rat", rewardPoints:10 },
  { id:"faction-face", name:"Make a Name", description:"Reach 100 faction reputation.", requirement:"faction", target:100, rewardCash:4000, rewardXp:200, chapter:3, prerequisite:"working-class", rewardMerits:1 },
  { id:"hot-streak", name:"Too Hot", description:"Reach 50 Heat and survive the attention.", requirement:"heat", target:50, rewardCash:5000, rewardXp:250, chapter:3, prerequisite:"faction-face", rewardPoints:15 },
  { id:"money-maker", name:"Making Money", description:"Accumulate $10,000 cash.", requirement:"cash", target:10000, rewardCash:1000, rewardXp:100, chapter:3, prerequisite:"hot-streak", rewardMerits:1 },
];
