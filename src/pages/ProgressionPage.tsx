import React from "react";
import { Progression } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function ProgressionPage({ g }: PageProps) {
  return <Progression g={g} />;
}
