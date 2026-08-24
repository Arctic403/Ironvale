# Safe Bypass React Patch

## What changed
- Replaced the old Safecracking precision-dial interaction with a reusable React `SafeBypassMinigame`.
- Added the 3-wire, 4-wire, and 6-wire circuit-board artwork as normal Vite imports under `src/assets/safe/`.
- Uses percentage-based socket coordinates tied to the 1086x1448 board canvas, so socket hit targets remain aligned as the board scales on desktop and mobile.
- Added live timer, match count, miss count, selection state, matched connection lines, cancel support, and timeout/mismatch failure states.
- Minigame quality feeds back into the existing crime resolution system instead of bypassing it:
  - Perfect: strong success/reward bonus and small Heat reduction.
  - Clean: moderate success/reward bonus.
  - Rough: small bonus with extra Heat.
  - Failed: success/reward penalty and extra Heat.
- Safecracking now has three progression tiers so all three boards are used:
  - Office Safe — 3 wires
  - Business Safe — 4 wires
  - Private Vault — 6 wires
- Added responsive styling in `src/styles/47-safe-bypass.css`.

## Integration notes
- The minigame remains fictional and does not model a real safe-opening method.
- Nerve, required items, mastery, rewards, Heat, activity feedback, and crime-family progression still resolve through the existing `runCrimeCareerAction` pipeline.
- The active safe card expands to full width so the board is usable on desktop while remaining mobile responsive.

## Validation
- ZIP/project structure and the existing React/Vite architecture were audited before integration.
- A full local Vite build could not be completed in the patch environment because project dependencies were not installed and package installation timed out. The patch was kept within the existing React/Vite/TypeScript patterns and does not introduce a new dependency.
