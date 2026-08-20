import React from "react";
import type { useRiftCity } from "../../hooks/useRiftCity";

import {
  Character,
  Crimes,
  Combat,
  GymView,
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
} from "../../views/GameScreens";

import { City } from "../../views/City";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type ScreenContentProps = {
  g: RiftCityGame;
};

const SCREEN_COMPONENTS: Record<
  string,
  React.ComponentType<ScreenContentProps>
> = {
  character: Character,
  city: City,
  crimes: Crimes,
  combat: Combat,
  gym: GymView,
  jobs: Jobs,
  inventory: Inventory,
  shops: Shops,
  missions: Missions,
  education: Education,
  property: PropertyView,
  market: Market,
  faction: Faction,
  awards: Awards,
  progression: Progression,
};

export function ScreenContent({
  g,
}: ScreenContentProps) {
  const Screen =
    SCREEN_COMPONENTS[g.currentScreen];

  if (!Screen) {
    return null;
  }

  return <Screen g={g} />;
}
