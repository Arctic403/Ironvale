import type { Screen } from "../types/riftCity";

export type RouteDefinition = {
  screen: Screen;
  path: string;
  title: string;
  navLabel?: string;
  icon?: string;
};

export const ROUTES: RouteDefinition[] = [
  { screen: "character", path: "/character", title: "Character", navLabel: "Character", icon: "👤" },
  { screen: "city", path: "/city", title: "City", navLabel: "City", icon: "🏙️" },
  { screen: "crimes", path: "/crimes", title: "Crimes", navLabel: "Crimes", icon: "🕵️" },
  { screen: "combat", path: "/combat", title: "Combat", navLabel: "Combat", icon: "⚔️" },
  { screen: "gym", path: "/gym", title: "Gym", navLabel: "Gym", icon: "🏋️" },
  { screen: "jobs", path: "/jobs", title: "Jobs", navLabel: "Jobs", icon: "💼" },
  { screen: "inventory", path: "/inventory", title: "Inventory", navLabel: "Inventory", icon: "🎒" },
  { screen: "shops", path: "/shops", title: "Shops", navLabel: "Shops", icon: "🛒" },
  { screen: "missions", path: "/missions", title: "Missions", navLabel: "Missions", icon: "📜" },
  { screen: "education", path: "/education", title: "Education", navLabel: "Education", icon: "🎓" },
  { screen: "property", path: "/property", title: "Property", navLabel: "Property", icon: "🏠" },
  { screen: "market", path: "/market", title: "Market", navLabel: "Market", icon: "📈" },
  { screen: "faction", path: "/faction", title: "Faction", navLabel: "Faction", icon: "🛡️" },
  { screen: "awards", path: "/awards", title: "Awards", navLabel: "Awards", icon: "🏆" },
  { screen: "progression", path: "/progression", title: "Progression", navLabel: "Progression", icon: "🧬" },
  { screen: "bank", path: "/bank", title: "RiftCity Bank" },
  { screen: "hospital", path: "/hospital", title: "RiftCity Hospital" },
  { screen: "jail", path: "/jail", title: "RiftCity Jail" },
  { screen: "police", path: "/police", title: "Police Department" },
  { screen: "pharmacy", path: "/pharmacy", title: "RiftCare Pharmacy" },
  { screen: "casino", path: "/casino", title: "The Rift Casino" },
  { screen: "nightclub", path: "/nightclub", title: "Pulse Nightclub" },
  { screen: "blackmarket", path: "/black-market", title: "Black Market" },
  { screen: "park", path: "/park", title: "Central Park" },
  { screen: "downtown", path: "/downtown", title: "Downtown" },
  { screen: "airport", path: "/airport", title: "RiftCity Airport" },
];

const SCREEN_TO_ROUTE = new Map(ROUTES.map((route) => [route.screen, route]));
const PATH_TO_SCREEN = new Map(ROUTES.map((route) => [route.path, route.screen]));

export function normalizePath(pathname: string) {
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

export function screenToPath(screen: Screen) {
  return SCREEN_TO_ROUTE.get(screen)?.path ?? "/city";
}

export function pathToScreen(pathname: string): Screen {
  const path = normalizePath(pathname);
  if (path === "/") return "city";
  return PATH_TO_SCREEN.get(path) ?? "city";
}

export function getRouteTitle(screen: Screen) {
  return SCREEN_TO_ROUTE.get(screen)?.title ?? "RiftCity";
}

export function getNavigationRoutes() {
  return ROUTES.filter((route) => route.navLabel && route.icon);
}
