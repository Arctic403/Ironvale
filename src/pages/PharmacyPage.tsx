import React from "react";
import { Pharmacy } from "../views/CityServices";
import type { PageProps } from "./types";

export default function PharmacyPage({ g }: PageProps) {
  return <Pharmacy g={g} />;
}
