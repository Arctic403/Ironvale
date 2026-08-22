# RiftCity Custom Item Art Overhaul

- Added 68 custom futuristic item images derived from the approved RiftCity concept sheet.
- Added a reusable `ItemImage` component with rarity-aware framing and graceful fallback.
- Inventory and normal Shops now use the new item art instead of generic item icons.
- Black Market listings, Crime Tools, required crime gear, production supplies, and beta sell previews now use the item art.
- Combat weapon labels, attack choices, equipped weapon display, and fighter weapon overlays now use the matching weapon art.
- Crime requirement chips and item gains/losses in inline crime result dialogs now show the matching item art.
- Production recipes now visually show their inputs and output.
- The full generated item atlas is kept in `public/assets/items/_riftcity-item-atlas.webp` as an internal art reference.
- City map assets and map behavior were not modified.
