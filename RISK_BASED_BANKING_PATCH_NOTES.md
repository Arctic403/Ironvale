# RiftCity Risk-Based Banking Patch

## Money exposure
- Cash on hand is the most exposed money pool.
- Arrests can remove roughly 3–8% of carried cash.
- Critical crime failures can remove roughly 2–6% of carried cash.
- Spooked crime attempts can drop up to roughly 1.5% of carried cash.

## Checking
- Checking has a progression-based protected allowance.
- Base protected allowance is $5,000.
- Lifetime deposits gradually increase the allowance, capped at $100,000.
- Only the amount above the allowance is exposed to periodic fraud/seizure events.
- Heat raises the chance of an exposure event.

## Savings
- Savings has a larger protected allowance: $20,000 base, scaling with lifetime deposits to $500,000.
- Excess savings have a lower periodic exposure chance than checking.
- Moving savings back to checking costs a 2% early-access fee (minimum $10, capped at the transferred amount).

## Investments
- Investment tiers no longer guarantee positive returns.
- Each tier has a target return plus a possible downside/upside range.
- Higher tiers carry larger potential gains and larger possible losses.
- Realized return is rolled at maturity and recorded in the bank ledger.

## Persistence
- Existing saves migrate automatically with `bankRiskLastCheck` and `bankLosses` defaults.
- Existing bank, savings, investments and transaction history remain intact.
