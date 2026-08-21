import React from "react";
import { Hospital } from "../views/CityServices";
import type { PageProps } from "./types";

export default function HospitalPage({ g }: PageProps) {
  return <Hospital g={g} />;
}
