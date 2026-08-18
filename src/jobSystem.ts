import {
  Skill,
  Skills,
  EMPTY_SKILLS,
  skillLabel,
  meetsSkillRequirements,
} from "./skills";

export type InterviewQuestion = {
  question: string;

  answers: string[];

  correct: number;
};

export type JobPerk = {
  name: string;
  description: string;
};

export type JobPosition = {
  id: string;

  title: string;

  salary: number;

  requirements: Partial<Skills>;

  perks: JobPerk[];

  description: string;
};

export type Job = {
  id: string;

  company: string;

  title: string;

  description: string;

  skills: Skill[];

  primarySkill: Skill;

  secondarySkills: Skill[];

  positions: JobPosition[];

  interview: InterviewQuestion[];
};

export const EMPTY_JOB_SKILLS = EMPTY_SKILLS;

export const JOBS: Job[] = [
  {
    id: "riftexpress",

    company: "RiftExpress",

    title: "Delivery",

    description:
      "Move packages across RiftCity while learning its streets, routes and logistics network.",

    skills: [
      "driving",
      "logistics",
      "streetKnowledge",
    ],

    primarySkill: "streetKnowledge",

    secondarySkills: [
      "driving",
      "logistics",
    ],

    interview: [
      {
        question:
          "A delivery is running late. What should you do?",

        answers: [
          "Take the fastest safe route you know.",
          "Ignore the delivery.",
          "Wait until tomorrow.",
        ],

        correct: 0,
      },

      {
        question:
          "A customer says their package is damaged.",

        answers: [
          "Hide the damage.",
          "Report it properly.",
          "Blame another driver.",
        ],

        correct: 1,
      },

      {
        question:
          "You are given several deliveries at once.",

        answers: [
          "Deliver them randomly.",
          "Plan an efficient route.",
          "Refuse the deliveries.",
        ],

        correct: 1,
      },
    ],

    positions: [
      {
        id: "delivery-trainee",

        title: "Trainee Courier",

        salary: 55,

        requirements: {},

        perks: [
          {
            name: "Route Familiarity",
            description:
              "+0.5% travel efficiency.",
          },
        ],

        description:
          "Your first step into the delivery industry.",
      },

      {
        id: "courier",

        title: "Courier",

        salary: 70,

        requirements: {
          streetKnowledge: 10,
        },

        perks: [
          {
            name: "Efficient Routes",
            description:
              "+1% travel efficiency.",
          },
        ],

        description:
          "You understand the city's basic routes.",
      },

      {
        id: "senior-courier",

        title: "Senior Courier",

        salary: 90,

        requirements: {
          streetKnowledge: 25,
          logistics: 15,
        },

        perks: [
          {
            name: "Fast Routes",
            description:
              "+2% travel efficiency.",
          },
          {
            name: "Package Sense",
            description:
              "+1% item discovery.",
          },
        ],

        description:
          "You're becoming one of RiftExpress's reliable couriers.",
      },

      {
        id: "route-specialist",

        title: "Route Specialist",

        salary: 120,

        requirements: {
          streetKnowledge: 40,
          logistics: 30,
          driving: 25,
        },

        perks: [
          {
            name: "Master Routes",
            description:
              "+3% travel efficiency.",
          },
          {
            name: "Courier Instinct",
            description:
              "+2% item discovery.",
          },
        ],

        description:
          "A veteran courier trusted with the city's most difficult routes.",
      },
    ],
  },

  {
    id: "riftshield",

    company: "RiftShield Security",

    title: "Security",

    description:
      "Protect businesses and people while developing awareness, discipline and defensive skills.",

    skills: [
      "awareness",
      "discipline",
      "defense",
    ],

    primarySkill: "awareness",

    secondarySkills: [
      "discipline",
      "defense",
    ],

    interview: [
      {
        question:
          "You notice suspicious behaviour outside a business.",

        answers: [
          "Investigate carefully and follow procedure.",
          "Ignore it.",
          "Immediately start a fight.",
        ],

        correct: 0,
      },

      {
        question:
          "A customer becomes aggressive.",

        answers: [
          "Escalate immediately.",
          "Stay calm and de-escalate.",
          "Leave your post.",
        ],

        correct: 1,
      },

      {
        question:
          "Your supervisor gives you a security procedure.",

        answers: [
          "Follow it.",
          "Ignore it.",
          "Make up your own rules.",
        ],

        correct: 0,
      },
    ],

    positions: [
      {
        id: "security-trainee",

        title: "Security Trainee",

        salary: 65,

        requirements: {},

        perks: [
          {
            name: "Watchful",
            description:
              "+0.5% awareness effectiveness.",
          },
        ],

        description:
          "Learn the fundamentals of security.",
      },

      {
        id: "security-guard",

        title: "Security Guard",

        salary: 85,

        requirements: {
          awareness: 10,
        },

        perks: [
          {
            name: "Alert",
            description:
              "+1% crime detection.",
          },
        ],

        description:
          "A dependable security officer.",
      },

      {
        id: "senior-guard",

        title: "Senior Security Officer",

        salary: 110,

        requirements: {
          awareness: 25,
          discipline: 15,
        },

        perks: [
          {
            name: "Sharp Eye",
            description:
              "+2% crime detection.",
          },
          {
            name: "Composed",
            description:
              "+1% penalty resistance.",
          },
        ],

        description:
          "Experienced enough to handle difficult situations.",
      },

      {
        id: "security-specialist",

        title: "Security Specialist",

        salary: 145,

        requirements: {
          awareness: 40,
          discipline: 30,
          defense: 25,
        },

        perks: [
          {
            name: "Threat Assessment",
            description:
              "+3% crime detection.",
          },
          {
            name: "Controlled Response",
            description:
              "+2% penalty resistance.",
          },
        ],

        description:
          "A highly experienced security professional.",
      },
    ],
  },

  {
    id: "ironworks",

    company: "Ironworks Construction",

    title: "Construction",

    description:
      "Build RiftCity while developing strength, endurance and mechanical knowledge.",

    skills: [
      "strength",
      "endurance",
      "mechanics",
    ],

    primarySkill: "strength",

    secondarySkills: [
      "endurance",
      "mechanics",
    ],

    interview: [
      {
        question:
          "You discover unsafe equipment at a work site.",

        answers: [
          "Use it anyway.",
          "Report it and secure the area.",
          "Hide the problem.",
        ],

        correct: 1,
      },

      {
        question:
          "A heavy task requires two people.",

        answers: [
          "Ask for assistance.",
          "Risk doing it alone.",
          "Walk away.",
        ],

        correct: 0,
      },

      {
        question:
          "Your supervisor gives you a safety instruction.",

        answers: [
          "Follow it.",
          "Ignore it.",
          "Do the opposite.",
        ],

        correct: 0,
      },
    ],

    positions: [
      {
        id: "construction-trainee",

        title: "Construction Trainee",

        salary: 60,

        requirements: {},

        perks: [
          {
            name: "Hard Worker",
            description:
              "+0.5% stamina efficiency.",
          },
        ],

        description:
          "Start learning the physical trades.",
      },

      {
        id: "construction-worker",

        title: "Construction Worker",

        salary: 80,

        requirements: {
          strength: 10,
        },

        perks: [
          {
            name: "Conditioned",
            description:
              "+1% energy efficiency.",
          },
        ],

        description:
          "You've developed the strength needed for regular work.",
      },

      {
        id: "skilled-tradesman",

        title: "Skilled Tradesman",

        salary: 105,

        requirements: {
          strength: 25,
          mechanics: 15,
        },

        perks: [
          {
            name: "Built Tough",
            description:
              "+2% energy efficiency.",
          },
          {
            name: "Practical Hands",
            description:
              "+1% equipment effectiveness.",
          },
        ],

        description:
          "You're becoming valuable on difficult jobs.",
      },

      {
        id: "site-specialist",

        title: "Site Specialist",

        salary: 135,

        requirements: {
          strength: 40,
          endurance: 30,
          mechanics: 25,
        },

        perks: [
          {
            name: "Heavy Duty",
            description:
              "+3% energy efficiency.",
          },
          {
            name: "Technical Hands",
            description:
              "+2% equipment effectiveness.",
          },
        ],

        description:
          "A veteran tradesman trusted with complex work.",
      },
    ],
  },

  {
    id: "rifttech",

    company: "RiftTech Solutions",

    title: "Technology",

    description:
      "Maintain systems, analyze networks and develop the technical skills powering RiftCity.",

    skills: [
      "computing",
      "cybersecurity",
      "analysis",
    ],

    primarySkill: "computing",

    secondarySkills: [
      "cybersecurity",
      "analysis",
    ],

    interview: [
      {
        question:
          "A computer suddenly stops responding.",

        answers: [
          "Start randomly deleting files.",
          "Diagnose the problem systematically.",
          "Ignore it.",
        ],

        correct: 1,
      },

      {
        question:
          "You discover a security vulnerability.",

        answers: [
          "Report it.",
          "Sell the information.",
          "Ignore it.",
        ],

        correct: 0,
      },

      {
        question:
          "Two systems are producing conflicting data.",

        answers: [
          "Guess which is correct.",
          "Analyze the source of the discrepancy.",
          "Delete both.",
        ],

        correct: 1,
      },
    ],

    positions: [
      {
        id: "tech-trainee",

        title: "Junior Technician",

        salary: 75,

        requirements: {},

        perks: [
          {
            name: "Technical Foundation",
            description:
              "+0.5% technology effectiveness.",
          },
        ],

        description:
          "Learn the basics of modern systems.",
      },

      {
        id: "technician",

        title: "IT Technician",

        salary: 100,

        requirements: {
          computing: 10,
        },

        perks: [
          {
            name: "System Knowledge",
            description:
              "+1% technology effectiveness.",
          },
        ],

        description:
          "You're trusted to maintain everyday systems.",
      },

      {
        id: "security-technician",

        title: "Security Technician",

        salary: 135,

        requirements: {
          computing: 25,
          cybersecurity: 15,
        },

        perks: [
          {
            name: "Network Sense",
            description:
              "+2% cyber success.",
          },
          {
            name: "System Analysis",
            description:
              "+1% information gathering.",
          },
        ],

        description:
          "You've moved into technical security.",
      },

      {
        id: "cyber-specialist",

        title: "Cybersecurity Specialist",

        salary: 180,

        requirements: {
          computing: 40,
          cybersecurity: 30,
          analysis: 25,
        },

        perks: [
          {
            name: "Cyber Expertise",
            description:
              "+3% cyber success.",
          },
          {
            name: "Deep Analysis",
            description:
              "+2% information gathering.",
          },
        ],

        description:
          "One of RiftCity's most capable technical specialists.",
      },
    ],
  },

  {
    id: "riftcapital",

    company: "Rift Capital",

    title: "Finance",

    description:
      "Analyze money, negotiate deals and learn how RiftCity's economy works.",

    skills: [
      "finance",
      "analysis",
      "negotiation",
    ],

    primarySkill: "finance",

    secondarySkills: [
      "analysis",
      "negotiation",
    ],

    interview: [
      {
        question:
          "A deal looks profitable but carries hidden risk.",

        answers: [
          "Investigate the risk first.",
          "Take the deal immediately.",
          "Ignore the numbers.",
        ],

        correct: 0,
      },

      {
        question:
          "A client disagrees with your proposal.",

        answers: [
          "Listen and negotiate.",
          "End the conversation.",
          "Threaten them.",
        ],

        correct: 0,
      },

      {
        question:
          "Two investments have different risk levels.",

        answers: [
          "Compare their returns and risks.",
          "Choose randomly.",
          "Always choose the bigger number.",
        ],

        correct: 0,
      },
    ],

    positions: [
      {
        id: "finance-trainee",

        title: "Finance Assistant",

        salary: 70,

        requirements: {},

        perks: [
          {
            name: "Money Sense",
            description:
              "+0.5% financial efficiency.",
          },
        ],

        description:
          "Learn the fundamentals of RiftCity's economy.",
      },

      {
        id: "financial-clerk",

        title: "Financial Clerk",

        salary: 95,

        requirements: {
          finance: 10,
        },

        perks: [
          {
            name: "Market Awareness",
            description:
              "+1% marketplace efficiency.",
          },
        ],

        description:
          "You can now handle basic financial operations.",
      },

      {
        id: "financial-analyst",

        title: "Financial Analyst",

        salary: 130,

        requirements: {
          finance: 25,
          analysis: 15,
        },

        perks: [
          {
            name: "Market Analysis",
            description:
              "+2% marketplace efficiency.",
          },
          {
            name: "Deal Sense",
            description:
              "+1% negotiation effectiveness.",
          },
        ],

        description:
          "You understand the numbers behind the city.",
      },

      {
        id: "investment-specialist",

        title: "Investment Specialist",

        salary: 175,

        requirements: {
          finance: 40,
          analysis: 30,
          negotiation: 25,
        },

        perks: [
          {
            name: "Capital Insight",
            description:
              "+3% marketplace efficiency.",
          },
          {
            name: "Negotiator",
            description:
              "+2% negotiation effectiveness.",
          },
        ],

        description:
          "You've become a serious player in RiftCity's financial world.",
      },
    ],
  },
];

export function getJob(
  id: string | null
) {
  if (!id) return undefined;

  return JOBS.find(
    job => job.id === id
  );
}

export function getCurrentPosition(
  job: Job | undefined,
  position: number
) {
  if (!job) return undefined;

  return job.positions[
    Math.min(
      position,
      job.positions.length - 1
    )
  ];
}

export function getNextPromotion(
  job: Job | undefined,
  position: number,
  skills: Skills
) {
  if (!job) return undefined;

  const next =
    job.positions[position + 1];

  if (!next) return undefined;

  return meetsSkillRequirements(
    skills,
    next.requirements
  )
    ? next
    : undefined;
}

export function formatSkillName(
  skill: Skill
) {
  return skillLabel(skill);
}
