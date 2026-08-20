import type { SaveData } from "../types/riftCity";
import { checkingProtectedCap, savingsProtectedCap, investmentRealizedRate } from "../data/banking";
import { getJob, getJobPosition, getJobSkillLevel } from "../data/jobs";
import {
  BANK_INTEREST_INTERVAL, DEFAULT_MARKET_PRICES, ENERGY_REGEN_INTERVAL,
  HAPPINESS_TICK, HEALTH_REGEN_INTERVAL, JOB_PAY_INTERVAL, JOB_SKILL_INTERVAL,
  MARKET_UPDATE_INTERVAL, NERVE_REGEN_INTERVAL, randomMarketPrice,
} from "../core/gameCore";

export const tickGameState = (
  prev: SaveData,
  now: number,
  ctx: { maxHealth: number; maxNerve: number; maxHappiness: number; maxEnergy: number },
): SaveData => {
  let changed = false;
  const u: Partial<SaveData> = {};

  if (prev.energy < ctx.maxEnergy) {
    const n = Math.floor((now - prev.lastEnergyUpdate) / ENERGY_REGEN_INTERVAL);
    if (n) {
      u.energy = Math.min(ctx.maxEnergy, prev.energy + n);
      u.lastEnergyUpdate = prev.lastEnergyUpdate + n * ENERGY_REGEN_INTERVAL;
      changed = true;
    }
  } else if (prev.lastEnergyUpdate !== now) u.lastEnergyUpdate = now;

  if (prev.nerve < ctx.maxNerve) {
    const n = Math.floor((now - prev.lastNerveUpdate) / NERVE_REGEN_INTERVAL);
    if (n) {
      u.nerve = Math.min(ctx.maxNerve, prev.nerve + n);
      u.lastNerveUpdate = prev.lastNerveUpdate + n * NERVE_REGEN_INTERVAL;
      changed = true;
    }
  } else if (prev.lastNerveUpdate !== now) u.lastNerveUpdate = now;

  if (prev.happiness < ctx.maxHappiness) {
    const n = Math.floor((now - prev.lastHappinessUpdate) / HAPPINESS_TICK);
    if (n) {
      u.happiness = Math.min(ctx.maxHappiness, prev.happiness + n * 5);
      u.lastHappinessUpdate = prev.lastHappinessUpdate + n * HAPPINESS_TICK;
      changed = true;
    }
  } else if (prev.lastHappinessUpdate !== now) u.lastHappinessUpdate = now;

  if (prev.health < ctx.maxHealth && !prev.hospitalUntil && !prev.jailUntil) {
    const medicalRank = prev.propertyUpgrades["medical-room"] ?? 0;
    const n = Math.floor((now - prev.lastHealthUpdate) / HEALTH_REGEN_INTERVAL);
    if (n) {
      u.health = Math.min(ctx.maxHealth, prev.health + n * (1 + medicalRank));
      u.lastHealthUpdate = prev.lastHealthUpdate + n * HEALTH_REGEN_INTERVAL;
      changed = true;
    }
  } else if (prev.health >= ctx.maxHealth) u.lastHealthUpdate = now;

  if (prev.jailUntil && now >= prev.jailUntil) { u.jailUntil = null; changed = true; }
  if (prev.hospitalUntil && now >= prev.hospitalUntil) {
    u.hospitalUntil = null; u.health = ctx.maxHealth; u.lastHealthUpdate = now; changed = true;
  }

  if ((prev.bank > 0 || prev.bankSavings > 0) && now - prev.lastBankInterest >= BANK_INTEREST_INTERVAL) {
    const n = Math.floor((now - prev.lastBankInterest) / BANK_INTEREST_INTERVAL);
    const bonus = (prev.meritUpgrades.banker ?? 0) * 0.002;
    const checkingInterest = Math.floor(prev.bank * (0.01 + bonus) * n);
    const savingsInterest = Math.floor(prev.bankSavings * (0.015 + bonus) * n);
    u.bank = prev.bank + checkingInterest;
    u.bankSavings = prev.bankSavings + savingsInterest;
    u.bankInterest = prev.bankInterest + checkingInterest + savingsInterest;
    u.lastBankInterest = prev.lastBankInterest + n * BANK_INTEREST_INTERVAL;
    u.bankHistory = [...prev.bankHistory, prev.bank + checkingInterest + prev.bankSavings + savingsInterest].slice(-40);
    changed = true;
  }

  const matured = prev.bankInvestments.filter((inv) => now >= inv.maturesAt);
  if (matured.length) {
    let payout = 0;
    let profit = 0;
    const maturityTx = matured.map((inv) => {
      const realizedRate = investmentRealizedRate(inv.tierId, inv.rate);
      const result = Math.max(0, Math.floor(inv.principal * (1 + realizedRate)));
      const gain = result - inv.principal;
      payout += result;
      profit += gain;
      return {
        id: `maturity-${inv.id}-${now}`,
        type: "investment",
        amount: result,
        time: now,
        note: `${inv.tierId} matured at ${(realizedRate * 100).toFixed(1)}% (${gain >= 0 ? "+" : ""}${gain})`,
      };
    });
    const baseBank = u.bank ?? prev.bank;
    u.bank = baseBank + payout;
    u.bankInterest = (u.bankInterest ?? prev.bankInterest) + Math.max(0, profit);
    if (profit < 0) u.bankLosses = (u.bankLosses ?? prev.bankLosses) + Math.abs(profit);
    u.bankInvestments = prev.bankInvestments.filter((inv) => now < inv.maturesAt);
    u.bankTransactions = [...maturityTx, ...(u.bankTransactions ?? prev.bankTransactions)].slice(0, 60);
    u.bankHistory = [...(u.bankHistory ?? prev.bankHistory), baseBank + payout + (u.bankSavings ?? prev.bankSavings)].slice(-40);
    changed = true;
  }

  // Bank exposure check: balances above the protected allowance can be hit by fraud/seizure events.
  // High heat raises the chance, so moving dirty money into the bank is safer than carrying cash but not perfectly safe.
  const riskInterval = 24 * 60 * 60 * 1000;
  if (now - prev.bankRiskLastCheck >= riskInterval) {
    const checks = Math.min(30, Math.floor((now - prev.bankRiskLastCheck) / riskInterval));
    let checking = u.bank ?? prev.bank;
    let savings = u.bankSavings ?? prev.bankSavings;
    let losses = u.bankLosses ?? prev.bankLosses;
    const tx = [...(u.bankTransactions ?? prev.bankTransactions)];
    let riskChanged = false;

    for (let i = 0; i < checks; i++) {
      const heatFactor = Math.max(0, Math.min(1, prev.heat / 100));
      const checkingExposed = Math.max(0, checking - checkingProtectedCap(prev.bankLifetimeDeposits));
      const savingsExposed = Math.max(0, savings - savingsProtectedCap(prev.bankLifetimeDeposits));

      const checkingChance = checkingExposed > 0 ? 0.025 + heatFactor * 0.075 : 0;
      if (Math.random() < checkingChance) {
        const loss = Math.min(checking, Math.max(1, Math.floor(checkingExposed * (0.03 + Math.random() * 0.05))));
        checking -= loss;
        losses += loss;
        tx.unshift({ id:`risk-checking-${now}-${i}`, type:"risk", amount:-loss, time:now, note:"Checking exposure loss (fraud / seizure event)" });
        riskChanged = true;
      }

      const savingsChance = savingsExposed > 0 ? 0.01 + heatFactor * 0.03 : 0;
      if (Math.random() < savingsChance) {
        const loss = Math.min(savings, Math.max(1, Math.floor(savingsExposed * (0.01 + Math.random() * 0.025))));
        savings -= loss;
        losses += loss;
        tx.unshift({ id:`risk-savings-${now}-${i}`, type:"risk", amount:-loss, time:now, note:"Savings exposure loss" });
        riskChanged = true;
      }
    }

    u.bankRiskLastCheck = prev.bankRiskLastCheck + checks * riskInterval;
    if (riskChanged) {
      u.bank = checking;
      u.bankSavings = savings;
      u.bankLosses = losses;
      u.bankTransactions = tx.slice(0,60);
      u.bankHistory = [...(u.bankHistory ?? prev.bankHistory), checking + savings].slice(-40);
    }
    changed = true;
  }

  if (prev.currentJob && now - prev.lastJobPayment >= JOB_PAY_INTERVAL) {
    const job = getJob(prev.currentJob);
    if (job) {
      const n = Math.floor((now - prev.lastJobPayment) / JOB_PAY_INTERVAL);
      const pos = getJobPosition(job, prev.jobSkills);
      u.cash = (u.cash ?? prev.cash) + pos.salary * n;
      u.lastJobPayment = prev.lastJobPayment + n * JOB_PAY_INTERVAL;
      changed = true;
    }
  }

  if (prev.currentJob && now - prev.lastJobSkillUpdate >= JOB_SKILL_INTERVAL) {
    const job = getJob(prev.currentJob);
    if (job) {
      const days = Math.floor((now - prev.lastJobSkillUpdate) / JOB_SKILL_INTERVAL);
      const skills = { ...prev.jobSkills };
      for (const skill of job.skills) {
        const k = `${job.id}:${skill.id}`;
        skills[k] = Math.min(10, (skills[k] ?? 0) + days);
      }
      u.jobSkills = skills;
      u.lastJobSkillUpdate = prev.lastJobSkillUpdate + days * JOB_SKILL_INTERVAL;
      const max = Math.max(...job.skills.map((s) => getJobSkillLevel(skills, job, s.id)));
      u.jobPositionTiers = {
        ...prev.jobPositionTiers,
        [job.id]: ([...job.positions].reverse().find((x) => max >= x.requiredSkillLevel) ?? job.positions[0]).tier,
      };
      changed = true;
    }
  }

  if (now - prev.lastMarketUpdate >= MARKET_UPDATE_INTERVAL) {
    const market = { ...prev.market };
    const history = { ...prev.marketHistory };
    for (const id of Object.keys(DEFAULT_MARKET_PRICES)) {
      market[id] = randomMarketPrice(market[id] ?? DEFAULT_MARKET_PRICES[id]);
      history[id] = [...(history[id] ?? []), market[id]].slice(-12);
    }
    u.market = market;
    u.marketHistory = history;
    u.lastMarketUpdate = now;
    changed = true;
  }

  if (prev.worldEventUntil && now >= prev.worldEventUntil) {
    u.activeWorldEvent = null;
    u.worldEventUntil = null;
    changed = true;
  }

  return changed ? { ...prev, ...u } : prev;
};
