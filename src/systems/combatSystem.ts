import {
  CombatStats,
} from "./progressionSystem";

export type CombatDifficulty =
  | "easy"
  | "fair"
  | "dangerous"
  | "very-dangerous";

export type Opponent = {
  id: string;
  name: string;
  description: string;
  health: number;
  stats: CombatStats;
  rewardCash: number;
  rewardXp: number;
};

export type CombatResult =
  | "victory"
  | "defeat";

export const OPPONENTS: Opponent[] = [
  {
    id: "danny-dents",
    name: 'Danny "Dents" Walsh',
    description:
      "A small-time street hustler who picked the wrong neighborhood.",
    health: 75,
    stats: {
      strength: 7,
      defense: 5,
      speed: 6,
      dexterity: 5,
    },
    rewardCash: 100,
    rewardXp: 15,
  },

  {
    id: "rico-santos",
    name: "Rico Santos",
    description:
      "A quick-handed thief who spends most of his nights looking for easy targets.",
    health: 85,
    stats: {
      strength: 9,
      defense: 7,
      speed: 10,
      dexterity: 8,
    },
    rewardCash: 150,
    rewardXp: 20,
  },

  {
    id: "mike-scrap-turner",
    name: 'Mike "Scrap" Turner',
    description:
      "A neighborhood brawler who has been in more fights than he can remember.",
    health: 95,
    stats: {
      strength: 13,
      defense: 11,
      speed: 9,
      dexterity: 10,
    },
    rewardCash: 225,
    rewardXp: 25,
  },

  {
    id: "jayden-cross",
    name: "Jayden Cross",
    description:
      "Fast, aggressive, and always looking for someone weaker than himself.",
    health: 105,
    stats: {
      strength: 15,
      defense: 12,
      speed: 17,
      dexterity: 15,
    },
    rewardCash: 300,
    rewardXp: 30,
  },

  {
    id: "tommy-vex",
    name: "Tommy Vex",
    description:
      "A local enforcer with enough experience to make beginners nervous.",
    health: 120,
    stats: {
      strength: 20,
      defense: 17,
      speed: 16,
      dexterity: 19,
    },
    rewardCash: 400,
    rewardXp: 35,
  },

  {
    id: "marcus-knuckles-reed",
    name: 'Marcus "Knuckles" Reed',
    description:
      "A veteran street fighter with a reputation for never backing down.",
    health: 135,
    stats: {
      strength: 27,
      defense: 24,
      speed: 21,
      dexterity: 23,
    },
    rewardCash: 550,
    rewardXp: 45,
  },

  {
    id: "maya-switch-carter",
    name: 'Maya "Switch" Carter',
    description:
      "Quick on her feet and extremely difficult to predict.",
    health: 145,
    stats: {
      strength: 25,
      defense: 22,
      speed: 34,
      dexterity: 31,
    },
    rewardCash: 700,
    rewardXp: 50,
  },

  {
    id: "eddie-graves",
    name: "Eddie Graves",
    description:
      "A former amateur fighter who never really left the ring behind.",
    health: 160,
    stats: {
      strength: 35,
      defense: 31,
      speed: 29,
      dexterity: 32,
    },
    rewardCash: 850,
    rewardXp: 60,
  },

  {
    id: "big-tony-russo",
    name: 'Big Tony Russo',
    description:
      "Slow, powerful, and built like a brick wall.",
    health: 185,
    stats: {
      strength: 48,
      defense: 52,
      speed: 27,
      dexterity: 30,
    },
    rewardCash: 1100,
    rewardXp: 70,
  },

  {
    id: "chris-ace",
    name: 'Chris "Ace" Morgan',
    description:
      "A disciplined fighter who rarely makes the same mistake twice.",
    health: 200,
    stats: {
      strength: 44,
      defense: 39,
      speed: 45,
      dexterity: 48,
    },
    rewardCash: 1400,
    rewardXp: 80,
  },

  {
    id: "damien-cole",
    name: "Damien Cole",
    description:
      "A serious competitor who has spent years training for street combat.",
    health: 220,
    stats: {
      strength: 58,
      defense: 51,
      speed: 55,
      dexterity: 57,
    },
    rewardCash: 1750,
    rewardXp: 90,
  },

  {
    id: "nate-briggs",
    name: "Nate Briggs",
    description:
      "A heavily trained fighter who specializes in overpowering opponents.",
    health: 245,
    stats: {
      strength: 73,
      defense: 68,
      speed: 51,
      dexterity: 58,
    },
    rewardCash: 2200,
    rewardXp: 100,
  },

  {
    id: "victor-shaw",
    name: "Victor Shaw",
    description:
      "A balanced fighter with almost no obvious weakness.",
    health: 270,
    stats: {
      strength: 72,
      defense: 70,
      speed: 71,
      dexterity: 69,
    },
    rewardCash: 2800,
    rewardXp: 115,
  },

  {
    id: "andre-knox",
    name: "Andre Knox",
    description:
      "A brutal underground fighter known for ending matches quickly.",
    health: 300,
    stats: {
      strength: 91,
      defense: 83,
      speed: 76,
      dexterity: 81,
    },
    rewardCash: 3500,
    rewardXp: 130,
  },

  {
    id: "mason-black",
    name: "Mason Black",
    description:
      "An experienced combatant who has made a career out of beating stronger people.",
    health: 335,
    stats: {
      strength: 96,
      defense: 92,
      speed: 94,
      dexterity: 90,
    },
    rewardCash: 4500,
    rewardXp: 150,
  },

  {
    id: "roman-vale",
    name: "Roman Vale",
    description:
      "A feared fighter who controls several underground gyms.",
    health: 375,
    stats: {
      strength: 118,
      defense: 110,
      speed: 105,
      dexterity: 112,
    },
    rewardCash: 5750,
    rewardXp: 175,
  },

  {
    id: "kane-mercer",
    name: "Kane Mercer",
    description:
      "A professional-level fighter who rarely loses.",
    health: 420,
    stats: {
      strength: 142,
      defense: 135,
      speed: 130,
      dexterity: 138,
    },
    rewardCash: 7000,
    rewardXp: 200,
  },

  {
    id: "the-ghost",
    name: "The Ghost",
    description:
      "Nobody seems to know who The Ghost really is. Nobody wants to find out.",
    health: 475,
    stats: {
      strength: 170,
      defense: 155,
      speed: 190,
      dexterity: 180,
    },
    rewardCash: 9000,
    rewardXp: 225,
  },

  {
    id: "the-warden",
    name: "The Warden",
    description:
      "A legendary fighter who has spent years dominating RiftCity's underground.",
    health: 540,
    stats: {
      strength: 205,
      defense: 220,
      speed: 185,
      dexterity: 195,
    },
    rewardCash: 12000,
    rewardXp: 250,
  },

  {
    id: "viktor-kane",
    name: "Viktor Kane",
    description:
      "One of the most dangerous people currently walking the streets of RiftCity.",
    health: 625,
    stats: {
      strength: 260,
      defense: 245,
      speed: 275,
      dexterity: 265,
    },
    rewardCash: 17500,
    rewardXp: 300,
  },
];

