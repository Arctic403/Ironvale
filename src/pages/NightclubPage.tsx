import React from "react";
import { Nightclub } from "../views/CityServices";
import type { PageProps } from "./types";

export default function NightclubPage({ g }: PageProps) {
  return <Nightclub g={g} />;
}
