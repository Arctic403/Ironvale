import React from "react";
import { Faction } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function FactionPage({ g }: PageProps) {
  return <Faction g={g} />;
}
