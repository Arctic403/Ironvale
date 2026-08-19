/**
 * RiftCity — Canonical World Foundation
 *
 * This is intentionally a small lore seed, not the entire story.
 * Game systems should build on these concepts without copying
 * another game's characters, locations, text, or worldbuilding.
 */

export const RIFTCITY_WORLD = {
  title: "RiftCity",
  premise:
    "A persistent modern world built around a chain of cities whose economies, factions, and secrets are connected by the phenomenon known as the Rift.",
  playerRole:
    "The player begins as an ordinary resident of RiftCity and earns influence through work, crime, training, education, relationships, business, and risk.",
  homeCity:
    "RiftCity is the player's permanent home base and the starting point of the world.",
  rift:
    "The Rift is a poorly understood phenomenon that changed trade, technology, politics, and the balance of power. Its true origin is intentionally undisclosed at the start of the game.",
  pillars: [
    "A believable everyday life before the deeper mystery is revealed.",
    "A persistent economy where choices create opportunity and risk.",
    "Factions and organizations with competing interests rather than simple good and evil.",
    "A world that expands through destination-based real-time travel.",
    "Long-term consequences that let players build different lives.",
  ],
  loreRules: [
    "RiftCity content must use original names, characters, art, dialogue, and descriptions.",
    "World travel expands the setting instead of turning the home city into a movement map.",
    "The Rift should remain mysterious enough to support years of new content.",
    "Every major system should have an in-world reason to exist.",
  ],
} as const;
