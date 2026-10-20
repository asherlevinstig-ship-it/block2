import type * as pc from "playcanvas";
import type { ArmourId, MainHandId } from "@blockcraft/protocol";

type PortraitApi = ReturnType<typeof import("./character-portrait.js").createCharacterPortrait>;
type SelectGear = (hand: MainHandId, armour: ArmourId) => () => void;

export function createLazyCharacterPortrait(canvas: HTMLCanvasElement, root: pc.Entity, selectGear: SelectGear): PortraitApi {
  let actual: PortraitApi | null = null;
  let latestRefresh: [MainHandId, ArmourId, string] | null = null;
  let pendingTurn = 0;
  let destroyed = false;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = "#101d19"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#b8cfc1"; context.font = "bold 15px system-ui"; context.textAlign = "center";
    context.fillText("Loading character…", canvas.width / 2, canvas.height / 2);
  }
  void import("./character-portrait.js").then(({ createCharacterPortrait }) => {
    if (destroyed) return;
    actual = createCharacterPortrait(canvas, root, selectGear);
    if (latestRefresh) actual.refresh(...latestRefresh);
    if (pendingTurn) actual.turn(pendingTurn);
  });
  return {
    refresh(hand, armour, appearanceKey) {
      latestRefresh = [hand, armour, appearanceKey];
      actual?.refresh(hand, armour, appearanceKey);
    },
    turn(degrees) { if (actual) actual.turn(degrees); else pendingTurn += degrees; },
    hide() { actual?.hide(); },
    destroy() { destroyed = true; actual?.destroy(); },
  };
}
