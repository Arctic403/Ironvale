import React from "react";
import { Police } from "../views/CityServices";
import type { PageProps } from "./types";

export default function PolicePage({ g }: PageProps) {
  return <Police g={g} />;
}
