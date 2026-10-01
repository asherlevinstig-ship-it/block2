import * as pc from "playcanvas";
import { Client, getStateCallbacks, type Room } from "@colyseus/sdk";
import {
  WORLD_ROOM,
  type ActionRejected,
  type BlockChanged,
  type ChunkSnapshot,
  type WorldBootstrap,
} from "@blockcraft/protocol";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
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
  cameraRelativeMovement,
  movementYaw,
  quantizeMovementToEightDirections,
  sampleRemotePose,
  trimRemoteSnapshots,
  type RemoteSnapshot,
} from "./movement-network.js";
import {
  isBelowSurroundingSurface,
  isVoxelHiddenForPlayer,
  loweredSliceHeight,
  shouldReleaseDepthSlice,
  shouldUseDepthSlice,
  type PlayerCutaway,
} from "./player-visibility.js";
import { MILESTONE_EXIT_STEPS } from "./exit-guidance.js";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const targetLabel = document.querySelector<HTMLElement>("#target")!;
const playerCount = document.querySelector<HTMLElement>("#players")!;
const exitGuide = document.querySelector<HTMLElement>("#exit-guide")!;
const performanceToggle = document.querySelector<HTMLButtonElement>("#performance-toggle")!;
const performancePanel = document.querySelector<HTMLElement>("#performance-panel")!;
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
if (!canvas || !status || !targetLabel || !playerCount || !exitGuide || !performanceToggle || !performancePanel || !joystickZone || !joystickKnob || !mineButton) {
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

const palette: Record<number, pc.Color> = {
  [Block.Bedrock]: new pc.Color(0.14, 0.16, 0.18),
  [Block.Stone]: new pc.Color(0.38, 0.42, 0.44),
  [Block.Dirt]: new pc.Color(0.42, 0.28, 0.16),
  [Block.Grass]: new pc.Color(0.28, 0.58, 0.25),
  [Block.IronOre]: new pc.Color(0.7, 0.48, 0.29),
};

const materials = new Map<number, pc.StandardMaterial>();

function materialFor(block: number): pc.StandardMaterial {
  let material = materials.get(block);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = palette[block] ?? new pc.Color(1, 0, 1);
    material.update();
    materials.set(block, material);
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
  const buffers = new Map<number, { positions: number[]; normals: number[]; indices: number[] }>();
  for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const block = chunk.blocks[chunkIndex(localX, y, localZ)] ?? Block.Air;
        if (block === Block.Air) continue;
        const x = chunk.chunkX * CHUNK_SIZE + localX;
        const z = chunk.chunkZ * CHUNK_SIZE + localZ;
        if (isCutawayHidden(x, y, z)) continue;
        chunk.visibleBlocks += 1;
        let buffer = buffers.get(block);
        if (!buffer) {
          buffer = { positions: [], normals: [], indices: [] };
          buffers.set(block, buffer);
        }
        for (const face of faces) {
          const neighbor = readVisibleWorldBlock(x + face.normal[0], y + face.normal[1], z + face.normal[2]);
          if (neighbor !== Block.Air) continue;
          chunk.visibleFaces += 1;
          const base = buffer.positions.length / 3;
          for (const corner of face.corners) {
            buffer.positions.push(x + corner[0], y + corner[1], z + corner[2]);
            buffer.normals.push(...face.normal);
          }
          buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  const meshInstances: pc.MeshInstance[] = [];
  for (const [block, buffer] of buffers) {
    if (buffer.indices.length === 0) continue;
    const geometry = new pc.Geometry();
    geometry.positions = buffer.positions;
    geometry.normals = buffer.normals;
    geometry.indices = buffer.indices;
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry);
    chunk.meshes.push(mesh);
    meshInstances.push(new pc.MeshInstance(mesh, materialFor(block)));
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

const facingMaterial = new pc.StandardMaterial();
facingMaterial.diffuse = new pc.Color(0.12, 0.09, 0.05);
facingMaterial.emissive = new pc.Color(0.08, 0.05, 0.02);
facingMaterial.update();

function addFacingMarker(player: pc.Entity): void {
  const marker = new pc.Entity("facing-marker");
  marker.addComponent("render", { type: "box", castShadows: true });
  if (marker.render) marker.render.material = facingMaterial;
  marker.setLocalScale(0.2, 0.16, 0.38);
  marker.setLocalPosition(0, PLAYER_HEIGHT * 0.58, PLAYER_RADIUS + 0.08);
  player.addChild(marker);
}

const localPlayer = new pc.Entity("local-player");
const playerMaterial = new pc.StandardMaterial();
playerMaterial.diffuse = new pc.Color(0.95, 0.73, 0.28);
playerMaterial.update();
const silhouetteMaterial = new pc.StandardMaterial();
silhouetteMaterial.diffuse = new pc.Color(1, 0.72, 0.18);
silhouetteMaterial.emissive = new pc.Color(1, 0.42, 0.04);
silhouetteMaterial.opacity = 0.22;
silhouetteMaterial.blendType = pc.BLEND_NORMAL;
silhouetteMaterial.depthTest = false;
silhouetteMaterial.depthWrite = false;
silhouetteMaterial.update();

function addPlayerBody(player: pc.Entity, material: pc.StandardMaterial, withSilhouette = false): pc.Entity | null {
  const body = new pc.Entity("player-body");
  body.addComponent("render", { type: "capsule", castShadows: true });
  if (body.render) body.render.material = material;
  body.setLocalScale(PLAYER_RADIUS * 2, PLAYER_HEIGHT / 2, PLAYER_RADIUS * 2);
  body.setLocalPosition(0, PLAYER_HEIGHT / 2, 0);
  player.addChild(body);
  let silhouette: pc.Entity | null = null;
  if (withSilhouette) {
    silhouette = new pc.Entity("player-silhouette");
    silhouette.addComponent("render", { type: "capsule", castShadows: false });
    if (silhouette.render) silhouette.render.material = silhouetteMaterial;
    silhouette.setLocalScale(PLAYER_RADIUS * 2.3, PLAYER_HEIGHT * 0.56, PLAYER_RADIUS * 2.3);
    silhouette.setLocalPosition(0, PLAYER_HEIGHT / 2, 0);
    silhouette.enabled = false;
    player.addChild(silhouette);
  }
  addFacingMarker(player);
  return silhouette;
}

const localPlayerSilhouette = addPlayerBody(localPlayer, playerMaterial, true);
localPlayer.setPosition(8.5, 11, 8.5);
app.root.addChild(localPlayer);

interface NetworkPlayer {
  x: number;
  y: number;
  z: number;
  yaw: number;
  lastProcessedInput: number;
  name: string;
}

interface RemotePlayerVisual {
  entity: pc.Entity;
  snapshots: RemoteSnapshot[];
}

const remoteMaterial = new pc.StandardMaterial();
remoteMaterial.diffuse = new pc.Color(0.24, 0.66, 0.95);
remoteMaterial.update();
const remotePlayers = new Map<string, RemotePlayerVisual>();
const authoritativeLocalPosition = new pc.Vec3(8.5, 11, 8.5);
let localFacingYaw = 0;
const cameraFocus = new pc.Vec3(8.5, 11, 8.5);

function updatePlayerCount(): void {
  const count = room ? remotePlayers.size + 1 : 0;
  playerCount.textContent = `${count} player${count === 1 ? "" : "s"} online`;
}

function createRemotePlayer(sessionId: string, player: NetworkPlayer): RemotePlayerVisual {
  const entity = new pc.Entity(`remote-player:${sessionId}`);
  addPlayerBody(entity, remoteMaterial);
  entity.setPosition(player.x, player.y, player.z);
  app.root.addChild(entity);
  return {
    entity,
    snapshots: [{ receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw }],
  };
}

function recordRemoteSnapshot(remote: RemotePlayerVisual, player: NetworkPlayer): void {
  const snapshot = { receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw };
  const latest = remote.snapshots[remote.snapshots.length - 1];
  if (latest && snapshot.receivedAt - latest.receivedAt < 1) remote.snapshots[remote.snapshots.length - 1] = snapshot;
  else remote.snapshots.push(snapshot);
}

function bindPlayers(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const players = callbacks(joinedRoom.state).players;
  players.onAdd((player: NetworkPlayer, sessionId: string) => {
    const isLocal = sessionId === joinedRoom.sessionId;
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

canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  pointer.y = (event.clientY - rect.top) * (canvas.height / rect.height);
});

function updateTarget(): void {
  if (!camera.camera) return;
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const direction = end.clone().sub(start);
  const hit = voxelRaycast(start, direction, camera.camera.farClip, readVisibleWorldBlock);
  const player = localPlayer.getPosition();
  const inRange = Boolean(hit) && Math.hypot(hit!.x + 0.5 - player.x, hit!.y + 0.5 - player.y, hit!.z + 0.5 - player.z) <= 4.5;
  currentTarget = inRange ? hit : null;
  targetMarker.enabled = Boolean(currentTarget);
  if (currentTarget) targetMarker.setPosition(currentTarget.x + 0.5, currentTarget.y + 0.5, currentTarget.z + 0.5);

  const nextKey = currentTarget ? `${currentTarget.x},${currentTarget.y},${currentTarget.z}` : "none";
  if (nextKey === targetStateKey) return;
  targetStateKey = nextKey;
  if (!currentTarget) targetLabel.textContent = "Target: move near a block and point at it";
  else if (isProtectedVoxel(currentTarget.x, currentTarget.z)) targetLabel.textContent = `Target: ${nextKey} · protected`;
  else targetLabel.textContent = `Target: ${nextKey} · mineable`;
}

let lastChunkBuildMs = 0;
let worldPayloadBytes = 0;
let networkRttMs: number | null = null;

function renderBootstrap(payload: WorldBootstrap): void {
  const buildStartedAt = performance.now();
  worldPayloadBytes = new Blob([JSON.stringify(payload)]).size;
  for (const chunk of chunks.values()) for (const mesh of chunk.meshes) mesh.destroy();
  for (const child of [...worldRoot.children]) child.destroy();
  chunks.clear();
  const installed = payload.chunks.map(installChunk);
  for (const chunk of installed) rebuildChunk(chunk);
  lastChunkBuildMs = performance.now() - buildStartedAt;
  const ownPlayer = room ? (room.state as { players?: { get(id: string): NetworkPlayer | undefined } }).players?.get(room.sessionId) : undefined;
  const initialPosition = ownPlayer ?? payload.spawn;
  localPlayer.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
  authoritativeLocalPosition.set(initialPosition.x, initialPosition.y, initialPosition.z);
  cameraFocus.set(initialPosition.x, initialPosition.y, initialPosition.z);
  localVerticalVelocity = 0;
  playerCutaway.active = false;
  playerCutaway.sliceY = CHUNK_HEIGHT;
  cutawayStateKey = "surface";
  cutawaySliceY = null;
  surfaceReferenceY = initialPosition.y;
  surfaceReturnStartedAt = null;
  exitTrail.enabled = false;
  exitGuide.hidden = true;
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
let localVerticalVelocity = 0;
let cutawayStateKey = "surface";
let cutawaySliceY: number | null = null;
let surfaceReferenceY: number | null = null;
let surfaceReturnStartedAt: number | null = null;
let smoothedMovement = { x: 0, z: 0 };

function resetMovementControls(): void {
  keys.clear();
  if (joystickPointerId !== null) releaseJoystick(joystickPointerId);
  touchStrafe = 0;
  touchForward = 0;
  smoothedMovement = { x: 0, z: 0 };
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

function estimatedSurfaceY(position: pc.Vec3): number {
  const centerX = Math.floor(position.x);
  const centerZ = Math.floor(position.z);
  const surfaceLevels: number[] = [];
  for (const offsetX of [-3, 0, 3]) {
    for (const offsetZ of [-3, 0, 3]) {
      if (offsetX === 0 && offsetZ === 0) continue;
      const solidY = highestLoadedSolidY(centerX + offsetX, centerZ + offsetZ);
      if (solidY >= 0) surfaceLevels.push(solidY + 1);
    }
  }
  surfaceLevels.sort((a, b) => a - b);
  return Math.max(position.y, surfaceLevels[Math.floor(surfaceLevels.length / 2)] ?? position.y);
}

function updateUndergroundPresentation(position: pc.Vec3): void {
  const underground = hasCeilingAbove(position);
  const excavating = !underground && isInOpenExcavation(position);
  if (surfaceReferenceY === null) surfaceReferenceY = position.y;
  if (cutawaySliceY === null && underground && position.y >= surfaceReferenceY - 0.65) {
    surfaceReferenceY = estimatedSurfaceY(position);
  }
  let visibilityCutaway = shouldUseDepthSlice(
    cutawaySliceY,
    position.y,
    surfaceReferenceY,
    underground,
    excavating,
  );
  if (cutawaySliceY !== null) {
    const supported = isPlayerSupported(readCollisionWorldBlock, position.x, position.y, position.z);
    const atSurface = !underground && supported && position.y >= surfaceReferenceY - 0.1;
    if (atSurface) surfaceReturnStartedAt ??= performance.now();
    else surfaceReturnStartedAt = null;
    const surfaceDurationMs = surfaceReturnStartedAt === null ? 0 : performance.now() - surfaceReturnStartedAt;
    if (shouldReleaseDepthSlice(position.y, surfaceReferenceY, underground, supported, surfaceDurationMs)) {
      visibilityCutaway = false;
      surfaceReturnStartedAt = null;
    }
  } else {
    surfaceReturnStartedAt = null;
  }
  const nextSliceY = visibilityCutaway ? loweredSliceHeight(cutawaySliceY, position.y) : null;
  const nextKey = nextSliceY === null ? "surface" : `slice:${nextSliceY}`;
  caveLight.enabled = underground;
  if (localPlayerSilhouette) localPlayerSilhouette.enabled = visibilityCutaway;
  exitTrail.enabled = visibilityCutaway;
  exitGuide.hidden = !visibilityCutaway;
  caveLight.setPosition(position.x, position.y + 1.2, position.z);
  if (light.light) light.light.intensity = underground ? 0.5 : 1.35;
  app.scene.ambientLight = underground ? new pc.Color(0.16, 0.18, 0.2) : new pc.Color(0.36, 0.42, 0.38);
  if (nextKey === cutawayStateKey) return;
  cutawayStateKey = nextKey;
  cutawaySliceY = nextSliceY;
  if (!visibilityCutaway) surfaceReferenceY = position.y;
  playerCutaway.active = visibilityCutaway;
  playerCutaway.sliceY = nextSliceY ?? CHUNK_HEIGHT;
  for (const chunk of chunks.values()) rebuildChunk(chunk);
  status.textContent = underground
    ? `Underground · slice ${nextSliceY ?? "off"} · lowers only when descending`
    : excavating
      ? `Excavation · slice ${nextSliceY ?? "off"} · lowers only when descending`
      : "Surface · cross the flat ground to the descending mine entrance east of spawn.";
}

function requestMine(): void {
  if (!room || !worldReady || !currentTarget) return;
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

window.addEventListener("keydown", event => {
  if (event.code === "KeyE" && !event.repeat) requestMine();
});
canvas.addEventListener("pointerdown", event => {
  if (event.button === 0) requestMine();
});
mineButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestMine();
});

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

function reconcileLocalPlayer(dt: number): void {
  const position = localPlayer.getPosition();
  const distance = position.distance(authoritativeLocalPosition);
  if (distance > 1.5) {
    localPlayer.setPosition(authoritativeLocalPosition);
    localVerticalVelocity = 0;
  } else if (distance > 0.12) {
    position.lerp(position, authoritativeLocalPosition, Math.min(1, dt * 4));
    localPlayer.setPosition(position);
  }
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
  localFacingYaw = movementYaw(smoothedMovement.x, smoothedMovement.z, localFacingYaw);
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
  localPlayer.setPosition(predicted.x, predicted.y, predicted.z);
  localPlayer.setEulerAngles(0, localFacingYaw, 0);
  reconcileLocalPlayer(dt);

  const player = localPlayer.getPosition();
  const renderAt = performance.now() - REMOTE_INTERPOLATION_DELAY_MS;
  for (const remote of remotePlayers.values()) {
    const pose = sampleRemotePose(remote.snapshots, renderAt);
    if (pose) {
      remote.entity.setPosition(pose.x, pose.y, pose.z);
      remote.entity.setEulerAngles(0, pose.yaw, 0);
    }
    trimRemoteSnapshots(remote.snapshots, renderAt);
  }
  cameraFocus.lerp(cameraFocus, player, Math.min(1, dt * 6));
  const desiredCamera = new pc.Vec3(cameraFocus.x + CAMERA_OFFSET_X, cameraFocus.y + 18, cameraFocus.z + CAMERA_OFFSET_Z);
  const cameraPosition = camera.getPosition();
  camera.setPosition(cameraPosition.lerp(cameraPosition, desiredCamera, Math.min(1, dt * 7)));
  camera.lookAt(cameraFocus.x, cameraFocus.y - 2, cameraFocus.z);
  updateUndergroundPresentation(player);
  updateTarget();

  const now = performance.now();
  updatePerformanceMetrics(now);
  if (room && worldReady && now - lastPingSentAt >= 2000) {
    lastPingSentAt = now;
    pingSequence += 1;
    const id = `ping-${pingSequence}`;
    pendingPings.set(id, now);
    room.send("ping", { id });
  }
  if (room && worldReady && now - lastMoveSentAt >= 50) {
    lastMoveSentAt = now;
    moveSequence += 1;
    room.send("move", {
      sequence: moveSequence,
      strafe: smoothedMovement.x,
      forward: smoothedMovement.z,
      yaw: localFacingYaw,
    });
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
    || (localHost ? "ws://localhost:2567" : "wss://us-mia-ea26ba04.colyseus.cloud");
  const client = new Client(endpoint);
  const qaSpawn = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("qa") : null;
  room = await client.joinOrCreate(WORLD_ROOM, { name: "Explorer", ...(qaSpawn === "cave" ? { qaSpawn } : {}) });
  bindPlayers(room);
  updatePlayerCount();
  status.textContent = "Connected. Loading the authoritative world...";
  room.onMessage("world:bootstrap", (payload: WorldBootstrap) => renderBootstrap(payload));
  room.onMessage("block:changed", applyBlockChange);
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
    if (message.reason === "stale") {
      worldReady = false;
      room?.send("world:ready");
    }
  });
  room.onLeave(() => {
    worldReady = false;
    room = null;
    status.textContent = "Disconnected from the world.";
    for (const remote of remotePlayers.values()) remote.entity.destroy();
    remotePlayers.clear();
    updatePlayerCount();
  });
  room.send("world:ready");
}

connect().catch(error => {
  status.textContent = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
});
