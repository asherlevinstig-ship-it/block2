import * as pc from "playcanvas";
import { MINERAL_DEPOSITS, WILDERNESS_CAMPS } from "@blockcraft/voxel-world";
import { STONE_BRUTE_ARENA, STONE_BRUTE_ARENA_HOME } from "@blockcraft/voxel-world";
import { Block, CHUNK_SIZE, GREENWOOD_CAMP, SURFACE_HEIGHT, TOWN_BEACON_POSITION, TOWN_BLACKSMITH_STALL_POSITION, TOWN_GATE_POSTS, TOWN_TAVERN, TOWN_TAVERN_Z_OFFSET, TOWN_TAVERN_QUIZ_TABLE_POSITION, TOWN_TAVERN_TABLE_CENTERS, type WorldBlockReader } from "@blockcraft/voxel-world";
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
const IRON: Color = [0.39, 0.47, 0.51];
const SOOT: Color = [0.12, 0.15, 0.16];
const FORGE_STONE: Color = [0.29, 0.30, 0.29];
const CANVAS: Color = [0.53, 0.15, 0.10];
const CANVAS_LIGHT: Color = [0.74, 0.27, 0.14];

const TAVERN_PATRONS = [
  { x: 3.8, z: 12.6, facing: 1, skin: [0.65, 0.38, 0.23], shirt: [0.20, 0.31, 0.52], hair: [0.11, 0.08, 0.06], phase: 0 },
  { x: 5.2, z: 14.4, facing: -1, skin: [0.83, 0.57, 0.39], shirt: [0.54, 0.26, 0.18], hair: [0.36, 0.19, 0.08], phase: 1.7 },
  { x: 11.8, z: 12.6, facing: 1, skin: [0.48, 0.31, 0.22], shirt: [0.29, 0.43, 0.23], hair: [0.14, 0.13, 0.12], phase: 3.1 },
  { x: 13.2, z: 17.4, facing: -1, skin: [0.72, 0.49, 0.34], shirt: [0.39, 0.27, 0.48], hair: [0.25, 0.15, 0.10], phase: 4.6 },
] as const satisfies ReadonlyArray<{ x: number; z: number; facing: number; skin: Color; shirt: Color; hair: Color; phase: number }>;

