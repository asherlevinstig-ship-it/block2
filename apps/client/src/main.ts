import * as pc from "playcanvas";
import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import {
  BRAMBLE_SNARE,
  MAIN_HAND_DEFINITIONS,
  MOMENTUM_TRAIT,
  TRAIT_DEFINITIONS,
  HUNTERS_MARK,
  ITEM_DEFINITIONS,
  POWER_DEFINITIONS,
  SEISMIC_CLEAVE_UPGRADES,
  SPECIAL_DEFINITIONS,
  WEAPON_ATTACK_DEFINITIONS,
  WORLD_ROOM,
  type ActionRejected,
  type BlockChanged,
  type BrambleSnarePlaced,
  type BrambleSnareTriggered,
  type ChunkSnapshot,
  type CombatHit,
  type CombatMiss,
  type CombatReward,
  type CombatStagger,
  type DefenseResolved,
  type ItemId,
  type LootPickedUp,
  type MainHandId,
  type MobHazardPlaced,
  type MobProjectileReleased,
  type PlayerHit,
  type PowerCast,
  type PowerCancelled,
  type PowerId,
  type PowerResolved,
  type SeismicMasteryId,
  type SpecialApplied,
  type SpecialConsumed,
  type SpecialProgressed,
  type SpecialId,
  type TraitId,
  type WorldBootstrap,
  type WeaponAttackReleased,
} from "@blockcraft/protocol";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  SURFACE_HEIGHT,
  TERMINAL_VELOCITY,
  chunkIndex,
  isProtectedVoxel,
  isPlayerSupported,
  resolvePlayerMotion,
  voxelRaycast,
  worldToChunk,
  type BlockId,
  type VoxelRaycastHit,
} from "@blockcraft/voxel-world";
import {
  REMOTE_INTERPOLATION_DELAY_MS,
  approachMovement,
  approachYaw,
  cameraRelativeMovement,
  localReconciliationRate,
  movementDirectionChanged,
  movementYaw,
  quantizeMovementToEightDirections,
  reconciliationVerticalTarget,
  sampleRemotePose,
  smoothVerticalOffset,
  trimRemoteSnapshots,
  type RemoteSnapshot,
} from "./movement-network.js";
import {
  bootstrapSliceHeight,
  isAtSurfaceReturnHeight,
  isBelowSurroundingSurface,
  isVoxelHiddenForPlayer,
  loweredSliceHeight,
  restoredSliceHeight,
  shouldUseDepthSlice,
  type PlayerCutaway,
} from "./player-visibility.js";
import { MILESTONE_EXIT_STEPS } from "./exit-guidance.js";
import { createVoxelTexturePixels, type VoxelTextureKind } from "./voxel-textures.js";
import { retryConnection } from "./connection-retry.js";
import {
  alternateInteractionMode,
  primaryActionForMode,
  type InteractionMode,
} from "./interaction-mode.js";
import {
  PRIMARY_ACTION_DURATION_MS,
  advanceLocomotionAnimation,
  eruptionPowerPose,
  lungePowerPose,
  primaryActionPose,
  seismicPowerPose,
  shockwavePowerPose,
  voxelCharacterPose,
} from "./character-animation.js";
import { isPowerCompatibleWithMainHand } from "./power-loadout.js";
import { createGuestProfileToken, getOrCreateProfileToken } from "./player-profile.js";
import { CombatAudio, enemyCuePan, enemyCuesForTransition, type EnemyCue, type EnemyCueSnapshot } from "./combat-audio.js";
import "./styles.css";

function newGuestProfileToken() {
  return createGuestProfileToken(crypto.getRandomValues(new Uint8Array(16)));
}

function browserProfileToken() {
  try {
    return getOrCreateProfileToken(window.localStorage, newGuestProfileToken);
  } catch {
    return newGuestProfileToken();
  }
}

const profileToken = browserProfileToken();

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const targetLabel = document.querySelector<HTMLElement>("#target")!;
const playerCount = document.querySelector<HTMLElement>("#players")!;
const dangerZone = document.querySelector<HTMLElement>("#danger-zone")!;
const dangerZoneName = document.querySelector<HTMLElement>("#danger-zone-name")!;
const dangerZoneTier = document.querySelector<HTMLElement>("#danger-zone-tier")!;
const dangerZoneDetail = document.querySelector<HTMLElement>("#danger-zone-detail")!;
const exitGuide = document.querySelector<HTMLElement>("#exit-guide")!;
const performanceToggle = document.querySelector<HTMLButtonElement>("#performance-toggle")!;
const performancePanel = document.querySelector<HTMLElement>("#performance-panel")!;
const movementDebug = document.querySelector<HTMLDetailsElement>("#movement-debug")!;
const movementDebugLive = document.querySelector<HTMLElement>("#movement-debug-live")!;
const movementDebugEvents = document.querySelector<HTMLOListElement>("#movement-debug-events")!;
const movementDebugCopy = document.querySelector<HTMLButtonElement>("#movement-debug-copy")!;
const movementDebugTrace = document.querySelector<HTMLElement>("#movement-debug-trace")!;
const playerHealthFill = document.querySelector<HTMLElement>("#player-health-fill")!;
const playerHealthValue = document.querySelector<HTMLElement>("#player-health-value")!;
const playerStaminaFill = document.querySelector<HTMLElement>("#player-stamina-fill")!;
const playerStaminaValue = document.querySelector<HTMLElement>("#player-stamina-value")!;
const defenseSlot = document.querySelector<HTMLButtonElement>("#defense-slot")!;
const traitSlot = document.querySelector<HTMLElement>("#trait-slot")!;
const traitName = document.querySelector<HTMLElement>("#trait-name")!;
const traitDetail = document.querySelector<HTMLElement>("#trait-detail")!;
const traitBonus = document.querySelector<HTMLElement>("#trait-bonus")!;
const traitPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#trait-picker [data-trait]")];
const momentumPips = [...document.querySelectorAll<HTMLElement>("#momentum-pips i")];
const powerSlot = document.querySelector<HTMLButtonElement>("#power-slot")!;
const powerName = document.querySelector<HTMLElement>("#power-name")!;
const powerPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#power-picker [data-power]")];
const mainHandPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#main-hand-picker [data-main-hand]")];
const mainHandName = document.querySelector<HTMLElement>("#main-hand-name")!;
const mainHandAttack = document.querySelector<HTMLElement>("#main-hand-attack")!;
const powerCooldownFill = document.querySelector<HTMLElement>("#power-cooldown-fill")!;
const powerCooldownLabel = document.querySelector<HTMLElement>("#power-cooldown-label")!;
const seismicUpgrades = document.querySelector<HTMLElement>("#seismic-upgrades")!;
const seismicMasteryButtons = [...document.querySelectorAll<HTMLButtonElement>("#seismic-mastery-picker [data-seismic-mastery]")];
const specialSlot = document.querySelector<HTMLButtonElement>("#special-slot")!;
const specialName = document.querySelector<HTMLElement>("#special-name")!;
const specialPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#special-picker [data-special]")];
const specialCooldownFill = document.querySelector<HTMLElement>("#special-cooldown-fill")!;
const specialCooldownLabel = document.querySelector<HTMLElement>("#special-cooldown-label")!;
const controlsHelp = document.querySelector<HTMLElement>("#controls-help")!;
const combatReticle = document.querySelector<HTMLElement>("#combat-reticle")!;
const combatFeedback = document.querySelector<HTMLElement>("#combat-feedback")!;
const inventoryPanel = document.querySelector<HTMLElement>("#inventory-panel")!;
const inventoryTotal = document.querySelector<HTMLElement>("#inventory-total")!;
const inventoryCountElements = new Map<ItemId, HTMLElement>(
  [...document.querySelectorAll<HTMLElement>("[data-item-count]")].map(element => [element.dataset.itemCount as ItemId, element]),
);
const inventoryEquipButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-equip-main-hand]")];
const performanceFields = {
  frame: document.querySelector<HTMLElement>("#perf-frame")!,
  fps: document.querySelector<HTMLElement>("#perf-fps")!,
  rtt: document.querySelector<HTMLElement>("#perf-rtt")!,
  voxels: document.querySelector<HTMLElement>("#perf-voxels")!,
  geometry: document.querySelector<HTMLElement>("#perf-geometry")!,
  chunks: document.querySelector<HTMLElement>("#perf-chunks")!,
  payload: document.querySelector<HTMLElement>("#perf-payload")!,
  memory: document.querySelector<HTMLElement>("#perf-memory")!,
  budget: document.querySelector<HTMLElement>("#perf-budget")!,
};
const joystickZone = document.querySelector<HTMLElement>("#joystick-zone")!;
const joystickKnob = document.querySelector<HTMLElement>("#joystick-knob")!;
const mineButton = document.querySelector<HTMLButtonElement>("#mine-button")!;
const dodgeButton = document.querySelector<HTMLButtonElement>("#dodge-button")!;
const defenseButton = document.querySelector<HTMLButtonElement>("#defense-button")!;
const powerButton = document.querySelector<HTMLButtonElement>("#power-button")!;
const specialButton = document.querySelector<HTMLButtonElement>("#special-button")!;
const touchModeButton = document.querySelector<HTMLButtonElement>("#touch-mode-button")!;
const touchModeLabel = document.querySelector<HTMLElement>("#touch-mode-label")!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("#mode-toggle [data-mode]")];
if (!canvas || !status || !targetLabel || !playerCount || !dangerZone || !dangerZoneName || !dangerZoneTier || !dangerZoneDetail || !exitGuide || !performanceToggle || !performancePanel || !inventoryPanel || !inventoryTotal || inventoryCountElements.size !== Object.keys(ITEM_DEFINITIONS).length || inventoryEquipButtons.length !== 3 || !movementDebug || !movementDebugLive || !movementDebugEvents || !movementDebugCopy || !joystickZone || !joystickKnob || !mineButton || !dodgeButton || !defenseButton || !powerButton || !specialButton || !touchModeButton || !touchModeLabel || !defenseSlot || !traitSlot || !traitName || !traitDetail || !traitBonus || traitPickerButtons.length !== 3 || momentumPips.length !== MOMENTUM_TRAIT.maxStacks || !powerSlot || !powerName || !seismicUpgrades || seismicMasteryButtons.length !== 2 || !specialSlot || !specialName || !specialCooldownFill || !specialCooldownLabel || powerPickerButtons.length !== 4 || specialPickerButtons.length !== 2 || mainHandPickerButtons.length !== 3 || !mainHandName || !mainHandAttack || !powerCooldownFill || !powerCooldownLabel || !controlsHelp || !playerHealthFill || !playerHealthValue || !playerStaminaFill || !playerStaminaValue || !combatReticle || !combatFeedback || modeButtons.length !== 2) {
  throw new Error("Game shell is missing required elements");
}

function applyDefensePose(rig: VoxelCharacterRig): void {
  rig.torso.setLocalEulerAngles(7, 0, 0);
  rig.leftArm.setLocalEulerAngles(-82, 0, -32);
  rig.rightArm.setLocalEulerAngles(-68, 0, 28);
}

if (window.matchMedia("(pointer: coarse), (max-width: 820px)").matches) {
  movementDebug.open = false;
}

const app = new pc.Application(canvas, {
  graphicsDeviceOptions: { antialias: true, alpha: false },
  mouse: new pc.Mouse(canvas),
  touch: new pc.TouchDevice(canvas),
});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight = new pc.Color(0.36, 0.42, 0.38);
app.start();

const camera = new pc.Entity("camera");
camera.addComponent("camera", { clearColor: new pc.Color(0.055, 0.09, 0.075), farClip: 120 });
app.root.addChild(camera);
const CAMERA_OFFSET_X = 16;
const CAMERA_OFFSET_Z = 16;

const light = new pc.Entity("sun");
light.addComponent("light", { type: "directional", intensity: 1.35, castShadows: true, shadowResolution: 1024 });
light.setEulerAngles(48, 32, 0);
app.root.addChild(light);

const caveLight = new pc.Entity("explorer-lantern");
caveLight.addComponent("light", { type: "omni", color: new pc.Color(1, 0.72, 0.38), intensity: 1.1, range: 10 });
caveLight.enabled = false;
app.root.addChild(caveLight);

const worldRoot = new pc.Entity("voxel-world");
app.root.addChild(worldRoot);

const exitTrail = new pc.Entity("exit-trail");
const exitTrailMaterial = new pc.StandardMaterial();
exitTrailMaterial.diffuse = new pc.Color(1, 0.72, 0.08);
exitTrailMaterial.emissive = new pc.Color(0.82, 0.34, 0.01);
exitTrailMaterial.opacity = 0.88;
exitTrailMaterial.blendType = pc.BLEND_NORMAL;
exitTrailMaterial.depthWrite = false;
exitTrailMaterial.update();
for (const step of MILESTONE_EXIT_STEPS) {
  const marker = new pc.Entity("exit-step");
  marker.addComponent("render", { type: "box", castShadows: false });
  if (marker.render) marker.render.material = exitTrailMaterial;
  marker.setLocalScale(0.72, 0.06, 0.72);
  marker.setPosition(step.x, step.topY + 0.04, step.z);
  exitTrail.addChild(marker);
}
exitTrail.enabled = false;
app.root.addChild(exitTrail);

const materials = new Map<VoxelTextureKind, pc.StandardMaterial>();

function textureKindFor(block: number, normalY: number): VoxelTextureKind {
  if (block === Block.Bedrock) return "bedrock";
  if (block === Block.Stone) return "stone";
  if (block === Block.Dirt) return "dirt";
  if (block === Block.Grass) return normalY > 0 ? "grass-top" : "grass-side";
  return "iron";
}

function createVoxelTexture(kind: VoxelTextureKind): pc.Texture {
  const size = 16;
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = size;
  canvasTexture.height = size;
  const context = canvasTexture.getContext("2d")!;
  const imageData = context.createImageData(size, size);
  imageData.data.set(createVoxelTexturePixels(kind, size));
  context.putImageData(imageData, 0, 0);
  const texture = new pc.Texture(app.graphicsDevice, {
    width: size,
    height: size,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_REPEAT,
  });
  texture.setSource(canvasTexture);
  return texture;
}

function materialFor(kind: VoxelTextureKind): pc.StandardMaterial {
  let material = materials.get(kind);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 1, 1);
    material.diffuseMap = createVoxelTexture(kind);
    material.specular = new pc.Color(0.05, 0.05, 0.05);
    material.gloss = 8;
    material.update();
    materials.set(kind, material);
  }
  return material;
}

const faces = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
] as const;

interface ClientChunk {
  chunkX: number;
  chunkZ: number;
  revision: number;
  blocks: Uint8Array;
  root: pc.Entity;
  meshes: pc.Mesh[];
  visibleBlocks: number;
  visibleFaces: number;
}

const chunks = new Map<string, ClientChunk>();
const playerCutaway: PlayerCutaway = {
  active: false,
  sliceY: CHUNK_HEIGHT,
};

function chunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

function readWorldBlock(x: number, y: number, z: number): BlockId {
  if (y < 0 || y >= CHUNK_HEIGHT) return Block.Air;
  const address = worldToChunk(x, z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk) return Block.Air;
  return (chunk.blocks[chunkIndex(address.localX, y, address.localZ)] ?? Block.Air) as BlockId;
}

function readCollisionWorldBlock(x: number, y: number, z: number): BlockId {
  if (y < 0) return Block.Bedrock;
  if (y >= CHUNK_HEIGHT) return Block.Air;
  const address = worldToChunk(x, z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk) return Block.Bedrock;
  return (chunk.blocks[chunkIndex(address.localX, y, address.localZ)] ?? Block.Air) as BlockId;
}

function isCutawayHidden(x: number, y: number, z: number): boolean {
  return isVoxelHiddenForPlayer(x, y, z, playerCutaway);
}

function readVisibleWorldBlock(x: number, y: number, z: number): BlockId {
  return isCutawayHidden(x, y, z) ? Block.Air : readWorldBlock(x, y, z);
}

function rebuildChunk(chunk: ClientChunk): void {
  for (const mesh of chunk.meshes) mesh.destroy();
  chunk.meshes = [];
  for (const child of [...chunk.root.children]) child.destroy();
  chunk.visibleBlocks = 0;
  chunk.visibleFaces = 0;
  const buffers = new Map<VoxelTextureKind, { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }>();
  for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const block = chunk.blocks[chunkIndex(localX, y, localZ)] ?? Block.Air;
        if (block === Block.Air) continue;
        const x = chunk.chunkX * CHUNK_SIZE + localX;
        const z = chunk.chunkZ * CHUNK_SIZE + localZ;
        if (isCutawayHidden(x, y, z)) continue;
        chunk.visibleBlocks += 1;
        for (const face of faces) {
          const neighbor = readVisibleWorldBlock(x + face.normal[0], y + face.normal[1], z + face.normal[2]);
          if (neighbor !== Block.Air) continue;
          const textureKind = textureKindFor(block, face.normal[1]);
          let buffer = buffers.get(textureKind);
          if (!buffer) {
            buffer = { positions: [], normals: [], uvs: [], indices: [] };
            buffers.set(textureKind, buffer);
          }
          chunk.visibleFaces += 1;
          const base = buffer.positions.length / 3;
          for (const corner of face.corners) {
            buffer.positions.push(x + corner[0], y + corner[1], z + corner[2]);
            buffer.normals.push(...face.normal);
          }
          buffer.uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
          buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  const meshInstances: pc.MeshInstance[] = [];
  for (const [textureKind, buffer] of buffers) {
    if (buffer.indices.length === 0) continue;
    const geometry = new pc.Geometry();
    geometry.positions = buffer.positions;
    geometry.normals = buffer.normals;
    geometry.uvs = buffer.uvs;
    geometry.indices = buffer.indices;
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry);
    chunk.meshes.push(mesh);
    meshInstances.push(new pc.MeshInstance(mesh, materialFor(textureKind)));
  }
  if (meshInstances.length === 0) return;
  const entity = new pc.Entity(`chunk-mesh:${chunk.chunkX},${chunk.chunkZ}`);
  entity.addComponent("render", { meshInstances, castShadows: true, receiveShadows: true });
  chunk.root.addChild(entity);
}

function installChunk(snapshot: ChunkSnapshot): ClientChunk {
  const key = chunkKey(snapshot.chunkX, snapshot.chunkZ);
  const previous = chunks.get(key);
  for (const mesh of previous?.meshes ?? []) mesh.destroy();
  previous?.root.destroy();
  const root = new pc.Entity(`chunk:${key}`);
  worldRoot.addChild(root);
  const chunk = {
    chunkX: snapshot.chunkX,
    chunkZ: snapshot.chunkZ,
    revision: snapshot.revision,
    blocks: Uint8Array.from(snapshot.blocks),
    root,
    meshes: [],
    visibleBlocks: 0,
    visibleFaces: 0,
  };
  chunks.set(key, chunk);
  return chunk;
}

function rebuildChunkAndNeighbors(chunk: ClientChunk, x: number, z: number): void {
  rebuildChunk(chunk);
  const address = worldToChunk(x, z);
  const neighborKeys = new Set<string>();
  if (address.localX === 0) neighborKeys.add(chunkKey(address.chunkX - 1, address.chunkZ));
  if (address.localX === CHUNK_SIZE - 1) neighborKeys.add(chunkKey(address.chunkX + 1, address.chunkZ));
  if (address.localZ === 0) neighborKeys.add(chunkKey(address.chunkX, address.chunkZ - 1));
  if (address.localZ === CHUNK_SIZE - 1) neighborKeys.add(chunkKey(address.chunkX, address.chunkZ + 1));
  for (const key of neighborKeys) {
    const neighbor = chunks.get(key);
    if (neighbor) rebuildChunk(neighbor);
  }
}

const localPlayer = new pc.Entity("local-player");
const silhouetteMaterial = new pc.StandardMaterial();
silhouetteMaterial.diffuse = new pc.Color(1, 0.72, 0.18);
silhouetteMaterial.emissive = new pc.Color(1, 0.42, 0.04);
silhouetteMaterial.opacity = 0.22;
silhouetteMaterial.blendType = pc.BLEND_NORMAL;
silhouetteMaterial.depthTest = false;
silhouetteMaterial.depthWrite = false;
silhouetteMaterial.update();

const skinMaterial = new pc.StandardMaterial();
skinMaterial.diffuse = new pc.Color(0.78, 0.53, 0.32);
skinMaterial.update();
const hairMaterial = new pc.StandardMaterial();
hairMaterial.diffuse = new pc.Color(0.12, 0.075, 0.045);
hairMaterial.update();
const bootMaterial = new pc.StandardMaterial();
bootMaterial.diffuse = new pc.Color(0.12, 0.14, 0.16);
bootMaterial.update();
const faceMaterial = new pc.StandardMaterial();
faceMaterial.diffuse = new pc.Color(0.035, 0.045, 0.05);
faceMaterial.emissive = new pc.Color(0.02, 0.03, 0.035);
faceMaterial.update();
const bladeMaterial = coloredMaterial(new pc.Color(0.62, 0.72, 0.76));
const weaponWoodMaterial = coloredMaterial(new pc.Color(0.34, 0.19, 0.08));
const fangWeaponMaterial = coloredMaterial(new pc.Color(0.9, 0.84, 0.66));
const coreWeaponMaterial = coloredMaterial(new pc.Color(0.42, 0.52, 0.56));
const coreGlowMaterial = new pc.StandardMaterial();
coreGlowMaterial.diffuse = new pc.Color(0.95, 0.48, 0.08);
coreGlowMaterial.emissive = new pc.Color(0.55, 0.18, 0.02);
coreGlowMaterial.update();
const acidWeaponMaterial = new pc.StandardMaterial();
acidWeaponMaterial.diffuse = new pc.Color(0.48, 0.82, 0.12);
acidWeaponMaterial.emissive = new pc.Color(0.2, 0.55, 0.04);
acidWeaponMaterial.update();
const focusMaterial = new pc.StandardMaterial();
focusMaterial.diffuse = new pc.Color(0.2, 0.52, 0.96);
focusMaterial.emissive = new pc.Color(0.08, 0.3, 0.85);
focusMaterial.update();

function coloredMaterial(color: pc.Color): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.update();
  return material;
}

interface VoxelCharacterRig {
  root: pc.Entity;
  torso: pc.Entity;
  head: pc.Entity;
  leftArm: pc.Entity;
  rightArm: pc.Entity;
  leftLeg: pc.Entity;
  rightLeg: pc.Entity;
  silhouette: pc.Entity | null;
  mainHands: Record<MainHandId, pc.Entity>;
  locomotionPhase: number;
  locomotionWeight: number;
}

function addBox(
  parent: pc.Entity,
  name: string,
  material: pc.StandardMaterial,
  scale: [number, number, number],
  position: [number, number, number],
): pc.Entity {
  const box = new pc.Entity(name);
  box.addComponent("render", { type: "box", castShadows: true });
  if (box.render) box.render.material = material;
  box.setLocalScale(...scale);
  box.setLocalPosition(...position);
  parent.addChild(box);
  return box;
}

