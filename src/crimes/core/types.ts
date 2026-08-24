import type { GameIconName } from "../../components/GameIcon";
import type { CrimeFamily } from "../../systems/crimeActivities";

export type CrimeCareerMode = "scavenge" | "target" | "shoplift" | "graffiti" | "operation" | "actions" | "major";
export type CrimeCareerTargetKind = "pickpocket" | "burglary" | "vehicle";
export type CrimePluginUiKind = "scavenge" | "pickpocket" | "target" | "shoplift" | "graffiti" | "operation" | "actions" | "major";

export type CrimeCareerAction = {
  id: string;
  name: string;
  description: string;
  nerve: number;
  difficulty: number;
  minReward: number;
  maxReward: number;
  heat: number;
  masteryRequired?: number;
  streetRepRequired?: number;
  requiredItems?: string[];
  recommendedItems?: string[];
  rewardType?: "cash" | "heat-reduction" | "street-rep";
};

export type CrimeCareerDefinition = {
  id: string;
  name: string;
  description: string;
  family: CrimeFamily;
  mode: CrimeCareerMode;
  icon: GameIconName;
  unlockCrimeExperience: number;
  baseNerve: number;
  risk: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  targetKind?: CrimeCareerTargetKind;
  operationIds?: string[];
  legacyCrimeId?: string;
  actions?: CrimeCareerAction[];
};

export type CrimePlugin = {
  id: string;
  definition: CrimeCareerDefinition;
  uiKind: CrimePluginUiKind;
  version: number;
  tags: string[];
};

export type ScavengeLocation = {
  id: string;
  name: string;
  district: string;
  description: string;
  masteryRequired: number;
  nerve: number;
  difficulty: number;
  minReward: number;
  maxReward: number;
  heat: number;
  lootHint: string;
  requiredItems?: string[];
  opportunityProfile: "downtown" | "transit" | "rail" | "nightclub" | "harbor" | "casino" | "estate" | "luxury";
  peakLabel: string;
  lootIds?: string[];
  lootChanceBonus?: number;
};

export type ShopliftItem = {
  id: string;
  name: string;
  value: number;
  severity: 1 | 2 | 3 | 4 | 5;
  masteryRequired: number;
  requiredItems?: string[];
};

export type ShopliftStore = {
  id: string;
  name: string;
  district: string;
  description: string;
  masteryRequired: number;
  baseSecurity: number;
  items: ShopliftItem[];
};

export type ShopliftConditions = {
  crowd: "EMPTY" | "QUIET" | "NORMAL" | "BUSY" | "PACKED";
  security: "CAMERAS OFFLINE" | "PARTIAL" | "NORMAL" | "HIGH" | "LOCKDOWN";
  staffing: "UNDERSTAFFED" | "NORMAL" | "EXTRA STAFF" | "SECURITY PRESENT";
  opportunity: number;
  suspicionModifier: number;
  payoutMultiplier: number;
};
