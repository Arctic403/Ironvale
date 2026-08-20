# RiftCity Mobile Interaction Fix v2.9

- Replaced the mobile Stats toggle with a real independent bottom sheet.
- Stats button now opens/closes a dedicated scrollable stats panel.
- Level badge is now a real button and opens Stats.
- Energy and Health HUD pills are explicit mobile tap targets.
- Menu / Stats / Log are mutually exclusive so overlays no longer stack over one another.
- Activity Log now has its own vertical scroll area.
- Activity Log text is selectable/copyable on touch devices.
- Added iOS momentum scrolling and pan-y touch handling for Log and Stats.
- Fixed mobile overlay z-index and pointer-event ordering.
- Removed malformed duplicate type folder / stray T files if present.
