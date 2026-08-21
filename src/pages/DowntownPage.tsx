import React from "react";
import { Downtown } from "../views/CityServices";
import type { PageProps } from "./types";

export default function DowntownPage({ g }: PageProps) {
  return <Downtown g={g} />;
}
