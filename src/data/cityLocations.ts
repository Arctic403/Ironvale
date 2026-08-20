export type CityScreen =
  | "character"
  | "gym"
  | "inventory"
  | "shops"
  | "jobs"
  | "education"
  | "crimes"
  | "combat"
  | "missions"
  | "property"
  | "market"
  | "bank"
  | "hospital"
  | "jail"
  | "police"
  | "pharmacy"
  | "casino"
  | "nightclub"
  | "blackmarket"
  | "park"
  | "downtown"
  | "airport";

export type CityLocation = {
  id: string;
  name: string;
  icon: string;
  description: string;
  district: string;
  screen?: CityScreen;
  x: string;
  y: string;
};

export const CITY_LOCATIONS: CityLocation[] = [
  // =========================================================
  // NORTHSIDE
  // =========================================================

  {
    id: "hospital",
    name: "RiftCity Hospital",
    icon: "🏥",
    description:
      "Medical treatment and recovery after serious injuries.",
    district: "Medical District",
    screen: "hospital",
    x: "18%",
    y: "19%",
  },

  {
    id: "police",
    name: "RiftCity Police Department",
    icon: "🚔",
    description:
      "Law enforcement, wanted records, and city security.",
    district: "Northside",
    screen: "police",
    x: "38%",
    y: "12%",
  },

  {
    id: "bank",
    name: "RiftCity Bank",
    icon: "🏦",
    description:
      "Store your cash safely and manage your bank balance.",
    district: "Financial District",
    screen: "bank",
    x: "58%",
    y: "18%",
  },

  {
    id: "university",
    name: "Rift University",
    icon: "🎓",
    description:
      "Take courses and improve your character through education.",
    district: "University District",
    screen: "education",
    x: "74%",
    y: "18%",
  },

  // =========================================================
  // CENTRAL DISTRICT
  // =========================================================

  {
    id: "park",
    name: "Central Park",
    icon: "🌳",
    description:
      "The central green space of RiftCity.",
    district: "Central District",
    screen: "park",
    x: "51%",
    y: "39%",
  },

  {
    id: "property",
    name: "RiftCity Homes",
    icon: "🏠",
    description:
      "Browse properties and purchase a better home.",
    district: "Residential District",
    screen: "property",
    x: "19%",
    y: "42%",
  },

  {
    id: "jobs",
    name: "Employment Center",
    icon: "💼",
    description:
      "Find work, build your career, and earn a living.",
    district: "Business District",
    screen: "jobs",
    x: "78%",
    y: "40%",
  },

  {
    id: "downtown",
    name: "Downtown",
    icon: "📍",
    description:
      "The heart of RiftCity, filled with businesses, people, and activity.",
    district: "Downtown",
    screen: "downtown",
    x: "52%",
    y: "57%",
  },

  {
    id: "pharmacy",
    name: "RiftCare Pharmacy",
    icon: "💊",
    description:
      "Purchase medical supplies, recovery items, and other essentials.",
    district: "Medical District",
    screen: "pharmacy",
    x: "34%",
    y: "48%",
  },

  {
    id: "casino",
    name: "The Rift Casino",
    icon: "🎰",
    description:
      "A high-stakes entertainment venue where fortune can change quickly.",
    district: "Entertainment District",
    screen: "casino",
    x: "68%",
    y: "51%",
  },

  {
    id: "nightclub",
    name: "Pulse Nightclub",
    icon: "🎵",
    description: "Music, dancing, social events, reputation, and VIP nightlife progression.",
    district: "Entertainment District",
    screen: "nightclub",
    x: "63%",
    y: "61%",
  },

  // =========================================================
  // EAST MARKET
  // =========================================================

  {
    id: "shops",
    name: "RiftCity Shops",
    icon: "🛒",
    description:
      "Weapons, equipment, consumables, and everyday supplies.",
    district: "Commercial District",
    screen: "shops",
    x: "81%",
    y: "62%",
  },

  {
    id: "market",
    name: "RiftCity Market",
    icon: "📈",
    description:
      "Trade goods and commodities at constantly changing prices.",
    district: "Market District",
    screen: "market",
    x: "82%",
    y: "84%",
  },

  {
    id: "black-market",
    name: "The Black Market",
    icon: "🕶️",
    description:
      "An underground marketplace dealing in restricted and hard-to-find goods.",
    district: "East Market",
    screen: "blackmarket",
    x: "91%",
    y: "47%",
  },

  // =========================================================
  // SOUTHSIDE
  // =========================================================

  {
    id: "gym",
    name: "Rift Fitness",
    icon: "🏋️",
    description:
      "Train your physical combat statistics and become stronger.",
    district: "Industrial District",
    screen: "gym",
    x: "19%",
    y: "65%",
  },

  {
    id: "jail",
    name: "RiftCity Jail",
    icon: "🔒",
    description:
      "The city's detention facility for criminals awaiting release.",
    district: "Justice District",
    screen: "jail",
    x: "35%",
    y: "72%",
  },

  {
    id: "crime",
    name: "The Underground",
    icon: "🕵️",
    description:
      "Commit crimes, take risks, and build criminal experience.",
    district: "Underground District",
    screen: "crimes",
    x: "18%",
    y: "84%",
  },

  {
    id: "combat",
    name: "Combat District",
    icon: "⚔️",
    description:
      "Challenge other players and prove yourself in combat.",
    district: "Combat District",
    screen: "combat",
    x: "51%",
    y: "82%",
  },

  {
    id: "missions",
    name: "Mission Headquarters",
    icon: "🎯",
    description:
      "Accept missions, complete objectives, and earn rewards.",
    district: "Operations District",
    screen: "missions",
    x: "67%",
    y: "73%",
  },

  // =========================================================
  // TRAVEL
  // =========================================================

  {
    id: "airport",
    name: "RiftCity International Airport",
    icon: "✈️",
    description:
      "Travel to other cities and eventually connect RiftCity to the wider world.",
    district: "Airport District",
    screen: "airport",
    x: "88%",
    y: "15%",
  },
];
