# RiftCity Animated Combat Stage Patch

## What changed

- Replaced the old player/opponent card presentation with a full-width animated combat stage.
- Kept combat asynchronous and turn based. Turn math is still resolved by the existing combat engine.
- Player and opponent now use lightweight CSS character rigs rather than static person emoji portraits.
- Added different animation families for:
  - Unarmed
  - Blades
  - Blunt weapons
  - Handguns
  - SMGs
  - Shotguns
  - Rifles
- Added wind-up / attack / impact / recovery timing instead of changing health immediately on click.
- Added hit reactions, critical reactions, dodge/miss reactions, knockout animation, muzzle flash, recoil, stage shake, floating damage, and animated health bars.
- Moved the battle feed below the arena and made it collapsible so the fight owns the screen, especially on mobile.
- Kept the existing weapon skills, accuracy, damage, ownership checks, rewards, mug/leave/hospitalize outcomes, and PvP turn logic.
- Added mobile-specific sizing so the animated stage remains readable on iPhone-sized screens.

## Architecture

Animations are presentation only. `executeCombatTurn()` still determines hits, misses, criticals, body-part hits, damage, and final health. The UI calculates the turn result, then animates that result before handing control to the next turn.
