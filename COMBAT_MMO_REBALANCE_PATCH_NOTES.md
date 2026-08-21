# RiftCity Combat MMO Rebalance

## Goals
- Preserve asynchronous / turn-based PvP.
- Make combat presentation feel alive without requiring both players online simultaneously.
- Remove weapon-as-accuracy shortcuts: a knife or expensive gun no longer grants near-perfect hit chance to an untrained player.
- Create long-term weapon specialization appropriate for an MMO.

## Weapon skill progression
Seven persistent skills were added: Unarmed, Blades, Blunt, Handguns, SMGs, Shotguns and Rifles.
Weapon-skill XP is earned when that class is actually used in combat. Hits earn more XP than misses. Skill level is capped at 100 and uses an increasingly slower XP curve.

Accuracy now combines weapon handling, weapon-skill level, Dexterity, opponent Speed, range and cover. Final hit chance is capped at 92% and floored at 8%, so no build becomes perfectly guaranteed.

## Damage balance
- Melee/unarmed scale primarily from Strength.
- Firearms scale only lightly from Dexterity; buying a firearm does not multiply Strength into gun damage.
- Defense and equipped armor reduce incoming damage.
- Weapon skill gives a modest long-term damage bonus capped at 28% rather than runaway scaling.
- Head hits are less extreme than the old 1.8x multiplier.
- Critical multipliers were reduced to prevent random one-turn blowouts.

## Expanded weapons
Added balanced combat definitions and shop items for Heavy Crowbar, Machete, Heavy Pistol, Machine Pistol, Compact SMG, Pump Shotgun, Street Carbine and Rift Rifle, alongside the existing knife, bat, pistol, faction blade and unarmed combat.

## NPC loadouts
Existing test opponents now carry real equipped weapons and skill levels appropriate to their progression instead of silently falling back to unarmed combat.

## Inventory ownership fix
Combat now only exposes weapons the player actually owns in inventory (plus Unarmed). An equipped weapon no longer becomes usable merely because it exists in the global test weapon catalog.

## Visual combat pass
- Header now identifies the mode as TURN-BASED PVP rather than live combat.
- Fighters have idle animation, attack lunges, weapon overlays, hit/crit/miss reactions and smoother health transitions.
- Attack choices show estimated current hit chance, weapon class skill and base damage.
- Reduced-motion accessibility is respected.

All visual sequences occur after/around deterministic turn resolution and do not turn PvP into real-time combat.
