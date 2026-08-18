# RiftCity baseline audit / patch

Baseline: RiftCityV1-main.zip supplied by user.

Preserved existing architecture and systems. Added:
- Core resource visibility: health, energy, nerve, happiness in top status bar and Character page.
- Resource persistence and offline regeneration remain intact.
- Crime progression now uses crime experience thresholds rather than arbitrary player-level gates.
- Jobs no longer have player-level UI/logic locks; roles are available through employment and pay according to role.
- Education no longer blocks enrollment solely on player level.
- Combat opponents are now persistent-style player profiles with name, level, status, location, health, faction, equipment, bounty and combat stats.
- Combat selection is profile based instead of anonymous NPC archetypes.
- Existing combat energy, hospital, win/loss, rewards and equipment interactions remain wired into the profile system.
- Added src/data/playerProfiles.ts.
- Existing market, faction, awards, daily reward, bank interest, property, gym, education, missions and city systems were preserved.
- Added responsive core-resource grid styling.

Build note:
Dependency installation could not complete in this environment because the npm registry/cache was unavailable, so a production Vite build could not be executed here. The source was inspected and patched directly against the supplied project rather than replacing it with a new application.
