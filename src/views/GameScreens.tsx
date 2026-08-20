import type { useRiftCity } from "../hooks/useRiftCity";

/*
 * Management screens
 */
export {
  Character,
  Jobs,
  Inventory,
  Shops,
  Missions,
  Education,
  PropertyView,
  Market,
  Faction,
  Awards,
  Progression,
} from "./ManagementScreens";

/*
 * Activity screens
 */
export { Crimes } from "./CrimeScreen";
export { Combat } from "./CombatScreen";
export { GymView } from "./GymScreen";

export type Game =
  ReturnType<typeof useRiftCity>;