export function calculateAttackPower(
  stats: CombatStats
): number {
  return (
    stats.strength * 2 +
    stats.speed
  );
}

export function calculateDefensePower(
  stats: CombatStats
): number {
  return (
    stats.defense * 2 +
    stats.dexterity
  );
}

export function calculateCombatPower(
  stats: CombatStats
): number {
  return (
    calculateAttackPower(
      stats
    ) +
    calculateDefensePower(
      stats
    )
  );
}

export function calculateWinChance(
  player: CombatStats,
  opponent: CombatStats
): number {
  const playerPower =
    calculateCombatPower(
      player
    );

  const opponentPower =
    calculateCombatPower(
      opponent
    );

  /*
   * Smooth percentage curve.
   *
   * This prevents extremely weak
   * opponents from becoming a
   * guaranteed 100% win and prevents
   * extremely strong opponents from
   * becoming completely impossible.
   */
  const ratio =
    playerPower /
    Math.max(
      1,
      opponentPower
    );

  let chance =
    50 +
    (ratio - 1) * 45;

  return Math.max(
    5,
    Math.min(
      95,
      chance
    )
  );
}

export function getCombatDifficulty(
  player: CombatStats,
  opponent: CombatStats
): CombatDifficulty {
  const playerPower =
    calculateCombatPower(
      player
    );

  const opponentPower =
    calculateCombatPower(
      opponent
    );

  const ratio =
    playerPower /
    Math.max(
      1,
      opponentPower
    );

  if (ratio >= 1.35) {
    return "easy";
  }

  if (ratio >= 0.90) {
    return "fair";
  }

  if (ratio >= 0.65) {
    return "dangerous";
  }

  return "very-dangerous";
}

export function getCombatDifficultyLabel(
  difficulty: CombatDifficulty
): string {
  switch (
    difficulty
  ) {
    case "easy":
      return "EASY";

    case "fair":
      return "FAIR";

    case "dangerous":
      return "DANGEROUS";

    case "very-dangerous":
      return "VERY DANGEROUS";
  }
}

export function resolveCombat(
  player: CombatStats,
  opponent: CombatStats
): CombatResult {
  const chance =
    calculateWinChance(
      player,
      opponent
    );

  return Math.random() * 100 <
    chance
    ? "victory"
    : "defeat";
}
