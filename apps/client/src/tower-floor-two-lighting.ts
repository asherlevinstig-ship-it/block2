export interface FloorTwoWallSconce {
  id: string;
  x: number;
  z: number;
  yaw: number;
  /** Only selected sconces own an omni light; every sconce still has an
   * emissive flame. This keeps the route readable without multiplying light
   * passes across the entire floor. */
  castsLight: boolean;
}

export const FLOOR_TWO_WALL_SCONCES: readonly FloorTwoWallSconce[] = [
  { id: "entry-north", x: 417, z: 98.2, yaw: 180, castsLight: true },
  { id: "entry-south", x: 417, z: 113.8, yaw: 0, castsLight: true },
  { id: "intake-north-west", x: 432, z: 93.7, yaw: 0, castsLight: false },
  { id: "intake-north-east", x: 444, z: 93.7, yaw: 0, castsLight: true },
  { id: "intake-south-west", x: 432, z: 118.3, yaw: 180, castsLight: false },
  { id: "intake-south-east", x: 444, z: 118.3, yaw: 180, castsLight: true },
  { id: "furnace-west", x: 453.7, z: 78, yaw: 90, castsLight: true },
  { id: "furnace-east", x: 462.3, z: 88, yaw: -90, castsLight: false },
  { id: "quench-west", x: 453.7, z: 126, yaw: 90, castsLight: true },
  { id: "quench-east", x: 462.3, z: 136, yaw: -90, castsLight: false },
  { id: "crucible-north", x: 494, z: 96.2, yaw: 180, castsLight: true },
  { id: "crucible-south", x: 494, z: 115.8, yaw: 0, castsLight: true },
  { id: "boss-north", x: 506, z: 96.2, yaw: 180, castsLight: false },
  { id: "boss-south", x: 506, z: 115.8, yaw: 0, castsLight: false },
] as const;

export const FLOOR_TWO_OBJECTIVE_LIGHTS = [
  { id: "entry", x: 423, y: 12, z: 106, colour: [1, .52, .2] as const, intensity: 1.55, range: 22 },
  { id: "hub", x: 458, y: 13, z: 106, colour: [.2, .68, 1] as const, intensity: 1.7, range: 27 },
  { id: "furnace", x: 480, y: 14, z: 70, colour: [1, .28, .055] as const, intensity: 1.85, range: 28 },
  { id: "quench", x: 480, y: 14, z: 142, colour: [.12, .65, 1] as const, intensity: 1.7, range: 28 },
  { id: "crucible", x: 510, y: 15, z: 106, colour: [1, .26, .045] as const, intensity: 2.05, range: 35 },
  { id: "boss", x: 525, y: 14, z: 106, colour: [.92, .2, .055] as const, intensity: 1.45, range: 26 },
] as const;
