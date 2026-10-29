import { TOWER_FLOOR_ONE } from "@blockcraft/protocol";

export type FloorOneBossState = "sealed" | "awakening" | "alive" | "defeated";
export type FloorOneRunStage = "arrival" | "wardens" | "final-seal" | "crownkeeper" | "cleared";

export type FloorOneRunInput = {
  active: boolean;
  x: number;
  z: number;
  northAlive: boolean;
  southAlive: boolean;
  bossState: FloorOneBossState;
  openingAlive?: boolean;
  northApproachAlive?: boolean;
  southApproachAlive?: boolean;
};

export type FloorOneRunView = {
  stage: FloorOneRunStage;
  eyebrow: string;
  title: string;
  detail: string;
  targetName: string;
  targetX: number;
  targetZ: number;
  distance: number;
  northComplete: boolean;
  southComplete: boolean;
  crownComplete: boolean;
};

const NORTH = { name: "North Root Warden", x: 350, z: 80 } as const;
const SOUTH = { name: "South Root Warden", x: 350, z: 132 } as const;
const OPENING = { name: "Breach Skirmish", x: 329, z: 106 } as const;
const NORTH_APPROACH = { name: "Bramble Causeway", x: 337, z: 90 } as const;
const SOUTH_APPROACH = { name: "Thornway Crossfire", x: 337, z: 122 } as const;
const CROWN = { name: "Crownkeeper Court", x: 375, z: 106 } as const;
const ASCENT = { name: "Floor 2 Ascent", x: TOWER_FLOOR_ONE.ascentPortal.x, z: TOWER_FLOOR_ONE.ascentPortal.z } as const;

const range = (x: number, z: number, target: { x: number; z: number }): number =>
  Math.round(Math.hypot(target.x - x, target.z - z));

