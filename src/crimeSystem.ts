import {
  Skill,
  Skills,
  skillLabel,
  meetsSkillRequirements,
} from "./skills";

export type Crime = {
  id: string;

  name: string;

  description: string;

  skills: Skill[];

  requirements: Partial<Skills>;

  difficulty: number;

  energy: number;

  minReward: number;

  maxReward: number;

  xp: number;

  cooldownMinutes: number;
};

export const CRIMES: Crime[] = [
  {
    id: "pickpocket",

    name: "Pickpocket",

    description:
      "Lift something from an unsuspecting target without drawing attention.",

    skills: [
      "awareness",
      "streetKnowledge",
    ],

    requirements: {
      awareness: 0,
    },

    difficulty: 12,

    energy: 5,

    minReward: 20,

    maxReward: 65,

    xp: 7,

    cooldownMinutes: 5,
  },

  {
    id: "shoplift",

    name: "Shoplifting",

    description:
      "Steal merchandise from a small local store.",

    skills: [
      "awareness",
      "streetKnowledge",
    ],

    requirements: {
      awareness: 8,
      streetKnowledge: 5,
    },

    difficulty: 25,

    energy: 8,

    minReward: 45,

    maxReward: 140,

    xp: 12,

    cooldownMinutes: 10,
  },

  {
    id: "burglary",

    name: "Residential Burglary",

    description:
      "Break into a residence and search for valuables.",

    skills: [
      "awareness",
      "streetKnowledge",
      "mechanics",
    ],

    requirements: {
      awareness: 15,
      streetKnowledge: 10,
    },

    difficulty: 42,

    energy: 12,

    minReward: 120,

    maxReward: 360,

    xp: 20,

    cooldownMinutes: 20,
  },

  {
    id: "vehicle-theft",

    name: "Vehicle Theft",

    description:
      "Steal a vehicle using driving and mechanical knowledge.",

    skills: [
      "driving",
      "mechanics",
      "awareness",
    ],

    requirements: {
      driving: 15,
      mechanics: 10,
    },

    difficulty: 48,

    energy: 15,

    minReward: 180,

    maxReward: 500,

    xp: 24,

    cooldownMinutes: 25,
  },

  {
    id: "store-robbery",

    name: "Store Robbery",

    description:
      "A dangerous crime requiring physical control and awareness.",

    skills: [
      "strength",
      "awareness",
      "discipline",
    ],

    requirements: {
      strength: 20,
      awareness: 20,
      discipline: 10,
    },

    difficulty: 65,

    energy: 20,

    minReward: 300,

    maxReward: 850,

    xp: 35,

    cooldownMinutes: 35,
  },

  {
    id: "cyber-intrusion",

    name: "System Intrusion",

    description:
      "Attempt to compromise a poorly secured computer system.",

    skills: [
      "computing",
      "cybersecurity",
      "analysis",
    ],

    requirements: {
      computing: 15,
      cybersecurity: 20,
    },

    difficulty: 58,

    energy: 15,

    minReward: 300,

    maxReward: 1000,

    xp: 40,

    cooldownMinutes: 30,
  },

  {
    id: "major-robbery",

    name: "Major Robbery",

    description:
      "A serious operation requiring physical ability, awareness and discipline.",

    skills: [
      "strength",
      "awareness",
      "discipline",
      "streetKnowledge",
    ],

    requirements: {
      strength: 40,
      awareness: 35,
      discipline: 25,
    },

    difficulty: 85,

    energy: 28,

    minReward: 900,

    maxReward: 2500,

    xp: 65,

    cooldownMinutes: 60,
  },
];

export function crimeUnlocked(
  crime: Crime,
  skills: Skills
) {
  return meetsSkillRequirements(
    skills,
    crime.requirements
  );
}

export function crimeSuccessChance(
  crime: Crime,
  skills: Skills
) {
  const relevant =
    crime.skills.reduce(
      (total, skill) =>
        total + skills[skill],
      0
    ) /
    crime.skills.length;

  return Math.max(
    8,
    Math.min(
      92,
      50 +
        relevant * 0.6 -
        crime.difficulty * 0.35
    )
  );
}

export function formatCrimeSkills(
  crime: Crime
) {
  return crime.skills
    .map(skillLabel)
    .join(" • ");
}
