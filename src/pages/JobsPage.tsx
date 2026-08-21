import React from "react";
import { Jobs } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function JobsPage({ g }: PageProps) {
  return <Jobs g={g} />;
}
