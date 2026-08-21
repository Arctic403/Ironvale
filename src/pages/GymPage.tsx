import React from "react";
import { GymView } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function GymPage({ g }: PageProps) {
  return <GymView g={g} />;
}
