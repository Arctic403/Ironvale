import type { CrimeCareerDefinition, CrimePlugin, CrimePluginUiKind } from "./types";

export type CrimePluginOverride = {
  uiKind?: CrimePluginUiKind;
  version?: number;
  tags?: string[];
};

function defaultUiKind(definition: CrimeCareerDefinition): CrimePluginUiKind {
  // Pickpocket uses the target data model but its own interactive renderer.
  if (definition.id === "pickpocket") return "pickpocket";
  return definition.mode;
}

export function defineCrimePlugin(
  definition: CrimeCareerDefinition,
  override: CrimePluginOverride = {},
): CrimePlugin {
  return {
    id: definition.id,
    definition,
    uiKind: override.uiKind ?? defaultUiKind(definition),
    version: override.version ?? 1,
    tags: override.tags ?? [definition.family, definition.mode, definition.risk.toLowerCase()],
  };
}

export function defineCrimePlugins(
  definitions: CrimeCareerDefinition[],
  overrides: Record<string, CrimePluginOverride> = {},
): CrimePlugin[] {
  return definitions.map((definition) => defineCrimePlugin(definition, overrides[definition.id]));
}
