# Pickpocket Live System Patch

## New gameplay loop
- Live pedestrians continue to spawn according to RiftCity time-of-day weighting.
- Each pedestrian now exposes 1–3 readable behavioral/value clues.
- Player chooses one of four abstract approaches: Blend In, Use the Crowd, Create a Distraction, or Quick Move.
- A live Opening meter cycles while the target is on screen.
- Committing snapshots the current timing window and approach fit.
- Timing and approach now modify success chance, reward multiplier, Heat, and arrest pressure.
- Suspicion is shown as LOW / RISING / HIGH / CRITICAL.
- Abort / Let Pass costs no Nerve and immediately rolls a new pedestrian.
- Mastery continues to progressively reveal wealth, awareness, exact odds/value, and danger intel.

## Guard Crackdown
When `activeWorldEvent === "guard-crackdown"` during pickpocketing:
- -6% chance modifier
- +4 arrest-pressure modifier
- +2 Heat on the committed attempt
- +18 suspicion pressure
- Dedicated warning banner in the Pickpocket screen

## Files changed
- `src/systems/crimeV5.ts`
- `src/hooks/useRiftCity.ts`
- `src/views/CrimeScreen.tsx`
- `src/styles/45-crime-careers.css`
