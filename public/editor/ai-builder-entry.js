import { renderDowntown3D, destroyDowntown3D } from '../downtown3d-foundation.js';
import { mountRiftAiBuilder } from '../rift-ai-builder.js';

let activeBuilder = null;

export async function renderDeveloperAiBuilder(root) {
  activeBuilder?.destroy?.();
  activeBuilder = null;
  const foundation = await renderDowntown3D(root);
  if (!foundation) throw new Error('Rift Engine failed to mount for AI Builder.');
  activeBuilder = mountRiftAiBuilder({ root, foundation });
  return { foundation, builder: activeBuilder };
}

export function destroyDeveloperAiBuilder() {
  activeBuilder?.destroy?.();
  activeBuilder = null;
  destroyDowntown3D();
}