// Decorative geometry is baked into two draws, rather than one entity per sprig
// or architectural trim. It never participates in collision or target picking.
class BoxBatch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private readonly cube = new pc.BoxGeometry();
  offsetZ = 0;

  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: Color): void {
    const base = this.positions.length / 3;
    const p = this.cube.positions!;
    const n = this.cube.normals!;
    for (let i = 0; i < p.length; i += 3) {
      this.positions.push(x + p[i]! * sx, y + p[i + 1]! * sy, z + this.offsetZ + p[i + 2]! * sz);
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
  private forgeLight: pc.Entity | null = null;
  private campfireLight: pc.Entity | null = null;
  private keeper: pc.Entity | null = null;
  private keeperHead: pc.Entity | null = null;
  private keeperArm: pc.Entity | null = null;
  private blacksmithBuilt = false;
  private readonly keeperMaterials = new Map<string, pc.StandardMaterial>();
  private readonly patronHeads: Array<{ entity: pc.Entity; baseYaw: number; phase: number }> = [];

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

  get blacksmithVisible(): boolean {
    return this.root.enabled && this.blacksmithBuilt;
  }

  update(timeMilliseconds: number): void {
    if (!this.root.enabled) return;
    const time = timeMilliseconds * 0.001;
    if (this.fireLight?.light) this.fireLight.light.intensity = 1.35 + Math.sin(time * 8.3) * 0.11 + Math.sin(time * 13.7) * 0.055;
    if (this.forgeLight?.light) this.forgeLight.light.intensity = 0.85 + Math.sin(time * 10.1) * 0.08 + Math.sin(time * 17.3) * 0.035;
    if (this.campfireLight?.light) this.campfireLight.light.intensity = 0.9 + Math.sin(time * 7.7) * 0.12 + Math.sin(time * 14.9) * 0.05;
    if (this.keeperHead) this.keeperHead.setLocalEulerAngles(0, Math.sin(time * 0.72) * 5, 0);
    if (this.keeperArm) this.keeperArm.setLocalEulerAngles(Math.sin(time * 1.65) * 8 - 8, 0, -6);
    for (const patron of this.patronHeads) {
      patron.entity.setEulerAngles(0, patron.baseYaw + Math.sin(time * 0.47 + patron.phase) * 9, 0);
    }
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

  private createSeatedPatrons(batch: BoxBatch): void {
    for (const [index, patron] of TAVERN_PATRONS.entries()) {
      const { x, z, facing, skin, shirt, hair, phase } = patron;
      const trousers: Color = [0.17, 0.16, 0.17];
      const boots: Color = [0.11, 0.085, 0.07];
      // Bodies remain batched with the tavern art; only heads turn gently.
      batch.box(x, 8.71, z, 0.55, 0.47, 0.37, shirt);
      batch.box(x, 8.53, z, 0.58, 0.16, 0.43, trousers);
      for (const side of [-1, 1]) {
        batch.box(x + side * 0.15, 8.48, z + facing * 0.37, 0.19, 0.17, 0.64, trousers);
        batch.box(x + side * 0.15, 8.41, z + facing * 0.69, 0.21, 0.13, 0.28, boots);
        batch.box(x + side * 0.37, 8.76, z + facing * 0.12, 0.20, 0.24, 0.28, shirt);
        batch.box(x + side * 0.36, 8.84, z + facing * 0.37, 0.19, 0.11, 0.31, skin);
      }
      const head = new pc.Entity(`tavern-patron-${index + 1}-head`);
      head.setPosition(x, 9.10, z + TOWN_TAVERN_Z_OFFSET);
      head.setEulerAngles(0, facing === 1 ? 0 : 180, 0);
      this.root.addChild(head);
      this.keeperBox(head, "face", [0.43, 0.43, 0.42], [0, 0, 0], skin);
      this.keeperBox(head, "hair", [0.47, 0.15, 0.45], [0, 0.23, -0.01], hair);
      this.keeperBox(head, "left-eye", [0.05, 0.05, 0.025], [-0.1, 0.025, 0.22], boots);
      this.keeperBox(head, "right-eye", [0.05, 0.05, 0.025], [0.1, 0.025, 0.22], boots);
      if (index === 2) this.keeperBox(head, "cap-brim", [0.53, 0.07, 0.16], [0, 0.2, 0.22], hair);
      this.patronHeads.push({ entity: head, baseYaw: facing === 1 ? 0 : 180, phase });
    }
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
    this.forgeLight = null;
    this.campfireLight = null;
    this.keeper = null;
    this.keeperHead = null;
    this.keeperArm = null;
    this.blacksmithBuilt = false;
    this.patronHeads.length = 0;
    const solid = new BoxBatch();
    const glow = new BoxBatch();
    const surface = SURFACE_HEIGHT + 1;
    const tavernRead = (x: number, y: number, z: number) => read(x, y, z + TOWN_TAVERN_Z_OFFSET);

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

    const campVisible = read(GREENWOOD_CAMP.minX, SURFACE_HEIGHT, GREENWOOD_CAMP.minZ) === Block.Dirt;
    if (campVisible) {
      const centerX = (GREENWOOD_CAMP.minX + GREENWOOD_CAMP.maxX) / 2 + 0.5;
      const centerZ = (GREENWOOD_CAMP.minZ + GREENWOOD_CAMP.maxZ) / 2 + 0.5;
      // An open forester lean-to keeps the player visible while reading as a landmark.
      for (const x of [GREENWOOD_CAMP.minX + 0.5, GREENWOOD_CAMP.maxX + 0.5]) {
        for (const z of [GREENWOOD_CAMP.minZ + 0.5, GREENWOOD_CAMP.maxZ + 0.5]) {
          solid.box(x, 9.15, z, 0.24, 2.3, 0.24, DARK_OAK);
          solid.box(x, 8.08, z, 0.36, 0.16, 0.36, FORGE_STONE);
        }
      }
      for (let x = GREENWOOD_CAMP.minX; x <= GREENWOOD_CAMP.maxX; x += 1) {
        solid.box(x + 0.5, 10.36, GREENWOOD_CAMP.maxZ + 0.48, 0.88, 0.12, 0.36, x % 2 ? OAK : WOOD);
      }
      solid.box(centerX + 2.3, 9.75, GREENWOOD_CAMP.maxZ + 0.47, 0.18, 1.5, 0.18, OAK);
      solid.box(centerX - 2.3, 9.75, GREENWOOD_CAMP.maxZ + 0.47, 0.18, 1.5, 0.18, OAK);
      for (const x of [GREENWOOD_CAMP.minX + 1.2, GREENWOOD_CAMP.minX + 2.0, GREENWOOD_CAMP.minX + 2.8]) {
        solid.box(x, 8.28, GREENWOOD_CAMP.maxZ - 0.1, 0.62, 0.38, 0.62, OAK);
        solid.box(x, 8.28, GREENWOOD_CAMP.maxZ - 0.1, 0.68, 0.08, 0.68, DARK_OAK);
      }
      // Campfire ring, chopping block, stacked timber and a trail-facing sign.
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2;
        solid.box(centerX + Math.cos(angle) * 0.72, 8.12, centerZ + Math.sin(angle) * 0.72, 0.28, 0.22, 0.28, FORGE_STONE);
      }
      glow.box(centerX, 8.31, centerZ, 0.72, 0.5, 0.72, EMBER);
      glow.box(centerX - 0.13, 8.58, centerZ, 0.18, 0.7, 0.18, GOLD);
      glow.box(centerX + 0.16, 8.52, centerZ + 0.08, 0.16, 0.58, 0.16, CREAM);
      solid.box(centerX - 2.1, 8.42, centerZ + 1.2, 0.72, 0.82, 0.72, OAK);
      solid.box(centerX - 2.1, 8.85, centerZ + 1.2, 0.78, 0.08, 0.78, DARK_OAK);
      for (const [x, z, yaw] of [[centerX + 2.0, centerZ + 1.3, 18], [centerX + 2.25, centerZ + 1.05, -8], [centerX + 1.72, centerZ + 1.0, 32]] as const) {
        solid.box(x, 8.25, z, 0.34, 0.34, 1.65, OAK);
        solid.box(x, 8.25, z, 0.38, 0.08, 1.72, DARK_OAK);
        void yaw;
      }
      solid.box(39.5, 9.25, 14.35, 0.18, 2.45, 0.18, DARK_OAK);
      solid.box(39.5, 10.0, 14.28, 2.3, 0.72, 0.16, OAK);
      glow.box(39.5, 10.0, 14.18, 1.92, 0.44, 0.035, GOLD);
      solid.box(39.5, 10.0, 14.13, 1.5, 0.09, 0.025, DARK_OAK);
      // Trail pennants and an iron-vein marker: batched, no extra draw calls.
      for (const [x, z] of [[31.5, 11.5], [40.5, 12.5], [47.5, 18.5]] as const) {
        solid.box(x, 8.7, z, 0.12, 1.4, 0.12, DARK_OAK);
        solid.box(x + 0.28, 9.15, z, 0.55, 0.4, 0.06, x > 46 ? IRON : CLOTH);
        glow.box(x + 0.28, 9.16, z - 0.04, 0.3, 0.06, 0.025, GOLD);
      }
    }

    if (read(STONE_BRUTE_ARENA_HOME.x | 0, SURFACE_HEIGHT, STONE_BRUTE_ARENA_HOME.z | 0) === Block.Stone) {
      // Open arena: flat perimeter markings, no walls or roofs over the fight.
      const a = STONE_BRUTE_ARENA;
      for (let x = a.minX + 1; x < a.maxX; x += 2) {
        solid.box(x + 0.5, 8.025, a.minZ + 0.5, 0.7, 0.035, 0.35, SLATE);
        solid.box(x + 0.5, 8.025, a.maxZ + 0.5, 0.7, 0.035, 0.35, SLATE);
      }
      for (let z = a.minZ + 1; z < a.maxZ; z += 2) {
        solid.box(a.minX + 0.5, 8.025, z + 0.5, 0.35, 0.035, 0.7, SLATE);
        solid.box(a.maxX + 0.5, 8.025, z + 0.5, 0.35, 0.035, 0.7, SLATE);
      }
      for (const z of [27.5, 31.5, 33.5]) {
        solid.box(43.3, 8.7, z, 0.12, 1.4, 0.12, DARK_OAK);
        solid.box(43.6, 9.15, z, 0.6, 0.45, 0.08, SLATE);
        glow.box(43.6, 9.2, z - 0.05, 0.28, 0.12, 0.03, GOLD);
        glow.box(43.6, 9.05, z - 0.05, 0.05, 0.25, 0.03, GOLD);
      }
    }

    // Ore-site pennants are batched with existing dressing, not new draw calls.
    for (const deposit of MINERAL_DEPOSITS) {
      if (read(deposit.x, SURFACE_HEIGHT, deposit.z) === Block.Air) continue;
      const x = deposit.x + deposit.radius + 1.5;
      const z = deposit.z + deposit.radius + 1.5;
      const color: Color = deposit.block === Block.IronOre ? COPPER : deposit.radius > 1 ? [0.48, 0.16, 0.1] : [0.16, 0.38, 0.48];
      solid.box(x, 8.7, z, .12, 1.4, .12, DARK_OAK);
      solid.box(x + .3, 9.15, z, .65, .45, .07, color);
      glow.box(x + .3, 9.15, z - .045, .25, .1, .025, deposit.block === Block.IronOre ? IRON : [0.7, 0.86, 0.94]);
      if (deposit.radius > 1) glow.box(x + .3, 9.32, z - .045, .25, .05, .025, GOLD);
    }

    for (const camp of WILDERNESS_CAMPS) {
      // Only bake decorations whose ground is actually present in the streamed world.
      for (const [dx, dz] of camp.kind === "nest" ? [[-3, -3], [3, 3]] : camp.kind === "spitter" ? [[-2, -3], [2, 3]] : [[-3, -4], [3, 4]]) {
        const x = camp.x + dx!; const z = camp.z + dz!;
        if (read(x, SURFACE_HEIGHT, z) === Block.Air) continue;
        if (camp.kind === "nest") {
          // Low twig bowls and pale shed fangs: readable but not invisible colliders.
          for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            solid.box(x + .5 + Math.sin(angle) * .55, 8.1, z + .5 + Math.cos(angle) * .55, .24, .18, .24, DARK_OAK);
          }
          solid.box(x + .35, 8.12, z + .35, .17, .2, .17, [0.8, .76, .53]);
          solid.box(x + .65, 8.12, z + .6, .15, .18, .15, [0.8, .76, .53]);
        } else if (camp.kind === "spitter") {
          solid.box(x + .5, 8.025, z + .5, .9, .04, .75, [.22, .3, .13]);
          glow.box(x + .5, 8.06, z + .5, .28, .06, .22, [.43, .65, .08]);
        } else {
          solid.box(x + .5, 8.055, z + .5, .75, .11, .65, SLATE);
          glow.box(x + .5, 8.12, z + .5, .35, .035, .08, [.65, .27, .1]);
        }
      }
    }

    // Keep the existing hall art in local coordinates while moving the entire tavern south.
    solid.offsetZ = TOWN_TAVERN_Z_OFFSET;
    glow.offsetZ = TOWN_TAVERN_Z_OFFSET;
    // The tavern is the town's single landmark: a broad timber hall with a raised slate roof.
    for (const [x, z] of [[0, 10], [16, 10], [0, 17], [16, 17], [2, 19], [14, 19]]) {
      if (tavernRead(x!, 10, z!) !== Block.Dirt) continue;
      solid.box(x! + 0.5, 10, z! + 0.5, 0.22, 4.05, 0.22, WOOD);
      solid.box(x! + 0.5, 8.15, z! + 0.5, 0.32, 0.3, 0.32, SLATE);
    }
    if (tavernRead(8, 12, 10) === Block.Stone && (hiddenRoof?.minX !== TOWN_TAVERN.minX || hiddenRoof.minZ !== TOWN_TAVERN.minZ)) {
      solid.box(8.5, 13.04, 10.02, 17.14, 0.12, 0.18, SLATE);
      solid.box(8.5, 13.04, 18.02, 17.14, 0.12, 0.18, SLATE);
      solid.box(8.5, 13.04, 19.98, 13.14, 0.12, 0.18, SLATE);
      solid.box(0.02, 13.04, 14, 0.18, 0.12, 8.1, SLATE);
      solid.box(16.98, 13.04, 14, 0.18, 0.12, 8.1, SLATE);
      solid.box(8.5, 15.05, 15, 11.1, 0.12, 4.1, COPPER);
    }
    for (const x of [0, 16]) {
      for (const z of [12, 15]) {
        if (tavernRead(x, 9, z) !== Block.Air) continue;
        const outsideX = x === 0 ? -0.04 : 17.04;
        glow.box(outsideX, 9.5, z + 0.5, 0.045, 0.72, 0.74, GOLD);
        solid.box(outsideX + (x === 0 ? -0.03 : 0.03), 9.5, z + 0.5, 0.055, 0.83, 0.09, WOOD);
      }
    }
    for (const z of [10, 19]) {
      for (const x of [4, 12]) {
        if (tavernRead(x, 9, z) !== Block.Air) continue;
        const outsideZ = z === 10 ? 9.96 : 20.04;
        glow.box(x + 0.5, 9.5, outsideZ, 0.74, 0.72, 0.045, GOLD);
        solid.box(x + 0.5, 9.5, outsideZ + (z === 10 ? -0.03 : 0.03), 0.09, 0.83, 0.055, WOOD);
      }
    }
    if (tavernRead(8, 11, 10) === Block.Dirt) {
      solid.box(8.5, 11.25, 9.94, 3.4, 0.64, 0.16, WOOD);
      solid.box(8.5, 11.25, 9.84, 2.9, 0.1, 0.04, COPPER);
      glow.box(8.5, 11.25, 9.79, 0.24, 0.38, 0.04, GOLD);
    }
    if (tavernRead(8, 12, 14) === Block.Stone && tavernRead(8, 8, 14) === Block.Air) {
      // Warm plank floor and a runner guide players between both doors.
      for (let z = 11; z <= 18; z += 1) {
        for (let x = 1; x <= 15; x += 1) {
          if (tavernRead(x, 8, z) !== Block.Air) continue;
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
      for (const [cx, worldZ] of TOWN_TAVERN_TABLE_CENTERS) {
        const cz = worldZ - TOWN_TAVERN_Z_OFFSET;
        solid.box(cx, 8.78, cz, 2.72, 0.14, 0.88, OAK);
        solid.box(cx, 8.875, cz, 2.55, 0.045, 0.7, COPPER);
        for (const dx of [-1.05, 1.05]) {
          for (const dz of [-0.28, 0.28]) solid.box(cx + dx, 8.37, cz + dz, 0.15, 0.69, 0.15, DARK_OAK);
        }
        for (const side of [-1, 1]) {
          solid.box(cx, 8.43, cz + side * 0.9, 2.62, 0.11, 0.28, OAK);
          for (const dx of [-1.08, 1.08]) solid.box(cx + dx, 8.22, cz + side * 0.9, 0.13, 0.39, 0.16, DARK_OAK);
        }
        if (cx === TOWN_TAVERN_QUIZ_TABLE_POSITION.x && worldZ === TOWN_TAVERN_QUIZ_TABLE_POSITION.z) {
          // Blue felt and gold tokens distinguish the playable table from dining tables.
          solid.box(cx, 8.91, cz, 2.31, 0.025, 0.56, CLOTH);
          for (const dx of [-0.68, -0.34, 0.34, 0.68]) {
            glow.box(cx + dx, 8.94, cz, 0.21, 0.035, 0.21, GOLD);
          }
          glow.box(cx, 9.04, cz - 0.1, 0.28, 0.2, 0.28, GOLD);
        } else {
          for (const dx of [-0.64, 0.64]) {
            solid.box(cx + dx, 8.935, cz + 0.06, 0.19, 0.14, 0.19, CREAM);
            solid.box(cx + dx + 0.12, 8.935, cz + 0.06, 0.065, 0.075, 0.08, GOLD);
          }
          glow.box(cx, 8.91, cz - 0.1, 0.34, 0.04, 0.3, GOLD);
        }
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
    if (tavernRead(3, 10, 16) === Block.Stone) {
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

    solid.offsetZ = 0;
    glow.offsetZ = 0;
    // A compact, readable smithy: heavy timber, a striped awning, working forge,
    // and metal goods. Everything stays in the two shared decorative batches.
    if (read(Math.floor(TOWN_BLACKSMITH_STALL_POSITION.x), SURFACE_HEIGHT, Math.floor(TOWN_BLACKSMITH_STALL_POSITION.z)) !== Block.Air) {
      this.blacksmithBuilt = true;
      const { x, z } = TOWN_BLACKSMITH_STALL_POSITION;
      // Counter panels and separate planks give the front a crafted texture.
      solid.box(x, 8.54, z, 3.1, 1.08, 0.7, DARK_OAK);
      for (const dx of [-1.24, -0.62, 0, 0.62, 1.24]) {
        solid.box(x + dx, 8.54, z + 0.365, 0.55, 0.93, 0.035, WOOD);
        solid.box(x + dx - 0.16, 8.38, z + 0.389, 0.22, 0.025, 0.01, OAK);
      }
      for (const dx of [-1.48, 1.48]) {
        solid.box(x + dx, 8.54, z + 0.39, 0.07, 1.03, 0.07, SOOT);
        for (const y of [8.18, 8.86]) solid.box(x + dx, y, z + 0.43, 0.08, 0.075, 0.025, COPPER);
      }
      solid.box(x, 9.13, z, 3.52, 0.15, 0.97, OAK);
      for (const dz of [-0.31, 0, 0.31]) solid.box(x, 9.225, z + dz, 3.34, 0.035, 0.27, dz === 0 ? COPPER : WOOD);
      solid.box(x, 9.16, z + 0.51, 3.6, 0.09, 0.07, SOOT);

      // The posts and canopy are broad enough to read from the game camera.
      for (const dx of [-1.78, 1.78]) for (const dz of [-1.2, 1.12]) {
        solid.box(x + dx, 9.34, z + dz, 0.19, 2.7, 0.19, WOOD);
        solid.box(x + dx, 8.12, z + dz, 0.3, 0.24, 0.3, FORGE_STONE);
        for (const y of [8.4, 10.32]) solid.box(x + dx, y, z + dz, 0.215, 0.09, 0.215, SOOT);
      }
      for (const dz of [-1.2, 1.12]) solid.box(x, 10.63, z + dz, 3.84, 0.15, 0.2, DARK_OAK);
      solid.box(x, 10.75, z - 0.05, 3.94, 0.13, 2.68, DARK_OAK);
      for (const dx of [-1.58, -1.05, -0.52, 0.01, 0.54, 1.07, 1.6]) {
        const stripe = Math.round((dx + 1.58) / 0.53) % 2 === 0;
        solid.box(x + dx, 10.84, z - 0.04, 0.49, 0.055, 2.54, stripe ? CANVAS : CANVAS_LIGHT);
        solid.box(x + dx, 10.48, z + 1.22, 0.49, 0.53, 0.055, stripe ? CANVAS : CANVAS_LIGHT);
        solid.box(x + dx, 10.48, z - 1.31, 0.49, 0.53, 0.055, stripe ? CANVAS : CANVAS_LIGHT);
        for (const seamZ of [-0.8, 0.6]) solid.box(x + dx, 10.874, z + seamZ, 0.42, 0.009, 0.016, stripe ? CANVAS_LIGHT : CREAM);
      }
      solid.box(x, 10.91, z - 0.05, 3.98, 0.08, 0.13, COPPER);
      solid.box(x, 10.18, z + 1.25, 3.84, 0.07, 0.09, GOLD);
      for (const dx of [-1.78, 1.78]) solid.box(x + dx, 10.47, z + 1.26, 0.09, 0.58, 0.07, COPPER);

      // Front-facing hanging sign: framed metal field with a simple hammer mark.
      solid.box(x, 10.09, z + 1.31, 1.84, 0.61, 0.08, DARK_OAK);
      solid.box(x, 10.09, z + 1.36, 1.65, 0.47, 0.025, SOOT);
      solid.box(x - 0.32, 10.08, z + 1.38, 0.44, 0.12, 0.03, IRON);
      solid.box(x - 0.14, 9.99, z + 1.39, 0.09, 0.3, 0.03, OAK);
      solid.box(x + 0.39, 10.04, z + 1.38, 0.52, 0.09, 0.03, IRON);
      glow.box(x + 0.39, 10.12, z + 1.38, 0.34, 0.04, 0.03, GOLD);
      for (const dx of [-0.85, 0.85]) for (const dy of [-0.2, 0.2]) solid.box(x + dx, 10.09 + dy, z + 1.39, 0.06, 0.06, 0.03, COPPER);

      // Stone forge with a dark mouth, ember bed, chimney and iron rim.
      const forgeX = x + 1.05;
      const forgeZ = z - 0.86;
      solid.box(forgeX, 8.12, forgeZ, 0.96, 0.24, 0.84, FORGE_STONE);
      for (const y of [8.32, 8.56, 8.8]) {
        for (const dx of [-0.38, 0.38]) solid.box(forgeX + dx, y, forgeZ, 0.22, 0.24, 0.76, y === 8.56 ? SLATE : FORGE_STONE);
        solid.box(forgeX, y, forgeZ - 0.28, 0.58, 0.23, 0.18, FORGE_STONE);
      }
      solid.box(forgeX, 8.68, forgeZ + 0.03, 0.56, 0.43, 0.52, SOOT);
      glow.box(forgeX, 8.59, forgeZ + 0.27, 0.48, 0.14, 0.09, EMBER);
      glow.box(forgeX - 0.13, 8.79, forgeZ + 0.28, 0.12, 0.28, 0.08, GOLD);
      glow.box(forgeX + 0.12, 8.76, forgeZ + 0.28, 0.11, 0.21, 0.08, EMBER);
      solid.box(forgeX, 9.06, forgeZ, 1.02, 0.14, 0.9, IRON);
      solid.box(forgeX + 0.3, 9.59, forgeZ - 0.32, 0.36, 1.0, 0.38, FORGE_STONE);
      solid.box(forgeX + 0.3, 10.12, forgeZ - 0.32, 0.45, 0.1, 0.46, SOOT);
      // The stack rises above the awning so the workshop reads from a distance.
      solid.box(forgeX + 0.3, 11.38, forgeZ - 0.32, 0.42, 1.0, 0.42, FORGE_STONE);
      for (const y of [11.02, 11.48, 11.84]) solid.box(forgeX + 0.3, y, forgeZ - 0.32, 0.47, 0.08, 0.47, SLATE);
      solid.box(forgeX + 0.3, 11.93, forgeZ - 0.32, 0.56, 0.11, 0.56, SOOT);

      // Anvil on a banded stump, with a narrow horn and polished working face.
      const anvilX = x - 1.02;
      const anvilZ = z - 0.75;
      solid.box(anvilX, 8.36, anvilZ, 0.56, 0.72, 0.56, WOOD);
      for (const y of [8.14, 8.6]) solid.box(anvilX, y, anvilZ, 0.61, 0.075, 0.61, SOOT);
      solid.box(anvilX, 8.77, anvilZ, 0.64, 0.12, 0.46, SOOT);
      solid.box(anvilX, 8.94, anvilZ, 0.34, 0.32, 0.3, IRON);
      solid.box(anvilX, 9.13, anvilZ, 0.79, 0.13, 0.48, IRON);
      solid.box(anvilX - 0.49, 9.1, anvilZ, 0.27, 0.11, 0.21, SLATE);
      solid.box(anvilX, 9.205, anvilZ, 0.7, 0.025, 0.37, CREAM);

      // The smith stands behind the counter in a leather apron with a raised hammer.
      solid.box(x - 0.2, 8.34, z - 1.06, 0.48, 0.62, 0.35, SOOT);
      solid.box(x - 0.2, 8.92, z - 1.06, 0.57, 0.63, 0.36, WOOD);
      solid.box(x - 0.2, 8.84, z - 0.85, 0.4, 0.57, 0.035, COPPER);
      solid.box(x - 0.2, 9.48, z - 1.06, 0.42, 0.41, 0.42, CREAM);
      solid.box(x - 0.2, 9.73, z - 1.06, 0.49, 0.15, 0.48, DARK_OAK);
      solid.box(x + 0.17, 9.13, z - 1.03, 0.18, 0.52, 0.23, WOOD);
      solid.box(x + 0.17, 9.43, z - 0.96, 0.16, 0.2, 0.18, CREAM);
      solid.box(x + 0.17, 9.64, z - 0.96, 0.065, 0.35, 0.065, OAK);
      solid.box(x + 0.17, 9.83, z - 0.96, 0.32, 0.13, 0.18, IRON);

      // Iron stock and ore samples on the counter make the trade legible.
      for (const dx of [-1.12, -0.86, 0.48, 0.76]) {
        solid.box(x + dx, 9.36, z + 0.05, 0.19, 0.2, 0.2, dx < 0 ? FORGE_STONE : IRON);
        solid.box(x + dx - 0.035, 9.48, z + 0.07, 0.08, 0.07, 0.09, dx < 0 ? COPPER : SLATE);
      }
      for (const dx of [-0.68, -0.47, -0.26]) glow.box(x + dx, 9.28, z + 0.27, 0.15, 0.045, 0.15, GOLD);
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
      { x: -14, z: 8, sx: 1, sz: 2 }, { x: 30, z: 8, sx: 1, sz: 2 },
      { x: 8, z: -14, sx: 2, sz: 1 }, { x: 8, z: 30, sx: 2, sz: 1 },
    ]) {
      if (read(gate.x, 10, gate.z) !== Block.Stone) continue;
      solid.box(gate.x + gate.sx / 2, 11.035, gate.z + gate.sz / 2, gate.sx + 0.12, 0.12, gate.sz + 0.12, COPPER);
    }
    if (read(TOWN_BEACON_POSITION.x, 11, TOWN_BEACON_POSITION.z) === Block.IronOre) {
      const beaconX = TOWN_BEACON_POSITION.x + 0.5;
      const beaconZ = TOWN_BEACON_POSITION.z + 0.5;
      for (const y of [9, 10, 11]) {
        solid.box(beaconX, y + 0.05, beaconZ, 1.055, 0.12, 1.055, COPPER);
        glow.box(beaconX, y + 0.47, beaconZ + 0.515, 0.23, 0.56, 0.035, GOLD);
        glow.box(beaconX + 0.515, y + 0.47, beaconZ, 0.035, 0.56, 0.23, GOLD);
      }
      solid.box(beaconX, 12.015, beaconZ, 1.1, 0.12, 1.1, SLATE);
    }

    const furnishedTavern = tavernRead(5, 8, 18) === Block.Air && tavernRead(8, 12, 14) === Block.Stone;
    if (furnishedTavern) {
      solid.offsetZ = TOWN_TAVERN_Z_OFFSET;
      this.createSeatedPatrons(solid);
      solid.offsetZ = 0;
    }
    for (const [batch, material, castsShadow] of [[solid, this.material, true], [glow, this.glow, false]] as const) {
      const mesh = batch.mesh(this.app.graphicsDevice);
      if (!mesh) continue;
      this.meshes.push(mesh);
      const entity = new pc.Entity("batched-world-details");
      entity.addComponent("render", { meshInstances: [new pc.MeshInstance(mesh, material)], castShadows: castsShadow, receiveShadows: true });
      this.root.addChild(entity);
    }
    if (tavernRead(3, 10, 16) === Block.Stone) {
      this.fireLight = new pc.Entity("tavern-hearth-light");
      this.fireLight.addComponent("light", { type: "omni", color: new pc.Color(1, 0.39, 0.13), intensity: 1.35, range: 7, castShadows: false });
      this.fireLight.setPosition(4.3, 9.3, 16.5 + TOWN_TAVERN_Z_OFFSET);
      this.root.addChild(this.fireLight);
      for (const [x, z] of [[4.5, 13.5], [12.5, 14.7]] as const) {
        const lantern = new pc.Entity("tavern-lantern-light");
        lantern.addComponent("light", { type: "omni", color: new pc.Color(1, 0.64, 0.31), intensity: 0.5, range: 5, castShadows: false });
        lantern.setPosition(x, 10.4, z + TOWN_TAVERN_Z_OFFSET);
        this.root.addChild(lantern);
      }
    }
    if (this.blacksmithBuilt) {
      this.forgeLight = new pc.Entity("blacksmith-forge-light");
      this.forgeLight.addComponent("light", { type: "omni", color: new pc.Color(1, 0.35, 0.09), intensity: 0.85, range: 4.5, castShadows: false });
      this.forgeLight.setPosition(TOWN_BLACKSMITH_STALL_POSITION.x + 1.05, 8.75, TOWN_BLACKSMITH_STALL_POSITION.z - 0.58);
      this.root.addChild(this.forgeLight);
    }
    if (campVisible) {
      this.campfireLight = new pc.Entity("greenwood-campfire-light");
      this.campfireLight.addComponent("light", { type: "omni", color: new pc.Color(1, 0.42, 0.12), intensity: 0.9, range: 6, castShadows: false });
      this.campfireLight.setPosition((GREENWOOD_CAMP.minX + GREENWOOD_CAMP.maxX) / 2 + 0.5, 8.7, (GREENWOOD_CAMP.minZ + GREENWOOD_CAMP.maxZ) / 2 + 0.5);
      this.root.addChild(this.campfireLight);
    }
    if (furnishedTavern) this.createTavernKeeper();
  }
}
