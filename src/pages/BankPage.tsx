import React from "react";
import { Bank } from "../views/CityServices";
import type { PageProps } from "./types";

export default function BankPage({ g }: PageProps) {
  return <Bank g={g} />;
}
