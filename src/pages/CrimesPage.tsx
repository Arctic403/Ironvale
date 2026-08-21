import React from "react";
import { Crimes } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function CrimesPage({ g }: PageProps) {
  return <Crimes g={g} />;
}
