export type DepthsPoint = { x: number; y: number; z: number };
export const DEPTHS_ROUTE_NODES = [
  { id: "entrance", label: "Entrance", short: "IN", point: { x: 61.5, y: 1, z: 9.5 } },
  { id: "guard-a", label: "North Guard", short: "I", point: { x: 64.5, y: 1, z: 6.5 } },
  { id: "guard-b", label: "South Guard", short: "II", point: { x: 65.5, y: 1, z: 11.5 } },
  { id: "seal", label: "Moonstone Seal", short: "◆", point: { x: 68.5, y: 1, z: 9.5 } },
  { id: "matriarch", label: "Matriarch", short: "♛", point: { x: 72.5, y: 1, z: 9.5 } },
  { id: "extraction", label: "Extraction", short: "↑", point: { x: 75.5, y: 1, z: 9.5 } },
] as const;
export type DepthsNodeId = typeof DEPTHS_ROUTE_NODES[number]["id"];

export interface DepthsRouteState {
  active: DepthsNodeId;
  completed: Set<DepthsNodeId>;
  title: string;
  target: DepthsPoint;
}

export function silverDepthsRoute(runStage: number, guardAAlive: boolean, guardBAlive: boolean): DepthsRouteState | null {
  if (runStage <= 0) return null;
  const completed = new Set<DepthsNodeId>(["entrance"]);
  if (runStage >= 2) completed.add("seal");
  if (runStage >= 3 || !guardAAlive) completed.add("guard-a");
  if (runStage >= 3 || !guardBAlive) completed.add("guard-b");
  if (runStage >= 4) completed.add("matriarch");
  let active: DepthsNodeId = "seal", title = "Break the Moonstone Seal";
  if (runStage === 2) {
    active = guardAAlive ? "guard-a" : guardBAlive ? "guard-b" : "matriarch";
    title = guardAAlive || guardBAlive ? "Defeat the Moonstone Guards" : "Enter the Matriarch Arena";
  } else if (runStage === 3) { active = "matriarch"; title = "Defeat the Crystal Matriarch"; }
  else if (runStage === 4) { active = "matriarch"; title = "Claim Matriarch's Edge"; }
  else if (runStage >= 5) { active = "extraction"; title = "Extract to the Town"; }
  const target = DEPTHS_ROUTE_NODES.find(node => node.id === active)!.point;
  return { active, completed, title, target };
}
