import * as pc from "playcanvas";
import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import {
  COMBAT_ATTACKS,
  COMBO_CHAIN_WINDOW_MS,
  POWER_DEFINITIONS,
  WORLD_ROOM,
  type ActionRejected,
  type BlockChanged,
  type ChunkSnapshot,
  type CombatHit,
  type CombatMiss,
  type CombatStagger,
  type PlayerHit,
  type PowerCast,
  type PowerResolved,
  type WorldBootstrap,
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
  SEISMIC_POWER_DURATION_MS,
  advanceLocomotionAnimation,
  primaryActionPose,
  seismicPowerPose,
  voxelCharacterPose,
} from "./character-animation.js";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const targetLabel = document.querySelector<HTMLElement>("#target")!;
const playerCount = document.querySelector<HTMLElement>("#players")!;
const exitGuide = document.querySelector<HTMLElement>("#exit-guide")!;
const performanceToggle = document.querySelector<HTMLButtonElement>("#performance-toggle")!;
const performancePanel = document.querySelector<HTMLElement>("#performance-panel")!;
const movementDebugLive = document.querySelector<HTMLElement>("#movement-debug-live")!;
const movementDebugEvents = document.querySelector<HTMLOListElement>("#movement-debug-events")!;
const movementDebugCopy = document.querySelector<HTMLButtonElement>("#movement-debug-copy")!;
const movementDebugTrace = document.querySelector<HTMLElement>("#movement-debug-trace")!;
const playerHealthFill = document.querySelector<HTMLElement>("#player-health-fill")!;
const playerHealthValue = document.querySelector<HTMLElement>("#player-health-value")!;
const playerStaminaFill = document.querySelector<HTMLElement>("#player-stamina-fill")!;
const playerStaminaValue = document.querySelector<HTMLElement>("#player-stamina-value")!;
const powerSlot = document.querySelector<HTMLButtonElement>("#power-slot")!;
const powerCooldownFill = document.querySelector<HTMLElement>("#power-cooldown-fill")!;
const powerCooldownLabel = document.querySelector<HTMLElement>("#power-cooldown-label")!;
const combatReticle = document.querySelector<HTMLElement>("#combat-reticle")!;
const combatFeedback = document.querySelector<HTMLElement>("#combat-feedback")!;
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
const powerButton = document.querySelector<HTMLButtonElement>("#power-button")!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("#mode-toggle [data-mode]")];
if (!canvas || !status || !targetLabel || !playerCount || !exitGuide || !performanceToggle || !performancePanel || !movementDebugLive || !movementDebugEvents || !movementDebugCopy || !joystickZone || !joystickKnob || !mineButton || !dodgeButton || !powerButton || !powerSlot || !powerCooldownFill || !powerCooldownLabel || !playerHealthFill || !playerHealthValue || !playerStaminaFill || !playerStaminaValue || !combatReticle || !combatFeedback || modeButtons.length !== 2) {
  throw new Error("Game shell is missing required elements");
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
  return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg, silhouette, locomotionPhase: 0, locomotionWeight: 0 };
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
  powerElapsedMilliseconds: number | null = null,
): void {
  const locomotion = advanceLocomotionAnimation(
    { phase: rig.locomotionPhase, weight: rig.locomotionWeight },
    speed,
    deltaTime,
  );
  rig.locomotionPhase = locomotion.phase;
  rig.locomotionWeight = locomotion.weight;
  const pose = voxelCharacterPose(speed, time, verticalVelocity, grounded, 4.2, locomotion);
  const powerPose = seismicPowerPose(powerElapsedMilliseconds);
  const action = powerPose.active ? powerPose : primaryActionPose(actionElapsedMilliseconds, actionStep);
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
  mainHandTag: string;
  equippedPower: string;
  powerCooldownUntil: number;
  powerSequence: number;
  powerCastStartedAt: number;
  name: string;
}

