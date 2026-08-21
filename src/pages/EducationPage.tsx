import React from "react";
import { Education } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function EducationPage({ g }: PageProps) {
  return <Education g={g} />;
}
