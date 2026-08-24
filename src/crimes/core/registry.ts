import type { CrimeCareerDefinition, CrimePlugin, CrimePluginUiKind } from "./types";
import { THEFT_CRIMES } from "../modules/theft";
import { STREET_CRIMES } from "../modules/street";
import { BURGLARY_CRIMES } from "../modules/burglary";
import { VEHICLE_CRIMES } from "../modules/vehicle";
import { FRAUD_CRIMES } from "../modules/fraud";
import { CYBER_CRIMES } from "../modules/cyber";
import { ORGANIZED_CRIMES } from "../modules/organized";

const moduleDefinitions: CrimeCareerDefinition[] = [
  ...THEFT_CRIMES,
  ...STREET_CRIMES,
  ...BURGLARY_CRIMES,
  ...VEHICLE_CRIMES,
  ...FRAUD_CRIMES,
  ...CYBER_CRIMES,
  ...ORGANIZED_CRIMES,
];

// Keep the existing player-facing order stable even though definitions now live in family modules.
const CRIME_ORDER = [
  "scavenging", "pickpocket", "shoplift", "graffiti", "package-swipe", "locker-theft",
  "burglary", "commercial-burglary", "safecracking", "art-theft",
  "vehicle-theft", "parts-theft", "chop-shop",
  "card-skimming", "email-fraud", "forgery", "counterfeit-run", "identity-fraud", "corporate-fraud",
  "data-breach", "cargo-theft", "black-market-delivery", "smuggling", "protection-racket",
  "underground-gambling", "evidence-cleanup", "robbery", "warehouse-job", "bank-job", "major-heist",
] as const;

const definitionById = new Map(moduleDefinitions.map((definition) => [definition.id, definition]));
const definitions: CrimeCareerDefinition[] = CRIME_ORDER.map((id) => {
  const definition = definitionById.get(id);
  if (!definition) throw new Error(`Crime plugin missing definition: ${id}`);
  return definition;
});

if (definitions.length !== moduleDefinitions.length) {
  const ordered = new Set(CRIME_ORDER);
  const extra = moduleDefinitions.find((definition) => !ordered.has(definition.id as typeof CRIME_ORDER[number]));
  if (extra) throw new Error(`Crime plugin missing from CRIME_ORDER: ${extra.id}`);
}

function uiKindFor(definition: CrimeCareerDefinition): CrimePluginUiKind {
  if (definition.id === "pickpocket") return "pickpocket";
  return definition.mode;
}

function buildPlugin(definition: CrimeCareerDefinition): CrimePlugin {
  return {
    id: definition.id,
    definition,
    uiKind: uiKindFor(definition),
    version: 1,
    tags: [definition.family, definition.mode, definition.risk.toLowerCase()],
  };
}

export const CRIME_PLUGINS: CrimePlugin[] = definitions.map(buildPlugin);
export const CRIME_CAREERS: CrimeCareerDefinition[] = CRIME_PLUGINS.map((plugin) => plugin.definition);

const pluginMap = new Map<string, CrimePlugin>();
for (const plugin of CRIME_PLUGINS) {
  if (pluginMap.has(plugin.id)) throw new Error(`Duplicate crime plugin id: ${plugin.id}`);
  pluginMap.set(plugin.id, plugin);
}

export function getCrimePlugin(id: string) {
  return pluginMap.get(id);
}

export function requireCrimePlugin(id: string) {
  const plugin = getCrimePlugin(id);
  if (!plugin) throw new Error(`Unknown crime plugin: ${id}`);
  return plugin;
}
