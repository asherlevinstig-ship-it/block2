import * as pc from "playcanvas";
import { Client, type Room } from "@colyseus/sdk";
import { WORLD_ROOM, type ActionRejected, type BlockChanged, type WorldBootstrap } from "@blockcraft/protocol";
import { Block, CHUNK_HEIGHT, CHUNK_SIZE, chunkIndex } from "@blockcraft/voxel-world";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
if (!canvas || !status) throw new Error("Game shell is missing required elements");

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
camera.setPosition(22, 25, 24);
camera.lookAt(8, 4, 8);
app.root.addChild(camera);

const light = new pc.Entity("sun");
light.addComponent("light", { type: "directional", intensity: 1.35, castShadows: true, shadowResolution: 1024 });
light.setEulerAngles(48, 32, 0);
app.root.addChild(light);

const worldRoot = new pc.Entity("voxel-world");
app.root.addChild(worldRoot);
const blockEntities = new Map<string, pc.Entity>();

const palette: Record<number, pc.Color> = {
  [Block.Bedrock]: new pc.Color(0.14, 0.16, 0.18),
  [Block.Stone]: new pc.Color(0.38, 0.42, 0.44),
  [Block.Dirt]: new pc.Color(0.42, 0.28, 0.16),
  [Block.Grass]: new pc.Color(0.28, 0.58, 0.25),
  [Block.IronOre]: new pc.Color(0.7, 0.48, 0.29),
};

function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function addBlock(x: number, y: number, z: number, block: number): void {
  if (block === Block.Air) return;
  const entity = new pc.Entity(blockKey(x, y, z));
  entity.addComponent("render", { type: "box", castShadows: true, receiveShadows: true });
  const material = new pc.StandardMaterial();
  material.diffuse = palette[block] ?? new pc.Color(1, 0, 1);
  material.update();
  if (entity.render) entity.render.material = material;
  entity.setPosition(x + 0.5, y + 0.5, z + 0.5);
  worldRoot.addChild(entity);
  blockEntities.set(blockKey(x, y, z), entity);
}

function renderBootstrap(payload: WorldBootstrap): void {
  for (const child of [...worldRoot.children]) child.destroy();
  blockEntities.clear();
  for (const chunk of payload.chunks) {
    for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
      for (let z = 0; z < CHUNK_SIZE; z += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const block = chunk.blocks[chunkIndex(x, y, z)] ?? Block.Air;
          if (block !== Block.Air) addBlock(chunk.chunkX * CHUNK_SIZE + x, y, chunk.chunkZ * CHUNK_SIZE + z, block);
        }
      }
    }
  }
  localPlayer.setPosition(payload.spawn.x, payload.spawn.y, payload.spawn.z);
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

const keys = new Set<string>();
window.addEventListener("keydown", event => keys.add(event.code));
window.addEventListener("keyup", event => keys.delete(event.code));

let room: Room | null = null;
let lastMoveSentAt = 0;
let mineSequence = 0;

window.addEventListener("keydown", event => {
  if (event.code !== "KeyE" || !room) return;
  const position = localPlayer.getPosition();
  mineSequence += 1;
  room.send("mine", {
    requestId: `mine-${mineSequence}`,
    x: Math.floor(position.x),
    y: Math.max(1, Math.floor(position.y - 1)),
    z: Math.floor(position.z - 2),
  });
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
  const now = performance.now();
  if (room && now - lastMoveSentAt >= 100) {
    lastMoveSentAt = now;
    const position = localPlayer.getPosition();
    room.send("move", { x: position.x, y: position.y, z: position.z, yaw: 0 });
  }
});

async function connect(): Promise<void> {
  const endpoint = import.meta.env.VITE_GAME_SERVER_URL || "ws://localhost:2567";
  const client = new Client(endpoint);
  room = await client.joinOrCreate(WORLD_ROOM, { name: "Explorer" });
  status.textContent = "Connected. The protected center is green; walk outward before mining.";
  room.onMessage("world:bootstrap", (payload: WorldBootstrap) => renderBootstrap(payload));
  room.onMessage("block:changed", (message: BlockChanged) => {
    const entity = blockEntities.get(blockKey(message.x, message.y, message.z));
    entity?.destroy();
    blockEntities.delete(blockKey(message.x, message.y, message.z));
  });
  room.onMessage("action:rejected", (message: ActionRejected) => {
    status.textContent = `Server rejected ${message.action}: ${message.reason}`;
  });
  room.send("world:ready");
}

connect().catch(error => {
  status.textContent = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
});
