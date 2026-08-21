import React from "react";
import { Awards } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function AwardsPage({ g }: PageProps) {
  return <Awards g={g} />;
}
