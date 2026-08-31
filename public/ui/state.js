export const state = {
  authenticated: false,
  user: null,
  character: null,
  profile: null,
  needsCharacterCreation: false,
  creationOptions: null,
  world: null,
  journal: null,
  inventory: null,
  equipment: null,
  sync: null,
  route: null,
  activeRequest: 0,
  inlineMessage: null
};

export function setCharacter(character) { if (character) state.character = character; }
export function clearState() {
  state.authenticated = false; state.user = null; state.character = null; state.profile = null;
  state.needsCharacterCreation = false; state.creationOptions = null; state.world = null; state.journal = null;
  state.inventory = null; state.equipment = null; state.sync = null;
}