function createVoxelCharacter(parent: pc.Entity, clothing: pc.StandardMaterial, withSilhouette = false): VoxelCharacterRig {
  const root = new pc.Entity("voxel-character");
  parent.addChild(root);
  const torso = addBox(root, "torso", clothing, [0.48, 0.55, 0.3], [0, 0.82, 0]);
  const head = addBox(root, "head", skinMaterial, [0.38, 0.38, 0.38], [0, 1.28, 0]);
  addBox(head, "hair", hairMaterial, [0.4, 0.1, 0.4], [0, 0.2, 0]);
  addBox(head, "left-eye", faceMaterial, [0.055, 0.055, 0.025], [-0.09, 0.045, 0.2]);
  addBox(head, "right-eye", faceMaterial, [0.055, 0.055, 0.025], [0.09, 0.045, 0.2]);

  const leftArm = new pc.Entity("left-arm-pivot");
  leftArm.setLocalPosition(-0.34, 1.03, 0);
  root.addChild(leftArm);
  addBox(leftArm, "left-arm", clothing, [0.17, 0.46, 0.18], [0, -0.22, 0]);
  addBox(leftArm, "left-hand", skinMaterial, [0.18, 0.14, 0.19], [0, -0.48, 0]);

  const rightArm = new pc.Entity("right-arm-pivot");
  rightArm.setLocalPosition(0.34, 1.03, 0);
  root.addChild(rightArm);
  addBox(rightArm, "right-arm", clothing, [0.17, 0.46, 0.18], [0, -0.22, 0]);
  addBox(rightArm, "right-hand", skinMaterial, [0.18, 0.14, 0.19], [0, -0.48, 0]);

  const longsword = new pc.Entity("main-hand-longsword");
  longsword.setLocalPosition(0, -0.62, 0.1);
  addBox(longsword, "sword-grip", weaponWoodMaterial, [0.08, 0.28, 0.08], [0, 0, 0]);
  addBox(longsword, "sword-guard", weaponWoodMaterial, [0.32, 0.07, 0.1], [0, -0.13, 0]);
  addBox(longsword, "sword-blade", bladeMaterial, [0.12, 0.72, 0.08], [0, -0.54, 0]);
  rightArm.addChild(longsword);

  const bow = new pc.Entity("main-hand-bow");
  bow.setLocalPosition(0, -0.64, 0.1);
  addBox(bow, "bow-center", weaponWoodMaterial, [0.08, 0.34, 0.08], [0, 0, 0]);
  const bowTop = addBox(bow, "bow-top", weaponWoodMaterial, [0.08, 0.42, 0.08], [0.1, -0.31, 0]);
  bowTop.setLocalEulerAngles(0, 0, 24);
  const bowBottom = addBox(bow, "bow-bottom", weaponWoodMaterial, [0.08, 0.42, 0.08], [-0.1, 0.31, 0]);
  bowBottom.setLocalEulerAngles(0, 0, 24);
  rightArm.addChild(bow);

  const magicFocus = new pc.Entity("main-hand-magic-focus");
  magicFocus.setLocalPosition(0, -0.68, 0.11);
  addBox(magicFocus, "focus-handle", weaponWoodMaterial, [0.09, 0.45, 0.09], [0, 0, 0]);
  addBox(magicFocus, "focus-crystal", focusMaterial, [0.25, 0.25, 0.25], [0, -0.34, 0]);
  rightArm.addChild(magicFocus);

  const fangDagger = new pc.Entity("main-hand-fang-dagger");
  fangDagger.setLocalPosition(0, -0.6, 0.1);
  addBox(fangDagger, "dagger-grip", weaponWoodMaterial, [0.09, 0.25, 0.09], [0, 0, 0]);
  addBox(fangDagger, "dagger-guard", fangWeaponMaterial, [0.25, 0.07, 0.11], [0, -0.12, 0]);
  const fangBlade = addBox(fangDagger, "dagger-fang", fangWeaponMaterial, [0.16, 0.46, 0.11], [0, -0.38, 0]);
  fangBlade.setLocalEulerAngles(0, 0, 8);
  rightArm.addChild(fangDagger);

  const stoneCoreHammer = new pc.Entity("main-hand-stone-core-hammer");
  stoneCoreHammer.setLocalPosition(0, -0.66, 0.1);
  addBox(stoneCoreHammer, "hammer-handle", weaponWoodMaterial, [0.11, 0.74, 0.11], [0, -0.2, 0]);
  addBox(stoneCoreHammer, "hammer-head", coreWeaponMaterial, [0.62, 0.34, 0.38], [0, -0.62, 0]);
  addBox(stoneCoreHammer, "hammer-core", coreGlowMaterial, [0.2, 0.22, 0.4], [0, -0.62, 0]);
  rightArm.addChild(stoneCoreHammer);

  const acidGlandFocus = new pc.Entity("main-hand-acid-gland-focus");
  acidGlandFocus.setLocalPosition(0, -0.68, 0.11);
  addBox(acidGlandFocus, "acid-focus-handle", weaponWoodMaterial, [0.1, 0.48, 0.1], [0, 0, 0]);
  addBox(acidGlandFocus, "acid-focus-cage", coreWeaponMaterial, [0.34, 0.1, 0.34], [0, -0.34, 0]);
  addBox(acidGlandFocus, "acid-focus-gland", acidWeaponMaterial, [0.25, 0.3, 0.25], [0, -0.42, 0]);
  rightArm.addChild(acidGlandFocus);

  const mainHands = {
    longsword,
    bow,
    magic_focus: magicFocus,
    fang_dagger: fangDagger,
    stone_core_hammer: stoneCoreHammer,
    acid_gland_focus: acidGlandFocus,
  };
  bow.enabled = false;
  magicFocus.enabled = false;
  fangDagger.enabled = false;
  stoneCoreHammer.enabled = false;
  acidGlandFocus.enabled = false;

  const leftLeg = new pc.Entity("left-leg-pivot");
  leftLeg.setLocalPosition(-0.13, 0.56, 0);
  root.addChild(leftLeg);
  addBox(leftLeg, "left-leg", bootMaterial, [0.2, 0.5, 0.22], [0, -0.25, 0]);
  addBox(leftLeg, "left-boot", bootMaterial, [0.21, 0.16, 0.31], [0, -0.48, 0.055]);

  const rightLeg = new pc.Entity("right-leg-pivot");
  rightLeg.setLocalPosition(0.13, 0.56, 0);
  root.addChild(rightLeg);
  addBox(rightLeg, "right-leg", bootMaterial, [0.2, 0.5, 0.22], [0, -0.25, 0]);
  addBox(rightLeg, "right-boot", bootMaterial, [0.21, 0.16, 0.31], [0, -0.48, 0.055]);

  let silhouette: pc.Entity | null = null;
  if (withSilhouette) {
    silhouette = new pc.Entity("player-silhouette");
    addBox(silhouette, "silhouette-body", silhouetteMaterial, [0.62, 1.02, 0.42], [0, 0.72, 0]);
    addBox(silhouette, "silhouette-head", silhouetteMaterial, [0.46, 0.46, 0.46], [0, 1.28, 0]);
    silhouette.enabled = false;
    root.addChild(silhouette);
  }
  return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg, silhouette, mainHands, locomotionPhase: 0, locomotionWeight: 0 };
}

function setRigMainHand(rig: VoxelCharacterRig, mainHandId: MainHandId): void {
  for (const [id, entity] of Object.entries(rig.mainHands)) entity.enabled = id === mainHandId;
}

function animateVoxelCharacter(
  rig: VoxelCharacterRig,
  speed: number,
  time: number,
  deltaTime: number,
  verticalVelocity: number,
  grounded: boolean,
  actionElapsedMilliseconds: number | null,
  actionStep = 0,
  actionMainHandId: MainHandId | null = null,
  powerElapsedMilliseconds: number | null = null,
  powerId: PowerId | null = null,
): void {
  const locomotion = advanceLocomotionAnimation(
    { phase: rig.locomotionPhase, weight: rig.locomotionWeight },
    speed,
    deltaTime,
  );
  rig.locomotionPhase = locomotion.phase;
  rig.locomotionWeight = locomotion.weight;
  const pose = voxelCharacterPose(speed, time, verticalVelocity, grounded, 4.2, locomotion);
  const powerPose = powerId === "shockwave"
    ? shockwavePowerPose(powerElapsedMilliseconds)
    : powerId === "eruption"
      ? eruptionPowerPose(powerElapsedMilliseconds)
      : powerId === "lunge_strike"
        ? lungePowerPose(powerElapsedMilliseconds)
      : seismicPowerPose(powerElapsedMilliseconds);
  const action = powerPose.active ? powerPose : primaryActionPose(actionElapsedMilliseconds, actionStep, actionMainHandId);
  rig.root.setLocalPosition(0, pose.bodyY, 0);
  rig.torso.setLocalEulerAngles(pose.torsoPitch, action.torsoYaw, pose.torsoRoll);
  rig.head.setLocalEulerAngles(0, pose.headYaw, 0);
  rig.leftArm.setLocalEulerAngles(pose.leftArmPitch + action.leftArmPitch, 0, action.leftArmRoll);
  rig.rightArm.setLocalEulerAngles(pose.rightArmPitch + action.rightArmPitch, 0, action.rightArmRoll);
  rig.leftLeg.setLocalEulerAngles(pose.leftLegPitch, 0, 0);
  rig.rightLeg.setLocalEulerAngles(pose.rightLegPitch, 0, 0);
}

const localPlayerVisual = new pc.Entity("local-player-visual");
localPlayer.addChild(localPlayerVisual);
const localPlayerRig = createVoxelCharacter(localPlayerVisual, coloredMaterial(new pc.Color(0.88, 0.58, 0.12)), true);
const localPlayerSilhouette = localPlayerRig.silhouette;
localPlayer.setPosition(8.5, 11, 8.5);
app.root.addChild(localPlayer);

interface NetworkPlayer {
  x: number;
  y: number;
  z: number;
  yaw: number;
  lastProcessedInput: number;
  actionSequence: number;
  attackStep: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  dodgeSequence: number;
  invulnerableUntil: number;
  mainHandId: string;
  mainHandTag: string;
  equippedPower: string;
  seismicMastery: string;
  powerCooldownUntil: number;
  powerSequence: number;
  powerCastStartedAt: number;
  specialCooldownUntil: number;
  equippedSpecial: string;
  dangerTier: number;
  name: string;
  defending: boolean;
  defenseStartedAt: number;
  momentumStacks: number;
  equippedTrait: string;
}

interface RemotePlayerVisual {
  entity: pc.Entity;
  rig: VoxelCharacterRig;
  snapshots: RemoteSnapshot[];
  actionStartedAt: number | null;
  actionStep: number;
  actionMainHandId: MainHandId | null;
  lastActionSequence: number;
  powerStartedAt: number | null;
  powerId: PowerId | null;
  lastPowerSequence: number;
  defending: boolean;
}

interface NetworkMob {
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  hitSequence: number;
  actionSequence: number;
  combatState: string;
  stateUntil: number;
  targetId: string;
  staggerSequence: number;
  yaw: number;
  name: string;
  archetype: string;
  armor: number;
  difficultyTier: number;
  attackDamage: number;
  speedMultiplier: number;
  rewardMultiplier: number;
}

interface NetworkLootDrop {
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  z: number;
  expiresAt: number;
}

interface LootVisual {
  root: pc.Entity;
  state: NetworkLootDrop;
  phase: number;
}

interface MobVisual {
  entity: pc.Entity;
  bodyRoot: pc.Entity;
  bodyMaterial: pc.StandardMaterial;
  warning: pc.Entity;
  warningMaterial: pc.StandardMaterial;
  warningScale: number;
  healthFill: pc.Entity;
  healthWidth: number;
  healthBarY: number;
  isBrute: boolean;
  isSpitter: boolean;
  mark: pc.Entity;
  markMaterial: pc.StandardMaterial;
  markPips: pc.Entity[];
  marks: Map<string, MarkVisualState>;
  state: NetworkMob;
  lastHitSequence: number;
  hitAt: number;
  lastActionSequence: number;
  actionAt: number;
  lastStaggerSequence: number;
  staggerAt: number;
  lastCombatState: string;
  lastAlive: boolean;
}

interface MarkVisualState {
  expiresAt: number;
  stacks: number;
  maxStacks: number;
}

const remoteMaterial = coloredMaterial(new pc.Color(0.18, 0.55, 0.86));
const remotePlayers = new Map<string, RemotePlayerVisual>();
const mobVisuals = new Map<string, MobVisual>();
const lootVisuals = new Map<string, LootVisual>();
const inventoryCounts = new Map<ItemId, number>(Object.keys(ITEM_DEFINITIONS).map(itemId => [itemId as ItemId, 0]));
const combatAudio = new CombatAudio();
const unlockCombatAudio = (): void => combatAudio.unlock();
window.addEventListener("pointerdown", unlockCombatAudio, { once: true, capture: true });
window.addEventListener("keydown", unlockCombatAudio, { once: true, capture: true });
const authoritativeLocalPosition = new pc.Vec3(8.5, 11, 8.5);
let localFacingYaw = 0;
let localVisualVerticalOffset = 0;
const localPowerVisualOffset = new pc.Vec3();
let localActionStartedAt: number | null = null;
let localActionFacingYaw: number | null = null;
let localActionStep = 0;
let localActionMainHandId: MainHandId | null = null;
let localComboStep = 0;
let localComboExpiresAt = 0;
let localHitPauseUntil = 0;
let localDodgeStartedAt: number | null = null;
let localDefending = false;
let localMomentumStacks = 0;
let localTraitId: TraitId = "momentum";
let localPowerStartedAt: number | null = null;
let localPowerFacingYaw: number | null = null;
let localPowerStepApplied = false;
let localPowerCooldownUntil = 0;
let localSpecialCooldownUntil = 0;
let localMainHandId: MainHandId = "longsword";
let localEquippedPower: PowerId = "shockwave";
let localSeismicMastery: SeismicMasteryId = "advancing_fault";
let localEquippedSpecial: SpecialId = "hunters_mark";
let localActivePower: PowerId | null = null;
let powerSequence = 0;
let specialSequence = 0;
let specialEquipSequence = 0;
let powerEquipSequence = 0;
let seismicMasterySequence = 0;
let mainHandEquipSequence = 0;
let defenseSequence = 0;
let traitEquipSequence = 0;
let localLastPowerSequence = 0;
let powerServerReady = false;
let powerAimActive = false;
let powerAimYaw = 0;
let powerAimPointerId: number | null = null;
const powerAimTarget = new pc.Vec3();
let powerAimTargetValid = true;
let specialAimActive = false;
let specialAimPointerId: number | null = null;
let specialAimYaw = 0;
const specialAimTarget = new pc.Vec3();
let specialAimTargetValid = true;
let cameraShakeUntil = 0;
let cameraShakeStrength = 0;
let lastProcessedInputSequence = 0;
let pendingStopInputSequence: number | null = null;
let pendingStopDeadline = 0;
const cameraFocus = new pc.Vec3(8.5, 11, 8.5);
const cameraTarget = new pc.Vec3(8.5, 11, 8.5);

function isPowerId(value: string): value is PowerId {
  return value in POWER_DEFINITIONS;
}

function isSeismicMasteryId(value: string): value is SeismicMasteryId {
  return value === "advancing_fault" || value === "tectonic_stand";
}

function seismicPowerShape(masteryId = localSeismicMastery): { range: number; width: number; forwardStep: number } {
  const mastery = SEISMIC_CLEAVE_UPGRADES.masteries[masteryId];
  return {
    range: POWER_DEFINITIONS.seismic_cleave.range + SEISMIC_CLEAVE_UPGRADES.faultReachBonus,
    width: mastery.width,
    forwardStep: mastery.forwardStep,
  };
}

function activePowerShape(powerId: PowerId): { range: number; width: number; forwardStep: number } {
  const definition = POWER_DEFINITIONS[powerId];
  return powerId === "seismic_cleave" ? seismicPowerShape() : definition;
}

function isSpecialId(value: string): value is SpecialId {
  return value in SPECIAL_DEFINITIONS;
}

function isMainHandId(value: string): value is MainHandId {
  return value in MAIN_HAND_DEFINITIONS;
}

function isTraitId(value: string): value is TraitId {
  return value in TRAIT_DEFINITIONS;
}

function refreshPowerCompatibility(): void {
  const mainHand = MAIN_HAND_DEFINITIONS[localMainHandId];
  mainHandName.textContent = mainHand.name;
  mainHandAttack.textContent = mainHand.attackName;
  for (const button of mainHandPickerButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mainHand === localMainHandId));
  }
  for (const button of inventoryEquipButtons) {
    const equipped = button.dataset.equipMainHand === localMainHandId;
    button.setAttribute("aria-pressed", String(equipped));
    button.textContent = equipped ? "EQUIPPED" : "EQUIP";
  }
  for (const button of powerPickerButtons) {
    const powerId = button.dataset.power;
    if (!powerId || !isPowerId(powerId)) continue;
    const compatible = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[powerId], localMainHandId);
    button.disabled = !compatible;
    button.title = compatible
      ? `${POWER_DEFINITIONS[powerId].name} is compatible with ${mainHand.name}`
      : `${POWER_DEFINITIONS[powerId].name} requires a melee main hand`;
  }
  const equippedCompatible = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[localEquippedPower], localMainHandId);
  powerSlot.classList.toggle("incompatible", !equippedCompatible);
  setRigMainHand(localPlayerRig, localMainHandId);
}

function updatePowerLoadout(powerId: PowerId): void {
  localEquippedPower = powerId;
  const definition = POWER_DEFINITIONS[powerId];
  powerName.textContent = definition.name;
  powerSlot.setAttribute("aria-label", `Use ${definition.name}`);
  seismicUpgrades.hidden = powerId !== "seismic_cleave";
  updateControlsHelp();
  for (const button of powerPickerButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.power === powerId));
  }
  refreshPowerCompatibility();
}

function updateSeismicMastery(masteryId: SeismicMasteryId): void {
  localSeismicMastery = masteryId;
  for (const button of seismicMasteryButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.seismicMastery === masteryId));
  }
}

function requestSeismicMastery(masteryId: SeismicMasteryId): void {
  if (!room || !worldReady || masteryId === localSeismicMastery) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = "Finish or cancel Seismic Cleave before changing its mastery.";
    return;
  }
  seismicMasterySequence += 1;
  room.send("power:seismic-mastery", {
    requestId: `seismic-mastery-${seismicMasterySequence}`,
    masteryId,
  });
  status.textContent = `Equipping ${SEISMIC_CLEAVE_UPGRADES.masteries[masteryId].name}...`;
}

function updateControlsHelp(): void {
  const power = POWER_DEFINITIONS[localEquippedPower];
  const special = SPECIAL_DEFINITIONS[localEquippedSpecial];
  const powerHint = power.castType === "tap" ? `R ${power.name}` : `Hold R ${power.core === "ground" ? "place" : "aim"} ${power.name}`;
  const specialHint = special.castType === "tap" ? `F ${special.name}` : `Hold F place ${special.name}`;
  controlsHelp.textContent = `WASD move · Hold C/right-click Guard · Space dodge/cancel · ${powerHint} · ${specialHint} · Q mode · E/click acts`;
}

function updateSpecialLoadout(specialId: SpecialId): void {
  localEquippedSpecial = specialId;
  const definition = SPECIAL_DEFINITIONS[specialId];
  specialName.textContent = definition.name;
  specialSlot.setAttribute("aria-label", `Use ${definition.name}`);
  specialButton.textContent = specialId === "hunters_mark" ? "Mark" : "Snare";
  for (const button of specialPickerButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.special === specialId));
  }
  updateControlsHelp();
}

function requestSpecialEquip(specialId: SpecialId): void {
  if (!room || !worldReady || specialId === localEquippedSpecial) return;
  if (specialAimActive || localPowerStartedAt !== null || localActionStartedAt !== null) {
    status.textContent = "Finish or cancel the current action before changing Special.";
    return;
  }
  specialEquipSequence += 1;
  room.send("special:equip", { requestId: `special-equip-${specialEquipSequence}`, specialId });
  status.textContent = `Equipping ${SPECIAL_DEFINITIONS[specialId].name}...`;
}

function updateMainHandLoadout(mainHandId: MainHandId): void {
  localMainHandId = mainHandId;
  localComboStep = 0;
  localComboExpiresAt = 0;
  targetStateKey = "";
  refreshPowerCompatibility();
}

function requestPowerEquip(powerId: PowerId): void {
  if (!room || !worldReady || powerId === localEquippedPower) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = "Finish or cancel the current Power before changing it.";
    return;
  }
  if (!isPowerCompatibleWithMainHand(POWER_DEFINITIONS[powerId], localMainHandId)) {
    const mainHand = MAIN_HAND_DEFINITIONS[localMainHandId];
    status.textContent = `${POWER_DEFINITIONS[powerId].name} is not compatible with ${mainHand.name}.`;
    showCombatFeedback("INCOMPATIBLE POWER", "hurt");
    return;
  }
  powerEquipSequence += 1;
  room.send("power:equip", { requestId: `power-equip-${powerEquipSequence}`, powerId });
  status.textContent = `Equipping ${POWER_DEFINITIONS[powerId].name}...`;
}

function requestMainHandEquip(mainHandId: MainHandId): void {
  if (!room || !worldReady || mainHandId === localMainHandId) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = "Finish or cancel the current Power before changing main hand.";
    return;
  }
  mainHandEquipSequence += 1;
  room.send("main-hand:equip", { requestId: `main-hand-equip-${mainHandEquipSequence}`, mainHandId });
  status.textContent = `Equipping ${MAIN_HAND_DEFINITIONS[mainHandId].name}...`;
}

function updateTraitLoadout(traitId: TraitId): void {
  localTraitId = traitId;
  const definition = TRAIT_DEFINITIONS[traitId];
  traitName.textContent = definition.name;
  traitDetail.textContent = definition.description;
  traitSlot.dataset.trait = traitId;
  momentumPips[0]?.parentElement?.toggleAttribute("hidden", traitId !== "momentum");
  traitBonus.hidden = traitId === "momentum";
  traitBonus.textContent = traitId === "bulwark" ? "−35% GUARD" : traitId === "executioner" ? "+1 VULNERABLE" : "";
  for (const button of traitPickerButtons) button.setAttribute("aria-pressed", String(button.dataset.trait === traitId));
  if (traitId !== "momentum") updateMomentum(0);
  else updateMomentum(localMomentumStacks);
}

function requestTraitEquip(traitId: TraitId): void {
  if (!room || !worldReady || traitId === localTraitId) return;
  if (powerAimActive || specialAimActive || localPowerStartedAt !== null || localActionStartedAt !== null || localDefending) {
    status.textContent = "Finish the current combat action before changing Trait.";
    return;
  }
  traitEquipSequence += 1;
  room.send("trait:equip", { requestId: `trait-equip-${traitEquipSequence}`, traitId });
  status.textContent = `Equipping ${TRAIT_DEFINITIONS[traitId].name}...`;
}

function updatePlayerHealth(health: number, maximumHealth: number): void {
  const fraction = Math.max(0, Math.min(1, health / Math.max(1, maximumHealth)));
  playerHealthFill.style.width = `${fraction * 100}%`;
  playerHealthValue.textContent = `${health} / ${maximumHealth}`;
}

function updatePlayerStamina(stamina: number, maximumStamina: number): void {
  const fraction = Math.max(0, Math.min(1, stamina / Math.max(1, maximumStamina)));
  playerStaminaFill.style.width = `${fraction * 100}%`;
  playerStaminaValue.textContent = `${Math.round(stamina)}`;
}

function updateMomentum(stacksValue: number): void {
  const safeStacks = Number.isFinite(stacksValue) ? stacksValue : 0;
  localMomentumStacks = Math.max(0, Math.min(MOMENTUM_TRAIT.maxStacks, Math.floor(safeStacks)));
  momentumPips.forEach((pip, index) => pip.classList.toggle("active", index < localMomentumStacks));
  traitSlot.setAttribute("aria-label", localTraitId === "momentum"
    ? `${MOMENTUM_TRAIT.name} trait, ${localMomentumStacks} of ${MOMENTUM_TRAIT.maxStacks} stacks`
    : `${TRAIT_DEFINITIONS[localTraitId].name} trait. ${TRAIT_DEFINITIONS[localTraitId].description}`);
  traitSlot.dataset.stacks = String(localMomentumStacks);
}

function localMovementSpeed(): number {
  const baseSpeed = localDefending ? 2.1 : 4.2;
  return localTraitId === "momentum"
    ? baseSpeed * (1 + localMomentumStacks * MOMENTUM_TRAIT.movementSpeedBonusPerStack)
    : baseSpeed;
}

const DANGER_ZONE_LABELS = [
  { name: "SAFE CORE", detail: "No enemy scaling near the world centre" },
  { name: "OUTSKIRTS", detail: "Standard enemies and standard rewards" },
  { name: "WILDS", detail: "Tougher, faster enemies · improved rewards" },
  { name: "DEEP FRONTIER", detail: "Elite enemies · highest danger and rewards" },
] as const;

function updateDangerZone(tierValue: number): void {
  const tier = Math.max(0, Math.min(3, Math.floor(tierValue)));
  const label = DANGER_ZONE_LABELS[tier]!;
  dangerZone.dataset.tier = String(tier);
  dangerZoneName.textContent = label.name;
  dangerZoneTier.textContent = `TIER ${tier}`;
  dangerZoneDetail.textContent = label.detail;
}

function actionDuration(step: number): number {
  if (step < 1 || step > 3 || localActionMainHandId === null) return PRIMARY_ACTION_DURATION_MS;
  return WEAPON_ATTACK_DEFINITIONS[localActionMainHandId].attacks[step - 1]?.durationMs ?? PRIMARY_ACTION_DURATION_MS;
}

function remoteActionDuration(mainHandId: MainHandId | null, step: number): number {
  if (!mainHandId || step < 1 || step > 3) return PRIMARY_ACTION_DURATION_MS;
  return WEAPON_ATTACK_DEFINITIONS[mainHandId].attacks[step - 1]?.durationMs ?? PRIMARY_ACTION_DURATION_MS;
}

function powerDuration(powerId: PowerId | null): number {
  if (!powerId) return 0;
  const definition = POWER_DEFINITIONS[powerId];
  return definition.windupMs + definition.activeMs + definition.recoveryMs;
}

function showCombatFeedback(text: string, style: "hit" | "hurt" | "dodge" = "hit"): void {
  combatFeedback.textContent = text;
  combatFeedback.classList.remove("show", "hurt", "dodge");
  void combatFeedback.offsetWidth;
  if (style !== "hit") combatFeedback.classList.add(style);
  combatFeedback.classList.add("show");
}

