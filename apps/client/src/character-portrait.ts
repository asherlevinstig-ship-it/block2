import * as pc from "playcanvas";
import type { ArmourId, MainHandId } from "@blockcraft/protocol";

type Point = { x: number; y: number; depth: number };
type Face = { corners: Point[]; depth: number; fill: string };
type SelectGear = (hand: MainHandId, armour: ArmourId) => () => void;

const CORNERS = [
  [-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5],
  [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5],
] as const;
const SIDES = [
  { indices: [0, 3, 2, 1], light: .56 }, // back
  { indices: [4, 5, 6, 7], light: 1.0 }, // front
  { indices: [0, 4, 7, 3], light: .75 }, // left
  { indices: [1, 2, 6, 5], light: .84 }, // right
  { indices: [3, 7, 6, 2], light: 1.14 }, // top
  { indices: [0, 1, 5, 4], light: .46 }, // bottom
] as const;

function litColor(color: pc.Color, light: number): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value * light * 255))).toString(16).padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function visibleWithin(node: pc.Entity, root: pc.Entity): boolean {
  for (let current: pc.GraphNode | null = node; current; current = current.parent) {
    if (!current.enabled) return false;
    if (current === root) return true;
  }
  return false;
}

/** Draws the real voxel rig's visible box transforms without a second WebGL scene or GPU readback. */
export function createCharacterPortrait(canvas: HTMLCanvasElement, root: pc.Entity, selectGear: SelectGear) {
  const context = canvas.getContext("2d", { alpha: false });
  let yaw = -30;
  let lastKey = "";
  let hand: MainHandId | undefined;
  let armour: ArmourId | undefined;
  let look = "";
  let pointerX: number | null = null;
  let framePending = false;
  let destroyed = false;

  const draw = () => {
    if (!context || destroyed || !hand || !armour) return;
    const key = `${hand}:${armour}:${look}:${yaw.toFixed(1)}`;
    if (key === lastKey) return;
    lastKey = key;
    const restoreGear = selectGear(hand, armour);
    const faces: Face[] = [];
    try {
      const inverseRoot = root.getWorldTransform().clone().invert();
      const radians = yaw * Math.PI / 180;
      const cosine = Math.cos(radians), sine = Math.sin(radians);
      const tilt = 14 * Math.PI / 180;
      const tiltCos = Math.cos(tilt), tiltSin = Math.sin(tilt);
      const project = (point: pc.Vec3): Point => {
        const turnedX = point.x * cosine + point.z * sine;
        const turnedZ = -point.x * sine + point.z * cosine;
        return {
          x: canvas.width * .5 + turnedX * canvas.width * .53,
          y: canvas.height * .52 - ((point.y - .8) * tiltCos - turnedZ * tiltSin) * canvas.height * .43,
          depth: turnedZ * tiltCos + (point.y - .8) * tiltSin,
        };
      };
      for (const component of root.findComponents("render") as pc.RenderComponent[]) {
        const node = component.entity;
        if (!node || component.type !== "box" || !visibleWithin(node, root)) continue;
        const transform = new pc.Mat4().mul2(inverseRoot, node.getWorldTransform());
        const corners = CORNERS.map(([x, y, z]) => project(transform.transformPoint(new pc.Vec3(x, y, z))));
        const color = component.material instanceof pc.StandardMaterial ? component.material.diffuse : pc.Color.WHITE;
        for (const side of SIDES) {
          const points = side.indices.map(index => corners[index]!);
          const cross = (points[1]!.x - points[0]!.x) * (points[2]!.y - points[0]!.y)
            - (points[1]!.y - points[0]!.y) * (points[2]!.x - points[0]!.x);
          if (cross >= 0) continue;
          faces.push({ corners: points, depth: points.reduce((sum, point) => sum + point.depth, 0) / 4,
            fill: litColor(color, side.light) });
        }
      }
    } finally {
      restoreGear();
    }

    context.fillStyle = "#101d19";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#20362e";
    context.beginPath();
    context.ellipse(canvas.width * .5, canvas.height * .91, canvas.width * .22, canvas.height * .035, 0, 0, Math.PI * 2);
    context.fill();
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      context.fillStyle = face.fill;
      context.beginPath();
      context.moveTo(face.corners[0]!.x, face.corners[0]!.y);
      for (let index = 1; index < 4; index++) context.lineTo(face.corners[index]!.x, face.corners[index]!.y);
      context.closePath();
      context.fill();
    }
  };
  const schedule = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { framePending = false; draw(); });
  };
  const pointerDown = (event: PointerEvent) => {
    pointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    if (pointerX === null) return;
    yaw += (event.clientX - pointerX) * .8;
    pointerX = event.clientX;
    schedule();
  };
  const pointerUp = () => { pointerX = null; };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  return {
    refresh(nextHand: MainHandId, nextArmour: ArmourId, appearanceKey: string) {
      hand = nextHand; armour = nextArmour; look = appearanceKey;
      draw();
    },
    turn(degrees: number) { yaw += degrees; draw(); },
    hide() { pointerX = null; },
    destroy() {
      destroyed = true;
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    },
  };
}
