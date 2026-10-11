import { CRYSTAL_MATRIARCH_HOME, SILVER_DEPTHS_CHECKPOINT_POSITION, SILVER_DEPTHS_ENTRY_POSITION, SILVER_DEPTHS_EXIT_POSITION, SILVER_DEPTHS_MOONSTONE_SEAL_POSITION } from "@blockcraft/voxel-world";

export type DepthsPoint = { x: number; y: number; z: number };
export const DEPTHS_ROUTE_NODES = [
  { id: "entrance", label: "Entrance", short: "IN", point: SILVER_DEPTHS_ENTRY_POSITION },
  { id: "seal", label: "Moonstone Seal", short: "◆", point: SILVER_DEPTHS_MOONSTONE_SEAL_POSITION },
  { id: "wave-one", label: "Gallery I", short: "I", point: { x: 94.5, y: 1, z: 14.5 } },
  { id: "wave-two", label: "Gallery II", short: "II", point: { x: 103.5, y: 1, z: 14.5 } },
  { id: "checkpoint", label: "Checkpoint", short: "+", point: SILVER_DEPTHS_CHECKPOINT_POSITION },
  { id: "matriarch", label: "Matriarch", short: "♛", point: CRYSTAL_MATRIARCH_HOME },
  { id: "extraction", label: "Extraction", short: "↑", point: SILVER_DEPTHS_EXIT_POSITION },
] as const;
export type DepthsNodeId = typeof DEPTHS_ROUTE_NODES[number]["id"];

export interface DepthsRouteState {
  active: DepthsNodeId;
  completed: Set<DepthsNodeId>;
  title: string;
  target: DepthsPoint;
}

export function silverDepthsRoute(runStage: number, _guardAAlive = true, _guardBAlive = true): DepthsRouteState | null {
  if (runStage <= 0) return null;
  const completed = new Set<DepthsNodeId>(["entrance"]);
  if (runStage >= 2) completed.add("seal");
  if (runStage >= 3) completed.add("wave-one");
  if (runStage >= 4) completed.add("wave-two");
  if (runStage >= 5) completed.add("checkpoint");
  if (runStage >= 6) completed.add("matriarch");
  let active: DepthsNodeId = "seal", title = "Break the Moonstone Seal";
  if (runStage === 2) { active = "wave-one"; title = "Clear Gallery Wave I"; }
  else if (runStage === 3) { active = "wave-two"; title = "Survive Gallery Wave II"; }
  else if (runStage === 4) { active = "checkpoint"; title = "Clear the Crystal Antechamber"; }
  else if (runStage === 5) { active = "matriarch"; title = "Defeat the Crystal Matriarch"; }
  else if (runStage === 6) { active = "matriarch"; title = "Claim Matriarch's Edge"; }
  else if (runStage >= 7) { active = "extraction"; title = "Extract to the Town"; }
  const target = DEPTHS_ROUTE_NODES.find(node => node.id === active)!.point;
  return { active, completed, title, target };
}
