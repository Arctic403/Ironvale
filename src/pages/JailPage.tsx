import React from "react";
import { Jail } from "../views/CityServices";
import type { PageProps } from "./types";

export default function JailPage({ g }: PageProps) {
  return <Jail g={g} />;
}
