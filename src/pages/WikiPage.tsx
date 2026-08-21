import React from "react";
import { Wiki } from "../views/Wiki";
import type { PageProps } from "./types";

export default function WikiPage({ g }: PageProps) {
  return <Wiki g={g} />;
}
