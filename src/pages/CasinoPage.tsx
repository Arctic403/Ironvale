import React from "react";
import { Casino } from "../views/CityServices";
import type { PageProps } from "./types";

export default function CasinoPage({ g }: PageProps) {
  return <Casino g={g} />;
}
