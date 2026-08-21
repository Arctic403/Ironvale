import React from "react";
import { Shops } from "../views/GameScreens";
import type { PageProps } from "./types";

export default function ShopsPage({ g }: PageProps) {
  return <Shops g={g} />;
}
