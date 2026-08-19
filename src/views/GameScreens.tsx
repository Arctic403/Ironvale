import type { useRiftCity } from "../hooks/useRiftCity";

/*
 * Management screens
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
 * Activity screens
 */
export { Crimes } from "./CrimeScreen";
export { Combat } from "./CombatScreen";
export { GymView } from "./GymScreen";

export type Game =
  ReturnType<typeof useRiftCity>;
