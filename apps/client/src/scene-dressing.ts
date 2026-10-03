import * as pc from "playcanvas";
import { Block, CHUNK_SIZE, SURFACE_HEIGHT, TOWN_GATE_POSTS, TOWN_TAVERN, type WorldBlockReader } from "@blockcraft/voxel-world";

type Color = readonly [number, number, number];
const WOOD: Color = [0.24, 0.17, 0.12];
const COPPER: Color = [0.72, 0.45, 0.22];
const SLATE: Color = [0.24, 0.31, 0.35];
const CLOTH: Color = [0.08, 0.42, 0.44];
const GOLD: Color = [0.94, 0.72, 0.31];

// Decorative geometry is baked into two draws, rather than one entity per sprig
// or architectural trim. It never participates in collision or target picking.
class BoxBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private readonly cube = new pc.BoxGeometry();

  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color): void {
    const base = this.positions.length / 3;
    const p = this.cube.positions!;
    const n = this.cube.normals!;
    for (let i = 0; i < p.length; i += 3) {
      this.positions.push(x + p[i]! * sx, y + p[i + 1]! * sy, z + p[i + 2]! * sz);
      this.normals.push(n[i]!, n[i + 1]!, n[i + 2]!);
      // Mesh.fromGeometry uses normalized byte vertex colors.
      this.colors.push(Math.round(color[0] * 255), Math.round(color[1] * 255), Math.round(color[2] * 255), 255);
    }
    for (const i of this.cube.indices!) this.indices.push(base + i);
  }

  mesh(device: pc.GraphicsDevice): pc.Mesh | null {
    if (this.indices.length === 0) return null;
    const geometry = new pc.Geometry();
    geometry.positions = this.positions;
    geometry.normals = this.normals;
    geometry.colors = this.colors;
    geometry.indices = this.indices;
    return pc.Mesh.fromGeometry(device, geometry);
  }
}

export class SceneDressing {
  private readonly root = new pc.Entity("world-art-details");
  private readonly material = new pc.StandardMaterial();
  private readonly glow = new pc.StandardMaterial();
  private meshes: pc.Mesh[] = [];

  constructor(private readonly app: pc.Application) {
    this.material.diffuse.set(1, 1, 1);
    this.material.diffuseVertexColor = true;
    this.material.specular.set(0.06, 0.06, 0.06);
    this.material.gloss = 0.12;
    this.material.update();
    this.glow.diffuse.set(1, 1, 1);
    this.glow.diffuseVertexColor = true;
    this.glow.emissive.set(0.62, 0.4, 0.15);
    this.glow.emissiveVertexColor = true;
    this.glow.update();
    app.root.addChild(this.root);
  }

  setSurfaceVisible(visible: boolean): void {
    this.root.enabled = visible;
  }