interface PowerTelegraphVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  startedAt: number;
  windupMs: number;
}

interface PowerImpactVisual {
  root: pc.Entity;
  fractureRoot: pc.Entity;
  material: pc.StandardMaterial;
  startedAt: number;
  powerId: PowerId;
  waveSegments: PowerAimSegment[];
  fractureSegments: PowerAimSegment[];
}

interface PowerAimSegment {
  entity: pc.Entity;
  distance: number;
}

interface PowerAimVisual {
  root: pc.Entity;
  validMaterial: pc.StandardMaterial;
  blockedMaterial: pc.StandardMaterial;
  segments: PowerAimSegment[];
  kind: "line" | "ground";
}

interface PowerDebrisVisual {
  entity: pc.Entity;
  velocity: pc.Vec3;
  spin: pc.Vec3;
  startedAt: number;
  delayMs?: number;
}

interface MarkPayoffVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  startedAt: number;
}

interface BrambleSnareVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  expiresAt: number;
  triggeredAt: number | null;
}

interface WeaponProjectileVisual {
  entity: pc.Entity;
  material: pc.StandardMaterial;
  start: pc.Vec3;
  end: pc.Vec3;
  startedAt: number;
  durationMs: number;
  hit: boolean;
}

interface MobHazardVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  expiresAt: number;
}

const powerTelegraphs = new Map<string, PowerTelegraphVisual>();
const powerImpactVisuals: PowerImpactVisual[] = [];
const powerDebrisVisuals: PowerDebrisVisual[] = [];
const markPayoffVisuals: MarkPayoffVisual[] = [];
const brambleSnareVisuals = new Map<string, BrambleSnareVisual>();
const weaponProjectileVisuals: WeaponProjectileVisual[] = [];
const mobHazardVisuals = new Map<string, MobHazardVisual>();
let powerAimVisual: PowerAimVisual | null = null;
let specialAimVisual: PowerAimVisual | null = null;

function powerMaterial(color: pc.Color, opacity: number): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = color.clone().mulScalar(0.72);
  material.opacity = opacity;
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.update();
  return material;
}

function createWeaponProjectile(message: WeaponAttackReleased): void {
  const acid = message.mainHandId === "acid_gland_focus";
  const entity = new pc.Entity(message.mainHandId === "bow" ? "arrow-projectile" : acid ? "corrosive-projectile" : "arcane-projectile");
  entity.addComponent("render", { type: message.mainHandId === "bow" ? "box" : "sphere" });
  const material = powerMaterial(
    message.mainHandId === "bow" ? new pc.Color(0.93, 0.76, 0.34) : acid ? new pc.Color(0.58, 1, 0.08) : new pc.Color(0.28, 0.68, 1),
    0.96,
  );
  if (entity.render) entity.render.material = material;
  if (message.mainHandId === "bow") entity.setLocalScale(0.07, 0.07, 0.58);
  else entity.setLocalScale(0.24, 0.24, 0.24);
  const start = new pc.Vec3(message.x, message.y + 1.05, message.z);
  const end = new pc.Vec3(message.targetX, message.targetY + 0.72, message.targetZ);
  entity.setPosition(start);
  if (message.mainHandId === "bow") entity.lookAt(end);
  app.root.addChild(entity);
  weaponProjectileVisuals.push({
    entity,
    material,
    start,
    end,
    startedAt: performance.now(),
    durationMs: Math.max(80, message.travelMs),
    hit: message.hit,
  });
}

function createMobProjectile(message: MobProjectileReleased): void {
  const entity = new pc.Entity("acid-projectile");
  entity.addComponent("render", { type: "sphere" });
  const material = powerMaterial(new pc.Color(0.54, 1, 0.08), 0.94);
  if (entity.render) entity.render.material = material;
  entity.setLocalScale(0.3, 0.3, 0.3);
  const start = new pc.Vec3(message.x, message.y + 1.05, message.z);
  const end = new pc.Vec3(message.targetX, message.targetY + 0.08, message.targetZ);
  entity.setPosition(start);
  app.root.addChild(entity);
  weaponProjectileVisuals.push({
    entity,
    material,
    start,
    end,
    startedAt: performance.now(),
    durationMs: Math.max(160, message.travelMs),
    hit: true,
  });
}

function createMobHazard(message: MobHazardPlaced): void {
  mobHazardVisuals.get(message.hazardId)?.root.destroy();
  const root = new pc.Entity(`mob-hazard:${message.hazardId}`);
  const material = powerMaterial(new pc.Color(0.4, 0.9, 0.06), 0.58);
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * Math.PI * 2;
    const radius = message.radius * (0.38 + (index % 3) * 0.22);
    const blob = addBox(
      root,
      "acid-puddle",
      material,
      [0.32 + index % 2 * 0.16, 0.035, 0.3 + (index + 1) % 2 * 0.16],
      [Math.sin(angle) * radius, 0.035, Math.cos(angle) * radius],
    );
    blob.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
  }
  root.setPosition(message.x, message.y + 0.015, message.z);
  app.root.addChild(root);
  mobHazardVisuals.set(message.hazardId, { root, material, expiresAt: message.expiresAt });
}

function startPowerTelegraph(
  casterId: string,
  powerId: PowerId,
  x: number,
  y: number,
  z: number,
  yaw: number,
  windupMs: number,
  shape?: { range?: number; width?: number },
): void {
  powerTelegraphs.get(casterId)?.root.destroy();
  const root = new pc.Entity(`power-telegraph:${casterId}`);
  const definition = POWER_DEFINITIONS[powerId];
  const range = shape?.range ?? definition.range;
  const width = shape?.width ?? definition.width;
  const material = powerMaterial(
    powerId === "shockwave"
      ? new pc.Color(0.18, 0.72, 1)
      : powerId === "eruption"
        ? new pc.Color(1, 0.18, 0.04)
        : powerId === "lunge_strike"
          ? new pc.Color(0.2, 1, 0.62)
        : new pc.Color(1, 0.43, 0.06),
    0.28,
  );
  if (definition.core === "burst") {
    for (let index = 0; index < 20; index += 1) {
      const angle = index / 20 * Math.PI * 2;
      const segment = addBox(
        root,
        "shockwave-warning",
        material,
        [0.46, 0.025, 0.14],
        [Math.sin(angle) * range, 0.035, Math.cos(angle) * range],
      );
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
  } else if (definition.core === "ground") {
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const segment = addBox(
        root,
        "eruption-warning",
        material,
        [0.42, 0.03, 0.13],
        [Math.sin(angle) * width, 0.04, Math.cos(angle) * width],
      );
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
    addBox(root, "eruption-center", material, [0.34, 0.035, 0.34], [0, 0.045, 0]);
  } else {
    for (let distance = 0.8; distance <= range; distance += 0.8) {
      addBox(root, "seismic-warning", material, [width, 0.025, 0.66], [0, 0.035, distance]);
    }
  }
  root.setPosition(x, y + 0.08, z);
  root.setEulerAngles(0, yaw, 0);
  app.root.addChild(root);
  powerTelegraphs.set(casterId, { root, material, startedAt: performance.now(), windupMs });
}

function destroyPowerAimVisual(): void {
  powerAimVisual?.root.destroy();
  powerAimVisual = null;
}

function createPowerAimVisual(): void {
  destroyPowerAimVisual();
  const root = new pc.Entity("power-aim-preview");
  const validMaterial = powerMaterial(new pc.Color(0.2, 0.95, 0.52), 0.42);
  const blockedMaterial = powerMaterial(new pc.Color(1, 0.16, 0.08), 0.5);
  const segments: PowerAimSegment[] = [];
  const definition = POWER_DEFINITIONS[localEquippedPower];
  const shape = activePowerShape(localEquippedPower);
  const kind = definition.core === "ground" ? "ground" : "line";
  if (kind === "ground") {
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const entity = addBox(
        root,
        "eruption-aim",
        validMaterial,
        [0.42, 0.028, 0.13],
        [Math.sin(angle) * definition.width, 0.045, Math.cos(angle) * definition.width],
      );
      entity.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
      segments.push({ entity, distance: definition.width });
    }
    segments.push({ entity: addBox(root, "eruption-aim-center", validMaterial, [0.32, 0.03, 0.32], [0, 0.05, 0]), distance: 0 });
  } else {
    for (let distance = 0.8; distance <= shape.range; distance += 0.8) {
      const entity = addBox(root, "seismic-aim", validMaterial, [shape.width, 0.028, 0.66], [0, 0.045, distance]);
      segments.push({ entity, distance });
    }
  }
  app.root.addChild(root);
  powerAimVisual = { root, validMaterial, blockedMaterial, segments, kind };
}

function updatePowerAimVisual(): void {
  if (!powerAimActive || !powerAimVisual) return;
  const player = localPlayer.getPosition();
  if (powerAimVisual.kind === "ground") {
    powerAimTargetValid = Math.hypot(powerAimTarget.x - player.x, powerAimTarget.z - player.z) <= POWER_DEFINITIONS.eruption.range + 0.05
      && isPlayerSupported(readCollisionWorldBlock, powerAimTarget.x, powerAimTarget.y, powerAimTarget.z);
    powerAimVisual.root.setPosition(powerAimTarget.x, powerAimTarget.y + 0.08, powerAimTarget.z);
    for (const segment of powerAimVisual.segments) {
      if (segment.entity.render) segment.entity.render.material = powerAimTargetValid ? powerAimVisual.validMaterial : powerAimVisual.blockedMaterial;
    }
    return;
  }
  powerAimVisual.root.setPosition(player.x, player.y, player.z);
  powerAimVisual.root.setEulerAngles(0, powerAimYaw, 0);
  const radians = powerAimYaw * Math.PI / 180;
  let pathBlocked = false;
  for (const segment of powerAimVisual.segments) {
    const x = Math.floor(player.x + Math.sin(radians) * segment.distance);
    const z = Math.floor(player.z + Math.cos(radians) * segment.distance);
    const feetY = Math.floor(player.y + 0.1);
    pathBlocked ||= readCollisionWorldBlock(x, feetY, z) !== Block.Air
      || readCollisionWorldBlock(x, feetY + 1, z) !== Block.Air;
    if (segment.entity.render) {
      segment.entity.render.material = pathBlocked ? powerAimVisual.blockedMaterial : powerAimVisual.validMaterial;
    }
  }
}

function destroySpecialAimVisual(): void {
  specialAimVisual?.root.destroy();
  specialAimVisual = null;
}

function createSpecialAimVisual(): void {
  destroySpecialAimVisual();
  const root = new pc.Entity("special-aim-preview");
  const validMaterial = powerMaterial(new pc.Color(0.22, 0.95, 0.34), 0.48);
  const blockedMaterial = powerMaterial(new pc.Color(1, 0.16, 0.08), 0.52);
  const segments: PowerAimSegment[] = [];
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * Math.PI * 2;
    const entity = addBox(
      root,
      "bramble-aim",
      validMaterial,
      [0.32, 0.035, 0.11],
      [Math.sin(angle) * BRAMBLE_SNARE.radius, 0.05, Math.cos(angle) * BRAMBLE_SNARE.radius],
    );
    entity.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    segments.push({ entity, distance: BRAMBLE_SNARE.radius });
  }
  segments.push({ entity: addBox(root, "bramble-aim-center", validMaterial, [0.24, 0.04, 0.24], [0, 0.05, 0]), distance: 0 });
  app.root.addChild(root);
  specialAimVisual = { root, validMaterial, blockedMaterial, segments, kind: "ground" };
}

function updateSpecialAimVisual(): void {
  if (!specialAimActive || !specialAimVisual) return;
  const player = localPlayer.getPosition();
  specialAimTargetValid = Math.hypot(specialAimTarget.x - player.x, specialAimTarget.z - player.z) <= BRAMBLE_SNARE.range + 0.05
    && isPlayerSupported(readCollisionWorldBlock, specialAimTarget.x, specialAimTarget.y, specialAimTarget.z);
  specialAimVisual.root.setPosition(specialAimTarget.x, specialAimTarget.y + 0.08, specialAimTarget.z);
  for (const segment of specialAimVisual.segments) {
    if (segment.entity.render) segment.entity.render.material = specialAimTargetValid ? specialAimVisual.validMaterial : specialAimVisual.blockedMaterial;
  }
}

function createBrambleSnareVisual(message: BrambleSnarePlaced): void {
  brambleSnareVisuals.get(message.casterId)?.root.destroy();
  const root = new pc.Entity(`bramble-snare:${message.casterId}`);
  const material = powerMaterial(new pc.Color(0.18, 0.72, 0.22), 0.72);
  for (let index = 0; index < 20; index += 1) {
    const angle = index / 20 * Math.PI * 2;
    const radius = message.radius * (0.66 + (index % 2) * 0.28);
    const thorn = addBox(root, "bramble-thorn", material, [0.12, 0.18 + (index % 3) * 0.06, 0.36], [Math.sin(angle) * radius, 0.1, Math.cos(angle) * radius]);
    thorn.setLocalEulerAngles(index % 2 ? 24 : -24, angle * 180 / Math.PI, 0);
  }
  root.setPosition(message.x, message.y + 0.04, message.z);
  app.root.addChild(root);
  brambleSnareVisuals.set(message.casterId, { root, material, expiresAt: message.expiresAt, triggeredAt: null });
}

function triggerBrambleSnareVisual(message: BrambleSnareTriggered): void {
  const visual = brambleSnareVisuals.get(message.casterId);
  if (visual) {
    visual.triggeredAt = performance.now();
    visual.expiresAt = Date.now() + 700;
  }
  const mob = mobVisuals.get(message.mobId);
  if (!mob) return;
  const material = visual?.material ?? powerMaterial(new pc.Color(0.18, 0.82, 0.25), 0.8);
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const vine = new pc.Entity("bramble-root-vine");
    vine.addComponent("render", { type: "box" });
    if (vine.render) vine.render.material = material;
    vine.setLocalScale(0.1, 0.65 + (index % 3) * 0.18, 0.1);
    vine.setPosition(mob.state.x + Math.sin(angle) * 0.52, mob.state.y + 0.3, mob.state.z + Math.cos(angle) * 0.52);
    vine.setEulerAngles(index % 2 ? 20 : -20, angle * 180 / Math.PI, 0);
    app.root.addChild(vine);
    powerDebrisVisuals.push({ entity: vine, velocity: new pc.Vec3(0, 0.3, 0), spin: new pc.Vec3(0, 40, 0), startedAt: performance.now() });
  }
}

function createPowerImpact(message: PowerResolved): void {
  powerTelegraphs.get(message.casterId)?.root.destroy();
  powerTelegraphs.delete(message.casterId);
  const root = new pc.Entity(`power-impact:${message.casterId}`);
  const fractureRoot = new pc.Entity(`power-fractures:${message.casterId}`);
  const definition = POWER_DEFINITIONS[message.powerId];
  const impactRange = message.range ?? definition.range;
  const impactWidth = message.width ?? definition.width;
  const waveSegments: PowerAimSegment[] = [];
  const fractureSegments: PowerAimSegment[] = [];
  const material = powerMaterial(
    message.powerId === "shockwave"
      ? new pc.Color(0.2, 0.76, 1)
      : message.powerId === "eruption"
        ? new pc.Color(1, 0.22, 0.035)
        : message.powerId === "lunge_strike"
          ? new pc.Color(0.24, 1, 0.68)
        : message.seismicMastery === "tectonic_stand"
          ? new pc.Color(1, 0.38, 0.08)
          : new pc.Color(1, 0.68, 0.14),
    0.78,
  );
  if (definition.core === "burst") {
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const segment = addBox(root, "shockwave-ring", material, [0.55, 0.12, 0.18], [Math.sin(angle) * 1.15, 0.12, Math.cos(angle) * 1.15]);
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
  } else if (definition.core === "ground") {
    for (let index = 0; index < 28; index += 1) {
      const angle = index / 28 * Math.PI * 2;
      const radius = 0.65 + (index % 2) * 0.42;
      const pillar = addBox(
        root,
        "eruption-pillar",
        material,
        [0.24 + (index % 3) * 0.05, 0.8 + (index % 5) * 0.22, 0.24 + (index % 2) * 0.05],
        [Math.sin(angle) * radius, 0.2, Math.cos(angle) * radius],
      );
      pillar.setLocalEulerAngles((index % 3 - 1) * 8, angle * 180 / Math.PI, (index % 2 ? 1 : -1) * 6);
    }
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const segment = addBox(root, "eruption-ring", material, [0.5, 0.1, 0.16], [Math.sin(angle) * definition.width, 0.1, Math.cos(angle) * definition.width]);
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
  } else if (definition.core === "mobility") {
    for (let index = -5; index <= 5; index += 1) {
      const angle = index / 5 * Math.PI * 0.34;
      const segment = addBox(
        root,
        "lunge-impact",
        material,
        [0.18, 0.18, 0.52],
        [Math.sin(angle) * 1.05, 0.22, Math.cos(angle) * 1.05],
      );
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, -index * 4);
    }
    addBox(root, "lunge-core", material, [definition.width, 0.16, 0.35], [0, 0.18, 0.42]);
  } else {
    for (let distance = 0.65; distance <= impactRange; distance += 0.65) {
      const wave = addBox(root, "seismic-wave", material, [impactWidth * 0.84, 0.12, 0.42], [0, 0.12, distance]);
      wave.enabled = false;
      waveSegments.push({ entity: wave, distance });
      for (const side of [-1, 1]) {
        const branch = addBox(
          root,
          "seismic-branch",
          material,
          [0.32 + (Math.floor(distance * 10) % 3) * 0.07, 0.06, 0.1],
          [side * (impactWidth * 0.45 + (Math.floor(distance * 10) % 2) * 0.16), 0.08, distance + side * 0.08],
        );
        branch.setLocalEulerAngles(0, side * (24 + distance * 3), 0);
        branch.enabled = false;
        waveSegments.push({ entity: branch, distance });
      }
    }
    if ((message.aftershockHitCount ?? 0) > 0) {
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        const burst = addBox(root, "seismic-aftershock", material, [0.28, 0.22, 0.28], [Math.sin(angle) * 0.8, 0.22, impactRange + Math.cos(angle) * 0.8]);
        burst.setLocalEulerAngles(index * 11, angle * 180 / Math.PI, 45);
      }
    }
  }
  for (const fracture of message.fractures) {
    const fractureEntity = addBox(fractureRoot, "terrain-fracture", material, [0.72, 0.035, 0.16], [fracture.x + 0.5, fracture.y + 1.025, fracture.z + 0.5]);
    const fractureDistance = Math.hypot(fracture.x + 0.5 - message.x, fracture.z + 0.5 - message.z);
    if (message.powerId === "seismic_cleave") fractureEntity.enabled = false;
    fractureSegments.push({ entity: fractureEntity, distance: fractureDistance });
  }
  root.setPosition(message.x, message.y + 0.04, message.z);
  root.setEulerAngles(0, message.yaw, 0);
  app.root.addChild(root);
  app.root.addChild(fractureRoot);
  powerImpactVisuals.push({ root, fractureRoot, material, startedAt: performance.now(), powerId: message.powerId, waveSegments, fractureSegments });
  const radians = message.yaw * Math.PI / 180;
  for (let index = 0; index < 14; index += 1) {
    const debrisAngle = message.powerId === "shockwave" || message.powerId === "eruption" ? index / 14 * Math.PI * 2 : radians;
    const directionX = Math.sin(debrisAngle);
    const directionZ = Math.cos(debrisAngle);
    const distance = message.powerId === "eruption"
      ? 0.45 + (index % 7) * 0.26
      : 0.5 + (index % 7) * 0.66;
    const side = index % 2 === 0 ? -1 : 1;
    const debris = new pc.Entity(`${message.powerId}-debris`);
    debris.addComponent("render", { type: "box" });
    if (debris.render) debris.render.material = material;
    const size = 0.09 + (index % 3) * 0.035;
    debris.setLocalScale(size, size, size);
    debris.setPosition(
      message.x + directionX * distance + directionZ * side * 0.22,
      message.y + 0.12,
      message.z + directionZ * distance - directionX * side * 0.22,
    );
    const delayMs = message.powerId === "seismic_cleave" ? Math.max(0, distance / impactRange * 360 - 40) : 0;
    if (delayMs > 0) debris.enabled = false;
    app.root.addChild(debris);
    powerDebrisVisuals.push({
      entity: debris,
      velocity: new pc.Vec3(directionX * (0.5 + index % 3 * 0.18) + directionZ * side * 0.55, 2.1 + index % 4 * 0.28, directionZ * (0.5 + index % 3 * 0.18) - directionX * side * 0.55),
      spin: new pc.Vec3(170 + index * 13, 120 + index * 17, 90 + index * 19),
      startedAt: performance.now(),
      delayMs,
    });
  }
  const player = localPlayer.getPosition();
  const distanceToImpact = Math.hypot(player.x - message.x, player.z - message.z);
  const seismicBoost = message.powerId === "seismic_cleave" ? 0.09 : 0;
  cameraShakeStrength = Math.max(cameraShakeStrength, Math.max(0.08, 0.28 + seismicBoost - distanceToImpact * 0.025));
  cameraShakeUntil = performance.now() + (message.powerId === "seismic_cleave" ? 440 : 360);
  if (message.powerId === "seismic_cleave" && distanceToImpact <= 14) {
    combatAudio.play("seismicImpact", enemyCuePan(message.x, player.x, 14));
  }
}

function createHuntersMarkPayoff(mob: MobVisual): void {
  const root = new pc.Entity("hunters-mark-payoff");
  const material = powerMaterial(new pc.Color(0.72, 0.16, 1), 0.92);
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * Math.PI * 2;
    const radius = index % 2 === 0 ? 0.78 : 1.08;
    const shard = addBox(
      root,
      "mark-payoff-shard",
      material,
      [0.12, 0.5 + (index % 3) * 0.12, 0.12],
      [Math.sin(angle) * radius, 0.45 + (index % 4) * 0.16, Math.cos(angle) * radius],
    );
    shard.setLocalEulerAngles(index % 2 === 0 ? -24 : 24, angle * 180 / Math.PI, 45);
  }
  for (let index = 0; index < HUNTERS_MARK.maxStacks; index += 1) {
    const angle = index / HUNTERS_MARK.maxStacks * Math.PI * 2;
    addBox(root, "mark-payoff-core", material, [0.28, 0.28, 0.28], [Math.sin(angle) * 0.42, 1.18, Math.cos(angle) * 0.42]);
  }
  root.setPosition(mob.state.x, mob.state.y + 0.04, mob.state.z);
  app.root.addChild(root);
  markPayoffVisuals.push({ root, material, startedAt: performance.now() });
  cameraShakeStrength = Math.max(cameraShakeStrength, 0.26);
  cameraShakeUntil = performance.now() + 420;
}

function createBruteSlamImpact(mob: MobVisual): void {
  const root = new pc.Entity("stone-brute-slam");
  const material = powerMaterial(new pc.Color(0.92, 0.34, 0.07), 0.9);
  for (let index = 0; index < 28; index += 1) {
    const angle = index / 28 * Math.PI * 2;
    const radius = index % 2 === 0 ? 1.15 : 1.55;
    const segment = addBox(
      root,
      "brute-slam-ring",
      material,
      [0.36 + index % 3 * 0.08, 0.1, 0.18],
      [Math.sin(angle) * radius, 0.1, Math.cos(angle) * radius],
    );
    segment.setLocalEulerAngles(0, angle * 180 / Math.PI, index % 2 === 0 ? 8 : -8);
  }
  root.setPosition(mob.state.x, mob.state.y + 0.03, mob.state.z);
  app.root.addChild(root);
  markPayoffVisuals.push({ root, material, startedAt: performance.now() });
  const playerPosition = localPlayer.getPosition();
  const distance = Math.hypot(playerPosition.x - mob.state.x, playerPosition.z - mob.state.z);
  if (distance <= 9) {
    cameraShakeStrength = Math.max(cameraShakeStrength, Math.max(0.12, 0.36 - distance * 0.025));
    cameraShakeUntil = performance.now() + 420;
    combatAudio.play("seismicImpact", enemyCuePan(mob.state.x, playerPosition.x, 9));
  }
}

function updatePlayerCount(): void {
  const count = room ? remotePlayers.size + 1 : 0;
  playerCount.textContent = `${count} player${count === 1 ? "" : "s"} online`;
}

