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
  { id: "entry", x: 423, y: 13, z: 106, colour: [1, .48, .16] as const, intensity: .8, range: 18 },
  { id: "hub", x: 458, y: 14, z: 106, colour: [.12, .58, 1] as const, intensity: .9, range: 21 },
  { id: "furnace", x: 480, y: 15, z: 70, colour: [1, .22, .035] as const, intensity: 1.15, range: 24 },
  { id: "quench", x: 480, y: 15, z: 142, colour: [.08, .55, 1] as const, intensity: .92, range: 24 },
  { id: "crucible", x: 510, y: 17, z: 106, colour: [1, .2, .025] as const, intensity: 1.2, range: 31 },
  { id: "boss", x: 525, y: 16, z: 106, colour: [.72, .11, .035] as const, intensity: .76, range: 20 },
] as const;
