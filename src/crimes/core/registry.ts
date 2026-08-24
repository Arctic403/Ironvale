import type { CrimeCareerDefinition, CrimePlugin, CrimePluginUiKind } from "./types";
import { THEFT_CRIME_PLUGINS } from "../modules/theft";
import { STREET_CRIME_PLUGINS } from "../modules/street";
import { BURGLARY_CRIME_PLUGINS } from "../modules/burglary";
import { VEHICLE_CRIME_PLUGINS } from "../modules/vehicle";
import { FRAUD_CRIME_PLUGINS } from "../modules/fraud";
import { CYBER_CRIME_PLUGINS } from "../modules/cyber";
import { ORGANIZED_CRIME_PLUGINS } from "../modules/organized";

// Module order is player-facing order. New crimes are added to their module rather than this screen/router.
const modulePlugins: CrimePlugin[] = [
  ...THEFT_CRIME_PLUGINS,
  ...STREET_CRIME_PLUGINS,
  ...BURGLARY_CRIME_PLUGINS,
  ...VEHICLE_CRIME_PLUGINS,
  ...FRAUD_CRIME_PLUGINS,
  ...CYBER_CRIME_PLUGINS,
  ...ORGANIZED_CRIME_PLUGINS,
];

// Keep the established RiftCity order stable while allowing every definition to live in a plug-in module.
const CRIME_ORDER = [
  "scavenging", "pickpocket", "shoplift", "graffiti", "package-swipe", "locker-theft",
  "burglary", "commercial-burglary", "safecracking", "art-theft",
  "vehicle-theft", "parts-theft", "chop-shop",
  "card-skimming", "email-fraud", "forgery", "counterfeit-run", "identity-fraud", "corporate-fraud",
  "data-breach", "cargo-theft", "black-market-delivery", "smuggling", "protection-racket",
  "underground-gambling", "evidence-cleanup", "robbery", "warehouse-job", "bank-job", "major-heist",
] as const;

const rawById = new Map(modulePlugins.map((plugin) => [plugin.id, plugin]));
export const CRIME_PLUGINS: CrimePlugin[] = CRIME_ORDER.map((id) => {
  const plugin = rawById.get(id);
  if (!plugin) throw new Error(`Crime plugin missing definition: ${id}`);
  return plugin;
});

if (CRIME_PLUGINS.length !== modulePlugins.length) {
  const ordered = new Set<string>(CRIME_ORDER);
  const extra = modulePlugins.find((plugin) => !ordered.has(plugin.id));
  if (extra) throw new Error(`Crime plugin missing from CRIME_ORDER: ${extra.id}`);
}

const pluginMap = new Map<string, CrimePlugin>();
for (const plugin of CRIME_PLUGINS) {
  if (pluginMap.has(plugin.id)) throw new Error(`Duplicate crime plugin id: ${plugin.id}`);
  if (plugin.id !== plugin.definition.id) throw new Error(`Crime plugin id mismatch: ${plugin.id}`);
  pluginMap.set(plugin.id, plugin);
}

export const CRIME_CAREERS: CrimeCareerDefinition[] = CRIME_PLUGINS.map((plugin) => plugin.definition);

export function getCrimePlugin(id: string) {
  return pluginMap.get(id);
}

export function requireCrimePlugin(id: string) {
  const plugin = getCrimePlugin(id);
  if (!plugin) throw new Error(`Unknown crime plugin: ${id}`);
  return plugin;
}

export function getCrimePluginsByUiKind(uiKind: CrimePluginUiKind) {
  return CRIME_PLUGINS.filter((plugin) => plugin.uiKind === uiKind);
}

export function getCrimePluginsByFamily(family: CrimeCareerDefinition["family"]) {
  return CRIME_PLUGINS.filter((plugin) => plugin.definition.family === family);
}

export function validateCrimePlugins() {
  return {
    count: CRIME_PLUGINS.length,
    ids: CRIME_PLUGINS.map((plugin) => plugin.id),
    versions: Object.fromEntries(CRIME_PLUGINS.map((plugin) => [plugin.id, plugin.version])),
  };
}
