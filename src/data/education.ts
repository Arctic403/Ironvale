import type { DistanceZone, Item, Mission, EducationCourse, Property } from "./dataTypes";

export const EDUCATION: EducationCourse[] = [
  {
    id: "street-smarts",
    name: "Street Smarts",
    description:
      "Learn how to keep your head down and spot opportunities.",
    cost: 1000,
    durationHours: 2,
    levelRequired: 1,
    bonus: "crime",
    bonusAmount: 3,
  },

  {
    id: "fitness-basics",
    name: "Fitness Fundamentals",
    description:
      "Learn the basics of effective training.",
    cost: 2500,
    durationHours: 4,
    levelRequired: 5,
    bonus: "gym",
    bonusAmount: 5,
  },

  {
    id: "self-defense",
    name: "Self Defense",
    description:
      "Learn practical fighting techniques.",
    cost: 5000,
    durationHours: 8,
    levelRequired: 10,
    bonus: "combat",
    bonusAmount: 5,
  },

  {
    id: "criminal-psychology",
    name: "Criminal Psychology",
    description:
      "Understand how criminals and investigators think.",
    cost: 10000,
    durationHours: 12,
    levelRequired: 15,
    bonus: "crime",
    bonusAmount: 7,
  },

  {
    id: "advanced-fitness",
    name: "Sports Science",
    description:
      "Learn how to get more from every training session.",
    cost: 25000,
    durationHours: 24,
    levelRequired: 20,
    bonus: "gym",
    bonusAmount: 10,
  },
];