export function floorOneRunView(input: FloorOneRunInput): FloorOneRunView {
  const northComplete = !input.northAlive;
  const southComplete = !input.southAlive;
  const crownComplete = input.bossState === "defeated";
  let stage: FloorOneRunStage, eyebrow: string, title: string, detail: string;
  let target: { name: string; x: number; z: number };

  const routeTarget = (north: boolean): { target: { name: string; x: number; z: number }; detail: string } => {
    if (north && input.northApproachAlive) return { target: NORTH_APPROACH,
      detail: "Close down the Rootway Keeper while the Bramble Hound pressures the front line." };
    if (!north && input.southApproachAlive) return { target: SOUTH_APPROACH,
      detail: "Use the ruined cover to split the Spitter from its pursuing guard." };
    return north
      ? { target: NORTH, detail: "Break the escort, interrupt the long Root Slam, then punish the exposed Warden." }
      : { target: SOUTH, detail: "Break the escort, weave through the Thorn Fan and interrupt the expanding Root Ring." };
  };

  if (crownComplete) {
    stage = "cleared"; eyebrow = "FLOOR 1 CLEARED"; title = "Reach the ascent gate";
    detail = "The Overgrown Rampart is conquered. Collect remaining loot, then continue east to the tower ascent.";
    target = ASCENT;
  } else if (northComplete && southComplete) {
    stage = "crownkeeper"; eyebrow = input.bossState === "awakening" ? "THE COURT AWAKENS" : "FINAL ENCOUNTER";
    title = "Defeat the Crownkeeper";
    detail = "Read each fixed attack, answer its counter cue, then strike during the party opening.";
    target = CROWN;
  } else if (northComplete || southComplete) {
    stage = "final-seal"; eyebrow = "ONE SEAL REMAINS";
    const route = routeTarget(input.northAlive);
    target = route.target;
    title = `Defeat the ${target.name}`;
    detail = route.detail;
  } else if (input.x < 322) {
    stage = "arrival"; eyebrow = "FLOOR 1 · OVERGROWN RAMPART"; title = "Cross the sanctuary causeway";
    detail = "At the ruined fork, choose either Warden. North teaches interrupts; South teaches spacing.";
    target = OPENING;
  } else if (input.openingAlive) {
    stage = "arrival"; eyebrow = "FIRST ENCOUNTER"; title = "Clear the Breach Skirmish";
    detail = "Remove the melee pressure first, then punish the Thorncaster during its windup.";
    target = OPENING;
  } else {
    stage = "wardens"; eyebrow = "BREAK BOTH ROOT SEALS"; title = "Choose your first Warden";
    detail = "North: interrupt heavy slams. South: move through ranged patterns. Either route is valid.";
    const north = range(input.x, input.z, NORTH) <= range(input.x, input.z, SOUTH);
    const route = routeTarget(north);
    target = route.target; detail = route.detail;
    title = `Clear ${target.name}`;
  }

  return {
    stage, eyebrow, title, detail, targetName: target.name, targetX: target.x, targetZ: target.z,
    distance: range(input.x, input.z, target), northComplete, southComplete, crownComplete,
  };
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function createFloorOneRunUI(): { update: (input: FloorOneRunInput) => void;
  timing: (update: { elapsedMs: number }) => void; close: () => void } {
  const tracker = document.createElement("aside");
  tracker.id = "floor-one-run"; tracker.hidden = true;
  tracker.innerHTML = `
    <header><small></small><strong></strong></header>
    <ol aria-label="Floor 1 encounter progress">
      <li data-step="north"><i></i><span>NORTH SEAL</span></li>
      <li data-step="south"><i></i><span>SOUTH SEAL</span></li>
      <li data-step="crown"><i></i><span>CROWNKEEPER</span></li>
    </ol>
    <p></p><footer><span></span><b></b></footer>`;

  const complete = document.createElement("section");
  complete.id = "floor-one-complete"; complete.hidden = true;
  complete.setAttribute("role", "dialog"); complete.setAttribute("aria-modal", "true");
  complete.setAttribute("aria-labelledby", "floor-one-complete-title");
  complete.innerHTML = `<div class="floor-one-complete-card">
    <small>THE OVERGROWN RAMPART</small><h2 id="floor-one-complete-title">Floor 1 Cleared</h2>
    <p>Both Root Seals are broken and the Crownkeeper has fallen.</p>
    <div><span>WARDENS<strong>2 / 2</strong></span><span>CROWNKEEPER<strong>DEFEATED</strong></span><span>RUN TIME<strong id="floor-one-clear-time">—</strong></span></div>
    <p class="floor-one-complete-next">Collect any remaining loot. The objective tracker now leads east to the Floor 2 ascent gate.</p>
    <button type="button" id="floor-one-complete-continue">CONTINUE TO ASCENT</button>
  </div>`;
  document.body.append(tracker, complete);

  let active = false, runStartedAt = 0, serverRunTime = 0, bossWasAlive = false, celebrated = false, fingerprint = "";
  const close = (): void => { complete.hidden = true; };
  complete.querySelector<HTMLButtonElement>("#floor-one-complete-continue")!.addEventListener("click", close);

  return {
    close,
    timing(update): void {
      serverRunTime = Math.max(0, update.elapsedMs);
      complete.querySelector<HTMLElement>("#floor-one-clear-time")!.textContent = formatDuration(serverRunTime);
    },
    update(input): void {
      if (!input.active) {
        tracker.hidden = true; complete.hidden = true; active = false; serverRunTime = 0;
        bossWasAlive = false; celebrated = false; fingerprint = "";
        return;
      }
      if (!active) { active = true; runStartedAt = performance.now(); }
      if (input.bossState === "alive") bossWasAlive = true;
      const view = floorOneRunView(input);
      const nextFingerprint = JSON.stringify(view);
      if (nextFingerprint !== fingerprint) {
        fingerprint = nextFingerprint; tracker.hidden = false; tracker.dataset.stage = view.stage;
        tracker.querySelector("header small")!.textContent = view.eyebrow;
        tracker.querySelector("header strong")!.textContent = view.title;
        tracker.querySelector("p")!.textContent = view.detail;
        tracker.querySelector("footer span")!.textContent = view.targetName;
        tracker.querySelector("footer b")!.textContent = `${view.distance}m`;
        tracker.querySelector<HTMLElement>('[data-step="north"]')!.dataset.complete = String(view.northComplete);
        tracker.querySelector<HTMLElement>('[data-step="south"]')!.dataset.complete = String(view.southComplete);
        tracker.querySelector<HTMLElement>('[data-step="crown"]')!.dataset.complete = String(view.crownComplete);
      }
      if (view.crownComplete && bossWasAlive && !celebrated) {
        celebrated = true;
        complete.querySelector<HTMLElement>("#floor-one-clear-time")!.textContent = formatDuration(serverRunTime || performance.now() - runStartedAt);
        complete.hidden = false;
      }
    },
  };
}
