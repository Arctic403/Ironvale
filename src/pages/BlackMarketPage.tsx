import React from "react";
import { BlackMarket } from "../views/CityServices";
import type { PageProps } from "./types";

export default function BlackMarketPage({ g }: PageProps) {
  return <BlackMarket g={g} />;
}
