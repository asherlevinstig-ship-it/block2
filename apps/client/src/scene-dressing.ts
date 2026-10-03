import * as pc from "playcanvas";
import { Block, CHUNK_SIZE, SURFACE_HEIGHT, type WorldBlockReader } from "@blockcraft/voxel-world";

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

  rebuild(read: WorldBlockReader, chunks: ReadonlyArray<{ chunkX: number; chunkZ: number }>): void {
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

    for (const lodge of [{ x: 2, z: 4 }, { x: 11, z: 9 }]) {
      const cx = lodge.x + 2;
      const cz = lodge.z + 2;
      // Keep details tied to their authoritative supporting voxels.
      for (const x of [lodge.x + 0.05, lodge.x + 3.95]) {
        for (const z of [lodge.z + 0.05, lodge.z + 3.95]) {
          if (read(Math.floor(x), 8, Math.floor(z)) !== Block.Dirt) continue;
          solid.box(x, 9, z, 0.16, 2, 0.16, WOOD);
          solid.box(x, 8.12, z, 0.21, 0.24, 0.21, SLATE);
        }
      }
      if (read(lodge.x, 10, lodge.z) === Block.Stone) {
        solid.box(cx, 10.98, lodge.z + 0.03, 4.12, 0.1, 0.16, SLATE);
        solid.box(cx, 10.98, lodge.z + 3.97, 4.12, 0.1, 0.16, SLATE);
        solid.box(lodge.x + 0.03, 10.98, cz, 0.16, 0.1, 4.12, SLATE);
        solid.box(lodge.x + 3.97, 10.98, cz, 0.16, 0.1, 4.12, SLATE);
        solid.box(cx, 10.045, lodge.z - 0.025, 4.08, 0.14, 0.12, WOOD);
        solid.box(cx, 10.045, lodge.z + 4.025, 4.08, 0.14, 0.12, WOOD);
      }
      // Inlaid amber windows on solid walls, with timber mullions and a sill.
      for (const wz of [lodge.z - 0.025, lodge.z + 4.025]) {
        const supportZ = Math.max(lodge.z, Math.min(lodge.z + 3, Math.floor(wz)));
        if (read(lodge.x + 1, 9, supportZ) !== Block.Dirt) continue;
        solid.box(cx, 9.24, wz, 1.18, 0.92, 0.07, WOOD);
        glow.box(cx, 9.24, wz + (wz < cz ? -0.04 : 0.04), 0.94, 0.69, 0.035, GOLD);
        solid.box(cx, 9.24, wz + (wz < cz ? -0.065 : 0.065), 0.09, 0.72, 0.04, WOOD);
        solid.box(cx, 9.24, wz + (wz < cz ? -0.065 : 0.065), 0.98, 0.08, 0.04, WOOD);
        solid.box(cx, 8.76, wz, 1.32, 0.12, 0.25, COPPER);
      }
    }

    const gatePosts = [[7, 1], [10, 1], [7, 16], [10, 16], [1, 7], [1, 10], [16, 7], [16, 10]];
    for (const [x, z] of gatePosts) {
      if (x === undefined || z === undefined || read(x, 10, z) !== Block.IronOre) continue;
      solid.box(x + 0.5, 10.05, z + 0.5, 1.04, 0.12, 1.04, COPPER);
      solid.box(x + 0.5, 11.015, z + 0.5, 1.07, 0.1, 1.07, SLATE);
      glow.box(x + 0.5, 11.1, z + 0.5, 0.4, 0.08, 0.4, GOLD);
      // Shallow fabric panels sit against the stone rather than across paths.
      solid.box(x + 0.5, 9.23, z + 1.025, 0.61, 1.26, 0.025, CLOTH);
      solid.box(x + 0.5, 9.88, z + 1.04, 0.79, 0.09, 0.09, COPPER);
      solid.box(x + 0.5, 9.35, z + 1.045, 0.1, 0.52, 0.025, GOLD);
      solid.box(x + 0.5, 9.35, z + 1.045, 0.32, 0.1, 0.03, GOLD);
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
