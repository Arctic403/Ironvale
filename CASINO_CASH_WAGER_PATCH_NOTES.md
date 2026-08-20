# Casino cash wagering patch

- Removed the casino 24-hour play/action limit and session cooldown behavior from gameplay/UI.
- Legacy cooldown/window/session values are cleared during save migration.
- Added a persistent casino chip balance with a 75 chip cap/default.
- Casino games now use RiftCity cash wagers and cash payouts.
- Blackjack deducts the selected stake and pays wins/pushes back to cash.
- Rift Wheel now uses cash multipliers.
- Slots now deduct cash stakes and pay winning triples back to cash.
- Rift Downs locks a cash wager with the horse selection and pays winning picks.
- Texas Hold'em now uses a $200 RiftCity cash buy-in; table chips represent that hand bankroll and cash out when the hand ends.
- Updated casino UI copy to remove old play-only/no-cash-value language.
