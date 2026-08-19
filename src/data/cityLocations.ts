export type CityLocation = {
  id: string;
  name: string;
  icon: string;
  description: string;
  district: string;
  screen:
    | "character"
    | "gym"
    | "items"
    | "jobs"
    | "education"
    | "crimes"
    | "combat"
    | "missions"
    | "property"
    | "market";
  x: string;
  y: string;
};

export const CITY_LOCATIONS: CityLocation[] = [
  {
    id: "hospital",
    name: "RiftCity Hospital",
    icon: "🏥",
    description: "Medical treatment and recovery after serious injuries.",
    district: "Medical District",
    screen: "character",
    x: "18%",
    y: "19%",
  },

  {
    id: "bank",
    name: "RiftCity Bank",
    icon: "🏦",
    description: "Store your cash safely and manage your bank balance.",
    district: "Financial District",
    screen: "character",
    x: "38%",
    y: "18%",
  },

  {
    id: "university",
    name: "Rift University",
    icon: "🎓",
    description: "Take courses and improve your character.",
    district: "University District",
    screen: "education",
    x: "74%",
    y: "18%",
  },

  {
    id: "property",
    name: "RiftCity Homes",
    icon: "🏠",
    description: "Browse properties and purchase a better home.",
    district: "Residential District",
    screen: "property",
    x: "19%",
    y: "42%",
  },

  {
    id: "park",
    name: "Central Park",
    icon: "🌳",
    description: "The central green space of RiftCity.",
    district: "Central District",
    screen: "character",
    x: "51%",
    y: "39%",
  },

  {
    id: "jobs",
    name: "Employment Center",
    icon: "💼",
    description: "Find work and build your career.",
    district: "Business District",
    screen: "jobs",
    x: "78%",
    y: "40%",
  },

  {
    id: "gym",
    name: "Rift Fitness",
    icon: "🏋️",
    description: "Train your physical combat statistics.",
    district: "Industrial District",
    screen: "gym",
    x: "19%",
    y: "65%",
  },

  {
    id: "downtown",
    name: "Downtown",
    icon: "📍",
    description: "The heart of RiftCity.",
    district: "Downtown",
    screen: "character",
    x: "52%",
    y: "57%",
  },

  {
    id: "shops",
    name: "RiftCity Shops",
    icon: "🛒",
    description: "Weapons, equipment, consumables and supplies.",
    district: "Commercial District",
    screen: "items",
    x: "81%",
    y: "62%",
  },

  {
    id: "crime",
    name: "The Underground",
    icon: "🕵️",
    description: "Commit crimes and build criminal experience.",
    district: "Underground District",
    screen: "crimes",
    x: "18%",
    y: "84%",
  },

  {
    id: "combat",
    name: "Combat District",
    icon: "⚔️",
    description: "Challenge other players to combat.",
    district: "Combat District",
    screen: "combat",
    x: "51%",
    y: "82%",
  },

  {
    id: "market",
    name: "RiftCity Market",
    icon: "📈",
    description: "Trade commodities at dynamic prices.",
    district: "Market District",
    screen: "market",
    x: "82%",
    y: "84%",
  },
];