function createRemotePlayer(sessionId: string, player: NetworkPlayer): RemotePlayerVisual {
  const entity = new pc.Entity(`remote-player:${sessionId}`);
  const rig = createVoxelCharacter(entity, remoteMaterial);
  if (isMainHandId(player.mainHandId)) setRigMainHand(rig, player.mainHandId);
  entity.setPosition(player.x, player.y, player.z);
  app.root.addChild(entity);
  return {
    entity,
    rig,
    snapshots: [{ receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw }],
    actionStartedAt: null,
    actionStep: player.attackStep,
    actionMainHandId: isMainHandId(player.mainHandId) ? player.mainHandId : null,
    lastActionSequence: player.actionSequence,
    powerStartedAt: null,
    powerId: isPowerId(player.equippedPower) ? player.equippedPower : null,
    lastPowerSequence: player.powerSequence,
    defending: player.defending,
  };
}

function recordRemoteSnapshot(remote: RemotePlayerVisual, player: NetworkPlayer): void {
  const snapshot = { receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw };
  const latest = remote.snapshots[remote.snapshots.length - 1];
  if (latest && snapshot.receivedAt - latest.receivedAt < 1) remote.snapshots[remote.snapshots.length - 1] = snapshot;
  else remote.snapshots.push(snapshot);
}

function createMobVisual(mobId: string, mob: NetworkMob): MobVisual {
  const entity = new pc.Entity(`mob:${mobId}`);
  const bodyRoot = new pc.Entity("mob-body");
  entity.addChild(bodyRoot);
  const isBrute = mob.archetype === "stone_brute";
  const isSpitter = mob.archetype === "cave_spitter";
  const tierColor = mob.difficultyTier >= 3
    ? new pc.Color(1, 0.2, 0.08)
    : mob.difficultyTier === 2
      ? new pc.Color(1, 0.62, 0.08)
      : new pc.Color(0.35, 0.9, 0.28);
  const bodyMaterial = coloredMaterial(
    isBrute ? new pc.Color(0.34, 0.36, 0.35) : isSpitter ? new pc.Color(0.24, 0.38, 0.16) : new pc.Color(0.22, 0.62, 0.24),
  );
  const accentMaterial = coloredMaterial(
    isBrute ? new pc.Color(0.62, 0.35, 0.09) : isSpitter ? new pc.Color(0.52, 0.92, 0.08) : new pc.Color(0.3, 0.72, 0.25),
  );
  const eyeMaterial = coloredMaterial(
    isBrute ? new pc.Color(1, 0.38, 0.04) : isSpitter ? new pc.Color(0.78, 1, 0.3) : new pc.Color(0.03, 0.045, 0.035),
  );
  const healthBackMaterial = coloredMaterial(new pc.Color(0.16, 0.025, 0.02));
  const healthMaterial = coloredMaterial(mob.difficultyTier > 1 ? tierColor : isBrute ? new pc.Color(0.94, 0.48, 0.12) : isSpitter ? new pc.Color(0.58, 0.92, 0.12) : tierColor);
  const warningMaterial = new pc.StandardMaterial();
  warningMaterial.diffuse = new pc.Color(0.9, 0.16, 0.06);
  warningMaterial.emissive = new pc.Color(0.7, 0.08, 0.02);
  warningMaterial.opacity = 0.32;
  warningMaterial.blendType = pc.BLEND_NORMAL;
  warningMaterial.depthWrite = false;
  warningMaterial.update();
  const markMaterial = new pc.StandardMaterial();
  markMaterial.diffuse = new pc.Color(0.48, 0.12, 0.78);
  markMaterial.emissive = new pc.Color(0.42, 0.08, 0.74);
  markMaterial.opacity = 0.48;
  markMaterial.blendType = pc.BLEND_NORMAL;
  markMaterial.depthWrite = false;
  markMaterial.update();
  if (isBrute) {
    addBox(bodyRoot, "brute-body", bodyMaterial, [1.18, 1.05, 0.92], [0, 0.67, 0]);
    addBox(bodyRoot, "brute-head", bodyMaterial, [0.76, 0.66, 0.7], [0, 1.43, 0.08]);
    addBox(bodyRoot, "brute-shoulder-left", bodyMaterial, [0.54, 0.52, 0.62], [-0.78, 1.12, 0]);
    addBox(bodyRoot, "brute-shoulder-right", bodyMaterial, [0.54, 0.52, 0.62], [0.78, 1.12, 0]);
    addBox(bodyRoot, "brute-arm-left", bodyMaterial, [0.42, 0.8, 0.46], [-0.82, 0.55, 0.1]);
    addBox(bodyRoot, "brute-arm-right", bodyMaterial, [0.42, 0.8, 0.46], [0.82, 0.55, 0.1]);
    addBox(bodyRoot, "brute-fist-left", accentMaterial, [0.58, 0.45, 0.62], [-0.82, 0.16, 0.2]);
    addBox(bodyRoot, "brute-fist-right", accentMaterial, [0.58, 0.45, 0.62], [0.82, 0.16, 0.2]);
    addBox(bodyRoot, "brute-brow", accentMaterial, [0.62, 0.15, 0.16], [0, 1.56, 0.39]);
    addBox(bodyRoot, "brute-eye-left", eyeMaterial, [0.12, 0.11, 0.07], [-0.2, 1.43, 0.44]);
    addBox(bodyRoot, "brute-eye-right", eyeMaterial, [0.12, 0.11, 0.07], [0.2, 1.43, 0.44]);
    addBox(bodyRoot, "brute-crystal", accentMaterial, [0.24, 0.48, 0.24], [0, 1.06, -0.48]).setLocalEulerAngles(12, 0, 45);
  } else if (isSpitter) {
    addBox(bodyRoot, "spitter-body", bodyMaterial, [0.96, 0.55, 1.16], [0, 0.38, -0.08]);
    addBox(bodyRoot, "spitter-head", bodyMaterial, [0.72, 0.58, 0.68], [0, 0.58, 0.58]);
    addBox(bodyRoot, "spitter-mouth", accentMaterial, [0.42, 0.16, 0.12], [0, 0.46, 0.94]);
    addBox(bodyRoot, "spitter-eye-left", eyeMaterial, [0.12, 0.13, 0.08], [-0.2, 0.7, 0.89]);
    addBox(bodyRoot, "spitter-eye-right", eyeMaterial, [0.12, 0.13, 0.08], [0.2, 0.7, 0.89]);
    addBox(bodyRoot, "spitter-sac-left", accentMaterial, [0.42, 0.5, 0.48], [-0.3, 0.7, -0.52]);
    addBox(bodyRoot, "spitter-sac-right", accentMaterial, [0.42, 0.5, 0.48], [0.3, 0.7, -0.52]);
    for (const side of [-1, 1]) {
      addBox(bodyRoot, `spitter-leg-front-${side}`, bodyMaterial, [0.22, 0.28, 0.5], [side * 0.52, 0.18, 0.42]);
      addBox(bodyRoot, `spitter-leg-back-${side}`, bodyMaterial, [0.22, 0.28, 0.5], [side * 0.52, 0.18, -0.42]);
    }
  } else {
    addBox(bodyRoot, "crawler-body", bodyMaterial, [0.92, 0.58, 0.86], [0, 0.32, 0]);
    addBox(bodyRoot, "crawler-head", bodyMaterial, [0.68, 0.48, 0.62], [0, 0.76, 0.08]);
    addBox(bodyRoot, "crawler-eye-left", eyeMaterial, [0.1, 0.12, 0.06], [-0.17, 0.8, 0.39]);
    addBox(bodyRoot, "crawler-eye-right", eyeMaterial, [0.1, 0.12, 0.06], [0.17, 0.8, 0.39]);
  }
  const healthWidth = isBrute ? 1.46 : isSpitter ? 1.12 : 0.96;
  const healthBarY = isBrute ? 2.18 : isSpitter ? 1.48 : 1.34;
  addBox(entity, "health-back", healthBackMaterial, [healthWidth + 0.06, 0.1, 0.08], [0, healthBarY, 0]);
  const healthFill = addBox(entity, "health-fill", healthMaterial, [healthWidth, 0.065, 0.09], [0, healthBarY, 0.01]);
  const tierMaterial = coloredMaterial(tierColor);
  for (let index = 0; index < mob.difficultyTier; index += 1) {
    const pipX = (index - (mob.difficultyTier - 1) / 2) * 0.22;
    const pip = addBox(entity, `danger-tier-${index + 1}`, tierMaterial, [0.12, 0.12, 0.12], [pipX, healthBarY + 0.2, 0]);
    pip.setLocalEulerAngles(0, 45, 45);
  }
  const warning = new pc.Entity("lunge-warning");
  warning.addComponent("render", { type: "cylinder" });
  if (warning.render) warning.render.material = warningMaterial;
  warning.setLocalPosition(0, 0.035, 0);
  const warningScale = isBrute ? 5.5 : isSpitter ? 3.6 : 4.2;
  warning.setLocalScale(warningScale, 0.025, warningScale);
  warning.enabled = false;
  entity.addChild(warning);
  const mark = new pc.Entity("hunters-mark");
  mark.addComponent("render", { type: "cylinder" });
  if (mark.render) mark.render.material = markMaterial;
  mark.setLocalPosition(0, 0.055, 0);
  mark.setLocalScale(1.55, 0.022, 1.55);
  mark.enabled = false;
  entity.addChild(mark);
  const markPips = [-0.24, 0, 0.24].map((x, index) => {
    const pip = addBox(entity, `hunters-mark-stack-${index + 1}`, markMaterial, [0.14, 0.14, 0.14], [x, healthBarY + 0.21, 0]);
    pip.setLocalEulerAngles(0, 45, 45);
    pip.enabled = false;
    return pip;
  });
  entity.setPosition(mob.x, mob.y, mob.z);
  app.root.addChild(entity);
  return {
    entity,
    bodyRoot,
    bodyMaterial,
    warning,
    warningMaterial,
    warningScale,
    healthFill,
    healthWidth,
    healthBarY,
    isBrute,
    isSpitter,
    mark,
    markMaterial,
    markPips,
    marks: new Map(),
    state: mob,
    lastHitSequence: mob.hitSequence,
    hitAt: 0,
    lastActionSequence: mob.actionSequence,
    actionAt: 0,
    lastStaggerSequence: mob.staggerSequence,
    staggerAt: 0,
    lastCombatState: mob.combatState,
    lastAlive: mob.alive,
  };
}

const lootMaterials: Record<ItemId, pc.StandardMaterial> = {
  moss_fibre: coloredMaterial(new pc.Color(0.28, 0.68, 0.2)),
  crawler_fang: coloredMaterial(new pc.Color(0.92, 0.84, 0.62)),
  stone_core: coloredMaterial(new pc.Color(0.38, 0.52, 0.62)),
  acid_gland: coloredMaterial(new pc.Color(0.58, 0.9, 0.1)),
  fang_dagger: coloredMaterial(new pc.Color(0.92, 0.84, 0.62)),
  stone_core_hammer: coloredMaterial(new pc.Color(0.42, 0.52, 0.58)),
  acid_gland_focus: coloredMaterial(new pc.Color(0.62, 0.96, 0.12)),
};

function isItemId(value: string): value is ItemId {
  return value in ITEM_DEFINITIONS;
}

function createLootVisual(dropId: string, drop: NetworkLootDrop): LootVisual {
  const root = new pc.Entity(`loot:${dropId}`);
  const itemId = isItemId(drop.itemId) ? drop.itemId : "moss_fibre";
  const material = lootMaterials[itemId];
  if (itemId === "fang_dagger") {
    addBox(root, "dropped-dagger-grip", weaponWoodMaterial, [0.1, 0.26, 0.1], [0, 0.17, 0]);
    addBox(root, "dropped-dagger-fang", material, [0.18, 0.48, 0.12], [0, -0.18, 0]).setLocalEulerAngles(0, 0, 8);
  } else if (itemId === "stone_core_hammer") {
    addBox(root, "dropped-hammer-handle", weaponWoodMaterial, [0.11, 0.7, 0.11], [0, 0, 0]);
    addBox(root, "dropped-hammer-head", material, [0.64, 0.34, 0.4], [0, -0.38, 0]);
  } else if (itemId === "acid_gland_focus") {
    addBox(root, "dropped-focus-handle", weaponWoodMaterial, [0.1, 0.48, 0.1], [0, 0.08, 0]);
    addBox(root, "dropped-focus-gland", material, [0.3, 0.32, 0.3], [0, -0.3, 0]);
  } else if (itemId === "crawler_fang") {
    addBox(root, "fang", material, [0.17, 0.48, 0.17], [0, 0, 0]).setLocalEulerAngles(0, 0, 32);
    addBox(root, "fang-tip", material, [0.12, 0.2, 0.12], [0.13, -0.2, 0]).setLocalEulerAngles(0, 0, 45);
  } else if (itemId === "stone_core") {
    addBox(root, "core", material, [0.38, 0.38, 0.38], [0, 0, 0]).setLocalEulerAngles(20, 45, 15);
    addBox(root, "core-shard", material, [0.16, 0.28, 0.16], [0.22, 0.08, 0]).setLocalEulerAngles(0, 0, 38);
  } else if (itemId === "acid_gland") {
    addBox(root, "gland", material, [0.38, 0.32, 0.38], [0, 0, 0]).setLocalEulerAngles(15, 45, 0);
    addBox(root, "gland-neck", material, [0.15, 0.24, 0.15], [0, 0.24, 0]);
  } else {
    addBox(root, "fibre-a", material, [0.12, 0.48, 0.12], [-0.08, 0, 0]).setLocalEulerAngles(28, 0, 18);
    addBox(root, "fibre-b", material, [0.12, 0.42, 0.12], [0.09, 0.02, 0]).setLocalEulerAngles(-22, 0, -18);
  }
  root.setPosition(drop.x, drop.y + 0.36, drop.z);
  app.root.addChild(root);
  return { root, state: drop, phase: [...dropId].reduce((total, character) => total + character.charCodeAt(0), 0) % 17 };
}

function bindLootDrops(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const state = joinedRoom.state as any;
  if (!state.lootDrops) return;
  const drops = callbacks(joinedRoom.state).lootDrops;
  drops.onAdd((drop: NetworkLootDrop, dropId: string) => {
    lootVisuals.get(dropId)?.root.destroy();
    lootVisuals.set(dropId, createLootVisual(dropId, drop));
  }, true);
  drops.onRemove((_drop: NetworkLootDrop, dropId: string) => {
    lootVisuals.get(dropId)?.root.destroy();
    lootVisuals.delete(dropId);
  });
}

function updateInventoryItem(itemId: ItemId, total: number): void {
  inventoryCounts.set(itemId, total);
  const count = inventoryCountElements.get(itemId);
  if (count) count.textContent = String(total);
  const equipButton = inventoryPanel.querySelector<HTMLButtonElement>(`[data-item="${itemId}"] [data-equip-main-hand]`);
  if (equipButton) equipButton.disabled = total <= 0;
  const grandTotal = [...inventoryCounts.values()].reduce((sum, quantity) => sum + quantity, 0);
  inventoryTotal.textContent = grandTotal === 0 ? "EMPTY" : `${grandTotal} ITEM${grandTotal === 1 ? "" : "S"}`;
  const card = inventoryPanel.querySelector<HTMLElement>(`[data-item="${itemId}"]`);
  if (card) {
    card.classList.remove("loot-added");
    requestAnimationFrame(() => card.classList.add("loot-added"));
    window.setTimeout(() => card.classList.remove("loot-added"), 650);
  }
}

function playMobCue(mob: MobVisual, cue: EnemyCue): void {
  const player = localPlayer.getPosition();
  combatAudio.play(cue, enemyCuePan(mob.state.x, player.x));
}

function updateMobVisual(mob: MobVisual): void {
  const previousCueState: EnemyCueSnapshot = {
    alive: mob.lastAlive,
    health: mob.state.health,
    hitSequence: mob.lastHitSequence,
    staggerSequence: mob.lastStaggerSequence,
    combatState: mob.lastCombatState,
  };
  const currentCueState: EnemyCueSnapshot = {
    alive: mob.state.alive,
    health: mob.state.health,
    hitSequence: mob.state.hitSequence,
    staggerSequence: mob.state.staggerSequence,
    combatState: mob.state.combatState,
  };
  for (const cue of enemyCuesForTransition(previousCueState, currentCueState)) playMobCue(mob, cue);
  const healthFraction = Math.max(0, Math.min(1, mob.state.health / Math.max(1, mob.state.maxHealth)));
  mob.healthFill.setLocalScale(mob.healthWidth * healthFraction, 0.065, 0.09);
  mob.healthFill.setLocalPosition(-mob.healthWidth * 0.5 * (1 - healthFraction), mob.healthBarY, 0.01);
  if (mob.state.hitSequence > mob.lastHitSequence) {
    mob.lastHitSequence = mob.state.hitSequence;
    mob.hitAt = performance.now();
  }
  if (mob.state.actionSequence > mob.lastActionSequence) {
    mob.lastActionSequence = mob.state.actionSequence;
    mob.actionAt = performance.now();
    if (mob.isBrute) createBruteSlamImpact(mob);
  }
  if (mob.state.staggerSequence > mob.lastStaggerSequence) {
    mob.lastStaggerSequence = mob.state.staggerSequence;
    mob.staggerAt = performance.now();
  }
  mob.lastCombatState = mob.state.combatState;
  mob.lastAlive = mob.state.alive;
}

function bindMobs(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const mobs = callbacks(joinedRoom.state).mobs;
  mobs.onAdd((mob: NetworkMob, mobId: string) => {
    const visual = createMobVisual(mobId, mob);
    mobVisuals.set(mobId, visual);
    const mobCallbacks = callbacks(mob);
    for (const field of ["x", "y", "z", "health", "maxHealth", "alive", "hitSequence", "actionSequence", "combatState", "stateUntil", "targetId", "staggerSequence", "yaw", "archetype", "armor", "name", "difficultyTier", "attackDamage", "speedMultiplier", "rewardMultiplier"] as const) {
      mobCallbacks.listen(field, () => updateMobVisual(visual), true);
    }
  }, true);
  mobs.onRemove((_mob: NetworkMob, mobId: string) => {
    mobVisuals.get(mobId)?.entity.destroy();
    mobVisuals.delete(mobId);
  });
}

function nearestLivingMob(position: pc.Vec3, maximumRange: number): { id: string; visual: MobVisual; distance: number } | null {
  let nearest: { id: string; visual: MobVisual; distance: number } | null = null;
  for (const [id, visual] of mobVisuals) {
    if (!visual.state.alive) continue;
    const distance = Math.hypot(visual.state.x - position.x, visual.state.y - position.y, visual.state.z - position.z);
    if (distance > maximumRange || (nearest && distance >= nearest.distance)) continue;
    nearest = { id, visual, distance };
  }
  return nearest;
}

function bindPlayers(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const players = callbacks(joinedRoom.state).players;
  players.onAdd((player: NetworkPlayer, sessionId: string) => {
    const isLocal = sessionId === joinedRoom.sessionId;
    if (isLocal) {
      if (isMainHandId(player.mainHandId)) updateMainHandLoadout(player.mainHandId);
      if (isSeismicMasteryId(player.seismicMastery)) updateSeismicMastery(player.seismicMastery);
      powerServerReady = isPowerId(player.equippedPower);
      if (isPowerId(player.equippedPower)) updatePowerLoadout(player.equippedPower);
      if (isSpecialId(player.equippedSpecial)) updateSpecialLoadout(player.equippedSpecial);
      if (isTraitId(player.equippedTrait)) updateTraitLoadout(player.equippedTrait);
    }
    let remote = isLocal ? undefined : remotePlayers.get(sessionId);
    if (!isLocal && !remote) {
      remote = createRemotePlayer(sessionId, player);
      remotePlayers.set(sessionId, remote);
      updatePlayerCount();
    }

    const updatePosition = () => {
      if (isLocal) authoritativeLocalPosition.set(player.x, player.y, player.z);
      else if (remote) recordRemoteSnapshot(remote, player);
    };
    const playerCallbacks = callbacks(player);
    playerCallbacks.listen("x", updatePosition, true);
    playerCallbacks.listen("y", updatePosition, true);
    playerCallbacks.listen("z", updatePosition, true);
    playerCallbacks.listen("yaw", () => {
      if (remote) recordRemoteSnapshot(remote, player);
    }, true);
    playerCallbacks.listen("lastProcessedInput", () => {
      if (isLocal) lastProcessedInputSequence = player.lastProcessedInput;
    }, true);
    playerCallbacks.listen("actionSequence", () => {
      if (!remote || player.actionSequence <= remote.lastActionSequence) return;
      remote.lastActionSequence = player.actionSequence;
      remote.actionStep = player.attackStep;
      remote.actionMainHandId = player.attackStep > 0 && isMainHandId(player.mainHandId) ? player.mainHandId : null;
      remote.actionStartedAt = performance.now();
    }, true);
    playerCallbacks.listen("powerSequence", () => {
      if (isLocal) {
        if (player.powerSequence <= localLastPowerSequence) return;
        localLastPowerSequence = player.powerSequence;
        if (isPowerId(player.equippedPower)) localActivePower = player.equippedPower;
        localPowerStartedAt ??= performance.now();
        return;
      }
      if (!remote || player.powerSequence <= remote.lastPowerSequence) return;
      remote.lastPowerSequence = player.powerSequence;
      remote.powerId = isPowerId(player.equippedPower) ? player.equippedPower : null;
      remote.powerStartedAt = performance.now();
    }, true);
    playerCallbacks.listen("defending", () => {
      if (isLocal) setDefensePresentation(player.defending);
      else if (remote) remote.defending = player.defending;
    }, true);
    playerCallbacks.listen("momentumStacks", () => {
      if (isLocal) updateMomentum(player.momentumStacks);
    }, true);
    playerCallbacks.listen("equippedTrait", () => {
      if (!isLocal || !isTraitId(player.equippedTrait)) return;
      updateTraitLoadout(player.equippedTrait);
      updateMomentum(player.momentumStacks);
      status.textContent = `${TRAIT_DEFINITIONS[player.equippedTrait].name} Trait equipped.`;
    }, true);
    playerCallbacks.listen("powerCooldownUntil", () => {
      if (isLocal) localPowerCooldownUntil = player.powerCooldownUntil;
    }, true);
    playerCallbacks.listen("specialCooldownUntil", () => {
      if (isLocal) localSpecialCooldownUntil = player.specialCooldownUntil;
    }, true);
    playerCallbacks.listen("equippedPower", () => {
      if (!isLocal) return;
      powerServerReady = isPowerId(player.equippedPower);
      if (isPowerId(player.equippedPower)) {
        updatePowerLoadout(player.equippedPower);
        status.textContent = `${POWER_DEFINITIONS[player.equippedPower].name} equipped.`;
      }
    }, true);
    playerCallbacks.listen("seismicMastery", () => {
      if (!isLocal || !isSeismicMasteryId(player.seismicMastery)) return;
      updateSeismicMastery(player.seismicMastery);
      status.textContent = `${SEISMIC_CLEAVE_UPGRADES.masteries[player.seismicMastery].name} equipped for Seismic Cleave.`;
    }, true);
    playerCallbacks.listen("equippedSpecial", () => {
      if (!isLocal || !isSpecialId(player.equippedSpecial)) return;
      updateSpecialLoadout(player.equippedSpecial);
      localSpecialCooldownUntil = player.specialCooldownUntil;
      status.textContent = `${SPECIAL_DEFINITIONS[player.equippedSpecial].name} equipped.`;
    }, true);
    playerCallbacks.listen("mainHandId", () => {
      if (isLocal && isMainHandId(player.mainHandId)) {
        updateMainHandLoadout(player.mainHandId);
        const mainHand = MAIN_HAND_DEFINITIONS[player.mainHandId];
        status.textContent = `${mainHand.name} equipped · Attack: ${mainHand.attackName}.`;
      } else if (remote && isMainHandId(player.mainHandId)) {
        setRigMainHand(remote.rig, player.mainHandId);
      }
    }, true);
    playerCallbacks.listen("health", () => {
      if (isLocal) updatePlayerHealth(player.health, player.maxHealth);
    }, true);
    playerCallbacks.listen("maxHealth", () => {
      if (isLocal) updatePlayerHealth(player.health, player.maxHealth);
    }, true);
    playerCallbacks.listen("stamina", () => {
      if (isLocal) updatePlayerStamina(player.stamina, player.maxStamina);
    }, true);
    playerCallbacks.listen("maxStamina", () => {
      if (isLocal) updatePlayerStamina(player.stamina, player.maxStamina);
    }, true);
    playerCallbacks.listen("dangerTier", () => {
      if (isLocal) updateDangerZone(player.dangerTier);
    }, true);
  }, true);
  players.onRemove((_player: NetworkPlayer, sessionId: string) => {
    const remote = remotePlayers.get(sessionId);
    if (!remote) return;
    remote.entity.destroy();
    remotePlayers.delete(sessionId);
    updatePlayerCount();
  });
}

