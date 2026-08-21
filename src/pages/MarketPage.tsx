import React from "react";
import { Market } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function MarketPage({ g }: PageProps) {
  return <Market g={g} />;
}
