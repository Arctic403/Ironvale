export const SKILLS = [
  "strength",
  "endurance",
  "defense",
  "mechanics",
  "awareness",
  "discipline",
  "streetKnowledge",
  "driving",
  "logistics",
  "computing",
  "cybersecurity",
  "analysis",
  "finance",
  "negotiation",
] as const;

export type Skill = (typeof SKILLS)[number];

export type Skills = Record<Skill, number>;

export const EMPTY_SKILLS: Skills = {
  strength: 0,
  endurance: 0,
  defense: 0,
  mechanics: 0,

  awareness: 0,
  discipline: 0,
  streetKnowledge: 0,
  driving: 0,
  logistics: 0,

  computing: 0,
  cybersecurity: 0,
  analysis: 0,

  finance: 0,
  negotiation: 0,
};

export const SKILL_LABELS: Record<Skill, string> = {
  strength: "Strength",
  endurance: "Endurance",
  defense: "Defense",
  mechanics: "Mechanics",

  awareness: "Awareness",
  discipline: "Discipline",
  streetKnowledge: "Street Knowledge",
  driving: "Driving",
  logistics: "Logistics",

  computing: "Computing",
  cybersecurity: "Cybersecurity",
  analysis: "Analysis",

  finance: "Finance",
  negotiation: "Negotiation",
};

export function skillLabel(skill: Skill) {
  return SKILL_LABELS[skill];
}

export function meetsSkillRequirements(
  skills: Skills,
  requirements: Partial<Skills>
) {
  return Object.entries(requirements).every(
    ([skill, required]) =>
      skills[skill as Skill] >= Number(required)
  );
}

export function clampSkill(value: number) {
  return Math.max(
    0,
    Math.min(100, value)
  );
}