const targetMarker = new pc.Entity("mining-target");
targetMarker.addComponent("render", { type: "box" });
const targetMaterial = new pc.StandardMaterial();
targetMaterial.diffuse = new pc.Color(1, 0.78, 0.12);
targetMaterial.emissive = new pc.Color(0.45, 0.24, 0.02);
targetMaterial.opacity = 0.32;
targetMaterial.blendType = pc.BLEND_NORMAL;
targetMaterial.depthWrite = false;
targetMaterial.update();
if (targetMarker.render) targetMarker.render.material = targetMaterial;
targetMarker.setLocalScale(1.04, 1.04, 1.04);
targetMarker.enabled = false;
app.root.addChild(targetMarker);

const pointer = { x: canvas.width / 2, y: canvas.height / 2 };
let currentTarget: VoxelRaycastHit | null = null;
let targetStateKey = "";
let interactionMode: InteractionMode = "build";

function updatePointerPosition(event: PointerEvent): void {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  pointer.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  if (powerAimActive) updatePowerAimFromPointer();
  if (specialAimActive) updateSpecialAimFromPointer();
}

canvas.addEventListener("pointermove", updatePointerPosition);

function visibleMarkState(mob: MobVisual, now = Date.now()): MarkVisualState | null {
  for (const [casterId, mark] of mob.marks) {
    if (now >= mark.expiresAt) mob.marks.delete(casterId);
  }
  const localMark = room?.sessionId ? mob.marks.get(room.sessionId) : undefined;
  if (localMark) return localMark;
  let strongest: MarkVisualState | null = null;
  for (const mark of mob.marks.values()) {
    if (!strongest || mark.stacks > strongest.stacks) strongest = mark;
  }
  return strongest;
}

function updateTarget(): void {
  if (!camera.camera) return;
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const direction = end.clone().sub(start);
  const hit = voxelRaycast(start, direction, camera.camera.farClip, readVisibleWorldBlock);
  const player = localPlayer.getPosition();
  const inRange = Boolean(hit) && Math.hypot(hit!.x + 0.5 - player.x, hit!.y + 0.5 - player.y, hit!.z + 0.5 - player.z) <= 4.5;
  currentTarget = inRange ? hit : null;
  const combatMob = nearestLivingMob(player, WEAPON_ATTACK_DEFINITIONS[localMainHandId].range);
  targetMarker.enabled = interactionMode === "build" && Boolean(currentTarget);
  if (currentTarget) targetMarker.setPosition(currentTarget.x + 0.5, currentTarget.y + 0.5, currentTarget.z + 0.5);

  const targetKey = currentTarget ? `${currentTarget.x},${currentTarget.y},${currentTarget.z}` : "none";
  const combatMark = combatMob ? visibleMarkState(combatMob.visual) : null;
  const combatKey = combatMob ? `${combatMob.id}:${combatMob.visual.state.health}:${combatMob.visual.state.combatState}:${combatMark?.stacks ?? 0}` : "none";
  const nextKey = `${interactionMode}:${targetKey}:${combatKey}`;
  if (nextKey === targetStateKey) return;
  targetStateKey = nextKey;
  if (interactionMode === "combat" && combatMob) {
    const intent = combatMob.visual.state.combatState === "windup"
      ? " · LUNGE INCOMING"
      : combatMob.visual.state.combatState === "stagger"
        ? " · STAGGERED"
        : "";
    const markLabel = combatMark
      ? combatMark.stacks >= combatMark.maxStacks
        ? ` · EXPOSED ${combatMark.stacks}/${combatMark.maxStacks}`
        : ` · HUNT ${combatMark.stacks}/${combatMark.maxStacks}`
      : "";
    targetLabel.textContent = `${combatMob.visual.state.name}: ${combatMob.visual.state.health}/${combatMob.visual.state.maxHealth} HP · ${combatMob.distance.toFixed(1)}m${markLabel}${intent}`;
  } else if (interactionMode === "combat") targetLabel.textContent = `${MAIN_HAND_DEFINITIONS[localMainHandId].name}: aim toward the Moss Crawler and attack`;
  else if (!currentTarget) targetLabel.textContent = "Target: move near a block and point at it";
  else if (isProtectedVoxel(currentTarget.x, currentTarget.z)) targetLabel.textContent = `Target: ${targetKey} · protected`;
  else targetLabel.textContent = `Target: ${targetKey} · mineable`;
}

let lastChunkBuildMs = 0;
let worldPayloadBytes = 0;
let networkRttMs: number | null = null;

function renderBootstrap(payload: WorldBootstrap): void {
  const buildStartedAt = performance.now();
  const previousSliceY = cutawaySliceY;
  worldPayloadBytes = new Blob([JSON.stringify(payload)]).size;
  for (const chunk of chunks.values()) for (const mesh of chunk.meshes) mesh.destroy();
  for (const child of [...worldRoot.children]) child.destroy();
  chunks.clear();
  const installed = payload.chunks.map(installChunk);
  const ownPlayer = room ? (room.state as { players?: { get(id: string): NetworkPlayer | undefined } }).players?.get(room.sessionId) : undefined;
  const initialPose = ownPlayer ?? payload.spawn;
  const initialPosition = new pc.Vec3(initialPose.x, initialPose.y, initialPose.z);
  localPlayer.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
  authoritativeLocalPosition.set(initialPosition.x, initialPosition.y, initialPosition.z);
  cameraFocus.set(initialPosition.x, initialPosition.y, initialPosition.z);
  camera.setPosition(initialPosition.x + CAMERA_OFFSET_X, initialPosition.y + 18, initialPosition.z + CAMERA_OFFSET_Z);
  camera.lookAt(initialPosition.x, initialPosition.y - 2, initialPosition.z);
  localVerticalVelocity = 0;
  localVisualVerticalOffset = 0;
  localPowerVisualOffset.set(0, 0, 0);
  localPlayerVisual.setLocalPosition(0, 0, 0);
  surfaceReferenceY = SURFACE_HEIGHT + 1;
  const bootstrapUnderground = hasCeilingAbove(initialPosition);
  const bootstrapExcavating = !bootstrapUnderground && isInOpenExcavation(initialPosition);
  cutawaySliceY = bootstrapSliceHeight(
    previousSliceY,
    initialPosition.y,
    surfaceReferenceY,
    bootstrapUnderground,
    bootstrapExcavating,
  );
  playerCutaway.active = cutawaySliceY !== null;
  playerCutaway.sliceY = cutawaySliceY ?? CHUNK_HEIGHT;
  cutawayStateKey = cutawaySliceY === null ? "surface" : `slice:${cutawaySliceY}`;
  surfaceReturnStartedAt = null;
  surfaceRestoreStartSliceY = null;
  undergroundLightingBlend = playerCutaway.active ? 1 : 0;
  exitTrail.enabled = playerCutaway.active;
  exitGuide.hidden = !playerCutaway.active;
  for (const chunk of installed) rebuildChunk(chunk);
  lastChunkBuildMs = performance.now() - buildStartedAt;
  logMovementEvent(
    `WORLD REFRESH ${previousSliceY === null ? "surface" : `slice:${previousSliceY}`} → ${cutawayStateKey} y=${initialPosition.y.toFixed(3)} surface=${surfaceReferenceY.toFixed(3)}`,
  );
  worldReady = true;
  status.textContent = "Connected. Cross the flat ground to the mine entrance east of spawn.";
}

const keys = new Set<string>();
window.addEventListener("keydown", event => keys.add(event.code));
window.addEventListener("keyup", event => keys.delete(event.code));

performanceToggle.addEventListener("click", () => {
  const opening = performancePanel.hidden;
  performancePanel.hidden = !opening;
  performanceToggle.setAttribute("aria-expanded", String(opening));
});

window.addEventListener("keydown", event => {
  if (event.code !== "KeyP" || event.repeat) return;
  performanceToggle.click();
});

let touchStrafe = 0;
let touchForward = 0;
let joystickPointerId: number | null = null;

function updateJoystick(clientX: number, clientY: number): void {
  const bounds = joystickZone.getBoundingClientRect();
  const radius = bounds.width * 0.34;
  let offsetX = clientX - (bounds.left + bounds.width / 2);
  let offsetY = clientY - (bounds.top + bounds.height / 2);
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > radius) {
    offsetX = offsetX / distance * radius;
    offsetY = offsetY / distance * radius;
  }
  touchStrafe = offsetX / radius;
  touchForward = offsetY / radius;
  joystickKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

