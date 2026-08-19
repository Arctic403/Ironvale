import React from "react";
import type { useRiftCity } from "../../hooks/useRiftCity";
import {
  Character,
  Crimes,
  Combat,
  GymView,
  Jobs,
  Items,
  Missions,
  Education,
  PropertyView,
  Market,
  Faction,
  Awards,
} from "../../views/GameScreens";
import { City } from "../../views/City";

type RiftCityGame = ReturnType<typeof useRiftCity>;

type ScreenContentProps = {
  g: RiftCityGame;
};

export function ScreenContent({
  g,
}: ScreenContentProps) {
  switch (g.currentScreen) {
    case "character":
      return <Character g={g} />;

    case "city":
      return <City g={g} />;

    case "crimes":
      return <Crimes g={g} />;

    case "combat":
      return <Combat g={g} />;

    case "gym":
      return <GymView g={g} />;

    case "jobs":
      return <Jobs g={g} />;

    case "items":
      return <Items g={g} />;

    case "missions":
      return <Missions g={g} />;

    case "education":
      return <Education g={g} />;

    case "property":
      return <PropertyView g={g} />;

    case "market":
      return <Market g={g} />;

    case "faction":
      return <Faction g={g} />;

    case "awards":
      return <Awards g={g} />;

    default:
      return null;
  }
}
