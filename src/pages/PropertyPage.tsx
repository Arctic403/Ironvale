import React from "react";
import { PropertyView } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function PropertyPage({ g }: PageProps) {
  return <PropertyView g={g} />;
}