interface RemotePlayerVisual {
  entity: pc.Entity;
  rig: VoxelCharacterRig;
  snapshots: RemoteSnapshot[];
  actionStartedAt: number | null;
  actionStep: number;
  lastActionSequence: number;
  powerStartedAt: number | null;
  lastPowerSequence: number;
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
}

interface MobVisual {
  entity: pc.Entity;
  bodyRoot: pc.Entity;
  bodyMaterial: pc.StandardMaterial;
  warning: pc.Entity;
  warningMaterial: pc.StandardMaterial;
  healthFill: pc.Entity;
  state: NetworkMob;
  lastHitSequence: number;
  hitAt: number;
  lastActionSequence: number;
  actionAt: number;
  lastStaggerSequence: number;
  staggerAt: number;
}

const remoteMaterial = coloredMaterial(new pc.Color(0.18, 0.55, 0.86));
const remotePlayers = new Map<string, RemotePlayerVisual>();
const mobVisuals = new Map<string, MobVisual>();
const authoritativeLocalPosition = new pc.Vec3(8.5, 11, 8.5);
let localFacingYaw = 0;
let localVisualVerticalOffset = 0;
let localActionStartedAt: number | null = null;
let localActionFacingYaw: number | null = null;
let localActionStep = 0;
let localComboStep = 0;
let localComboExpiresAt = 0;
let localHitPauseUntil = 0;
let localDodgeStartedAt: number | null = null;
let localPowerStartedAt: number | null = null;
let localPowerFacingYaw: number | null = null;
let localPowerStepApplied = false;
let localPowerCooldownUntil = 0;
let powerSequence = 0;
let localLastPowerSequence = 0;
let powerServerReady = false;
let lastProcessedInputSequence = 0;
let pendingStopInputSequence: number | null = null;
let pendingStopDeadline = 0;
const cameraFocus = new pc.Vec3(8.5, 11, 8.5);
const cameraTarget = new pc.Vec3(8.5, 11, 8.5);

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

function actionDuration(step: number): number {
  return step >= 1 && step <= 3 ? COMBAT_ATTACKS[step - 1]!.durationMs : PRIMARY_ACTION_DURATION_MS;
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
}

const powerTelegraphs = new Map<string, PowerTelegraphVisual>();
const powerImpactVisuals: PowerImpactVisual[] = [];

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

function startPowerTelegraph(casterId: string, x: number, y: number, z: number, yaw: number, windupMs: number): void {
  powerTelegraphs.get(casterId)?.root.destroy();
  const root = new pc.Entity(`power-telegraph:${casterId}`);
  const material = powerMaterial(new pc.Color(1, 0.43, 0.06), 0.28);
  const definition = POWER_DEFINITIONS.seismic_cleave;
  for (let distance = 0.8; distance <= definition.range; distance += 0.8) {
    addBox(root, "seismic-warning", material, [definition.width, 0.025, 0.66], [0, 0.035, distance]);
  }
  root.setPosition(x, y, z);
  root.setEulerAngles(0, yaw, 0);
  app.root.addChild(root);
  powerTelegraphs.set(casterId, { root, material, startedAt: performance.now(), windupMs });
}

function createPowerImpact(message: PowerResolved): void {
  powerTelegraphs.get(message.casterId)?.root.destroy();
  powerTelegraphs.delete(message.casterId);
  const root = new pc.Entity(`power-impact:${message.casterId}`);
  const fractureRoot = new pc.Entity(`power-fractures:${message.casterId}`);
  const material = powerMaterial(new pc.Color(1, 0.68, 0.14), 0.78);
  const definition = POWER_DEFINITIONS.seismic_cleave;
  for (let distance = 0.65; distance <= definition.range; distance += 0.65) {
    addBox(root, "seismic-wave", material, [definition.width * 0.84, 0.12, 0.42], [0, 0.12, distance]);
  }
  for (const fracture of message.fractures) {
    addBox(fractureRoot, "terrain-fracture", material, [0.72, 0.035, 0.16], [fracture.x + 0.5, fracture.y + 1.025, fracture.z + 0.5]);
  }
  root.setPosition(message.x, message.y, message.z);
  root.setEulerAngles(0, message.yaw, 0);
  app.root.addChild(root);
  app.root.addChild(fractureRoot);
  powerImpactVisuals.push({ root, fractureRoot, material, startedAt: performance.now() });
}

