export type BankInvestmentTier = {
  id: string;
  name: string;
  unlockDeposit: number;
  unlockMs: number;
  cap: number;
  term: number;
  targetRate: number;
  minRate: number;
  maxRate: number;
  riskLabel: string;
};

export const BANK_INVESTMENT_TIERS: BankInvestmentTier[] = [
  { id:"starter", name:"Starter Note", unlockDeposit:0, unlockMs:0, cap:2_000, term:5*60_000, targetRate:.02, minRate:-.01, maxRate:.035, riskLabel:"Low" },
  { id:"growth", name:"Growth Certificate", unlockDeposit:5_000, unlockMs:30*60_000, cap:10_000, term:15*60_000, targetRate:.04, minRate:-.025, maxRate:.065, riskLabel:"Moderate" },
  { id:"prime", name:"Prime Fund", unlockDeposit:25_000, unlockMs:2*60*60_000, cap:50_000, term:30*60_000, targetRate:.07, minRate:-.05, maxRate:.11, riskLabel:"High" },
  { id:"elite", name:"Elite Capital", unlockDeposit:100_000, unlockMs:6*60*60_000, cap:250_000, term:60*60_000, targetRate:.12, minRate:-.10, maxRate:.20, riskLabel:"Very high" },
];

export const SAVINGS_WITHDRAWAL_FEE_RATE = 0.02;
export const SAVINGS_WITHDRAWAL_MIN_FEE = 10;

export function checkingProtectedCap(lifetimeDeposits: number) {
  return Math.min(100_000, 5_000 + Math.floor(Math.max(0, lifetimeDeposits) * 0.10));
}

export function savingsProtectedCap(lifetimeDeposits: number) {
  return Math.min(500_000, 20_000 + Math.floor(Math.max(0, lifetimeDeposits) * 0.25));
}

export function investmentRealizedRate(tierId: string, fallbackTarget: number) {
  const tier = BANK_INVESTMENT_TIERS.find((x) => x.id === tierId);
  if (!tier) return fallbackTarget;
  // Bell-ish distribution: averaging three rolls keeps extreme results rare while preserving downside risk.
  const roll = (Math.random() + Math.random() + Math.random()) / 3;
  return tier.minRate + (tier.maxRate - tier.minRate) * roll;
}
