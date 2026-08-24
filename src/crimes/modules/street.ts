import type { CrimeCareerAction, CrimeCareerDefinition } from "../core/types";

const action = (value: CrimeCareerAction) => value;

export const STREET_CRIMES: CrimeCareerDefinition[] = [
  { id:"graffiti", name:"Graffiti", description:"Tag increasingly visible locations to build Street Reputation and Street Art mastery.", family:"street", mode:"graffiti", icon:"spray", unlockCrimeExperience:12, baseNerve:1, risk:"LOW" }
];
