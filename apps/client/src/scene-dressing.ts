import * as pc from "playcanvas";
import { Block, CHUNK_SIZE, SURFACE_HEIGHT, TOWN_GATE_POSTS, TOWN_TAVERN, type WorldBlockReader } from "@blockcraft/voxel-world";
import { TAVERN_KEEPER } from "./tavern-keeper.js";

type Color = readonly [number, number, number];
const WOOD: Color = [0.24, 0.17, 0.12];
const COPPER: Color = [0.72, 0.45, 0.22];
const SLATE: Color = [0.24, 0.31, 0.35];
const CLOTH: Color = [0.08, 0.42, 0.44];
const GOLD: Color = [0.94, 0.72, 0.31];
const OAK: Color = [0.42, 0.27, 0.16];
const DARK_OAK: Color = [0.15, 0.10, 0.075];
const RUG: Color = [0.37, 0.09, 0.10];
const CREAM: Color = [0.83, 0.72, 0.54];
const EMBER: Color = [1, 0.28, 0.045];

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
  private fireLight: pc.Entity | null = null;
  private keeper: pc.Entity | null = null;
  private keeperHead: pc.Entity | null = null;
  private keeperArm: pc.Entity | null = null;
  private readonly keeperMaterials = new Map<string, pc.StandardMaterial>();

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

  get keeperVisible(): boolean {
    return this.root.enabled && this.keeper !== null;
  }

  update(timeMilliseconds: number): void {
    if (!this.root.enabled) return;
    const time = timeMilliseconds * 0.001;
    if (this.fireLight?.light) this.fireLight.light.intensity = 1.35 + Math.sin(time * 8.3) * 0.11 + Math.sin(time * 13.7) * 0.055;
    if (this.keeperHead) this.keeperHead.setLocalEulerAngles(0, Math.sin(time * 0.72) * 5, 0);
    if (this.keeperArm) this.keeperArm.setLocalEulerAngles(Math.sin(time * 1.65) * 8 - 8, 0, -6);
  }

  private keeperMaterial(color: Color): pc.StandardMaterial {
    const key = color.join(",");
    let material = this.keeperMaterials.get(key);
    if (!material) {
      material = new pc.StandardMaterial();
      material.diffuse.set(...color);
      material.specular.set(0.04, 0.04, 0.04);
      material.gloss = 0.1;
      material.update();
      this.keeperMaterials.set(key, material);
    }
    return material;
  }

  private keeperBox(parent: pc.Entity, name: string, size: [number, number, number], position: [number, number, number], color: Color): pc.Entity {
    const box = new pc.Entity(name);
    box.addComponent("render", { type: "box", castShadows: true, receiveShadows: true });
    if (box.render) box.render.material = this.keeperMaterial(color);
    box.setLocalScale(...size);
    box.setLocalPosition(...position);
    parent.addChild(box);
    return box;
  }

  private createTavernKeeper(): void {
    const skin: Color = [0.72, 0.45, 0.28];
    const shirt: Color = [0.22, 0.38, 0.34];
    const apron: Color = [0.82, 0.72, 0.52];
    const hair: Color = [0.18, 0.10, 0.07];
    const boots: Color = [0.13, 0.10, 0.09];
    const keeper = new pc.Entity("Mara-the-tavernkeeper");
    keeper.setPosition(TAVERN_KEEPER.x, TAVERN_KEEPER.y, TAVERN_KEEPER.z);
    keeper.setEulerAngles(0, 180, 0); // Face customers across the bar.
    this.root.addChild(keeper);
    this.keeperBox(keeper, "left-boot", [0.22, 0.38, 0.29], [-0.15, 0.19, 0], boots);
    this.keeperBox(keeper, "right-boot", [0.22, 0.38, 0.29], [0.15, 0.19, 0], boots);
    this.keeperBox(keeper, "tunic", [0.67, 0.74, 0.38], [0, 0.83, 0], shirt);
    this.keeperBox(keeper, "apron", [0.53, 0.65, 0.055], [0, 0.68, 0.22], apron);
    this.keeperBox(keeper, "apron-belt", [0.72, 0.09, 0.44], [0, 0.85, 0.02], hair);
    this.keeperBox(keeper, "apron-clasp", [0.13, 0.12, 0.05], [0, 0.85, 0.25], GOLD);
    for (const side of [-1, 1]) {
      const arm = new pc.Entity(side < 0 ? "left-arm" : "right-arm");
      arm.setLocalPosition(side * 0.44, 1.07, 0);
      keeper.addChild(arm);
      this.keeperBox(arm, "sleeve", [0.23, 0.45, 0.3], [0, -0.2, 0], shirt);
      this.keeperBox(arm, "hand", [0.2, 0.18, 0.23], [0, -0.48, 0], skin);
      if (side > 0) this.keeperArm = arm;
    }
    const head = new pc.Entity("head");
    head.setLocalPosition(0, 1.43, 0);
    keeper.addChild(head);
    this.keeperBox(head, "face", [0.46, 0.43, 0.43], [0, 0, 0], skin);
    this.keeperBox(head, "hair", [0.5, 0.14, 0.47], [0, 0.24, -0.01], hair);
    this.keeperBox(head, "hair-bun", [0.29, 0.28, 0.24], [0, 0.22, -0.27], hair);
    this.keeperBox(head, "left-eye", [0.055, 0.055, 0.025], [-0.105, 0.035, 0.222], boots);
    this.keeperBox(head, "right-eye", [0.055, 0.055, 0.025], [0.105, 0.035, 0.222], boots);
    this.keeperBox(head, "smile", [0.18, 0.035, 0.025], [0, -0.12, 0.223], hair);
    this.keeperBox(keeper, "welcome-badge", [0.16, 0.16, 0.07], [-0.2, 1.12, 0.23], GOLD);
    this.keeper = keeper;
    this.keeperHead = head;
  }

  rebuild(
    read: WorldBlockReader,
    chunks: ReadonlyArray<{ chunkX: number; chunkZ: number }>,
    hiddenRoof: { minX: number; minZ: number } | null = null,
  ): void {
    for (const child of [...this.root.children]) child.destroy();
    for (const mesh of this.meshes) mesh.destroy();
    this.meshes = [];
    this.fireLight = null;
    this.keeper = null;
    this.keeperHead = null;
    this.keeperArm = null;
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
    if (read(8, 12, 14) === Block.Stone && read(8, 8, 14) === Block.Air) {
      // Warm plank floor and a runner guide players between both doors.
      for (let z = 11; z <= 18; z += 1) {
        for (let x = 1; x <= 15; x += 1) {
          if (read(x, 8, z) !== Block.Air) continue;
          solid.box(x + 0.5, 8.012, z + 0.5, 0.975, 0.024, 0.975, (x + z) % 3 === 0 ? OAK : WOOD);
          solid.box(x + 0.5, 8.029, z + 0.04, 0.84, 0.006, 0.018, DARK_OAK);
        }
      }
      solid.box(8.5, 8.045, 14.75, 2.45, 0.035, 6.5, GOLD);
      solid.box(8.5, 8.066, 14.75, 2.22, 0.013, 6.26, RUG);
      for (const z of [12.1, 14.7, 17.3]) {
        solid.box(8.5, 8.079, z, 1.9, 0.006, 0.055, GOLD);
      }

      // Three communal tables leave the central route and rear doorway clear.
      for (const [cx, cz] of [[4.5, 13.5], [12.5, 13.5], [12.5, 16.5]] as const) {
        solid.box(cx, 8.78, cz, 2.72, 0.14, 0.88, OAK);
        solid.box(cx, 8.875, cz, 2.55, 0.045, 0.7, COPPER);
        for (const dx of [-1.05, 1.05]) {
          for (const dz of [-0.28, 0.28]) solid.box(cx + dx, 8.37, cz + dz, 0.15, 0.69, 0.15, DARK_OAK);
        }
        for (const side of [-1, 1]) {
          solid.box(cx, 8.43, cz + side * 0.9, 2.62, 0.11, 0.28, OAK);
          for (const dx of [-1.08, 1.08]) solid.box(cx + dx, 8.22, cz + side * 0.9, 0.13, 0.39, 0.16, DARK_OAK);
        }
        for (const dx of [-0.64, 0.64]) {
          solid.box(cx + dx, 8.935, cz + 0.06, 0.19, 0.14, 0.19, CREAM);
          solid.box(cx + dx + 0.12, 8.935, cz + 0.06, 0.065, 0.075, 0.08, GOLD);
        }
        glow.box(cx, 8.91, cz - 0.1, 0.34, 0.04, 0.3, GOLD);
      }

      // A serving bar, bottle shelf, and barrels give the rear corner a purpose.
      solid.box(4.9, 8.62, 17.75, 3.6, 1.2, 0.48, DARK_OAK);
      solid.box(4.9, 9.28, 17.73, 3.92, 0.12, 0.7, OAK);
      solid.box(4.9, 9.355, 17.73, 3.74, 0.025, 0.56, COPPER);
      for (const y of [9.15, 10.0]) {
        solid.box(4.9, y, 18.78, 3.35, 0.11, 0.36, OAK);
        for (const x of [3.6, 4.25, 4.9, 5.55, 6.2]) {
          glow.box(x, y + 0.18, 18.7, 0.14, 0.25, 0.14, x === 4.9 ? CLOTH : GOLD);
          solid.box(x, y + 0.32, 18.7, 0.1, 0.04, 0.1, CREAM);
        }
      }
      for (const x of [2.2, 6.6]) {
        solid.box(x, 8.44, 18.0, 0.52, 0.82, 0.52, OAK);
        for (const y of [8.17, 8.65]) solid.box(x, y, 18.0, 0.56, 0.055, 0.56, SLATE);
      }

      // Keep hanging lamps, but clear the overhead beams in the interior camera view.
      if (!hiddenRoof) for (const z of [11.25, 14.75, 18.15]) solid.box(8.5, 11.78, z, 15.1, 0.22, 0.22, DARK_OAK);
      for (const [x, z] of [[4.5, 13.5], [12.5, 14.7]] as const) {
        solid.box(x, 11.12, z, 0.065, 1.0, 0.065, DARK_OAK);
        solid.box(x, 10.59, z, 0.52, 0.08, 0.52, SLATE);
        glow.box(x, 10.42, z, 0.27, 0.3, 0.27, GOLD);
        solid.box(x, 10.24, z, 0.5, 0.07, 0.5, SLATE);
      }
      for (const [x, z] of [[1.1, 12.5], [15.9, 16.5]] as const) {
        solid.box(x, 10.17, z, 0.26, 0.55, 0.2, SLATE);
        glow.box(x, 10.2, z, 0.18, 0.34, 0.11, GOLD);
      }
    }
    if (read(3, 10, 16) === Block.Stone) {
      // Solid voxel chimney, with a shallow decorative hearth facing the hall.
      solid.box(4.025, 8.14, 16.5, 0.62, 0.22, 1.38, SLATE);
      solid.box(4.045, 9.15, 16.04, 0.16, 1.45, 0.15, SLATE);
      solid.box(4.045, 9.15, 16.96, 0.16, 1.45, 0.15, SLATE);
      solid.box(4.09, 9.93, 16.5, 0.25, 0.17, 1.22, SLATE);
      glow.box(4.13, 8.75, 16.5, 0.17, 0.5, 0.75, EMBER);
      glow.box(4.23, 8.92, 16.32, 0.15, 0.63, 0.2, GOLD);
      glow.box(4.23, 8.91, 16.68, 0.15, 0.59, 0.2, GOLD);
      glow.box(4.28, 9.02, 16.5, 0.13, 0.72, 0.15, CREAM);
      for (const z of [16.2, 16.5, 16.8]) solid.box(4.31, 8.38, z, 0.19, 0.13, 0.13, DARK_OAK);
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
    if (read(3, 10, 16) === Block.Stone) {
      this.fireLight = new pc.Entity("tavern-hearth-light");
      this.fireLight.addComponent("light", { type: "omni", color: new pc.Color(1, 0.39, 0.13), intensity: 1.35, range: 7, castShadows: false });
      this.fireLight.setPosition(4.3, 9.3, 16.5);
      this.root.addChild(this.fireLight);
      for (const [x, z] of [[4.5, 13.5], [12.5, 14.7]] as const) {
        const lantern = new pc.Entity("tavern-lantern-light");
        lantern.addComponent("light", { type: "omni", color: new pc.Color(1, 0.64, 0.31), intensity: 0.5, range: 5, castShadows: false });
        lantern.setPosition(x, 10.4, z);
        this.root.addChild(lantern);
      }
    }
    if (read(5, 8, 18) === Block.Air && read(8, 12, 14) === Block.Stone) this.createTavernKeeper();
  }
}
