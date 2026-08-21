import React from "react";
import { Airport } from "../views/CityServices";
import type { PageProps } from "./types";

export default function AirportPage({ g }: PageProps) {
  return <Airport g={g} />;
}
