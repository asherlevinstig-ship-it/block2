import * as pc from "playcanvas";
import { Client, type Room } from "@colyseus/sdk";
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
  chunkIndex,
  isProtectedVoxel,
  voxelRaycast,
  worldToChunk,
  type BlockId,
  type VoxelRaycastHit,
} from "@blockcraft/voxel-world";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const targetLabel = document.querySelector<HTMLElement>("#target")!;
if (!canvas || !status || !targetLabel) throw new Error("Game shell is missing required elements");

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

const light = new pc.Entity("sun");
light.addComponent("light", { type: "directional", intensity: 1.35, castShadows: true, shadowResolution: 1024 });
light.setEulerAngles(48, 32, 0);
app.root.addChild(light);

const worldRoot = new pc.Entity("voxel-world");
app.root.addChild(worldRoot);

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
}

const chunks = new Map<string, ClientChunk>();

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

function rebuildChunk(chunk: ClientChunk): void {
  for (const mesh of chunk.meshes) mesh.destroy();
  chunk.meshes = [];
  for (const child of [...chunk.root.children]) child.destroy();
  const buffers = new Map<number, { positions: number[]; normals: number[]; indices: number[] }>();
  for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const block = chunk.blocks[chunkIndex(localX, y, localZ)] ?? Block.Air;
        if (block === Block.Air) continue;
        const x = chunk.chunkX * CHUNK_SIZE + localX;
        const z = chunk.chunkZ * CHUNK_SIZE + localZ;
        let buffer = buffers.get(block);
        if (!buffer) {
          buffer = { positions: [], normals: [], indices: [] };
          buffers.set(block, buffer);
        }
        for (const face of faces) {
          const neighbor = readWorldBlock(x + face.normal[0], y + face.normal[1], z + face.normal[2]);
          if (neighbor !== Block.Air) continue;
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
    const mesh = pc.createMesh(app.graphicsDevice, buffer.positions, { normals: buffer.normals, indices: buffer.indices });
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
localPlayer.addComponent("render", { type: "capsule", castShadows: true });
const playerMaterial = new pc.StandardMaterial();
playerMaterial.diffuse = new pc.Color(0.95, 0.73, 0.28);
playerMaterial.update();
if (localPlayer.render) localPlayer.render.material = playerMaterial;
localPlayer.setLocalScale(0.72, 1.45, 0.72);
localPlayer.setPosition(8.5, 11, 8.5);
app.root.addChild(localPlayer);

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
  const hit = voxelRaycast(start, direction, camera.camera.farClip, readWorldBlock);
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

function renderBootstrap(payload: WorldBootstrap): void {
  for (const chunk of chunks.values()) for (const mesh of chunk.meshes) mesh.destroy();
  for (const child of [...worldRoot.children]) child.destroy();
  chunks.clear();
  const installed = payload.chunks.map(installChunk);
  for (const chunk of installed) rebuildChunk(chunk);
  localPlayer.setPosition(payload.spawn.x, payload.spawn.y, payload.spawn.z);
  worldReady = true;
  status.textContent = "Connected. Walk to a corner of the hill, point at a nearby block, then mine.";
}

const keys = new Set<string>();
window.addEventListener("keydown", event => keys.add(event.code));
window.addEventListener("keyup", event => keys.delete(event.code));

let room: Room | null = null;
let worldReady = false;
let lastMoveSentAt = 0;
let mineSequence = 0;

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

app.on("update", (dt: number) => {
  const direction = new pc.Vec3(
    Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    0,
    Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
  );
  if (direction.lengthSq() > 0) {
    direction.normalize().mulScalar(Math.min(dt, 0.05) * 4.2);
    localPlayer.translate(direction);
  }

  const player = localPlayer.getPosition();
  const desiredCamera = new pc.Vec3(player.x + 14, player.y + 18, player.z + 16);
  const cameraPosition = camera.getPosition();
  camera.setPosition(cameraPosition.lerp(cameraPosition, desiredCamera, Math.min(1, dt * 7)));
  camera.lookAt(player.x, player.y - 2, player.z);
  updateTarget();

  const now = performance.now();
  if (room && worldReady && now - lastMoveSentAt >= 100) {
    lastMoveSentAt = now;
    room.send("move", { x: player.x, y: player.y, z: player.z, yaw: 0 });
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
  rebuildChunkAndNeighbors(chunk, message.x, message.z);
  status.textContent = `Block removed · chunk revision ${chunk.revision}`;
}

async function connect(): Promise<void> {
  const endpoint = import.meta.env.VITE_GAME_SERVER_URL || "ws://localhost:2567";
  const client = new Client(endpoint);
  room = await client.joinOrCreate(WORLD_ROOM, { name: "Explorer" });
  status.textContent = "Connected. Loading the authoritative world...";
  room.onMessage("world:bootstrap", (payload: WorldBootstrap) => renderBootstrap(payload));
  room.onMessage("block:changed", applyBlockChange);
  room.onMessage("action:rejected", (message: ActionRejected) => {
    status.textContent = `Server rejected ${message.action}: ${message.reason}`;
    if (message.reason === "stale") {
      worldReady = false;
      room?.send("world:ready");
    }
  });
  room.send("world:ready");
}

connect().catch(error => {
  status.textContent = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
});