  rebuild(
    read: WorldBlockReader,
    chunks: ReadonlyArray<{ chunkX: number; chunkZ: number }>,
    hiddenRoof: { minX: number; minZ: number } | null = null,
  ): void {
    for (const child of [...this.root.children]) child.destroy();
    for (const mesh of this.meshes) mesh.destroy();
    this.meshes = [];
    const solid = new BoxBatch();
    const glow = new BoxBatch();
    const surface = SURFACE_HEIGHT + 1;

    for (const chunk of chunks) {
      for (let z = chunk.chunkZ * CHUNK_SIZE; z < (chunk.chunkZ + 1) * CHUNK_SIZE; z += 1) {
        for (let x = chunk.chunkX * CHUNK_SIZE; x < (chunk.chunkX + 1) * CHUNK_SIZE; x += 1) {
          if (read(x, SURFACE_HEIGHT, z) !== Block.Grass || read(x, surface, z) !== Block.Air) continue;
          // Stable sparse clusters: no movement-dependent generation or noise.
          const hash = (Math.imul(x + 211, 73856093) ^ Math.imul(z + 97, 19349663)) >>> 0;
          if (hash % 13 !== 0) continue;
          const px = x + 0.22 + (hash % 53) / 100;
          const pz = z + 0.22 + (hash % 47) / 100;
          const height = 0.12 + (hash % 9) * 0.01;
          const grass: Color = hash % 2 === 0 ? [0.38, 0.48, 0.22] : [0.48, 0.55, 0.28];
          solid.box(px, surface + height * 0.5, pz, 0.045, height, 0.12, grass);
          solid.box(px + 0.1, surface + height * 0.38, pz + 0.08, 0.1, height * 0.76, 0.04, grass);
          if (hash % 7 === 0) {
            solid.box(px, surface + height + 0.025, pz, 0.1, 0.05, 0.1, hash % 3 === 0 ? [0.67, 0.63, 0.78] : [0.91, 0.81, 0.52]);
          }
        }
      }
    }

    // The tavern is the town's single landmark: a broad timber hall with a raised slate roof.
    for (const [x, z] of [[0, 10], [16, 10], [0, 17], [16, 17], [2, 19], [14, 19]]) {
      if (read(x!, 10, z!) !== Block.Dirt) continue;
      solid.box(x! + 0.5, 10, z! + 0.5, 0.22, 4.05, 0.22, WOOD);
      solid.box(x! + 0.5, 8.15, z! + 0.5, 0.32, 0.3, 0.32, SLATE);
    }
    if (read(8, 12, 10) === Block.Stone && (hiddenRoof?.minX !== TOWN_TAVERN.minX || hiddenRoof.minZ !== TOWN_TAVERN.minZ)) {
      solid.box(8.5, 13.04, 10.02, 17.14, 0.12, 0.18, SLATE);
      solid.box(8.5, 13.04, 18.02, 17.14, 0.12, 0.18, SLATE);
      solid.box(8.5, 13.04, 19.98, 13.14, 0.12, 0.18, SLATE);
      solid.box(0.02, 13.04, 14, 0.18, 0.12, 8.1, SLATE);
      solid.box(16.98, 13.04, 14, 0.18, 0.12, 8.1, SLATE);
      solid.box(8.5, 15.05, 15, 11.1, 0.12, 4.1, COPPER);
    }
    for (const x of [0, 16]) {
      for (const z of [12, 15]) {
        if (read(x, 9, z) !== Block.Air) continue;
        const outsideX = x === 0 ? -0.04 : 17.04;
        glow.box(outsideX, 9.5, z + 0.5, 0.045, 0.72, 0.74, GOLD);
        solid.box(outsideX + (x === 0 ? -0.03 : 0.03), 9.5, z + 0.5, 0.055, 0.83, 0.09, WOOD);
      }
    }
    for (const z of [10, 19]) {
      for (const x of [4, 12]) {
        if (read(x, 9, z) !== Block.Air) continue;
        const outsideZ = z === 10 ? 9.96 : 20.04;
        glow.box(x + 0.5, 9.5, outsideZ, 0.74, 0.72, 0.045, GOLD);
        solid.box(x + 0.5, 9.5, outsideZ + (z === 10 ? -0.03 : 0.03), 0.09, 0.83, 0.055, WOOD);
      }
    }
    if (read(8, 11, 10) === Block.Dirt) {
      solid.box(8.5, 11.25, 9.94, 3.4, 0.64, 0.16, WOOD);
      solid.box(8.5, 11.25, 9.84, 2.9, 0.1, 0.04, COPPER);
      glow.box(8.5, 11.25, 9.79, 0.24, 0.38, 0.04, GOLD);
    }
    for (const z of [13, 16]) {
      for (const x of [3, 11]) {
        if (read(x, 8, z) !== Block.Dirt) continue;
        solid.box(x + 1.5, 9.03, z + 0.5, 3.1, 0.12, 0.92, WOOD);
        solid.box(x + 1.5, 9.1, z + 0.5, 2.84, 0.05, 0.68, COPPER);
      }
    }
    if (read(3, 10, 16) === Block.Stone) {
      glow.box(3.5, 9.4, 15.96, 0.62, 0.8, 0.06, GOLD);
      solid.box(3.5, 8.98, 15.86, 1.12, 0.13, 0.38, SLATE);
    }

    for (const [x, z] of TOWN_GATE_POSTS) {
      if (read(x, 11, z) !== Block.IronOre) continue;
      solid.box(x + 0.5, 11.05, z + 0.5, 1.04, 0.12, 1.04, COPPER);
      solid.box(x + 0.5, 12.015, z + 0.5, 1.07, 0.1, 1.07, SLATE);
      glow.box(x + 0.5, 12.1, z + 0.5, 0.4, 0.08, 0.4, GOLD);
      // Shallow fabric panels sit against the stone rather than across paths.
      solid.box(x + 0.5, 9.23, z + 1.025, 0.61, 1.26, 0.025, CLOTH);
      solid.box(x + 0.5, 9.88, z + 1.04, 0.79, 0.09, 0.09, COPPER);
      solid.box(x + 0.5, 9.35, z + 1.045, 0.1, 0.52, 0.025, GOLD);
      solid.box(x + 0.5, 9.35, z + 1.045, 0.32, 0.1, 0.03, GOLD);
    }
    for (const gate of [
      { x: -6, z: 8, sx: 1, sz: 2 }, { x: 22, z: 8, sx: 1, sz: 2 },
      { x: 8, z: -6, sx: 2, sz: 1 }, { x: 8, z: 22, sx: 2, sz: 1 },
    ]) {
      if (read(gate.x, 10, gate.z) !== Block.Stone) continue;
      solid.box(gate.x + gate.sx / 2, 11.035, gate.z + gate.sz / 2, gate.sx + 0.12, 0.12, gate.sz + 0.12, COPPER);
    }
    if (read(8, 11, 4) === Block.IronOre) {
      for (const y of [9, 10, 11]) {
        solid.box(8.5, y + 0.05, 4.5, 1.055, 0.12, 1.055, COPPER);
        glow.box(8.5, y + 0.47, 5.015, 0.23, 0.56, 0.035, GOLD);
        glow.box(9.015, y + 0.47, 4.5, 0.035, 0.56, 0.23, GOLD);
      }
      solid.box(8.5, 12.015, 4.5, 1.1, 0.12, 1.1, SLATE);
    }

    for (const [batch, material, castsShadow] of [[solid, this.material, true], [glow, this.glow, false]] as const) {
      const mesh = batch.mesh(this.app.graphicsDevice);
      if (!mesh) continue;
      this.meshes.push(mesh);
      const entity = new pc.Entity("batched-world-details");
      entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: castsShadow, receiveShadows: true });
      this.root.addChild(entity);
    }
  }
}
