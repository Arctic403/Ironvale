import React from "react";
import { Park } from "../views/CityServices";
import type { PageProps } from "./types";

export default function ParkPage({ g }: PageProps) {
  return <Park g={g} />;
}
