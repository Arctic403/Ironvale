export const BANK_INVESTMENT_TIERS = Object.freeze([
  {id:'starter',name:'Starter Note',unlockDeposit:0,cap:2000,termSeconds:5*60,targetRate:.02,minRate:-.01,maxRate:.035,riskLabel:'Low'},
  {id:'growth',name:'Growth Certificate',unlockDeposit:5000,cap:10000,termSeconds:15*60,targetRate:.04,minRate:-.025,maxRate:.065,riskLabel:'Moderate'},
  {id:'prime',name:'Prime Fund',unlockDeposit:25000,cap:50000,termSeconds:30*60,targetRate:.07,minRate:-.05,maxRate:.11,riskLabel:'High'},
  {id:'elite',name:'Elite Capital',unlockDeposit:100000,cap:250000,termSeconds:60*60,targetRate:.12,minRate:-.10,maxRate:.20,riskLabel:'Very high'}
]);
export const SAVINGS_WITHDRAWAL_FEE_RATE=.02;
export const SAVINGS_WITHDRAWAL_MIN_FEE=10;
export const getBankTier=id=>BANK_INVESTMENT_TIERS.find(tier=>tier.id===id)||null;
