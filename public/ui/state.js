export const state = {
  authenticated:false,
  user:null,
  player:null,
  location:null,
  world:null,
  inventory:null,
  crimes:null,
  route:null,
  selectedLocation:null,
  activeRequest:0,
  serviceCache:new Map(),
  inlineMessage:null
};

export function setPlayer(player) {
  if (player) state.player = player;
}

export function clearState() {
  state.authenticated=false;
  state.user=null;
  state.player=null;
  state.location=null;
  state.world=null;
  state.inventory=null;
  state.crimes=null;
  state.selectedLocation=null;
  state.serviceCache.clear();
}