function releaseJoystick(pointerId: number): void {
  if (pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  touchStrafe = 0;
  touchForward = 0;
  joystickKnob.style.transform = "translate(-50%, -50%)";
}

joystickZone.addEventListener("pointerdown", event => {
  joystickPointerId = event.pointerId;
  joystickZone.setPointerCapture(event.pointerId);
  updateJoystick(event.clientX, event.clientY);
});
joystickZone.addEventListener("pointermove", event => {
  if (event.pointerId === joystickPointerId) updateJoystick(event.clientX, event.clientY);
});
joystickZone.addEventListener("pointerup", event => releaseJoystick(event.pointerId));
joystickZone.addEventListener("pointercancel", event => releaseJoystick(event.pointerId));

let room: Room | null = null;
let worldReady = false;
let lastMoveSentAt = 0;
let moveSequence = 0;
let mineSequence = 0;
let attackSequence = 0;
let dodgeSequence = 0;
let localVerticalVelocity = 0;
let cutawayStateKey = "surface";
let cutawaySliceY: number | null = null;
let surfaceReferenceY: number | null = null;
let surfaceReturnStartedAt: number | null = null;
let surfaceRestoreStartSliceY: number | null = null;
let undergroundLightingBlend = 0;
let undergroundClassification = false;
let excavationClassification = false;
let surfaceReturnClassification = false;
let smoothedMovement = { x: 0, z: 0 };
let lastSentMovement = { x: 0, z: 0 };
let lastMovementDebugUpdateAt = 0;
const movementEventLog: string[] = [];

interface StopTraceFrame {
  at: number;
  dtMs: number;
  rawX: number;
  rawZ: number;
  desiredX: number;
  desiredZ: number;
  appliedX: number;
  appliedZ: number;
  localX: number;
  localY: number;
  localZ: number;
  renderedY: number;
  serverX: number;
  serverY: number;
  serverZ: number;
  screenX: number;
  screenY: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  focusX: number;
  focusY: number;
  focusZ: number;
  animationWeight: number;
  animationPhase: number;
  bodyY: number;
  rightArmPitch: number;
  leftLegPitch: number;
  reconciliationDistance: number;
  reconciliationRate: number;
  verticalVelocity: number;
  visualOffset: number;
  grounded: boolean;
  stepped: boolean;
  hitVertical: boolean;
  sentSequence: number;
  acknowledgedSequence: number;
  pendingStopSequence: number | null;
}

interface StopTrace {
  id: number;
  releasedAt: number;
  captureUntil: number;
  frames: StopTraceFrame[];
}

const STOP_TRACE_HISTORY_FRAMES = 30;
const STOP_TRACE_AFTER_RELEASE_MS = 1200;
const stopTraceHistory: StopTraceFrame[] = [];
let activeStopTrace: StopTrace | null = null;
let completedStopTrace = "No completed stop trace yet.";
let stopTraceSequence = 0;
let previousAppliedMovement = false;

function setDefensePresentation(active: boolean): void {
  localDefending = active;
  defenseSlot.setAttribute("aria-pressed", String(active));
  defenseButton.setAttribute("aria-pressed", String(active));
  defenseSlot.classList.toggle("active", active);
  defenseButton.classList.toggle("active", active);
}

function requestDefense(active: boolean): void {
  if (!room || !worldReady || active === localDefending) return;
  if (active && (powerAimActive || specialAimActive || localPowerStartedAt !== null || localActionStartedAt !== null)) {
    status.textContent = "Finish or cancel the current action before guarding.";
    return;
  }
  defenseSequence += 1;
  setDefensePresentation(active);
  room.send("defense", { requestId: `defense-${defenseSequence}`, active, yaw: localFacingYaw });
  if (active) {
    showCombatFeedback("GUARD", "dodge");
    status.textContent = "Guarding · time the opening 0.24 seconds to parry frontal attacks.";
  }
}

function fixed(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function formatStopTrace(trace: StopTrace): string {
  const lines = [
    `STOP TRACE #${trace.id} frames=${trace.frames.length} pre=${STOP_TRACE_HISTORY_FRAMES} post=${STOP_TRACE_AFTER_RELEASE_MS}ms`,
    `viewport=${canvas.width}x${canvas.height} dpr=${window.devicePixelRatio.toFixed(2)} release_at=${trace.releasedAt.toFixed(1)}ms`,
    "t_ms dt raw_x raw_z desired_x desired_z applied_x applied_z local_x local_y local_z render_y server_x server_y server_z screen_x screen_y ds_x ds_y camera_x camera_y camera_z focus_x focus_y focus_z anim_weight anim_phase body_y arm_r leg_l reconcile rate vertical visual grounded stepped hit_y sent ack lag stop_wait",
  ];
  let previous: StopTraceFrame | undefined;
  for (const frame of trace.frames) {
    const deltaScreenX = previous ? frame.screenX - previous.screenX : 0;
    const deltaScreenY = previous ? frame.screenY - previous.screenY : 0;
    lines.push([
      fixed(frame.at - trace.releasedAt, 1), fixed(frame.dtMs, 1),
      fixed(frame.rawX, 2), fixed(frame.rawZ, 2), fixed(frame.desiredX, 2), fixed(frame.desiredZ, 2),
      fixed(frame.appliedX, 2), fixed(frame.appliedZ, 2),
      fixed(frame.localX), fixed(frame.localY), fixed(frame.localZ), fixed(frame.renderedY),
      fixed(frame.serverX), fixed(frame.serverY), fixed(frame.serverZ),
      fixed(frame.screenX, 1), fixed(frame.screenY, 1), fixed(deltaScreenX, 2), fixed(deltaScreenY, 2),
      fixed(frame.cameraX), fixed(frame.cameraY), fixed(frame.cameraZ),
      fixed(frame.focusX), fixed(frame.focusY), fixed(frame.focusZ),
      fixed(frame.animationWeight), fixed(frame.animationPhase), fixed(frame.bodyY),
      fixed(frame.rightArmPitch, 1), fixed(frame.leftLegPitch, 1),
      fixed(frame.reconciliationDistance), Number.isFinite(frame.reconciliationRate) ? fixed(frame.reconciliationRate, 1) : "HARD",
      fixed(frame.verticalVelocity), fixed(frame.visualOffset),
      Number(frame.grounded), Number(frame.stepped), Number(frame.hitVertical),
      frame.sentSequence, frame.acknowledgedSequence, Math.max(0, frame.sentSequence - frame.acknowledgedSequence), frame.pendingStopSequence ?? "-",
    ].join(" "));
    previous = frame;
  }
  return lines.join("\n");
}

function finishStopTrace(): void {
  if (!activeStopTrace) return;
  let maximumScreenDelta = 0;
  let maximumRenderedYDelta = 0;
  let maximumIdleWorldDelta = 0;
  for (let index = 1; index < activeStopTrace.frames.length; index += 1) {
    const previous = activeStopTrace.frames[index - 1]!;
    const current = activeStopTrace.frames[index]!;
    if (current.at < activeStopTrace.releasedAt) continue;
    maximumScreenDelta = Math.max(maximumScreenDelta, Math.hypot(current.screenX - previous.screenX, current.screenY - previous.screenY));
    maximumRenderedYDelta = Math.max(maximumRenderedYDelta, Math.abs(current.renderedY - previous.renderedY));
    if (Math.hypot(current.appliedX, current.appliedZ) < 0.01) {
      maximumIdleWorldDelta = Math.max(maximumIdleWorldDelta, Math.hypot(current.localX - previous.localX, current.localZ - previous.localZ));
    }
  }
  completedStopTrace = formatStopTrace(activeStopTrace);
  movementDebugTrace.textContent = `Stop trace #${activeStopTrace.id}: ${activeStopTrace.frames.length} frames · screen Δ${maximumScreenDelta.toFixed(2)}px · idle world Δ${maximumIdleWorldDelta.toFixed(3)} · renderY Δ${maximumRenderedYDelta.toFixed(4)} — COPY LOG`;
  logMovementEvent(`STOP TRACE #${activeStopTrace.id} ready (${activeStopTrace.frames.length} frames)`);
  activeStopTrace = null;
}

function movementVectorLabel(vector: { x: number; z: number }): string {
  return `${vector.x.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function logMovementEvent(message: string): void {
  const elapsed = (performance.now() / 1000).toFixed(2);
  movementEventLog.unshift(`${elapsed}s  ${message}`);
  movementEventLog.splice(8);
  movementDebugEvents.replaceChildren(...movementEventLog.map(entry => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
}

movementDebugCopy.addEventListener("click", async () => {
  const trace = activeStopTrace ? formatStopTrace(activeStopTrace) : completedStopTrace;
  const text = `${movementDebugLive.textContent ?? ""}\n\nEVENTS\n${movementEventLog.join("\n")}\n\n${trace}`;
  await navigator.clipboard.writeText(text);
  movementDebugCopy.textContent = "COPIED";
  window.setTimeout(() => { movementDebugCopy.textContent = "COPY LOG"; }, 1000);
});

function resetMovementControls(): void {
  keys.clear();
  if (joystickPointerId !== null) releaseJoystick(joystickPointerId);
  touchStrafe = 0;
  touchForward = 0;
  smoothedMovement = { x: 0, z: 0 };
  lastSentMovement = { x: 0, z: 0 };
  if (!room || !worldReady) return;
  moveSequence += 1;
  room.send("move", { sequence: moveSequence, strafe: 0, forward: 0, yaw: localFacingYaw });
}

window.addEventListener("blur", resetMovementControls);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetMovementControls();
});

function hasCeilingAbove(position: pc.Vec3): boolean {
  const x = Math.floor(position.x);
  const z = Math.floor(position.z);
  for (let y = Math.floor(position.y + 1.5); y < CHUNK_HEIGHT; y += 1) {
    if (readWorldBlock(x, y, z) !== Block.Air) return true;
  }
  return false;
}

function highestLoadedSolidY(x: number, z: number): number {
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
    if (readWorldBlock(x, y, z) !== Block.Air) return y;
  }
  return -1;
}

function isInOpenExcavation(position: pc.Vec3): boolean {
  const centerX = Math.floor(position.x);
  const centerZ = Math.floor(position.z);
  const surroundingHeights: number[] = [];
  for (const offsetX of [-3, 0, 3]) {
    for (const offsetZ of [-3, 0, 3]) {
      if (offsetX === 0 && offsetZ === 0) continue;
      surroundingHeights.push(highestLoadedSolidY(centerX + offsetX, centerZ + offsetZ));
    }
  }
  return isBelowSurroundingSurface(position.y, surroundingHeights);
}

function updateUndergroundPresentation(position: pc.Vec3, dt: number): void {
  const underground = hasCeilingAbove(position);
  const excavating = !underground && isInOpenExcavation(position);
  undergroundClassification = underground;
  excavationClassification = excavating;
  if (surfaceReferenceY === null) surfaceReferenceY = SURFACE_HEIGHT + 1;
  if (cutawaySliceY === null && underground && position.y >= surfaceReferenceY - 0.65) {
    surfaceReferenceY = SURFACE_HEIGHT + 1;
  }
  let visibilityCutaway = shouldUseDepthSlice(
    cutawaySliceY,
    position.y,
    surfaceReferenceY,
    underground,
    excavating,
  );
  let atSurface = false;
  let surfaceDurationMs = 0;
  if (cutawaySliceY !== null) {
    const supported = isPlayerSupported(readCollisionWorldBlock, position.x, position.y, position.z);
    atSurface = isAtSurfaceReturnHeight(position.y, surfaceReferenceY, supported);
    if (atSurface) {
      if (surfaceReturnStartedAt === null) {
        surfaceReturnStartedAt = performance.now();
        surfaceRestoreStartSliceY = cutawaySliceY;
      }
      surfaceDurationMs = performance.now() - surfaceReturnStartedAt;
    } else {
      surfaceReturnStartedAt = null;
      surfaceRestoreStartSliceY = null;
    }
  } else {
    surfaceReturnStartedAt = null;
    surfaceRestoreStartSliceY = null;
  }
  surfaceReturnClassification = atSurface;
  let nextSliceY = visibilityCutaway ? loweredSliceHeight(cutawaySliceY, position.y) : null;
  if (visibilityCutaway && atSurface && surfaceRestoreStartSliceY !== null) {
    nextSliceY = restoredSliceHeight(surfaceRestoreStartSliceY, surfaceReferenceY, surfaceDurationMs);
    if (nextSliceY === null) {
      visibilityCutaway = false;
      surfaceReturnStartedAt = null;
      surfaceRestoreStartSliceY = null;
    }
  }
  const nextKey = nextSliceY === null ? "surface" : `slice:${nextSliceY}`;
  const lightingTarget = visibilityCutaway ? 1 : 0;
  const lightingResponse = 1 - Math.exp(-Math.max(0, dt) * 5);
  undergroundLightingBlend += (lightingTarget - undergroundLightingBlend) * lightingResponse;
  if (Math.abs(lightingTarget - undergroundLightingBlend) < 0.001) undergroundLightingBlend = lightingTarget;
  caveLight.enabled = undergroundLightingBlend > 0.001;
  if (localPlayerSilhouette) localPlayerSilhouette.enabled = visibilityCutaway;
  exitTrail.enabled = visibilityCutaway;
  exitGuide.hidden = !visibilityCutaway;
  caveLight.setPosition(position.x, position.y + 1.2, position.z);
  if (light.light) light.light.intensity = 1.35 + (0.5 - 1.35) * undergroundLightingBlend;
  app.scene.ambientLight = new pc.Color(
    0.36 + (0.16 - 0.36) * undergroundLightingBlend,
    0.42 + (0.18 - 0.42) * undergroundLightingBlend,
    0.38 + (0.2 - 0.38) * undergroundLightingBlend,
  );
  if (nextKey === cutawayStateKey) return;
  logMovementEvent(
    `SLICE ${cutawayStateKey} → ${nextKey} y=${position.y.toFixed(3)} underground=${underground} return=${Math.round(surfaceDurationMs)}ms`,
  );
  cutawayStateKey = nextKey;
  cutawaySliceY = nextSliceY;
  if (!visibilityCutaway) surfaceReferenceY = SURFACE_HEIGHT + 1;
  playerCutaway.active = visibilityCutaway;
  playerCutaway.sliceY = nextSliceY ?? CHUNK_HEIGHT;
  for (const chunk of chunks.values()) rebuildChunk(chunk);
  status.textContent = atSurface && visibilityCutaway
    ? `Returning to surface · restoring slice ${nextSliceY}`
    : underground
    ? `Underground · slice ${nextSliceY ?? "off"} · lowers only when descending`
    : excavating
      ? `Excavation · slice ${nextSliceY ?? "off"} · lowers only when descending`
      : "Surface · cross the flat ground to the descending mine entrance east of spawn.";
}

function requestMine(): void {
  if (!room || !worldReady) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = `Committed to ${POWER_DEFINITIONS[localActivePower ?? localEquippedPower].name} · dodge to cancel.`;
    return;
  }
  if (!currentTarget) {
    status.textContent = "Move within mining reach and point at a block.";
    return;
  }
  const player = localPlayer.getPosition();
  localActionFacingYaw = movementYaw(
    currentTarget.x + 0.5 - player.x,
    currentTarget.z + 0.5 - player.z,
    localFacingYaw,
  );
  localActionStartedAt = performance.now();
  localActionStep = 0;
  localActionMainHandId = null;
  localComboStep = 0;
  localComboExpiresAt = 0;
  const proximity = Math.hypot(
    currentTarget.x + 0.5 - player.x,
    currentTarget.y + 0.5 - player.y,
    currentTarget.z + 0.5 - player.z,
  );
  logMovementEvent(`ACTION mine reach=${proximity.toFixed(2)}`);
  const address = worldToChunk(currentTarget.x, currentTarget.z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk) return;
  mineSequence += 1;
  room.send("mine", {
    requestId: `mine-${mineSequence}`,
    expectedRevision: chunk.revision,
    x: currentTarget.x,
    y: currentTarget.y,
    z: currentTarget.z,
  });
  status.textContent = `Mining ${currentTarget.x}, ${currentTarget.y}, ${currentTarget.z}...`;
}

function requestAttack(): void {
  if (!room || !worldReady) return;
  const now = performance.now();
  if (powerAimActive || (localPowerStartedAt !== null && now - localPowerStartedAt < powerDuration(localActivePower))) {
    status.textContent = `Committed to ${POWER_DEFINITIONS[localActivePower ?? localEquippedPower].name} · dodge to cancel.`;
    return;
  }
  if (localActionStartedAt !== null && now - localActionStartedAt < actionDuration(localActionStep)) {
    status.textContent = "Recovering from the previous attack...";
    return;
  }
  const attackDefinition = WEAPON_ATTACK_DEFINITIONS[localMainHandId];
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, attackDefinition.range);
  localActionFacingYaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : currentTarget
      ? movementYaw(currentTarget.x + 0.5 - player.x, currentTarget.z + 0.5 - player.z, localFacingYaw)
      : localFacingYaw;
  const comboStep = attackDefinition.combo && now <= localComboExpiresAt ? localComboStep % 3 + 1 : 1;
  const timing = attackDefinition.attacks[comboStep - 1] ?? attackDefinition.attacks[0]!;
  localActionStartedAt = now;
  localActionStep = comboStep;
  localActionMainHandId = localMainHandId;
  localComboStep = comboStep;
  localComboExpiresAt = attackDefinition.combo ? now + timing.durationMs + attackDefinition.comboWindowMs : 0;
  attackSequence += 1;
  room.send("attack", { requestId: `attack-${attackSequence}`, yaw: localActionFacingYaw });
  logMovementEvent(`ACTION ${localMainHandId} step=${comboStep} impact=${timing.impactMs}ms yaw=${localActionFacingYaw.toFixed(1)}`);
  const attackName = attackDefinition.combo
    ? `${MAIN_HAND_DEFINITIONS[localMainHandId].attackName} ${comboStep}`
    : MAIN_HAND_DEFINITIONS[localMainHandId].attackName;
  status.textContent = targetMob
    ? attackDefinition.combo && comboStep === 3
      ? `Heavy finisher aimed at ${targetMob.visual.state.name}...`
      : `${attackName} aimed at ${targetMob.visual.state.name}...`
    : `${attackName} · no target in reach.`;
}

function requestDodge(): void {
  if (!room || !worldReady) return;
  if (localDefending) requestDefense(false);
  if (powerAimActive) cancelPowerAim();
  if (specialAimActive) cancelSpecialAim();
  const activePowerElapsed = localPowerStartedAt === null ? null : performance.now() - localPowerStartedAt;
  if (activePowerElapsed !== null
    && localActivePower !== null
    && activePowerElapsed < POWER_DEFINITIONS[localActivePower].windupMs) {
    cancelLocalPowerPresentation();
  }
  const movementLength = Math.hypot(smoothedMovement.x, smoothedMovement.z);
  const direction = movementLength > 0.05
    ? { x: smoothedMovement.x / movementLength, z: smoothedMovement.z / movementLength }
    : {
        x: Math.sin(localFacingYaw * Math.PI / 180),
        z: Math.cos(localFacingYaw * Math.PI / 180),
      };
  const current = localPlayer.getPosition();
  const predicted = resolvePlayerMotion(
    { x: current.x, y: current.y, z: current.z },
    { x: direction.x * 1.8, y: 0, z: direction.z * 1.8 },
    readCollisionWorldBlock,
  );
  localPlayer.setPosition(predicted.x, predicted.y, predicted.z);
  localDodgeStartedAt = performance.now();
  dodgeSequence += 1;
  room.send("dodge", {
    requestId: `dodge-${dodgeSequence}`,
    strafe: direction.x,
    forward: direction.z,
    yaw: localFacingYaw,
  });
  showCombatFeedback("DODGE", "dodge");
  logMovementEvent(`DODGE ${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}`);
  status.textContent = "Dodging · brief invulnerability active.";
}

function updatePowerAimFromPointer(): void {
  if (!powerAimActive || !camera.camera) return;
  const player = localPlayer.getPosition();
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const rayY = end.y - start.y;
  if (Math.abs(rayY) < 0.0001) return;
  const distanceAlongRay = (player.y - start.y) / rayY;
  if (distanceAlongRay <= 0) return;
  const worldX = start.x + (end.x - start.x) * distanceAlongRay;
  const worldZ = start.z + (end.z - start.z) * distanceAlongRay;
  const definition = POWER_DEFINITIONS[localEquippedPower];
  const shape = activePowerShape(localEquippedPower);
  const deltaX = worldX - player.x;
  const deltaZ = worldZ - player.z;
  const pointerDistance = Math.hypot(deltaX, deltaZ);
  const scale = definition.core === "ground" && pointerDistance > definition.range
    ? definition.range / pointerDistance
    : 1;
  const targetX = player.x + deltaX * scale;
  const targetZ = player.z + deltaZ * scale;
  powerAimYaw = movementYaw(targetX - player.x, targetZ - player.z, powerAimYaw);
  if (localEquippedPower === "seismic_cleave" && pointerDistance > 0.1) {
    const directionX = deltaX / pointerDistance;
    const directionZ = deltaZ / pointerDistance;
    let assistedTarget: MobVisual | null = null;
    let closestLateralDistance = 0.72;
    for (const mob of mobVisuals.values()) {
      if (!mob.state.alive) continue;
      const mobDeltaX = mob.state.x - player.x;
      const mobDeltaZ = mob.state.z - player.z;
      const forwardDistance = mobDeltaX * directionX + mobDeltaZ * directionZ;
      if (forwardDistance <= 0 || forwardDistance > shape.range) continue;
      const lateralDistance = Math.abs(mobDeltaX * directionZ - mobDeltaZ * directionX);
      if (lateralDistance >= closestLateralDistance) continue;
      closestLateralDistance = lateralDistance;
      assistedTarget = mob;
    }
    if (assistedTarget) {
      powerAimYaw = movementYaw(assistedTarget.state.x - player.x, assistedTarget.state.z - player.z, powerAimYaw);
    }
  }
  if (definition.core === "ground") powerAimTarget.set(targetX, player.y, targetZ);
  localFacingYaw = powerAimYaw;
  updatePowerAimVisual();
}

function beginPowerAim(pointerId: number | null = null): void {
  if (!room || !worldReady) return;
  if (localDefending) requestDefense(false);
  if (!powerServerReady) {
    status.textContent = "Power server is updating · Powers will unlock automatically.";
    showCombatFeedback("POWER SERVER UPDATING", "hurt");
    return;
  }
  if (powerAimActive || specialAimActive || localPowerStartedAt !== null) return;
  const definition = POWER_DEFINITIONS[localEquippedPower];
  const shape = activePowerShape(localEquippedPower);
  if (!isPowerCompatibleWithMainHand(definition, localMainHandId)) {
    status.textContent = `${definition.name} is not compatible with ${MAIN_HAND_DEFINITIONS[localMainHandId].name}.`;
    showCombatFeedback("INCOMPATIBLE POWER", "hurt");
    return;
  }
  const remaining = localPowerCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${definition.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  if (definition.castType === "tap") {
    castPower(localFacingYaw);
    return;
  }
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, definition.core === "ground" ? shape.range : shape.range + 1.2);
  powerAimYaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : localFacingYaw;
  if (definition.core === "ground") {
    const radians = powerAimYaw * Math.PI / 180;
    const preferredDistance = targetMob ? Math.min(shape.range, targetMob.distance) : Math.min(shape.range, 3.5);
    powerAimTarget.set(
      targetMob ? targetMob.visual.state.x : player.x + Math.sin(radians) * preferredDistance,
      player.y,
      targetMob ? targetMob.visual.state.z : player.z + Math.cos(radians) * preferredDistance,
    );
    powerAimTargetValid = isPlayerSupported(readCollisionWorldBlock, powerAimTarget.x, powerAimTarget.y, powerAimTarget.z);
  }
  powerAimActive = true;
  powerAimPointerId = pointerId;
  localFacingYaw = powerAimYaw;
  createPowerAimVisual();
  updatePowerAimVisual();
  powerSlot.classList.add("aiming");
  powerButton.classList.add("aiming");
  showCombatFeedback(`AIM ${definition.name.toUpperCase()}`, "dodge");
  status.textContent = definition.core === "ground"
    ? `Placing ${definition.name} · point within range, release to cast, dodge to cancel.`
    : `Aiming ${definition.name} · drag to adjust, release to cast, dodge to cancel.`;
}

function cancelPowerAim(): void {
  if (!powerAimActive) return;
  powerAimActive = false;
  powerAimPointerId = null;
  destroyPowerAimVisual();
  powerSlot.classList.remove("aiming");
  powerButton.classList.remove("aiming");
  showCombatFeedback("POWER CANCELLED", "dodge");
}

function cancelLocalPowerPresentation(): void {
  localPowerCooldownUntil = 0;
  localPowerStartedAt = null;
  localPowerFacingYaw = null;
  localPowerStepApplied = false;
  localActivePower = null;
  const localTelegraph = room ? powerTelegraphs.get(room.sessionId) : undefined;
  localTelegraph?.root.destroy();
  if (room) powerTelegraphs.delete(room.sessionId);
}

function castPower(yaw: number, target?: { x: number; y: number; z: number }): void {
  if (!room) return;
  const powerId = localEquippedPower;
  const definition = POWER_DEFINITIONS[powerId];
  const shape = activePowerShape(powerId);
  const player = localPlayer.getPosition();
  localActivePower = powerId;
  localPowerFacingYaw = yaw;
  localPowerStartedAt = performance.now();
  localPowerStepApplied = false;
  localPowerCooldownUntil = Date.now() + definition.cooldownMs;
  powerSequence += 1;
  const telegraphPosition = definition.core === "ground" && target ? target : player;
  startPowerTelegraph(room.sessionId, powerId, telegraphPosition.x, telegraphPosition.y, telegraphPosition.z, yaw, definition.windupMs, shape);
  room.send("power", { requestId: `power-${powerSequence}`, powerId, yaw, ...(target ? { target } : {}) });
  if (powerId === "seismic_cleave") combatAudio.play("seismicWindup");
  showCombatFeedback(definition.name.toUpperCase(), "dodge");
  logMovementEvent(`POWER ${definition.id} yaw=${yaw.toFixed(1)}`);
  status.textContent = definition.core === "burst"
    ? `${definition.name} charging · radial impact in ${(definition.windupMs / 1000).toFixed(2)}s.`
    : definition.core === "ground"
      ? `${definition.name} marked · ground impact in ${(definition.windupMs / 1000).toFixed(2)}s.`
      : definition.core === "mobility"
        ? `${definition.name} committed · lunge impact in ${(definition.windupMs / 1000).toFixed(2)}s.`
      : powerId === "seismic_cleave"
        ? `${definition.name} committed · brace for the travelling faultline.`
        : `${definition.name} winding up · line impact in ${(definition.windupMs / 1000).toFixed(2)}s.`;
}

function commitPowerAim(): void {
  if (!powerAimActive || !room) return;
  const yaw = powerAimYaw;
  const definition = POWER_DEFINITIONS[localEquippedPower];
  if (definition.core === "ground" && !powerAimTargetValid) {
    status.textContent = `${definition.name} needs solid ground within range.`;
    showCombatFeedback("INVALID GROUND", "hurt");
    return;
  }
  const target = definition.core === "ground"
    ? { x: powerAimTarget.x, y: powerAimTarget.y, z: powerAimTarget.z }
    : undefined;
  powerAimActive = false;
  powerAimPointerId = null;
  destroyPowerAimVisual();
  powerSlot.classList.remove("aiming");
  powerButton.classList.remove("aiming");
  castPower(yaw, target);
}

function requestHuntersMark(): void {
  if (!room || !worldReady) return;
  const remaining = localSpecialCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${HUNTERS_MARK.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  if (powerAimActive || localPowerStartedAt !== null || localActionStartedAt !== null) {
    status.textContent = `${HUNTERS_MARK.name} needs a clear action window.`;
    showCombatFeedback("SPECIAL BLOCKED", "hurt");
    return;
  }
  const player = localPlayer.getPosition();
  const target = nearestLivingMob(player, HUNTERS_MARK.range);
  if (!target) {
    status.textContent = `${HUNTERS_MARK.name} needs a living enemy within ${HUNTERS_MARK.range}m.`;
    showCombatFeedback("NO MARK TARGET", "hurt");
    return;
  }
  const yaw = movementYaw(
    target.visual.state.x - player.x,
    target.visual.state.z - player.z,
    localFacingYaw,
  );
  localFacingYaw = yaw;
  localSpecialCooldownUntil = Date.now() + HUNTERS_MARK.cooldownMs;
  specialSequence += 1;
  room.send("special", { requestId: `special-${specialSequence}`, specialId: "hunters_mark", yaw });
  status.textContent = `Marking ${target.visual.state.name}...`;
  logMovementEvent(`SPECIAL ${HUNTERS_MARK.id} target=${target.id} yaw=${yaw.toFixed(1)}`);
}

function updateSpecialAimFromPointer(): void {
  if (!specialAimActive || !camera.camera) return;
  const player = localPlayer.getPosition();
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const rayY = end.y - start.y;
  if (Math.abs(rayY) < 0.0001) return;
  const distanceAlongRay = (player.y - start.y) / rayY;
  if (distanceAlongRay <= 0) return;
  const worldX = start.x + (end.x - start.x) * distanceAlongRay;
  const worldZ = start.z + (end.z - start.z) * distanceAlongRay;
  const deltaX = worldX - player.x;
  const deltaZ = worldZ - player.z;
  const pointerDistance = Math.hypot(deltaX, deltaZ);
  const scale = pointerDistance > BRAMBLE_SNARE.range ? BRAMBLE_SNARE.range / pointerDistance : 1;
  specialAimTarget.set(player.x + deltaX * scale, player.y, player.z + deltaZ * scale);
  specialAimYaw = movementYaw(specialAimTarget.x - player.x, specialAimTarget.z - player.z, specialAimYaw);
  localFacingYaw = specialAimYaw;
  updateSpecialAimVisual();
}

function beginSpecialAim(pointerId: number | null = null): void {
  if (!room || !worldReady || specialAimActive) return;
  if (localDefending) requestDefense(false);
  const definition = SPECIAL_DEFINITIONS[localEquippedSpecial];
  const remaining = localSpecialCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${definition.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  if (powerAimActive || localPowerStartedAt !== null || localActionStartedAt !== null) {
    status.textContent = `${definition.name} needs a clear action window.`;
    showCombatFeedback("SPECIAL BLOCKED", "hurt");
    return;
  }
  if (localEquippedSpecial === "hunters_mark") {
    requestHuntersMark();
    return;
  }
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, BRAMBLE_SNARE.range);
  specialAimYaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : localFacingYaw;
  const radians = specialAimYaw * Math.PI / 180;
  const preferredDistance = targetMob ? Math.min(BRAMBLE_SNARE.range, targetMob.distance) : Math.min(BRAMBLE_SNARE.range, 3.5);
  specialAimTarget.set(
    targetMob ? targetMob.visual.state.x : player.x + Math.sin(radians) * preferredDistance,
    player.y,
    targetMob ? targetMob.visual.state.z : player.z + Math.cos(radians) * preferredDistance,
  );
  specialAimTargetValid = isPlayerSupported(readCollisionWorldBlock, specialAimTarget.x, specialAimTarget.y, specialAimTarget.z);
  specialAimActive = true;
  specialAimPointerId = pointerId;
  localFacingYaw = specialAimYaw;
  createSpecialAimVisual();
  updateSpecialAimVisual();
  specialSlot.classList.add("aiming");
  specialButton.classList.add("aiming");
  showCombatFeedback("AIM BRAMBLE SNARE", "dodge");
  status.textContent = "Placing Bramble Snare · point within range, release to arm, dodge to cancel.";
}

function cancelSpecialAim(): void {
  if (!specialAimActive) return;
  specialAimActive = false;
  specialAimPointerId = null;
  destroySpecialAimVisual();
  specialSlot.classList.remove("aiming");
  specialButton.classList.remove("aiming");
  showCombatFeedback("SPECIAL CANCELLED", "dodge");
}

function commitSpecialAim(): void {
  if (!specialAimActive || !room) return;
  if (!specialAimTargetValid) {
    status.textContent = "Bramble Snare needs solid ground within range.";
    showCombatFeedback("INVALID GROUND", "hurt");
    return;
  }
  const target = { x: specialAimTarget.x, y: specialAimTarget.y, z: specialAimTarget.z };
  const yaw = specialAimYaw;
  specialAimActive = false;
  specialAimPointerId = null;
  destroySpecialAimVisual();
  specialSlot.classList.remove("aiming");
  specialButton.classList.remove("aiming");
  localSpecialCooldownUntil = Date.now() + BRAMBLE_SNARE.cooldownMs;
  specialSequence += 1;
  room.send("special", { requestId: `special-${specialSequence}`, specialId: "bramble_snare", yaw, target });
  showCombatFeedback("SNARE ARMED", "dodge");
  status.textContent = "Bramble Snare armed · the first enemy entering it will be rooted.";
  logMovementEvent(`SPECIAL ${BRAMBLE_SNARE.id} ${target.x.toFixed(1)},${target.z.toFixed(1)}`);
}

function requestPrimaryAction(): void {
  if (localDefending) requestDefense(false);
  if (primaryActionForMode(interactionMode) === "mine") requestMine();
  else requestAttack();
}

function setInteractionMode(mode: InteractionMode): void {
  if (interactionMode === mode && targetStateKey.startsWith(`${mode}:`)) return;
  interactionMode = mode;
  for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  mineButton.textContent = mode === "build" ? "Mine" : "Attack";
  mineButton.dataset.mode = mode;
  touchModeLabel.textContent = mode === "build" ? "Build" : "Combat";
  touchModeButton.dataset.mode = mode;
  touchModeButton.setAttribute("aria-label", `Switch to ${alternateInteractionMode(mode)} mode`);
  combatReticle.hidden = mode !== "combat";
  targetStateKey = "";
  updateTarget();
  logMovementEvent(`MODE ${mode.toUpperCase()}`);
  status.textContent = mode === "build"
    ? "Build mode · clicks mine nearby targeted blocks."
    : `Combat mode · clicks use the ${MAIN_HAND_DEFINITIONS[localMainHandId].name} Attack without changing blocks.`;
}

for (const button of modeButtons) {
  button.addEventListener("click", () => setInteractionMode(button.dataset.mode as InteractionMode));
}
touchModeButton.addEventListener("click", () => {
  setInteractionMode(alternateInteractionMode(interactionMode));
});
for (const button of powerPickerButtons) {
  button.addEventListener("click", () => {
    const powerId = button.dataset.power;
    if (powerId && isPowerId(powerId)) requestPowerEquip(powerId);
  });
}
for (const button of seismicMasteryButtons) {
  button.addEventListener("click", () => {
    const masteryId = button.dataset.seismicMastery;
    if (masteryId && isSeismicMasteryId(masteryId)) requestSeismicMastery(masteryId);
  });
}
for (const button of specialPickerButtons) {
  button.addEventListener("click", () => {
    const specialId = button.dataset.special;
    if (specialId && isSpecialId(specialId)) requestSpecialEquip(specialId);
  });
}
for (const button of mainHandPickerButtons) {
  button.addEventListener("click", () => {
    const mainHandId = button.dataset.mainHand;
    if (mainHandId && isMainHandId(mainHandId)) requestMainHandEquip(mainHandId);
  });
}
for (const button of inventoryEquipButtons) {
  button.addEventListener("click", () => {
    const mainHandId = button.dataset.equipMainHand;
    if (mainHandId && isMainHandId(mainHandId)) requestMainHandEquip(mainHandId);
  });
}
for (const button of traitPickerButtons) {
  button.addEventListener("click", () => {
    const traitId = button.dataset.trait;
    if (traitId && isTraitId(traitId)) requestTraitEquip(traitId);
  });
}

window.addEventListener("keydown", event => {
  if (event.repeat) return;
  if (event.code === "KeyQ") setInteractionMode(alternateInteractionMode(interactionMode));
  if (event.code === "KeyE") requestPrimaryAction();
  if (event.code === "KeyC") requestDefense(true);
  if (event.code === "KeyR") beginPowerAim();
  if (event.code === "KeyF") beginSpecialAim();
  if (event.code === "Space") {
    event.preventDefault();
    requestDodge();
  }
});
window.addEventListener("keyup", event => {
  if (event.code === "KeyC") requestDefense(false);
  if (event.code === "KeyR") commitPowerAim();
  if (event.code === "KeyF") commitSpecialAim();
});
canvas.addEventListener("pointerdown", event => {
  if (event.button === 2) {
    event.preventDefault();
    requestDefense(true);
    return;
  }
  if (event.button !== 0) return;
  updatePointerPosition(event);
  updateTarget();
  requestPrimaryAction();
});
canvas.addEventListener("pointerup", event => {
  if (event.button === 2) requestDefense(false);
});
canvas.addEventListener("pointercancel", () => requestDefense(false));
canvas.addEventListener("contextmenu", event => event.preventDefault());
mineButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestPrimaryAction();
});
dodgeButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestDodge();
});
for (const button of [defenseButton, defenseSlot]) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    requestDefense(true);
  });
  button.addEventListener("pointerup", event => {
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    requestDefense(false);
  });
  button.addEventListener("pointercancel", () => requestDefense(false));
}
specialButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  specialButton.setPointerCapture(event.pointerId);
  beginSpecialAim(event.pointerId);
});
specialSlot.addEventListener("pointerdown", event => {
  event.preventDefault();
  specialSlot.setPointerCapture(event.pointerId);
  beginSpecialAim(event.pointerId);
});
specialButton.addEventListener("pointermove", event => {
  if (specialAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
specialButton.addEventListener("pointerup", event => {
  if (specialAimPointerId === event.pointerId) commitSpecialAim();
});
specialButton.addEventListener("pointercancel", cancelSpecialAim);
specialSlot.addEventListener("pointermove", event => {
  if (specialAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
specialSlot.addEventListener("pointerup", event => {
  if (specialAimPointerId === event.pointerId) commitSpecialAim();
});
specialSlot.addEventListener("pointercancel", cancelSpecialAim);
powerButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  powerButton.setPointerCapture(event.pointerId);
  beginPowerAim(event.pointerId);
});
powerButton.addEventListener("pointermove", event => {
  if (powerAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
powerButton.addEventListener("pointerup", event => {
  if (powerAimPointerId === event.pointerId) commitPowerAim();
});
powerButton.addEventListener("pointercancel", cancelPowerAim);
powerSlot.addEventListener("pointerdown", event => {
  event.preventDefault();
  powerSlot.setPointerCapture(event.pointerId);
  beginPowerAim(event.pointerId);
});
powerSlot.addEventListener("pointermove", event => {
  if (powerAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
powerSlot.addEventListener("pointerup", event => {
  if (powerAimPointerId === event.pointerId) commitPowerAim();
});
powerSlot.addEventListener("pointercancel", cancelPowerAim);

const frameSamples: number[] = [];
const pendingPings = new Map<string, number>();
let pingSequence = 0;
let lastPingSentAt = 0;
let lastPerformanceUpdateAt = 0;

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function updatePerformanceMetrics(now: number): void {
  if (now - lastPerformanceUpdateAt < 500 || frameSamples.length < 10) return;
  lastPerformanceUpdateAt = now;
  const p50 = percentile(frameSamples, 0.5);
  const p95 = percentile(frameSamples, 0.95);
  const fps = p50 > 0 ? 1000 / p50 : 0;
  const visibleVoxels = [...chunks.values()].reduce((total, chunk) => total + chunk.visibleBlocks, 0);
  const meshes = [...chunks.values()].reduce((total, chunk) => total + chunk.meshes.length, 0);
  const triangles = [...chunks.values()].reduce((total, chunk) => total + chunk.visibleFaces * 2, 0);
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const stable = frameSamples.length >= 120;
  const withinBudget = stable && p95 <= 33.3 && (networkRttMs === null || networkRttMs <= 150) && lastChunkBuildMs <= 250;

  performanceFields.frame.textContent = `${p50.toFixed(1)} / ${p95.toFixed(1)} ms`;
  performanceFields.fps.textContent = `${Math.round(fps)}`;
  performanceFields.rtt.textContent = networkRttMs === null ? "Waiting…" : `${networkRttMs.toFixed(0)} ms`;
  performanceFields.voxels.textContent = visibleVoxels.toLocaleString();
  performanceFields.geometry.textContent = `${meshes} / ${triangles.toLocaleString()}`;
  performanceFields.chunks.textContent = `${lastChunkBuildMs.toFixed(1)} ms`;
  performanceFields.payload.textContent = formatBytes(worldPayloadBytes);
  performanceFields.memory.textContent = memory ? formatBytes(memory) : "Unavailable";
  performanceFields.budget.className = stable ? (withinBudget ? "pass" : "fail") : "";
  performanceFields.budget.textContent = !stable
    ? `Collecting sample ${frameSamples.length}/120…`
    : withinBudget
      ? "PASS · p95 ≤ 33.3 ms · RTT ≤ 150 ms"
      : "CHECK · one or more provisional budgets exceeded";

  (window as Window & { __BLOCKCRAFT_PERF__?: Record<string, number | boolean | null> }).__BLOCKCRAFT_PERF__ = {
    p50,
    p95,
    fps,
    networkRttMs,
    visibleVoxels,
    meshes,
    triangles,
    lastChunkBuildMs,
    worldPayloadBytes,
    stable,
    withinBudget,
  };
}

function reconcileLocalPlayer(
  dt: number,
  moving: boolean,
  sequenceLag: number,
  grounded: boolean,
  authoritativeInputReady: boolean,
): { distance: number; rate: number } {
  const position = localPlayer.getPosition();
  const target = authoritativeLocalPosition.clone();
  target.y = reconciliationVerticalTarget(position.y, target.y, grounded);
  const distance = position.distance(target);
  const reconciliationRate = localReconciliationRate(distance, moving, sequenceLag, authoritativeInputReady);
  if (!Number.isFinite(reconciliationRate)) {
    const mobilityAdvance = localActivePower !== null
      && POWER_DEFINITIONS[localActivePower].core === "mobility"
      && localPowerStartedAt !== null;
    if (worldReady) logMovementEvent(`${mobilityAdvance ? "MOBILITY ADVANCE" : "HARD CORRECTION"} d=${distance.toFixed(3)} lag=${sequenceLag}`);
    if (mobilityAdvance) {
      localPowerVisualOffset.x += position.x - target.x;
      localPowerVisualOffset.z += position.z - target.z;
    }
    localVisualVerticalOffset += position.y - target.y;
    localPlayer.setPosition(target);
    localVerticalVelocity = 0;
  } else if (reconciliationRate > 0) {
    const previousY = position.y;
    position.lerp(position, target, Math.min(1, dt * reconciliationRate));
    localVisualVerticalOffset += previousY - position.y;
    localPlayer.setPosition(position);
  }
  return { distance, rate: reconciliationRate };
}

app.on("update", (dt: number) => {
  frameSamples.push(dt * 1000);
  if (frameSamples.length > 240) frameSamples.shift();
  const keyboardStrafe = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const keyboardForward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const strafe = Math.max(-1, Math.min(1, keyboardStrafe + touchStrafe));
  const forward = Math.max(-1, Math.min(1, keyboardForward - touchForward));
  const frameTime = Math.min(dt, 0.05);
  const desiredMovement = quantizeMovementToEightDirections(
    cameraRelativeMovement(strafe, forward, CAMERA_OFFSET_X, CAMERA_OFFSET_Z),
  );
  smoothedMovement = approachMovement(smoothedMovement, desiredMovement, frameTime);
  const powerFacingActive = powerAimActive || (localPowerStartedAt !== null
    && performance.now() - localPowerStartedAt < powerDuration(localActivePower)
    && localPowerFacingYaw !== null);
  const actionFacingActive = localActionStartedAt !== null
    && performance.now() - localActionStartedAt < actionDuration(localActionStep)
    && localActionFacingYaw !== null;
  const desiredFacingYaw = specialAimActive
    ? specialAimYaw
    : powerFacingActive
    ? powerAimActive ? powerAimYaw : localPowerFacingYaw!
    : actionFacingActive
    ? localActionFacingYaw!
    : movementYaw(desiredMovement.x, desiredMovement.z, localFacingYaw);
  localFacingYaw = approachYaw(localFacingYaw, desiredFacingYaw, frameTime);
  const current = localPlayer.getPosition();
  const grounded = isPlayerSupported(readCollisionWorldBlock, current.x, current.y, current.z);
  if (grounded && localVerticalVelocity < 0) localVerticalVelocity = 0;
  else localVerticalVelocity = Math.max(-TERMINAL_VELOCITY, localVerticalVelocity - GRAVITY * frameTime);
  const predicted = resolvePlayerMotion(
    current,
    {
      x: smoothedMovement.x * localMovementSpeed() * frameTime,
      y: localVerticalVelocity * frameTime,
      z: smoothedMovement.z * localMovementSpeed() * frameTime,
    },
    readCollisionWorldBlock,
  );
  if (predicted.hitVertical || predicted.grounded) localVerticalVelocity = 0;
  if (predicted.stepped) {
    localVisualVerticalOffset += current.y - predicted.y;
    logMovementEvent(`STEP y ${current.y.toFixed(3)} → ${predicted.y.toFixed(3)}`);
  }
  localPlayer.setPosition(predicted.x, predicted.y, predicted.z);
  localPlayer.setEulerAngles(0, localFacingYaw, 0);
  const moving = Math.hypot(smoothedMovement.x, smoothedMovement.z) > 0.01;
  const lastSentMoving = Math.hypot(lastSentMovement.x, lastSentMovement.z) > 0.01;
  const reconciliationNow = performance.now();
  if (moving) pendingStopInputSequence = null;
  else if (lastSentMoving && pendingStopInputSequence === null) {
    pendingStopInputSequence = moveSequence + 1;
    pendingStopDeadline = reconciliationNow + 1500;
  }
  if (pendingStopInputSequence !== null
    && (lastProcessedInputSequence >= pendingStopInputSequence || reconciliationNow >= pendingStopDeadline)) {
    pendingStopInputSequence = null;
  }
  const authoritativeInputReady = pendingStopInputSequence === null;
  const sequenceLag = Math.max(0, moveSequence - lastProcessedInputSequence);
  const reconciliation = reconcileLocalPlayer(dt, moving, sequenceLag, predicted.grounded || grounded, authoritativeInputReady);
  localVisualVerticalOffset = smoothVerticalOffset(localVisualVerticalOffset, frameTime);
  localPowerVisualOffset.mulScalar(Math.max(0, 1 - frameTime * 11));
  localPlayerVisual.setLocalPosition(localPowerVisualOffset.x, localVisualVerticalOffset, localPowerVisualOffset.z);
  const animationNow = performance.now();
  const animationTime = animationNow / 1000;
  const localActionElapsed = localActionStartedAt === null ? null : animationNow - localActionStartedAt;
  const localPowerElapsed = localPowerStartedAt === null ? null : animationNow - localPowerStartedAt;
  const activePowerDefinition = localActivePower ? POWER_DEFINITIONS[localActivePower] : null;
  const activePowerForwardStep = localActivePower ? activePowerShape(localActivePower).forwardStep : 0;
  if (localPowerElapsed !== null
    && activePowerDefinition !== null
    && activePowerForwardStep > 0
    && localPowerElapsed >= activePowerDefinition.windupMs
    && !localPowerStepApplied
    && localPowerFacingYaw !== null) {
    if (activePowerDefinition.core !== "mobility") {
      const radians = localPowerFacingYaw * Math.PI / 180;
      const powerPosition = localPlayer.getPosition();
      const horizontalPowerMovement = {
        x: Math.sin(radians) * activePowerForwardStep,
        z: Math.cos(radians) * activePowerForwardStep,
      };
      const stepped = resolvePlayerMotion(powerPosition, { ...horizontalPowerMovement, y: 0 }, readCollisionWorldBlock);
      localPlayer.setPosition(stepped.x, stepped.y, stepped.z);
    }
    localPowerStepApplied = true;
  }
  if (animationNow >= localHitPauseUntil) {
    animateVoxelCharacter(localPlayerRig, Math.hypot(smoothedMovement.x, smoothedMovement.z) * localMovementSpeed(), animationTime, frameTime, localVerticalVelocity, predicted.grounded || grounded, localActionElapsed, localActionStep, localActionMainHandId, localPowerElapsed, localActivePower);
    if (localDefending) applyDefensePose(localPlayerRig);
  }
  const dodgeElapsed = localDodgeStartedAt === null ? null : animationNow - localDodgeStartedAt;
  if (dodgeElapsed !== null && dodgeElapsed < 320) {
    const dodgeProgress = dodgeElapsed / 320;
    localPlayerVisual.setLocalEulerAngles(0, 0, -Math.sin(dodgeProgress * Math.PI) * 13);
  } else {
    localPlayerVisual.setLocalEulerAngles(0, 0, 0);
    if (dodgeElapsed !== null) localDodgeStartedAt = null;
  }
  if (localActionElapsed !== null && localActionElapsed >= actionDuration(localActionStep)) {
    localActionStartedAt = null;
    localActionFacingYaw = null;
    localActionStep = 0;
    localActionMainHandId = null;
  }
  if (localPowerElapsed !== null && localPowerElapsed >= powerDuration(localActivePower)) {
    localPowerStartedAt = null;
    localPowerFacingYaw = null;
    localPowerStepApplied = false;
    localActivePower = null;
  }

  const player = localPlayer.getPosition();
  const renderAt = performance.now() - REMOTE_INTERPOLATION_DELAY_MS;
  for (const remote of remotePlayers.values()) {
    const pose = sampleRemotePose(remote.snapshots, renderAt);
    if (pose) {
      const previousPosition = remote.entity.getPosition();
      const remoteSpeed = Math.hypot(pose.x - previousPosition.x, pose.z - previousPosition.z) / Math.max(frameTime, 0.001);
      const remoteVerticalVelocity = (pose.y - previousPosition.y) / Math.max(frameTime, 0.001);
      remote.entity.setPosition(pose.x, pose.y, pose.z);
      remote.entity.setEulerAngles(0, pose.yaw, 0);
      const remoteActionElapsed = remote.actionStartedAt === null ? null : animationNow - remote.actionStartedAt;
      const remotePowerElapsed = remote.powerStartedAt === null ? null : animationNow - remote.powerStartedAt;
      animateVoxelCharacter(remote.rig, remoteSpeed, animationTime, frameTime, remoteVerticalVelocity, true, remoteActionElapsed, remote.actionStep, remote.actionMainHandId, remotePowerElapsed, remote.powerId);
      if (remote.defending) applyDefensePose(remote.rig);
      if (remoteActionElapsed !== null && remoteActionElapsed >= remoteActionDuration(remote.actionMainHandId, remote.actionStep)) {
        remote.actionStartedAt = null;
        remote.actionMainHandId = null;
      }
      if (remotePowerElapsed !== null && remotePowerElapsed >= powerDuration(remote.powerId)) {
        remote.powerStartedAt = null;
        remote.powerId = null;
      }
    }
    trimRemoteSnapshots(remote.snapshots, renderAt);
  }
  for (const loot of lootVisuals.values()) {
    const visible = !isCutawayHidden(Math.floor(loot.state.x), Math.floor(loot.state.y), Math.floor(loot.state.z));
    loot.root.enabled = visible;
    if (!visible) continue;
    const bob = Math.sin(animationTime * 3.2 + loot.phase) * 0.08;
    loot.root.setPosition(loot.state.x, loot.state.y + 0.36 + bob, loot.state.z);
    loot.root.setEulerAngles(0, (animationTime * 58 + loot.phase * 23) % 360, 0);
  }
  for (const mob of mobVisuals.values()) {
    const visible = mob.state.alive && !isCutawayHidden(Math.floor(mob.state.x), Math.floor(mob.state.y), Math.floor(mob.state.z));
    mob.entity.enabled = visible;
    if (!visible) continue;
    const currentMobPosition = mob.entity.getPosition();
    const targetMobPosition = new pc.Vec3(mob.state.x, mob.state.y, mob.state.z);
    currentMobPosition.lerp(currentMobPosition, targetMobPosition, Math.min(1, frameTime * 10));
    mob.entity.setPosition(currentMobPosition);
    const currentMobYaw = mob.entity.getEulerAngles().y;
    mob.entity.setEulerAngles(0, approachYaw(currentMobYaw, mob.state.yaw, frameTime, 420), 0);
    const hitStrength = Math.max(0, 1 - (animationNow - mob.hitAt) / 180);
    const attackElapsed = animationNow - mob.actionAt;
    const attackDuration = mob.isBrute ? 760 : mob.isSpitter ? 520 : 460;
    const attackStrength = attackElapsed >= 0 && attackElapsed < attackDuration ? Math.sin(attackElapsed / attackDuration * Math.PI) : 0;
    const staggerElapsed = animationNow - mob.staggerAt;
    const staggerStrength = staggerElapsed >= 0 && staggerElapsed < 900 ? 1 - staggerElapsed / 900 : 0;
    const windupStrength = mob.state.combatState === "windup"
      ? (mob.isBrute
          ? 0.72 + Math.sin(animationTime * 12) * 0.13
          : mob.isSpitter
            ? 0.68 + Math.sin(animationTime * 15) * 0.12
            : 0.55 + Math.sin(animationTime * 18) * 0.2)
      : 0;
    const markState = visibleMarkState(mob);
    const exposed = Boolean(markState && markState.stacks >= markState.maxStacks);
    mob.mark.enabled = Boolean(markState);
    if (mob.mark.enabled) {
      const markPulse = 1 + Math.sin(animationTime * (exposed ? 14 : 8)) * (exposed ? 0.15 : 0.08);
      mob.mark.setLocalScale(1.55 * markPulse, 0.022, 1.55 * markPulse);
      mob.markMaterial.emissive = exposed ? new pc.Color(0.78, 0.16, 1) : new pc.Color(0.42, 0.08, 0.74);
      mob.markMaterial.opacity = (exposed ? 0.58 : 0.38) + Math.sin(animationTime * (exposed ? 14 : 8)) * 0.1;
      mob.markMaterial.update();
    }
    for (let index = 0; index < mob.markPips.length; index += 1) {
      const pip = mob.markPips[index]!;
      pip.enabled = Boolean(markState && index < markState.stacks);
      if (pip.enabled) {
        const pipPulse = exposed ? 1 + Math.sin(animationTime * 16 + index * 1.7) * 0.22 : 1;
        pip.setLocalScale(0.14 * pipPulse, 0.14 * pipPulse, 0.14 * pipPulse);
      }
    }
    mob.warning.enabled = mob.state.combatState === "windup";
    if (mob.warning.enabled) {
      const warningPulse = 1 + Math.sin(animationTime * 18) * 0.045;
      mob.warning.setLocalScale(mob.warningScale * warningPulse, 0.025, mob.warningScale * warningPulse);
      mob.warningMaterial.opacity = 0.25 + windupStrength * 0.22;
      mob.warningMaterial.update();
    }
    mob.bodyRoot.setLocalPosition(
      0,
      Math.sin(animationTime * (mob.isBrute ? 2.8 : mob.isSpitter ? 5.5 : 4.5)) * (mob.isBrute ? 0.035 : 0.055) - hitStrength * 0.08 - attackStrength * (mob.isBrute ? 0.14 : 0),
      attackStrength * (mob.isBrute ? 0.42 : mob.isSpitter ? -0.3 : 0.24) - windupStrength * (mob.isBrute ? 0.25 : mob.isSpitter ? -0.18 : 0.16),
    );
    mob.bodyRoot.setLocalEulerAngles(
      mob.isBrute ? windupStrength * -11 + attackStrength * 18 : mob.isSpitter ? windupStrength * 12 - attackStrength * 20 : 0,
      0,
      Math.sin(animationTime * 35) * staggerStrength * (mob.isBrute ? 7 : 12),
    );
    mob.bodyMaterial.emissive = new pc.Color(
      0.55 * hitStrength + 0.34 * windupStrength,
      0.08 * hitStrength + 0.12 * windupStrength + 0.38 * staggerStrength,
      0.04 * hitStrength + 0.08 * windupStrength + 0.48 * staggerStrength,
    );
    mob.bodyMaterial.update();
  }
  for (const [casterId, telegraph] of powerTelegraphs) {
    const elapsed = animationNow - telegraph.startedAt;
    if (elapsed > telegraph.windupMs + 900) {
      telegraph.root.destroy();
      powerTelegraphs.delete(casterId);
      continue;
    }
    const progress = Math.max(0, Math.min(1, elapsed / telegraph.windupMs));
    telegraph.material.opacity = 0.18 + progress * 0.38 + Math.sin(animationTime * 28) * 0.05;
    telegraph.material.update();
  }
  updatePowerAimVisual();
  updateSpecialAimVisual();
  for (let index = powerImpactVisuals.length - 1; index >= 0; index -= 1) {
    const impact = powerImpactVisuals[index]!;
    const elapsed = animationNow - impact.startedAt;
    const impactLifetime = impact.powerId === "eruption" ? 900 : impact.powerId === "seismic_cleave" ? 980 : 650;
    if (elapsed >= impactLifetime) {
      impact.root.destroy();
      impact.fractureRoot.destroy();
      powerImpactVisuals.splice(index, 1);
      continue;
    }
    const strength = 1 - elapsed / impactLifetime;
    if (impact.powerId === "seismic_cleave") {
      const revealDistance = POWER_DEFINITIONS.seismic_cleave.range * Math.min(1, elapsed / 360);
      for (const segment of impact.waveSegments) {
        segment.entity.enabled = segment.distance <= revealDistance;
      }
      for (const segment of impact.fractureSegments) segment.entity.enabled = segment.distance <= revealDistance + 0.25;
      impact.root.setLocalScale(1, 0.8 + Math.max(0, 1 - elapsed / 540) * 1.7, 1);
      impact.material.opacity = Math.max(0, Math.min(0.92, strength * 1.18));
      impact.material.update();
      continue;
    }
    const radialScale = impact.powerId === "shockwave" ? 1 + (1 - strength) * 1.75 : 1;
    if (impact.powerId === "eruption") {
      const eruptionRise = Math.sin(Math.min(1, elapsed / 260) * Math.PI / 2);
      impact.root.setLocalScale(0.82 + eruptionRise * 0.3, 0.15 + eruptionRise * 1.45, 0.82 + eruptionRise * 0.3);
    } else {
      impact.root.setLocalScale(
        radialScale + (impact.powerId === "shockwave" ? 0 : (1 - strength) * 0.08),
        0.65 + strength * 1.8,
        radialScale,
      );
    }
    impact.material.opacity = Math.max(0, strength * 0.82);
    impact.material.update();
  }
  for (let index = powerDebrisVisuals.length - 1; index >= 0; index -= 1) {
    const debris = powerDebrisVisuals[index]!;
    const elapsed = animationNow - debris.startedAt - (debris.delayMs ?? 0);
    if (elapsed < 0) continue;
    debris.entity.enabled = true;
    if (elapsed >= 720) {
      debris.entity.destroy();
      powerDebrisVisuals.splice(index, 1);
      continue;
    }
    debris.velocity.y -= 9.8 * frameTime;
    const position = debris.entity.getPosition();
    debris.entity.setPosition(
      position.x + debris.velocity.x * frameTime,
      position.y + debris.velocity.y * frameTime,
      position.z + debris.velocity.z * frameTime,
    );
    debris.entity.rotate(debris.spin.x * frameTime, debris.spin.y * frameTime, debris.spin.z * frameTime);
  }
  for (let index = markPayoffVisuals.length - 1; index >= 0; index -= 1) {
    const payoff = markPayoffVisuals[index]!;
    const elapsed = animationNow - payoff.startedAt;
    if (elapsed >= 760) {
      payoff.root.destroy();
      markPayoffVisuals.splice(index, 1);
      continue;
    }
    const progress = elapsed / 760;
    const strength = 1 - progress;
    payoff.root.setLocalScale(0.55 + progress * 1.25, 0.8 + Math.sin(progress * Math.PI) * 1.25, 0.55 + progress * 1.25);
    payoff.root.rotate(0, frameTime * 210, 0);
    payoff.material.opacity = Math.max(0, strength * 0.92);
    payoff.material.update();
  }
  for (const [casterId, snare] of brambleSnareVisuals) {
    const expired = Date.now() >= snare.expiresAt;
    const triggerElapsed = snare.triggeredAt === null ? null : animationNow - snare.triggeredAt;
    if (expired || (triggerElapsed !== null && triggerElapsed >= 700)) {
      snare.root.destroy();
      brambleSnareVisuals.delete(casterId);
      continue;
    }
    if (triggerElapsed !== null) {
      const progress = Math.min(1, triggerElapsed / 700);
      snare.root.setLocalScale(1 + progress * 0.75, 1 + Math.sin(progress * Math.PI) * 1.4, 1 + progress * 0.75);
      snare.material.opacity = Math.max(0, (1 - progress) * 0.86);
    } else {
      const pulse = 1 + Math.sin(animationTime * 7) * 0.055;
      snare.root.setLocalScale(pulse, 1 + Math.sin(animationTime * 9) * 0.08, pulse);
      snare.material.opacity = 0.62 + Math.sin(animationTime * 7) * 0.1;
    }
    snare.material.update();
  }
  for (let index = weaponProjectileVisuals.length - 1; index >= 0; index -= 1) {
    const projectile = weaponProjectileVisuals[index]!;
    const progress = Math.min(1, (animationNow - projectile.startedAt) / projectile.durationMs);
    const eased = 1 - (1 - progress) * (1 - progress);
    projectile.entity.setPosition(
      projectile.start.x + (projectile.end.x - projectile.start.x) * eased,
      projectile.start.y + (projectile.end.y - projectile.start.y) * eased + Math.sin(progress * Math.PI) * 0.16,
      projectile.start.z + (projectile.end.z - projectile.start.z) * eased,
    );
    if (progress < 1) continue;
    projectile.entity.setLocalScale(projectile.hit ? 0.34 : 0.08, projectile.hit ? 0.34 : 0.08, projectile.hit ? 0.34 : 0.08);
    projectile.material.opacity = 0;
    projectile.material.update();
    projectile.entity.destroy();
    weaponProjectileVisuals.splice(index, 1);
  }
  for (const [hazardId, hazard] of mobHazardVisuals) {
    if (Date.now() >= hazard.expiresAt) {
      hazard.root.destroy();
      mobHazardVisuals.delete(hazardId);
      continue;
    }
    const pulse = 1 + Math.sin(animationTime * 8) * 0.07;
    hazard.root.setLocalScale(pulse, 1 + Math.sin(animationTime * 11) * 0.12, pulse);
    hazard.material.opacity = 0.5 + Math.sin(animationTime * 9) * 0.1;
    hazard.material.update();
  }
  const powerRemaining = Math.max(0, localPowerCooldownUntil - Date.now());
  const powerCompatible = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[localEquippedPower], localMainHandId);
  const powerFraction = powerRemaining / POWER_DEFINITIONS[localEquippedPower].cooldownMs;
  powerCooldownFill.style.width = `${Math.max(0, Math.min(1, powerFraction)) * 100}%`;
  powerCooldownLabel.textContent = !powerServerReady
    ? "SERVER UPDATE"
    : !powerCompatible
      ? "INCOMPATIBLE"
    : powerAimActive
      ? "RELEASE TO CAST"
    : powerRemaining > 0
      ? `${(powerRemaining / 1000).toFixed(1)}s`
      : "READY · R";
  powerSlot.classList.toggle("ready", powerServerReady && powerCompatible && powerRemaining <= 0 && !powerAimActive);
  powerButton.textContent = !powerServerReady ? "Wait" : !powerCompatible ? "Locked" : powerAimActive ? "Release" : powerRemaining > 0 ? `${Math.ceil(powerRemaining / 1000)}s` : "Power";
  const specialRemaining = Math.max(0, localSpecialCooldownUntil - Date.now());
  const specialDefinition = SPECIAL_DEFINITIONS[localEquippedSpecial];
  const specialFraction = specialRemaining / specialDefinition.cooldownMs;
  specialCooldownFill.style.width = `${Math.max(0, Math.min(1, specialFraction)) * 100}%`;
  specialCooldownLabel.textContent = specialAimActive
    ? "RELEASE TO ARM"
    : specialRemaining > 0
      ? `${(specialRemaining / 1000).toFixed(1)}s`
      : "READY · F";
  specialSlot.classList.toggle("ready", specialRemaining <= 0 && !specialAimActive);
  specialButton.textContent = specialAimActive
    ? "Release"
    : specialRemaining > 0
      ? `${Math.ceil(specialRemaining / 1000)}s`
      : localEquippedSpecial === "hunters_mark" ? "Mark" : "Snare";
  cameraTarget.set(
    player.x + localPowerVisualOffset.x,
    player.y + localVisualVerticalOffset,
    player.z + localPowerVisualOffset.z,
  );
  cameraFocus.copy(cameraTarget);
  const desiredCamera = new pc.Vec3(cameraFocus.x + CAMERA_OFFSET_X, cameraFocus.y + 18, cameraFocus.z + CAMERA_OFFSET_Z);
  if (animationNow < cameraShakeUntil) {
    const remaining = Math.max(0, (cameraShakeUntil - animationNow) / 360);
    const amplitude = cameraShakeStrength * remaining;
    desiredCamera.x += Math.sin(animationNow * 0.095) * amplitude;
    desiredCamera.y += Math.cos(animationNow * 0.12) * amplitude * 0.55;
    desiredCamera.z += Math.sin(animationNow * 0.14 + 1.7) * amplitude;
  }
  camera.setPosition(desiredCamera);
  camera.lookAt(cameraFocus.x, cameraFocus.y - 2, cameraFocus.z);
  const bodyY = localPlayerRig.root.getLocalPosition().y;
  const renderedPlayerPosition = new pc.Vec3(player.x, player.y + localVisualVerticalOffset + bodyY, player.z);
  const playerScreen = camera.camera?.worldToScreen(renderedPlayerPosition);
  updateUndergroundPresentation(player, frameTime);
  updateTarget();

  const now = performance.now();
  const cameraWorldPosition = camera.getPosition();
  const rightArmPitch = localPlayerRig.rightArm.getLocalEulerAngles().x;
  const leftLegPitch = localPlayerRig.leftLeg.getLocalEulerAngles().x;
  const traceFrame: StopTraceFrame = {
    at: now,
    dtMs: dt * 1000,
    rawX: strafe,
    rawZ: forward,
    desiredX: desiredMovement.x,
    desiredZ: desiredMovement.z,
    appliedX: smoothedMovement.x,
    appliedZ: smoothedMovement.z,
    localX: player.x,
    localY: player.y,
    localZ: player.z,
    renderedY: renderedPlayerPosition.y,
    serverX: authoritativeLocalPosition.x,
    serverY: authoritativeLocalPosition.y,
    serverZ: authoritativeLocalPosition.z,
    screenX: playerScreen?.x ?? Number.NaN,
    screenY: playerScreen?.y ?? Number.NaN,
    cameraX: cameraWorldPosition.x,
    cameraY: cameraWorldPosition.y,
    cameraZ: cameraWorldPosition.z,
    focusX: cameraFocus.x,
    focusY: cameraFocus.y,
    focusZ: cameraFocus.z,
    animationWeight: localPlayerRig.locomotionWeight,
    animationPhase: localPlayerRig.locomotionPhase,
    bodyY,
    rightArmPitch,
    leftLegPitch,
    reconciliationDistance: reconciliation.distance,
    reconciliationRate: reconciliation.rate,
    verticalVelocity: localVerticalVelocity,
    visualOffset: localVisualVerticalOffset,
    grounded: predicted.grounded || grounded,
    stepped: predicted.stepped,
    hitVertical: predicted.hitVertical,
    sentSequence: moveSequence,
    acknowledgedSequence: lastProcessedInputSequence,
    pendingStopSequence: pendingStopInputSequence,
  };
  const appliedMovement = Math.hypot(smoothedMovement.x, smoothedMovement.z) > 0.01;
  if (previousAppliedMovement && !appliedMovement) {
    if (activeStopTrace) finishStopTrace();
    stopTraceSequence += 1;
    activeStopTrace = {
      id: stopTraceSequence,
      releasedAt: now,
      captureUntil: now + STOP_TRACE_AFTER_RELEASE_MS,
      frames: [...stopTraceHistory],
    };
    movementDebugTrace.textContent = `Stop trace #${stopTraceSequence}: recording ${STOP_TRACE_AFTER_RELEASE_MS}ms after release…`;
    logMovementEvent(`STOP TRACE #${stopTraceSequence} recording`);
  }
  activeStopTrace?.frames.push(traceFrame);
  stopTraceHistory.push(traceFrame);
  if (stopTraceHistory.length > STOP_TRACE_HISTORY_FRAMES) stopTraceHistory.shift();
  previousAppliedMovement = appliedMovement;
  if (activeStopTrace && now >= activeStopTrace.captureUntil) finishStopTrace();

  updatePerformanceMetrics(now);
  if (room && worldReady && now - lastPingSentAt >= 2000) {
    lastPingSentAt = now;
    pingSequence += 1;
    const id = `ping-${pingSequence}`;
    pendingPings.set(id, now);
    room.send("ping", { id });
  }
  const directionChanged = movementDirectionChanged(lastSentMovement, smoothedMovement);
  if (room && worldReady && (directionChanged || now - lastMoveSentAt >= 50)) {
    lastMoveSentAt = now;
    moveSequence += 1;
    room.send("move", {
      sequence: moveSequence,
      strafe: smoothedMovement.x,
      forward: smoothedMovement.z,
      yaw: localFacingYaw,
    });
    if (directionChanged) logMovementEvent(`DIR #${moveSequence} ${movementVectorLabel(lastSentMovement)} → ${movementVectorLabel(smoothedMovement)}`);
    lastSentMovement = { ...smoothedMovement };
  }
  if (now - lastMovementDebugUpdateAt >= 100) {
    lastMovementDebugUpdateAt = now;
    const keysDown = ["KeyW", "KeyA", "KeyS", "KeyD"].filter(code => keys.has(code)).map(code => code.at(-1)).join("") || "none";
    movementDebugLive.textContent = [
      `keys       ${keysDown}   raw ${strafe.toFixed(2)}, ${forward.toFixed(2)}`,
      `desired    ${movementVectorLabel(desiredMovement)}`,
      `applied    ${movementVectorLabel(smoothedMovement)}`,
      `yaw        ${localFacingYaw.toFixed(1)} → ${desiredFacingYaw.toFixed(1)}`,
      `local      ${player.x.toFixed(3)}, ${player.y.toFixed(3)}, ${player.z.toFixed(3)}`,
      `server     ${authoritativeLocalPosition.x.toFixed(3)}, ${authoritativeLocalPosition.y.toFixed(3)}, ${authoritativeLocalPosition.z.toFixed(3)}`,
      `reconcile  d=${reconciliation.distance.toFixed(3)} rate=${Number.isFinite(reconciliation.rate) ? reconciliation.rate.toFixed(1) : "HARD"}`,
      `vertical   v=${localVerticalVelocity.toFixed(3)} visual=${localVisualVerticalOffset.toFixed(3)}`,
      `animation  weight=${localPlayerRig.locomotionWeight.toFixed(3)} phase=${localPlayerRig.locomotionPhase.toFixed(2)} bodyY=${bodyY.toFixed(3)}`,
      `camera     screen=${playerScreen ? `${playerScreen.x.toFixed(1)}, ${playerScreen.y.toFixed(1)}` : "n/a"}`,
      `mode       ${interactionMode} · click=${primaryActionForMode(interactionMode)}`,
      `trait      ${localTraitId} momentum=${localMomentumStacks}/${MOMENTUM_TRAIT.maxStacks} speed=${localMovementSpeed().toFixed(2)}`,
      `cutaway    ${cutawaySliceY === null ? "surface" : `slice=${cutawaySliceY}`} ref=${surfaceReferenceY?.toFixed(3) ?? "n/a"} underground=${undergroundClassification} excavation=${excavationClassification} return=${surfaceReturnClassification}`,
      `collision  grounded=${grounded} stepped=${predicted.stepped} hitY=${predicted.hitVertical}`,
      `sequence   sent=${moveSequence} ack=${lastProcessedInputSequence} lag=${sequenceLag}`,
      `stop ack   ${pendingStopInputSequence === null ? "ready" : `waiting for #${pendingStopInputSequence}`}`,
    ].join("\n");
  }
});

