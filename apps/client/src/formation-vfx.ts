export type FormationTactic = "surround" | "venom-lock" | "breach";

export type FormationVfxStyle = {
  primary: readonly [number, number, number];
  edge: readonly [number, number, number];
  laneWidth: number;
  pulseHz: number;
  motif: "roots" | "bubbles" | "cracks";
};

export type GroundPoint = { x: number; y: number; z: number };

export function formationVfxStyle(tactic: FormationTactic): FormationVfxStyle {
  if (tactic === "venom-lock") return {
    primary: [.36, .95, .08], edge: [.78, 1, .2], laneWidth: .18, pulseHz: 6.5, motif: "bubbles",
  };
  if (tactic === "breach") return {
    primary: [1, .28, .04], edge: [1, .72, .12], laneWidth: .24, pulseHz: 8, motif: "cracks",
  };
  return {
    primary: [.2, .78, .18], edge: [.68, .92, .24], laneWidth: .16, pulseHz: 5, motif: "roots",
  };
}

export function formationLanePoints(origin: GroundPoint, yaw: number, distance: number, spacing = .62): GroundPoint[] {
  const count = Math.max(2, Math.ceil(Math.max(.5, distance) / spacing));
  const radians = yaw * Math.PI / 180;
  return Array.from({ length: count }, (_, index) => {
    const travel = Math.min(distance, (index + 1) / count * distance);
    return { x: origin.x + Math.sin(radians) * travel, y: origin.y,
      z: origin.z + Math.cos(radians) * travel };
  });
}

export function formationRingPoints(center: GroundPoint, radius: number, count = 16): GroundPoint[] {
  const total = Math.max(8, count);
  return Array.from({ length: total }, (_, index) => {
    const radians = index / total * Math.PI * 2;
    return { x: center.x + Math.sin(radians) * radius, y: center.y,
      z: center.z + Math.cos(radians) * radius };
  });
}
