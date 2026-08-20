export type OffshoreTier = {
  id: string;
  name: string;
  unlockNetWorth: number;
  cap: number;
  depositFeeRate: number;
  withdrawFeeRate: number;
  hackLossMin: number;
  hackLossMax: number;
  protectionMs: number;
};

export const OFFSHORE_TIERS: OffshoreTier[] = [
  { id:"basic", name:"Island Account", unlockNetWorth:25_000, cap:50_000, depositFeeRate:.06, withdrawFeeRate:.08, hackLossMin:.01, hackLossMax:.03, protectionMs:24*60*60_000 },
  { id:"private", name:"Private Trust", unlockNetWorth:150_000, cap:300_000, depositFeeRate:.045, withdrawFeeRate:.065, hackLossMin:.008, hackLossMax:.025, protectionMs:36*60*60_000 },
  { id:"vault", name:"Offshore Vault", unlockNetWorth:750_000, cap:1_500_000, depositFeeRate:.03, withdrawFeeRate:.05, hackLossMin:.005, hackLossMax:.02, protectionMs:48*60*60_000 },
  { id:"sovereign", name:"Sovereign Network", unlockNetWorth:3_000_000, cap:10_000_000, depositFeeRate:.02, withdrawFeeRate:.04, hackLossMin:.003, hackLossMax:.015, protectionMs:72*60*60_000 },
];

export const BANK_FREEZE_MS = 20 * 60_000;
export const PROPERTY_RENT_INTERVAL = 60 * 60_000;
export const PROPERTY_RISK_INTERVAL = 24 * 60 * 60_000;
export const OFFSHORE_RISK_INTERVAL = 24 * 60 * 60_000;

export const getOffshoreTier = (id:string|null|undefined) => OFFSHORE_TIERS.find(t=>t.id===id) ?? null;

export function rentalGrossPerHour(propertyPrice:number) {
  return Math.max(25, Math.floor(propertyPrice * 0.004));
}

export function rentalUpkeepPerHour(propertyPrice:number) {
  return Math.max(5, Math.floor(rentalGrossPerHour(propertyPrice) * 0.18));
}
