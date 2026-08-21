import React from "react";
import { Character } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function CharacterPage({ g }: PageProps) {
  return <Character g={g} />;
}
