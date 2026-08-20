# Black Market / Production Beta Patch

## Added
- City-scale simulated Black Market with 180 deterministic NPC listings and headline 24h market activity.
- Real-world-named contraband commodities for game-economy use, including weed, speed, ecstasy, Xanax, cocaine, methamphetamine, heroin, LSD and ketamine.
- Fictionalized production supplies and recipes. No real-world manufacturing recipes/components are represented.
- Three beta production facilities with cheap test pricing and short 30–75 second timers.
- Production Attention meter tied to Heat, repeated batch risk, raids, seizures, charges and jail.
- Production batch inventory consumption, timed completion and collection.
- One-use crime tools: gloves, burner phone, disguise, lock bypass kit, jammer, forged badge, escape route and inside tip.
- Crime screen recommended-tool picker; equipped crime tools modify the attempt and are consumed once.
- Black Market supplier shop for crime tools and abstract production supplies.
- Save-data migration defaults for all new beta systems.
- Laying low now also reduces Production Attention.

## Validation
- Parsed all 59 TS/TSX source files with the TypeScript parser: 0 syntax errors.
- A normal Vite production build could not be completed in the patch environment because the submitted ZIP did not include node_modules and dependency installation could not complete there.
