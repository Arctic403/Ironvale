import React from "react";
import { Inventory } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function InventoryPage({ g }: PageProps) {
  return <Inventory g={g} />;
}
