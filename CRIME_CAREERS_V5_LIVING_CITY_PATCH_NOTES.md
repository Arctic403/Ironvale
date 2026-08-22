# RiftCity Crime Careers V5 — Living City Crime Pass

## Scavenging
- Search actions now show a short resolving indicator and an on-page result instead of requiring the Activity Log.
- Outcomes now include normal success, empty/failed searches, rare Lucky Finds, and rare Busted outcomes.
- Lucky Find rates respond to real-time opportunity, Scavenging Mastery, and location quality.
- Bust risk responds to location difficulty, current Heat, opportunity, and whether the route is restricted/high-tier.
- Restricted/high-tier busts can produce fines or jail; starter areas keep these outcomes deliberately rare.
- Rare-find pools can award valuable collectibles and fictional RiftCity booster contraband.
- Scavenging cards expose live Lucky Find and Bust rates.

## Pickpocketing
- Removed the scout-first target-board loop for Pickpocketing.
- Added a live pedestrian stream: one NPC passes at a time and leaves on a movement-based timer.
- Waiting and passing targets costs no Nerve; Nerve is spent only on an actual attempt.
- 28 pedestrian archetypes cover city life from homeless/street targets through commuters, workers, runners, cyclists, tourists, nightlife crowds, wealthy shoppers, executives, high rollers, couriers, security personnel and rare elite targets.
- Movement changes the decision window: waiting/strolling targets remain longer, while runners/cyclists can disappear in only a few seconds.
- Real RiftCity time changes the population mix (rush-hour workers/commuters, daytime tourists, nightlife/casino traffic, weekend shifts).
- Mastery progressively reveals target intelligence: wealth at M10, awareness at M25, exact odds/value at M50, danger intel at M75.
- Rare pedestrians can carry special game loot.

## Signature mechanics for other crimes
- Parcel Theft: live delivery-wave opportunity.
- Locker Theft: quiet-window / foot-traffic opportunity.
- Commercial Burglary: actual time-of-day business-hours and patrol window.
- Safecracking: fictional real-time sync meter (pure game timing; no real safe-opening method).
- Art Theft: underground buyer-demand cycle changes value.
- Parts Theft: live parts-demand market changes value.
- Data Theft: abstract security-gap pulse (no real hacking procedure).
- Cargo Theft: manifest-value + patrol-pressure freight window.
- Evidence Cleanup: current Heat feeds evidence pressure and makes cleanup more meaningful.

## Passive crime operations
- Added `risk-build` operation behavior.
- Card Skimming and Underground Gambling can be cashed out before the full timer once minimum value has built.
- Their accrued payout increases with time, while detection pressure also rises.
- Other operations retain fixed completion timers.

## Shared presentation
- Immediate crimes now use a short SEARCHING / ATTEMPTING / WORKING feedback state and show SUCCESS / FAILED / LUCKY FIND / BUSTED directly on the crime page.
- Existing Nerve, Heat, jail, Mastery, crime-family skills, inventory requirements, Black Market items, Street Reputation and save compatibility remain connected.
