export interface TabletContextState {
  tradePlayer?: boolean;
  recoveryBag?: boolean;
  storage?: boolean;
  loot?: boolean;
  reliquaryClaim?: boolean;
  reliquaryPreview?: boolean;
  portal?: boolean;
  roleAction?: string | null;
  roadside?: boolean;
  expeditionBoard?: boolean;
  blacksmith?: boolean;
  quiz?: boolean;
  keeper?: boolean;
}

export interface TabletContextAction {
  label: string;
  hold: boolean;
}

export function tabletContextAction(state: TabletContextState): TabletContextAction | null {
  if (state.tradePlayer) return { label: "Player", hold: false };
  if (state.recoveryBag) return { label: "Recover", hold: false };
  if (state.storage) return { label: "Open", hold: false };
  if (state.loot) return { label: "Pick Up", hold: true };
  if (state.reliquaryClaim) return { label: "Choose", hold: false };
  if (state.reliquaryPreview) return { label: "Preview", hold: false };
  if (state.portal) return { label: "Travel", hold: true };
  if (state.roleAction) return { label: state.roleAction, hold: false };
  if (state.roadside) return { label: "Explore", hold: false };
  if (state.expeditionBoard) return { label: "Board", hold: false };
  if (state.blacksmith) return { label: "Trade", hold: false };
  if (state.quiz) return { label: "Play", hold: false };
  if (state.keeper) return { label: "Talk", hold: false };
  return null;
}