function applyBlockChange(message: BlockChanged): void {
  const address = worldToChunk(message.x, message.z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk || message.revision <= chunk.revision) return;
  if (message.revision !== chunk.revision + 1) {
    status.textContent = "World changed too quickly; refreshing the chunk state...";
    worldReady = false;
    room?.send("world:ready");
    return;
  }
  chunk.blocks[chunkIndex(address.localX, message.y, address.localZ)] = message.block;
  chunk.revision = message.revision;
  const buildStartedAt = performance.now();
  rebuildChunkAndNeighbors(chunk, message.x, message.z);
  lastChunkBuildMs = performance.now() - buildStartedAt;
  status.textContent = `Block removed · chunk revision ${chunk.revision}`;
}

async function connect(): Promise<void> {
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  const endpoint = import.meta.env.VITE_GAME_SERVER_URL
    || (localHost ? "ws://localhost:2567" : `${window.location.origin}/game`);
  const qaSpawn = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;
  const joinOptions = { name: "Explorer", profileToken, ...(qaSpawn ? { qaSpawn } : {}) };
  room = await retryConnection(
    (signal, attempt) => {
      const client = new Client(endpoint, {
        fetchFn: (input, init) => fetch(input, { ...init, signal }),
      });
      return attempt === 1
        ? client.joinOrCreate(WORLD_ROOM, joinOptions)
        : client.create(WORLD_ROOM, joinOptions);
    },
    (attempt, delay) => {
      status.textContent = attempt === 2
        ? `Shared world is delayed. Starting a recovery world in ${Math.round(delay / 1000)}s…`
        : `Game server is restarting. Reconnecting in ${Math.round(delay / 1000)}s… (attempt ${attempt}/5)`;
    },
  );
  bindPlayers(room);
  bindMobs(room);
  bindLootDrops(room);
  updatePlayerCount();
  status.textContent = "Connected. Loading the authoritative world...";
  room.onMessage("world:bootstrap", (payload: WorldBootstrap) => renderBootstrap(payload));
  room.onMessage("block:changed", applyBlockChange);
  room.onMessage("combat:projectile", (message: WeaponAttackReleased) => {
    createWeaponProjectile(message);
    logMovementEvent(`${message.mainHandId === "bow" ? "ARROW" : "ARCANE"} ${message.hit ? "HIT" : "MISS"}`);
  });
  room.onMessage("combat:mob-projectile", (message: MobProjectileReleased) => {
    createMobProjectile(message);
    logMovementEvent(`ACID SHOT ${message.mobId}`);
  });
  room.onMessage("combat:mob-hazard", (message: MobHazardPlaced) => {
    createMobHazard(message);
    logMovementEvent(`ACID POOL ${message.hazardId}`);
  });
  room.onMessage("power:cast", (message: PowerCast) => {
    if (message.casterId !== room?.sessionId) {
      const telegraphPosition = message.target ?? message;
      startPowerTelegraph(message.casterId, message.powerId, telegraphPosition.x, telegraphPosition.y, telegraphPosition.z, message.yaw, message.windupMs, message);
      const remote = remotePlayers.get(message.casterId);
      if (remote) {
        remote.powerId = message.powerId;
        remote.powerStartedAt = performance.now();
      }
    }
    logMovementEvent(`POWER CAST ${message.casterId} ${message.powerId}`);
  });
  room.onMessage("power:resolved", (message: PowerResolved) => {
    createPowerImpact(message);
    for (const mobId of message.defeatedMobIds) {
      const defeatedMob = mobVisuals.get(mobId);
      defeatedMob?.marks.clear();
    }
    const isLocal = message.casterId === room?.sessionId;
    if (isLocal) {
      const definition = POWER_DEFINITIONS[message.powerId];
      const powerLabel = definition.name.toUpperCase();
      localHitPauseUntil = performance.now() + (message.hitCount > 0 ? 85 : 40);
      showCombatFeedback(
        message.defeatedMobIds.length > 0
          ? `${powerLabel} DEFEAT`
          : (message.traitBonusHitCount ?? 0) > 0
            ? `EXECUTION! ×${message.traitBonusHitCount}`
          : message.hitCount > 0
            ? `${powerLabel} HIT ×${message.hitCount}`
            : powerLabel,
      );
      status.textContent = message.hitCount > 0
        ? `${definition.name} struck ${message.hitCount} target${message.hitCount === 1 ? "" : "s"} for ${message.damage} damage${(message.aftershockHitCount ?? 0) > 0 ? ` · AFTERSHOCK ×${message.aftershockHitCount}` : ""}${(message.traitBonusHitCount ?? 0) > 0 ? ` · EXECUTIONER ×${message.traitBonusHitCount}` : ""}.`
        : definition.fracturesTerrain
          ? `${definition.name} fractured ${message.fractures.length} terrain block${message.fractures.length === 1 ? "" : "s"}.`
          : `${definition.name} released with no targets in range.`;
    }
    logMovementEvent(`POWER RESOLVE hits=${message.hitCount} fractures=${message.fractures.length}`);
  });
  room.onMessage("special:applied", (message: SpecialApplied) => {
    const mob = mobVisuals.get(message.mobId);
    mob?.marks.set(message.casterId, {
      expiresAt: message.expiresAt,
      stacks: message.stacks,
      maxStacks: message.maxStacks,
    });
    if (message.casterId === room?.sessionId) {
      localSpecialCooldownUntil = message.cooldownUntil;
      const name = mob?.state.name ?? "Enemy";
      showCombatFeedback("HUNTER'S MARK", "dodge");
      status.textContent = `${name} marked ${message.stacks}/${message.maxStacks} · land two Attacks, then cash in with Power.`;
    }
    logMovementEvent(`SPECIAL APPLIED ${message.mobId} ${message.stacks}/${message.maxStacks} +${message.bonusDamage}`);
  });
  room.onMessage("special:snare-placed", (message: BrambleSnarePlaced) => {
    createBrambleSnareVisual(message);
    if (message.casterId === room?.sessionId) {
      localSpecialCooldownUntil = message.cooldownUntil;
      showCombatFeedback("SNARE ARMED", "dodge");
      status.textContent = `Bramble Snare armed for ${(BRAMBLE_SNARE.lifetimeMs / 1000).toFixed(0)}s · lure an enemy into the ring.`;
    }
    logMovementEvent(`SNARE PLACED ${message.casterId} ${message.x.toFixed(1)},${message.z.toFixed(1)}`);
  });
  room.onMessage("special:snare-triggered", (message: BrambleSnareTriggered) => {
    triggerBrambleSnareVisual(message);
    if (message.casterId === room?.sessionId) {
      const name = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
      showCombatFeedback(`SNARED · ${(message.rootMs / 1000).toFixed(1)}S`, "dodge");
      status.textContent = `${name} rooted by Bramble Snare for ${(message.rootMs / 1000).toFixed(1)}s.`;
    }
    logMovementEvent(`SNARE TRIGGERED ${message.mobId} ${message.rootMs}ms`);
  });
  room.onMessage("special:progressed", (message: SpecialProgressed) => {
    const mob = mobVisuals.get(message.mobId);
    mob?.marks.set(message.casterId, {
      expiresAt: message.expiresAt,
      stacks: message.stacks,
      maxStacks: message.maxStacks,
    });
    if (message.casterId === room?.sessionId) {
      const name = mob?.state.name ?? "Enemy";
      showCombatFeedback(message.exposed ? "EXPOSED · USE POWER" : `HUNT ${message.stacks}/${message.maxStacks}`, "dodge");
      status.textContent = message.exposed
        ? `${name} is Exposed · Power will consume the mark for bonus damage and heavy stagger.`
        : `${name} Hunt stack ${message.stacks}/${message.maxStacks} · keep attacking.`;
    }
    logMovementEvent(`SPECIAL STACK ${message.mobId} ${message.stacks}/${message.maxStacks}`);
  });
  room.onMessage("special:consumed", (message: SpecialConsumed) => {
    const mob = mobVisuals.get(message.mobId);
    mob?.marks.delete(message.casterId);
    if (mob) createHuntersMarkPayoff(mob);
    if (message.casterId === room?.sessionId) {
      const name = mob?.state.name ?? "Enemy";
      showCombatFeedback(`MARK CASHED IN  +${message.bonusDamage}`, "dodge");
      status.textContent = `${name} Exposed payoff · +${message.bonusDamage} Power damage and ${(message.staggerMs / 1000).toFixed(1)}s stagger.`;
    }
    logMovementEvent(`SPECIAL CONSUMED ${message.mobId} +${message.bonusDamage}`);
  });
  room.onMessage("power:cancelled", (message: PowerCancelled) => {
    const telegraph = powerTelegraphs.get(message.casterId);
    telegraph?.root.destroy();
    powerTelegraphs.delete(message.casterId);
    if (message.casterId !== room?.sessionId) return;
    const powerName = POWER_DEFINITIONS[message.powerId].name;
    cancelLocalPowerPresentation();
    showCombatFeedback(message.reason === "dodge" ? "DODGE CANCEL" : "POWER CANCELLED", "dodge");
    status.textContent = message.reason === "dodge"
      ? `${powerName} cancelled into a dodge · cooldown refunded.`
      : `${powerName} cancelled · cooldown refunded.`;
    logMovementEvent(`POWER CANCEL ${message.reason}`);
  });
  room.onMessage("combat:hit", (message: CombatHit) => {
    const mob = mobVisuals.get(message.mobId);
    if (message.defeated) mob?.marks.clear();
    const name = mob?.state.name ?? "Mob";
    const respawnSeconds = mob?.state.archetype === "stone_brute" ? 8.5 : 5;
    status.textContent = message.defeated
      ? `${name} defeated · respawning in ${respawnSeconds} seconds.`
      : `${name} hit for ${message.damage} · ${message.health} HP remaining.`;
    logMovementEvent(`HIT ${message.mobId} hp=${message.health} defeated=${message.defeated}`);
    if (message.attackerId === room?.sessionId) {
      updateMomentum(message.momentumStacks);
      const comboStep = message.comboStep >= 1 && message.comboStep <= 3 ? message.comboStep : localActionStep || 1;
      localHitPauseUntil = performance.now() + (comboStep === 3 ? 75 : 48);
      const hitLabel = WEAPON_ATTACK_DEFINITIONS[message.mainHandId].combo && comboStep === 3
        ? `FINISHER  −${message.damage}`
        : `${MAIN_HAND_DEFINITIONS[message.mainHandId].attackName.toUpperCase()}  −${message.damage}`;
      showCombatFeedback(
        message.defeated
          ? "DEFEATED"
          : (message.traitBonusDamage ?? 0) > 0
            ? `EXECUTION!  −${message.damage}`
          : hitLabel,
      );
      if (localTraitId === "momentum") status.textContent += ` · Momentum ${message.momentumStacks}/${MOMENTUM_TRAIT.maxStacks}.`;
      else if ((message.traitBonusDamage ?? 0) > 0) status.textContent += ` · Executioner +${message.traitBonusDamage} damage.`;
    }
  });
  room.onMessage("combat:miss", (message: CombatMiss) => {
    if (message.attackerId !== room?.sessionId) return;
    showCombatFeedback("MISS", "hurt");
    const attackName = WEAPON_ATTACK_DEFINITIONS[message.mainHandId].combo
      ? `${MAIN_HAND_DEFINITIONS[message.mainHandId].attackName} ${message.comboStep}`
      : MAIN_HAND_DEFINITIONS[message.mainHandId].attackName;
    status.textContent = `${attackName} missed · recovery leaves you open.`;
    logMovementEvent(`MISS ${message.mainHandId} step=${message.comboStep}`);
  });
  room.onMessage("combat:stagger", (message: CombatStagger) => {
    if (message.attackerId !== room?.sessionId) return;
    showCombatFeedback("STAGGER!", "dodge");
    status.textContent = `Perfect counter · enemy staggered for ${(message.durationMs / 1000).toFixed(1)}s.`;
    logMovementEvent(`STAGGER ${message.mobId} ${message.durationMs}ms`);
  });
  room.onMessage("combat:player-hit", (message: PlayerHit) => {
    if (message.playerId !== room?.sessionId) return;
    if (message.momentumStacks !== undefined) updateMomentum(message.momentumStacks);
    if (message.guarded) return;
    const attackerName = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
    showCombatFeedback(message.defeated ? "DEFEATED · RESPAWNING" : `HURT  −${message.damage}`, "hurt");
    status.textContent = message.defeated
      ? "You were defeated and returned to the surface camp."
      : `${attackerName} hit you for ${message.damage} · ${message.health} HP remaining.`;
    logMovementEvent(`HURT hp=${message.health} defeated=${message.defeated}`);
  });
  room.onMessage("combat:defense", (message: DefenseResolved) => {
    if (message.playerId !== room?.sessionId) return;
    updateMomentum(message.momentumStacks);
    const attackerName = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
    showCombatFeedback(message.parried ? "PARRY!" : message.damage > 0 ? `GUARD  −${message.damage}` : "BLOCK", "dodge");
    status.textContent = message.parried
      ? localTraitId === "bulwark"
        ? `${attackerName} parried and staggered · Bulwark restored stamina · counter now.`
        : `${attackerName} parried and staggered · counter now.`
      : `${attackerName} guarded · ${message.damage} damage taken · ${message.stamina} stamina remaining.`;
    logMovementEvent(`${message.parried ? "PARRY" : "GUARD"} ${message.mobId} damage=${message.damage} stamina=${message.stamina}`);
  });
  room.onMessage("combat:reward", (message: CombatReward) => {
    if (message.playerId !== room?.sessionId) return;
    const defeatedName = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
    const rewards = [
      message.healthRestored > 0 ? `+${message.healthRestored} HP` : "",
      message.staminaRestored > 0 ? `+${message.staminaRestored} stamina` : "",
    ].filter(Boolean).join(" · ");
    showCombatFeedback(rewards || "VICTORY", "dodge");
    status.textContent = `${defeatedName} reward${rewards ? ` · ${rewards}` : " claimed"}.`;
    logMovementEvent(`REWARD ${message.mobId} hp=${message.healthRestored} stamina=${message.staminaRestored}`);
  });
  room.onMessage("loot:picked-up", (message: LootPickedUp) => {
    if (message.playerId !== room?.sessionId || !isItemId(message.itemId)) return;
    updateInventoryItem(message.itemId, message.total);
    const item = ITEM_DEFINITIONS[message.itemId];
    showCombatFeedback(`+${message.quantity} ${item.name.toUpperCase()}`, "dodge");
    status.textContent = `Picked up ${item.name} · ${message.total} total.`;
    logMovementEvent(`LOOT ${message.itemId} +${message.quantity} total=${message.total}`);
  });
  room.onMessage("pong", (message: { id?: unknown }) => {
    if (typeof message.id !== "string") return;
    const sentAt = pendingPings.get(message.id);
    if (sentAt === undefined) return;
    networkRttMs = performance.now() - sentAt;
    pendingPings.delete(message.id);
  });
  room.onMessage("action:rejected", (message: ActionRejected) => {
    status.textContent = `Server rejected ${message.action}: ${message.reason}`;
    if (message.action === "move") localPlayer.setPosition(authoritativeLocalPosition);
    if (message.action === "dodge") {
      localPlayer.setPosition(authoritativeLocalPosition);
      localDodgeStartedAt = null;
      localPlayerVisual.setLocalEulerAngles(0, 0, 0);
      showCombatFeedback(message.reason === "stamina" ? "NO STAMINA" : "DODGE BLOCKED", "hurt");
    }
    if (message.action === "defense") {
      setDefensePresentation(false);
      showCombatFeedback(message.reason === "stamina" ? "NO STAMINA" : "GUARD BLOCKED", "hurt");
    }
    if (message.action === "power") {
      const isEquipRejection = message.requestId?.startsWith("power-equip-") ?? false;
      if (!isEquipRejection) {
        cancelPowerAim();
        cancelLocalPowerPresentation();
      }
      showCombatFeedback(message.reason === "cooldown" ? "POWER RECHARGING" : "POWER BLOCKED", "hurt");
    }
    if (message.action === "special") {
      const isEquipRejection = message.requestId?.startsWith("special-equip-") ?? false;
      if (!isEquipRejection) {
        cancelSpecialAim();
        if (message.reason !== "cooldown") localSpecialCooldownUntil = 0;
        showCombatFeedback(message.reason === "cooldown" ? "SPECIAL RECHARGING" : "SPECIAL BLOCKED", "hurt");
      } else {
        showCombatFeedback("LOADOUT BLOCKED", "hurt");
      }
    }
    if (message.action === "loadout") {
      showCombatFeedback(message.reason === "missing" ? "ITEM REQUIRED" : "LOADOUT BLOCKED", "hurt");
      if (message.reason === "missing") status.textContent = "Collect that weapon from its enemy before equipping it.";
    }
    if (message.reason === "stale") {
      worldReady = false;
      room?.send("world:ready");
    }
  });
  room.onLeave(() => {
    worldReady = false;
    powerServerReady = false;
    localSpecialCooldownUntil = 0;
    setDefensePresentation(false);
    cancelPowerAim();
    cancelSpecialAim();
    cancelLocalPowerPresentation();
    room = null;
    status.textContent = "Disconnected from the world.";
    for (const remote of remotePlayers.values()) remote.entity.destroy();
    remotePlayers.clear();
    for (const mob of mobVisuals.values()) mob.entity.destroy();
    mobVisuals.clear();
    for (const loot of lootVisuals.values()) loot.root.destroy();
    lootVisuals.clear();
    for (const itemId of inventoryCounts.keys()) updateInventoryItem(itemId, 0);
    for (const telegraph of powerTelegraphs.values()) telegraph.root.destroy();
    powerTelegraphs.clear();
    for (const impact of powerImpactVisuals) {
      impact.root.destroy();
      impact.fractureRoot.destroy();
    }
    powerImpactVisuals.length = 0;
    for (const debris of powerDebrisVisuals) debris.entity.destroy();
    powerDebrisVisuals.length = 0;
    for (const payoff of markPayoffVisuals) payoff.root.destroy();
    markPayoffVisuals.length = 0;
    for (const snare of brambleSnareVisuals.values()) snare.root.destroy();
    brambleSnareVisuals.clear();
    for (const projectile of weaponProjectileVisuals) projectile.entity.destroy();
    weaponProjectileVisuals.length = 0;
    for (const hazard of mobHazardVisuals.values()) hazard.root.destroy();
    mobHazardVisuals.clear();
    updatePlayerCount();
  });
  room.send("world:ready");
}

connect().catch(error => {
  status.textContent = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
});
