import React from "react";
import { City } from "../views/City";
import type { PageProps } from "./types";

export default function CityPage({ g }: PageProps) {
  return <City g={g} />;
}
