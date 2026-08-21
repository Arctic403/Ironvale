import React from "react";
import { Missions } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function MissionsPage({ g }: PageProps) {
  return <Missions g={g} />;
}
