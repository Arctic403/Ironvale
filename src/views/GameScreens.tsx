import type { useRiftCity } from "../hooks/useRiftCity";

/*
 * Management screens live here:
 * Character, Jobs, Items, Missions, Education,
 * PropertyView, Market, Faction, Awards
 */
export {
  Character,
  Jobs,
  Items,
  Missions,
  Education,
  PropertyView,
  Market,
  Faction,
  Awards,
} from "./ManagementScreens";

/*
 * Activity screens live in their own modules.
 */
export { Crimes } from "./CrimeScreen";
export { Combat } from "./CombatScreen";
export { GymView } from "./GymScreen";

export type Game = ReturnType<typeof useRiftCity>;
