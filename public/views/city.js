import { renderDowntown3D, destroyDowntown3D } from '../downtown3d-foundation.js';

export function destroyCity2D() { destroyDowntown3D(); }
export const destroyIronvaleWorld = destroyDowntown3D;
export async function renderCity(root) { return renderDowntown3D(root); }
