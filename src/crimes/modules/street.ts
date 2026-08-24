import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";
import { defineCrimePlugins } from "../core/plugin";

const action = (value: CrimeCareerAction) => value;

export const STREET_CRIMES: CrimeCareerDefinition[] = [
  { id:"graffiti", name:"Graffiti", description:"Tag increasingly visible locations to build Street Reputation and Street Art mastery.", family:"street", mode:"graffiti", icon:"spray", unlockCrimeExperience:12, baseNerve:1, risk:"LOW" }
];

// Plugin export: the registry consumes plugins, while the *_CRIMES array remains a compatibility/data export.
export const STREET_CRIME_PLUGINS = defineCrimePlugins(STREET_CRIMES);
