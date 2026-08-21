import React from "react";
import { Combat } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function CombatPage({ g }: PageProps) {
  return <Combat g={g} />;
}
