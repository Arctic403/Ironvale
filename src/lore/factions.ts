/**
 * RiftCity — Faction seeds
 *
 * These are starting archetypes only. They are deliberately broad
 * so the world can grow without locking V1 into one storyline.
 */

export type FactionSeed = {
  id: string;
  name: string;
  publicFace: string;
  interest: string;
};

export const FACTION_SEEDS: FactionSeed[] = [
  {
    id: "city-authority",
    name: "RiftCity Authority",
    publicFace: "Government, regulation, and public order.",
    interest: "Control the city's stability and access to Rift infrastructure.",
  },
  {
    id: "industrial-consortium",
    name: "Industrial Consortium",
    publicFace: "Infrastructure, manufacturing, and employment.",
    interest: "Control production, logistics, and strategic resources.",
  },
  {
    id: "free-market-network",
    name: "Free Market Network",
    publicFace: "Independent commerce and private enterprise.",
    interest: "Keep trade open and profit from opportunities others overlook.",
  },
  {
    id: "underworld",
    name: "The Underworld",
    publicFace: "A loose network of criminals, brokers, and fixers.",
    interest: "Control information, contraband, and influence outside official systems.",
  },
] as const;
