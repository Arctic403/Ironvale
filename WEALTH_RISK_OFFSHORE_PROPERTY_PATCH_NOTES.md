# Wealth Risk / Offshore / Rental Economy Patch

## Added
- Offshore account progression with four tiers, net-worth unlocks, deposit/withdraw routing fees, caps, and limited percentage hack exposure.
- Offshore breach protection windows. After a successful hostile-player-style breach, the offshore account becomes protected for the tier duration so it cannot be repeatedly farmed.
- Domestic bank freeze state and seizure counter.
- Existing bank exposure events now distinguish account hacks and financial seizures; risky events can temporarily freeze domestic banking.
- Rental property investment portfolio separate from the player's current residence.
- Buy multiple rental units, toggle them for rent, hourly rent payouts, automatic upkeep, portfolio value, lifetime rent, and loss tracking.
- Property risk events tied to Heat and portfolio size: abstract raid/damage/tenant losses, bank freezes, and rare rental-unit seizures.
- Rental income is paid into checking so passive income remains part of the same risk economy.
- Save migration defaults for all new systems so older saves continue loading.

## Economy model
- Cash on hand: fastest access / intended PvP mugging exposure.
- Domestic checking: convenient, protected allowance, excess hack/seizure/freeze exposure.
- Savings: larger protected allowance, early-access fee, lower exposure.
- Investments: term + return risk.
- Rental properties: passive income with upkeep and raid/seizure risk.
- Offshore: strongest protection, but fees, caps, progression requirements, small-percent breach risk, then temporary breach immunity.

## Multiplayer readiness
The offshore breach event is currently represented by the economy simulation. The persisted fields (`offshoreBalance`, tier, protection-until, losses) are separated so a multiplayer server can later replace the simulated hostile event with real player-vs-player hacking resolution without changing the account UI/save model.
