import type { SaveData } from "../types/riftCity";
import { checkingProtectedCap, savingsProtectedCap, investmentRealizedRate } from "../data/banking";
import { getJob, getJobPosition, getJobSkillLevel } from "../data/jobs";
import { PROPERTIES } from "../data/properties";
import { BANK_FREEZE_MS, OFFSHORE_RISK_INTERVAL, PROPERTY_RENT_INTERVAL, PROPERTY_RISK_INTERVAL, getOffshoreTier, rentalGrossPerHour, rentalUpkeepPerHour } from "../data/wealthRisk";
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
        const eventName = Math.random() < .5 ? "account hack" : "financial seizure";
        tx.unshift({ id:`risk-checking-${now}-${i}`, type:"risk", amount:-loss, time:now, note:`Checking ${eventName}` });
        if (Math.random() < .28 + heatFactor*.35) {
          u.bankFrozenUntil = Math.max(u.bankFrozenUntil ?? prev.bankFrozenUntil ?? 0, now + BANK_FREEZE_MS);
        }
        if (eventName === "financial seizure") u.bankSeizures = (u.bankSeizures ?? prev.bankSeizures) + 1;
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


  // Rental portfolio: owned investment units can be toggled on/off for rent. Income lands in checking,
  // keeping passive income useful but still exposed to banking risk.
  if (now - prev.propertyLastRentAt >= PROPERTY_RENT_INTERVAL) {
    const periods = Math.min(168, Math.floor((now - prev.propertyLastRentAt) / PROPERTY_RENT_INTERVAL));
    let netPerPeriod = 0;
    for (const [id, countRaw] of Object.entries(prev.propertyHoldings)) {
      const count = Math.max(0, Number(countRaw) || 0);
      if (!count || !prev.propertyRentalEnabled[id]) continue;
      const property = PROPERTIES.find((p) => p.id === id);
      if (!property || property.price <= 0) continue;
      netPerPeriod += Math.max(0, rentalGrossPerHour(property.price) - rentalUpkeepPerHour(property.price)) * count;
    }
    const earned = netPerPeriod * periods;
    if (earned > 0) {
      const bank = u.bank ?? prev.bank;
      u.bank = bank + earned;
      u.propertyRentEarned = prev.propertyRentEarned + earned;
      u.bankTransactions = [{ id:`rent-${now}`, type:"rent", amount:earned, time:now, note:"Rental portfolio payout (after upkeep)" }, ...(u.bankTransactions ?? prev.bankTransactions)].slice(0,60);
      u.bankHistory = [...(u.bankHistory ?? prev.bankHistory), bank + earned + (u.bankSavings ?? prev.bankSavings)].slice(-40);
    }
    u.propertyLastRentAt = prev.propertyLastRentAt + periods * PROPERTY_RENT_INTERVAL;
    changed = true;
  }

  // Property portfolio risk. High Heat and a larger rental portfolio increase the chance of a raid,
  // freeze, damage bill, or seizure. The simulation is abstract and designed for the game economy.
  if (now - prev.propertyRiskLastCheck >= PROPERTY_RISK_INTERVAL) {
    const checks = Math.min(30, Math.floor((now - prev.propertyRiskLastCheck) / PROPERTY_RISK_INTERVAL));
    let holdings = { ...prev.propertyHoldings };
    let losses = prev.propertyLosses;
    let seizures = u.bankSeizures ?? prev.bankSeizures;
    let frozenUntil = u.bankFrozenUntil ?? prev.bankFrozenUntil;
    let tx = [...(u.bankTransactions ?? prev.bankTransactions)];
    for (let i=0;i<checks;i++) {
      const units = Object.values(holdings).reduce((a,b)=>a+Math.max(0, Number(b)||0),0);
      const heatFactor = Math.max(0, Math.min(1, prev.heat/100));
      if (units > 0 && Math.random() < 0.008 + units*0.002 + heatFactor*0.035) {
        const rentable = Object.entries(holdings).filter(([id,c]) => (Number(c)||0)>0 && PROPERTIES.some(p=>p.id===id && p.price>0));
        if (rentable.length) {
          const [id] = rentable[Math.floor(Math.random()*rentable.length)];
          const prop = PROPERTIES.find(p=>p.id===id)!;
          if (Math.random() < 0.22 + heatFactor*0.28) {
            holdings[id] = Math.max(0, (holdings[id]||0)-1);
            const hit = Math.floor(prop.price*0.35);
            losses += hit;
            seizures += 1;
            frozenUntil = Math.max(frozenUntil||0, now + BANK_FREEZE_MS);
            tx.unshift({id:`property-seizure-${now}-${i}`,type:"risk",amount:-hit,time:now,note:`${prop.name} rental unit seized; bank temporarily frozen`});
          } else {
            const bill = Math.max(100, Math.floor(prop.price*(0.01+Math.random()*0.025)));
            const bank = u.bank ?? prev.bank;
            const paid = Math.min(bank, bill);
            u.bank = bank-paid;
            losses += paid;
            tx.unshift({id:`property-risk-${now}-${i}`,type:"risk",amount:-paid,time:now,note:`${prop.name} raid/damage/tenant loss`});
          }
        }
      }
    }
    u.propertyHoldings = holdings;
    u.propertyLosses = losses;
    u.bankSeizures = seizures;
    u.bankFrozenUntil = frozenUntil;
    u.bankTransactions = tx.slice(0,60);
    u.propertyRiskLastCheck = prev.propertyRiskLastCheck + checks*PROPERTY_RISK_INTERVAL;
    changed = true;
  }

  // Offshore accounts are the strongest store of wealth, but not invulnerable. A successful hostile
  // player-style hack steals only a small percentage and then grants a protection window.
  if (now - prev.offshoreRiskLastCheck >= OFFSHORE_RISK_INTERVAL) {
    const checks = Math.min(30, Math.floor((now - prev.offshoreRiskLastCheck) / OFFSHORE_RISK_INTERVAL));
    let offshore = prev.offshoreBalance;
    let protectedUntil = prev.offshoreProtectedUntil;
    let offshoreLosses = prev.offshoreLosses;
    const tier = getOffshoreTier(prev.offshoreTier);
    let tx = [...(u.bankTransactions ?? prev.bankTransactions)];
    for (let i=0;i<checks;i++) {
      if (!tier || offshore <= 0 || (protectedUntil && protectedUntil > now)) continue;
      const wealthFactor = Math.min(.04, offshore / Math.max(1,tier.cap) * .025);
      if (Math.random() < .012 + wealthFactor) {
        const pct = tier.hackLossMin + Math.random()*(tier.hackLossMax-tier.hackLossMin);
        const loss = Math.max(1, Math.floor(offshore*pct));
        offshore -= loss;
        offshoreLosses += loss;
        protectedUntil = now + tier.protectionMs;
        tx.unshift({id:`offshore-hack-${now}-${i}`,type:"risk",amount:-loss,time:now,note:`Offshore breach: hostile player stole ${(pct*100).toFixed(1)}%; protection activated`});
      }
    }
    u.offshoreBalance = offshore;
    u.offshoreProtectedUntil = protectedUntil;
    u.offshoreLosses = offshoreLosses;
    u.offshoreRiskLastCheck = prev.offshoreRiskLastCheck + checks*OFFSHORE_RISK_INTERVAL;
    u.bankTransactions = tx.slice(0,60);
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