function updatePlayerCount(): void {
  const count = room ? remotePlayers.size + 1 : 0;
  playerCount.textContent = `${count} player${count === 1 ? "" : "s"} online`;
}

function createRemotePlayer(sessionId: string, player: NetworkPlayer): RemotePlayerVisual {
  const entity = new pc.Entity(`remote-player:${sessionId}`);
  const rig = createVoxelCharacter(entity, remoteMaterial);
  entity.setPosition(player.x, player.y, player.z);
  app.root.addChild(entity);
  return {
    entity,
    rig,
    snapshots: [{ receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw }],
    actionStartedAt: null,
    actionStep: player.attackStep,
    lastActionSequence: player.actionSequence,
    powerStartedAt: null,
    lastPowerSequence: player.powerSequence,
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
  const bodyMaterial = coloredMaterial(new pc.Color(0.22, 0.62, 0.24));
  const eyeMaterial = coloredMaterial(new pc.Color(0.03, 0.045, 0.035));
  const healthBackMaterial = coloredMaterial(new pc.Color(0.16, 0.025, 0.02));
  const healthMaterial = coloredMaterial(new pc.Color(0.35, 0.9, 0.28));
  const warningMaterial = new pc.StandardMaterial();
  warningMaterial.diffuse = new pc.Color(0.9, 0.16, 0.06);
  warningMaterial.emissive = new pc.Color(0.7, 0.08, 0.02);
  warningMaterial.opacity = 0.32;
  warningMaterial.blendType = pc.BLEND_NORMAL;
  warningMaterial.depthWrite = false;
  warningMaterial.update();
  addBox(bodyRoot, "crawler-body", bodyMaterial, [0.92, 0.58, 0.86], [0, 0.32, 0]);
  addBox(bodyRoot, "crawler-head", bodyMaterial, [0.68, 0.48, 0.62], [0, 0.76, 0.08]);
  addBox(bodyRoot, "crawler-eye-left", eyeMaterial, [0.1, 0.12, 0.06], [-0.17, 0.8, 0.39]);
  addBox(bodyRoot, "crawler-eye-right", eyeMaterial, [0.1, 0.12, 0.06], [0.17, 0.8, 0.39]);
  addBox(entity, "health-back", healthBackMaterial, [1.02, 0.1, 0.08], [0, 1.34, 0]);
  const healthFill = addBox(entity, "health-fill", healthMaterial, [0.96, 0.065, 0.09], [0, 1.34, 0.01]);
  const warning = new pc.Entity("lunge-warning");
  warning.addComponent("render", { type: "cylinder" });
  if (warning.render) warning.render.material = warningMaterial;
  warning.setLocalPosition(0, 0.035, 0);
  warning.setLocalScale(4.2, 0.025, 4.2);
  warning.enabled = false;
  entity.addChild(warning);
  entity.setPosition(mob.x, mob.y, mob.z);
  app.root.addChild(entity);
  return {
    entity,
    bodyRoot,
    bodyMaterial,
    warning,
    warningMaterial,
    healthFill,
    state: mob,
    lastHitSequence: mob.hitSequence,
    hitAt: 0,
    lastActionSequence: mob.actionSequence,
    actionAt: 0,
    lastStaggerSequence: mob.staggerSequence,
    staggerAt: 0,
  };
}

function updateMobVisual(mob: MobVisual): void {
  const healthFraction = Math.max(0, Math.min(1, mob.state.health / Math.max(1, mob.state.maxHealth)));
  mob.healthFill.setLocalScale(0.96 * healthFraction, 0.065, 0.09);
  mob.healthFill.setLocalPosition(-0.48 * (1 - healthFraction), 1.34, 0.01);
  if (mob.state.hitSequence > mob.lastHitSequence) {
    mob.lastHitSequence = mob.state.hitSequence;
    mob.hitAt = performance.now();
  }
  if (mob.state.actionSequence > mob.lastActionSequence) {
    mob.lastActionSequence = mob.state.actionSequence;
    mob.actionAt = performance.now();
  }
  if (mob.state.staggerSequence > mob.lastStaggerSequence) {
    mob.lastStaggerSequence = mob.state.staggerSequence;
    mob.staggerAt = performance.now();
  }
}

function bindMobs(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const mobs = callbacks(joinedRoom.state).mobs;
  mobs.onAdd((mob: NetworkMob, mobId: string) => {
    const visual = createMobVisual(mobId, mob);
    mobVisuals.set(mobId, visual);
    const mobCallbacks = callbacks(mob);
    for (const field of ["x", "y", "z", "health", "maxHealth", "alive", "hitSequence", "actionSequence", "combatState", "stateUntil", "targetId", "staggerSequence", "yaw"] as const) {
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
    if (isLocal) powerServerReady = typeof player.equippedPower === "string" && player.equippedPower.length > 0;
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
      remote.actionStartedAt = performance.now();
    }, true);
    playerCallbacks.listen("powerSequence", () => {
      if (isLocal) {
        if (player.powerSequence <= localLastPowerSequence) return;
        localLastPowerSequence = player.powerSequence;
        localPowerStartedAt ??= performance.now();
        return;
      }
      if (!remote || player.powerSequence <= remote.lastPowerSequence) return;
      remote.lastPowerSequence = player.powerSequence;
      remote.powerStartedAt = performance.now();
    }, true);
    playerCallbacks.listen("powerCooldownUntil", () => {
      if (isLocal) localPowerCooldownUntil = player.powerCooldownUntil;
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
}

canvas.addEventListener("pointermove", updatePointerPosition);

function updateTarget(): void {
  if (!camera.camera) return;
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const direction = end.clone().sub(start);
  const hit = voxelRaycast(start, direction, camera.camera.farClip, readVisibleWorldBlock);
  const player = localPlayer.getPosition();
  const inRange = Boolean(hit) && Math.hypot(hit!.x + 0.5 - player.x, hit!.y + 0.5 - player.y, hit!.z + 0.5 - player.z) <= 4.5;
  currentTarget = inRange ? hit : null;
  const combatMob = nearestLivingMob(player, 4.5);
  targetMarker.enabled = interactionMode === "build" && Boolean(currentTarget);
  if (currentTarget) targetMarker.setPosition(currentTarget.x + 0.5, currentTarget.y + 0.5, currentTarget.z + 0.5);

  const targetKey = currentTarget ? `${currentTarget.x},${currentTarget.y},${currentTarget.z}` : "none";
  const combatKey = combatMob ? `${combatMob.id}:${combatMob.visual.state.health}:${combatMob.visual.state.combatState}` : "none";
  const nextKey = `${interactionMode}:${targetKey}:${combatKey}`;
  if (nextKey === targetStateKey) return;
  targetStateKey = nextKey;
  if (interactionMode === "combat" && combatMob) {
    const intent = combatMob.visual.state.combatState === "windup"
      ? " · LUNGE INCOMING"
      : combatMob.visual.state.combatState === "stagger"
        ? " · STAGGERED"
        : "";
    targetLabel.textContent = `${combatMob.visual.state.name}: ${combatMob.visual.state.health}/${combatMob.visual.state.maxHealth} HP · ${combatMob.distance.toFixed(1)}m${intent}`;
  } else if (interactionMode === "combat") targetLabel.textContent = "Combat: approach the Moss Crawler and click to swing";
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
  if (localActionStartedAt !== null && now - localActionStartedAt < actionDuration(localActionStep)) {
    status.textContent = "Recovering from the previous swing...";
    return;
  }
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, 3.1);
  localActionFacingYaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : currentTarget
      ? movementYaw(currentTarget.x + 0.5 - player.x, currentTarget.z + 0.5 - player.z, localFacingYaw)
      : localFacingYaw;
  const comboStep = now <= localComboExpiresAt ? localComboStep % 3 + 1 : 1;
  const timing = COMBAT_ATTACKS[comboStep - 1]!;
  localActionStartedAt = now;
  localActionStep = comboStep;
  localComboStep = comboStep;
  localComboExpiresAt = now + timing.durationMs + COMBO_CHAIN_WINDOW_MS;
  attackSequence += 1;
  room.send("attack", { requestId: `attack-${attackSequence}`, yaw: localActionFacingYaw });
  logMovementEvent(`ACTION attack combo=${comboStep} impact=${timing.impactMs}ms yaw=${localActionFacingYaw.toFixed(1)}`);
  status.textContent = targetMob
    ? comboStep === 3
      ? `Heavy finisher aimed at ${targetMob.visual.state.name}...`
      : `Combo ${comboStep} aimed at ${targetMob.visual.state.name}...`
    : `Combo ${comboStep} swing · no target in reach.`;
}

function requestDodge(): void {
  if (!room || !worldReady) return;
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

function requestPower(): void {
  if (!room || !worldReady) return;
  if (!powerServerReady) {
    status.textContent = "Power server is updating · Seismic Cleave will unlock automatically.";
    showCombatFeedback("POWER SERVER UPDATING", "hurt");
    return;
  }
  const definition = POWER_DEFINITIONS.seismic_cleave;
  const remaining = localPowerCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${definition.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, definition.range + 1.2);
  const yaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : localFacingYaw;
  localFacingYaw = yaw;
  localPowerFacingYaw = yaw;
  localPowerStartedAt = performance.now();
  localPowerStepApplied = false;
  localPowerCooldownUntil = Date.now() + definition.cooldownMs;
  powerSequence += 1;
  startPowerTelegraph(room.sessionId, player.x, player.y, player.z, yaw, definition.windupMs);
  room.send("power", { requestId: `power-${powerSequence}`, powerId: definition.id, yaw });
  showCombatFeedback("SEISMIC CLEAVE", "dodge");
  logMovementEvent(`POWER ${definition.id} yaw=${yaw.toFixed(1)}`);
  status.textContent = `${definition.name} winding up · line impact in ${(definition.windupMs / 1000).toFixed(2)}s.`;
}

function requestPrimaryAction(): void {
  if (primaryActionForMode(interactionMode) === "mine") requestMine();
  else requestAttack();
}

function setInteractionMode(mode: InteractionMode): void {
  if (interactionMode === mode && targetStateKey.startsWith(`${mode}:`)) return;
  interactionMode = mode;
  for (const button of modeButtons) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  mineButton.textContent = mode === "build" ? "Mine" : "Attack";
  mineButton.dataset.mode = mode;
  combatReticle.hidden = mode !== "combat";
  targetStateKey = "";
  updateTarget();
  logMovementEvent(`MODE ${mode.toUpperCase()}`);
  status.textContent = mode === "build"
    ? "Build mode · clicks mine nearby targeted blocks."
    : "Combat mode · clicks perform a melee swing without changing blocks.";
}

for (const button of modeButtons) {
  button.addEventListener("click", () => setInteractionMode(button.dataset.mode as InteractionMode));
}

window.addEventListener("keydown", event => {
  if (event.repeat) return;
  if (event.code === "KeyQ") setInteractionMode(alternateInteractionMode(interactionMode));
  if (event.code === "KeyE") requestPrimaryAction();
  if (event.code === "KeyR") requestPower();
  if (event.code === "Space") {
    event.preventDefault();
    requestDodge();
  }
});
canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  updatePointerPosition(event);
  updateTarget();
  requestPrimaryAction();
});
mineButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestPrimaryAction();
});
dodgeButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestDodge();
});
powerButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestPower();
});
powerSlot.addEventListener("click", requestPower);

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
    if (worldReady) logMovementEvent(`HARD CORRECTION d=${distance.toFixed(3)} lag=${sequenceLag}`);
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
  const powerFacingActive = localPowerStartedAt !== null
    && performance.now() - localPowerStartedAt < SEISMIC_POWER_DURATION_MS
    && localPowerFacingYaw !== null;
  const actionFacingActive = localActionStartedAt !== null
    && performance.now() - localActionStartedAt < actionDuration(localActionStep)
    && localActionFacingYaw !== null;
  const desiredFacingYaw = powerFacingActive
    ? localPowerFacingYaw!
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
      x: smoothedMovement.x * 4.2 * frameTime,
      y: localVerticalVelocity * frameTime,
      z: smoothedMovement.z * 4.2 * frameTime,
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
  localPlayerVisual.setLocalPosition(0, localVisualVerticalOffset, 0);
  const animationNow = performance.now();
  const animationTime = animationNow / 1000;
  const localActionElapsed = localActionStartedAt === null ? null : animationNow - localActionStartedAt;
  const localPowerElapsed = localPowerStartedAt === null ? null : animationNow - localPowerStartedAt;
  if (localPowerElapsed !== null
    && localPowerElapsed >= POWER_DEFINITIONS.seismic_cleave.windupMs
    && !localPowerStepApplied
    && localPowerFacingYaw !== null) {
    const radians = localPowerFacingYaw * Math.PI / 180;
    const powerPosition = localPlayer.getPosition();
    const stepped = resolvePlayerMotion(
      powerPosition,
      {
        x: Math.sin(radians) * POWER_DEFINITIONS.seismic_cleave.forwardStep,
        y: 0,
        z: Math.cos(radians) * POWER_DEFINITIONS.seismic_cleave.forwardStep,
      },
      readCollisionWorldBlock,
    );
    localPlayer.setPosition(stepped.x, stepped.y, stepped.z);
    localPowerStepApplied = true;
  }
  if (animationNow >= localHitPauseUntil) {
    animateVoxelCharacter(localPlayerRig, Math.hypot(smoothedMovement.x, smoothedMovement.z) * 4.2, animationTime, frameTime, localVerticalVelocity, predicted.grounded || grounded, localActionElapsed, localActionStep, localPowerElapsed);
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
  }
  if (localPowerElapsed !== null && localPowerElapsed >= SEISMIC_POWER_DURATION_MS) {
    localPowerStartedAt = null;
    localPowerFacingYaw = null;
    localPowerStepApplied = false;
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
      animateVoxelCharacter(remote.rig, remoteSpeed, animationTime, frameTime, remoteVerticalVelocity, true, remoteActionElapsed, remote.actionStep, remotePowerElapsed);
      if (remoteActionElapsed !== null && remoteActionElapsed >= actionDuration(remote.actionStep)) remote.actionStartedAt = null;
      if (remotePowerElapsed !== null && remotePowerElapsed >= SEISMIC_POWER_DURATION_MS) remote.powerStartedAt = null;
    }
    trimRemoteSnapshots(remote.snapshots, renderAt);
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
    const attackStrength = attackElapsed >= 0 && attackElapsed < 460 ? Math.sin(attackElapsed / 460 * Math.PI) : 0;
    const staggerElapsed = animationNow - mob.staggerAt;
    const staggerStrength = staggerElapsed >= 0 && staggerElapsed < 900 ? 1 - staggerElapsed / 900 : 0;
    const windupStrength = mob.state.combatState === "windup" ? 0.55 + Math.sin(animationTime * 18) * 0.2 : 0;
    mob.warning.enabled = mob.state.combatState === "windup";
    if (mob.warning.enabled) {
      const warningPulse = 1 + Math.sin(animationTime * 18) * 0.045;
      mob.warning.setLocalScale(4.2 * warningPulse, 0.025, 4.2 * warningPulse);
      mob.warningMaterial.opacity = 0.25 + windupStrength * 0.22;
      mob.warningMaterial.update();
    }
    mob.bodyRoot.setLocalPosition(
      0,
      Math.sin(animationTime * 4.5) * 0.055 - hitStrength * 0.08,
      attackStrength * 0.24 - windupStrength * 0.16,
    );
    mob.bodyRoot.setLocalEulerAngles(0, 0, Math.sin(animationTime * 35) * staggerStrength * 12);
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
  for (let index = powerImpactVisuals.length - 1; index >= 0; index -= 1) {
    const impact = powerImpactVisuals[index]!;
    const elapsed = animationNow - impact.startedAt;
    if (elapsed >= 650) {
      impact.root.destroy();
      impact.fractureRoot.destroy();
      powerImpactVisuals.splice(index, 1);
      continue;
    }
    const strength = 1 - elapsed / 650;
    impact.root.setLocalScale(1 + (1 - strength) * 0.08, 0.65 + strength * 1.8, 1);
    impact.material.opacity = Math.max(0, strength * 0.82);
    impact.material.update();
  }
  const powerRemaining = Math.max(0, localPowerCooldownUntil - Date.now());
  const powerFraction = powerRemaining / POWER_DEFINITIONS.seismic_cleave.cooldownMs;
  powerCooldownFill.style.width = `${Math.max(0, Math.min(1, powerFraction)) * 100}%`;
  powerCooldownLabel.textContent = !powerServerReady
    ? "SERVER UPDATE"
    : powerRemaining > 0
      ? `${(powerRemaining / 1000).toFixed(1)}s`
      : "READY · R";
  powerSlot.classList.toggle("ready", powerServerReady && powerRemaining <= 0);
  powerButton.textContent = !powerServerReady ? "Wait" : powerRemaining > 0 ? `${Math.ceil(powerRemaining / 1000)}s` : "Power";
  cameraTarget.set(player.x, player.y + localVisualVerticalOffset, player.z);
  cameraFocus.copy(cameraTarget);
  const desiredCamera = new pc.Vec3(cameraFocus.x + CAMERA_OFFSET_X, cameraFocus.y + 18, cameraFocus.z + CAMERA_OFFSET_Z);
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
  const joinOptions = { name: "Explorer", ...(qaSpawn === "cave" ? { qaSpawn } : {}) };
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
  updatePlayerCount();
  status.textContent = "Connected. Loading the authoritative world...";
  room.onMessage("world:bootstrap", (payload: WorldBootstrap) => renderBootstrap(payload));
  room.onMessage("block:changed", applyBlockChange);
  room.onMessage("power:cast", (message: PowerCast) => {
    if (message.casterId !== room?.sessionId) {
      startPowerTelegraph(message.casterId, message.x, message.y, message.z, message.yaw, message.windupMs);
      const remote = remotePlayers.get(message.casterId);
      if (remote) remote.powerStartedAt = performance.now();
    }
    logMovementEvent(`POWER CAST ${message.casterId} ${message.powerId}`);
  });
  room.onMessage("power:resolved", (message: PowerResolved) => {
    createPowerImpact(message);
    const isLocal = message.casterId === room?.sessionId;
    if (isLocal) {
      localHitPauseUntil = performance.now() + (message.hitCount > 0 ? 85 : 40);
      showCombatFeedback(
        message.defeatedMobIds.length > 0
          ? "SEISMIC DEFEAT"
          : message.hitCount > 0
            ? `SEISMIC HIT ×${message.hitCount}`
            : "SEISMIC CLEAVE",
      );
      status.textContent = message.hitCount > 0
        ? `Seismic Cleave struck ${message.hitCount} target${message.hitCount === 1 ? "" : "s"} for ${message.damage} damage.`
        : `Seismic Cleave fractured ${message.fractures.length} terrain block${message.fractures.length === 1 ? "" : "s"}.`;
    }
    logMovementEvent(`POWER RESOLVE hits=${message.hitCount} fractures=${message.fractures.length}`);
  });
  room.onMessage("combat:hit", (message: CombatHit) => {
    const mob = mobVisuals.get(message.mobId);
    const name = mob?.state.name ?? "Mob";
    status.textContent = message.defeated
      ? `${name} defeated · respawning in 5 seconds.`
      : `${name} hit for ${message.damage} · ${message.health} HP remaining.`;
    logMovementEvent(`HIT ${message.mobId} hp=${message.health} defeated=${message.defeated}`);
    if (message.attackerId === room?.sessionId) {
      const comboStep = message.comboStep >= 1 && message.comboStep <= 3 ? message.comboStep : localActionStep || 1;
      localHitPauseUntil = performance.now() + (comboStep === 3 ? 75 : 48);
      showCombatFeedback(
        message.defeated
          ? "DEFEATED"
          : comboStep === 3
            ? `FINISHER  −${message.damage}`
            : `COMBO ${comboStep}  −${message.damage}`,
      );
    }
  });
  room.onMessage("combat:miss", (message: CombatMiss) => {
    if (message.attackerId !== room?.sessionId) return;
    showCombatFeedback("MISS", "hurt");
    status.textContent = `Combo ${message.comboStep} missed · recovery leaves you open.`;
    logMovementEvent(`MISS combo=${message.comboStep}`);
  });
  room.onMessage("combat:stagger", (message: CombatStagger) => {
    if (message.attackerId !== room?.sessionId) return;
    showCombatFeedback("STAGGER!", "dodge");
    status.textContent = `Perfect counter · enemy staggered for ${(message.durationMs / 1000).toFixed(1)}s.`;
    logMovementEvent(`STAGGER ${message.mobId} ${message.durationMs}ms`);
  });
  room.onMessage("combat:player-hit", (message: PlayerHit) => {
    if (message.playerId !== room?.sessionId) return;
    showCombatFeedback(message.defeated ? "DEFEATED · RESPAWNING" : `HURT  −${message.damage}`, "hurt");
    status.textContent = message.defeated
      ? "You were defeated and returned to the surface camp."
      : `The Moss Crawler hit you · ${message.health} HP remaining.`;
    logMovementEvent(`HURT hp=${message.health} defeated=${message.defeated}`);
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
    if (message.action === "power") {
      localPowerCooldownUntil = 0;
      localPowerStartedAt = null;
      localPowerFacingYaw = null;
      localPowerStepApplied = false;
      const localTelegraph = room ? powerTelegraphs.get(room.sessionId) : undefined;
      localTelegraph?.root.destroy();
      if (room) powerTelegraphs.delete(room.sessionId);
      showCombatFeedback(message.reason === "cooldown" ? "POWER RECHARGING" : "POWER BLOCKED", "hurt");
    }
    if (message.reason === "stale") {
      worldReady = false;
      room?.send("world:ready");
    }
  });
  room.onLeave(() => {
    worldReady = false;
    powerServerReady = false;
    room = null;
    status.textContent = "Disconnected from the world.";
    for (const remote of remotePlayers.values()) remote.entity.destroy();
    remotePlayers.clear();
    for (const mob of mobVisuals.values()) mob.entity.destroy();
    mobVisuals.clear();
    for (const telegraph of powerTelegraphs.values()) telegraph.root.destroy();
    powerTelegraphs.clear();
    for (const impact of powerImpactVisuals) {
      impact.root.destroy();
      impact.fractureRoot.destroy();
    }
    powerImpactVisuals.length = 0;
    updatePlayerCount();
  });
  room.send("world:ready");
}

connect().catch(error => {
  status.textContent = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
});
