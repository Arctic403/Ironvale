# RiftCity Multiplayer-Oriented Frontend Systems Patch

## Black Market / Auction House
- Replaced the duplicate NPC weapon shop with a player-listing exchange.
- Added listing records with seller, item, quantity, unit price, and timestamp.
- Players can list owned items, pay a 3% listing fee, cancel their own listings, and buy other listings.
- Added seeded example sellers/listings to demonstrate the multiplayer-facing UI before a real backend exists.
- Purchased seeded listings are removed from the local market state so they cannot be bought repeatedly.
- Search supports item names and seller names.
- RiftCity Shops remain the legal/common NPC storefront.

## Item Expansion
- Added candy/snack consumables with game effects.
- Added fictional contraband items with abstract game-only effects and Heat consequences.
- Added rare collectibles and ultra-rare loot.
- Added dropChance, store classification, contraband flag, and special-effect metadata to items.
- Crime success can now produce rare item drops.
- Added randomized outcomes for special loot items.
- Inventory now displays special effects and contraband classification.

## Crime Overhaul
- Expanded crime list substantially.
- Added three decision approaches to every crime: safe, balanced, and risky.
- Decisions change success chance, reward multiplier, Heat, and mastery XP.
- Added per-crime mastery XP and mastery levels.
- Crime mastery improves future success chance for that specific crime.
- Existing global Crime Experience still unlocks higher-tier crimes.
- Crime cards now show mastery, success chance, nerve, payout range, and risk.

## Gym Overhaul
- Removed the copied gym-upgrade ladder from the active frontend.
- RiftCity now uses one evolving Performance Lab plus a restricted jail facility.
- Added unlockable training programs instead of purchasing better gyms.
- Programs specialize in different stat mixes and energy profiles.
- Added a training consistency streak up to 10.
- Training streaks increase gains depending on the selected program.
- Every training action now shows the current stat, estimated gain, energy cost, and program multiplier.

## HUD Cleanup
- Removed the bottom Stats button.
- Removed the expandable Stats/details control from the top HUD.
- Important player information is now always shown in tiny compact pills at the top:
  Level, XP, Health, Energy, Nerve, Happiness, Cash, Bank, Heat, Points, Merits, Strength, Defense, Speed, and Dexterity.
- Resource pills remain tappable for their detailed resource modal.
- On phones the HUD horizontally scrolls instead of consuming vertical game space.
- Bottom floating controls are now Menu + Log only.

## Save Migration
- Added safe defaults/migration for:
  - crimeMastery
  - activeTrainingProgram
  - trainingStreak
  - lastTrainingAt
  - auctionListings
  - auctionRemovedListingIds
- Existing saves remain compatible.

## Cleanup / Validation
- Removed malformed duplicate `src/    types` path and stray `T` files again.
- Relative import scan: 0 missing.
- CSS brace scan: clean.
- Project-specific TypeScript diagnostics after filtering unavailable React dependency noise: 0.
- Full Vite build was not completed because npm dependency installation timed out in this environment.
