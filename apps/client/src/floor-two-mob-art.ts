import * as pc from "playcanvas";

type Triple = readonly [number, number, number];
type FloorTwoMobKind = "hound" | "ram" | "sentry" | "steamcaster" | "bloater" | "warden" | "forgeheart";

export type FloorTwoMobIdentity = {
  kind: FloorTwoMobKind;
  title: string;
  attackRead: string;
  accent: "ember" | "coolant" | "steam";
};

export interface FloorTwoMobRig {
  kind: FloorTwoMobKind;
  root: pc.Entity;
  attackPivot: pc.Entity;
  recoilPivot: pc.Entity;
  core: pc.Entity;
  vents: pc.Entity[];
}

export type FloorTwoAttackPose = {
  rootPitch: number;
  rootY: number;
  rootZ: number;
  attackPitch: number;
  attackYaw: number;
  recoilZ: number;
  coreScale: number;
  ventScale: number;
};

export function floorTwoMobIdentity(mobId: string, archetype: string): FloorTwoMobIdentity | null {
  if (!mobId.startsWith("floor2-")) return null;
  if (mobId === "floor2-forgeheart") return {
    kind: "forgeheart", title: "Forgeheart Colossus", attackRead: "raised hammer → impact", accent: "ember",
  };
  if (mobId === "floor2-quench-regulator") return {
    kind: "warden", title: "Quench Warden", attackRead: "coolant fists → slam", accent: "coolant",
  };
  if (archetype === "ember_hound") return {
    kind: "hound", title: "Soot Hound", attackRead: "crouch → pounce", accent: "ember",
  };
  if (archetype === "cinder_ram") return {
    kind: "ram", title: "Furnace Ram", attackRead: "head lowered → charge", accent: "ember",
  };
  if (archetype === "shard_sentry") return {
    kind: "sentry", title: "Pressure Sentry", attackRead: "barrels converge → shot", accent: "coolant",
  };
  if (archetype === "cave_spitter") return {
    kind: "steamcaster", title: "Steamcaster", attackRead: "boiler swells → burst", accent: "steam",
  };
  if (archetype === "fen_bloater") return {
    kind: "bloater", title: "Coolant Vessel", attackRead: "tanks inflate → bloom", accent: "coolant",
  };
  return null;
}

function surface(name: string, diffuse: Triple, emissive: Triple = [0, 0, 0], metalness = .15): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.name = name;
  result.diffuse.set(...diffuse);
  result.emissive.set(...emissive);
  result.metalness = metalness;
  result.shininess = metalness > .4 ? 72 : 24;
  result.update();
  return result;
}

const forgedIron = surface("floor2-mob-forged-iron", [.12, .135, .15], [0, 0, 0], .72);
const hotIron = surface("floor2-mob-hot-iron", [.38, .105, .035], [.26, .035, .004], .6);
const brass = surface("floor2-mob-brass", [.48, .32, .09], [.035, .018, .002], .62);
const ember = surface("floor2-mob-ember", [1, .22, .025], [.9, .07, .003], .15);
const coolant = surface("floor2-mob-coolant", [.05, .62, .86], [.015, .42, .72], .25);
const paleSteam = surface("floor2-mob-steam-glass", [.58, .82, .88], [.08, .22, .26], .35);

function joint(parent: pc.Entity, name: string, at: Triple): pc.Entity {
  const result = new pc.Entity(name);
  result.setLocalPosition(...at);
  parent.addChild(result);
  return result;
}

function part(parent: pc.Entity, name: string, type: "box" | "cylinder" | "sphere" | "cone",
  material: pc.StandardMaterial, scale: Triple, at: Triple, angle: Triple = [0, 0, 0], castShadows = true): pc.Entity {
  const result = new pc.Entity(name);
  result.addComponent("render", { type, material, castShadows, receiveShadows: true });
  result.setLocalPosition(...at);
  result.setLocalScale(...scale);
  result.setLocalEulerAngles(...angle);
  parent.addChild(result);
  return result;
}

function addExhaust(parent: pc.Entity, name: string, x: number, y: number, z: number, accent: pc.StandardMaterial): pc.Entity {
  const vent = joint(parent, name, [x, y, z]);
  part(vent, "pipe", "cylinder", forgedIron, [.14, .52, .14], [0, 0, 0]);
  part(vent, "rim", "cylinder", brass, [.22, .12, .22], [0, .28, 0]);
  part(vent, "glow", "cone", accent, [.13, .32, .13], [0, .46, 0], [0, 0, 0], false);
  return vent;
}

/** Adds Floor 2 machinery without replacing the shared creature skeleton. */
export function createFloorTwoMobArt(parent: pc.Entity, mobId: string, archetype: string): FloorTwoMobRig | null {
  const identity = floorTwoMobIdentity(mobId, archetype);
  if (!identity) return null;
  const root = joint(parent, `floor2-${identity.kind}-kit`, [0, 0, 0]);
  const attackPivot = joint(root, "attack-read-joint", [0, 0, 0]);
  const recoilPivot = joint(root, "recoil-joint", [0, 0, 0]);
  const vents: pc.Entity[] = [];
  let core: pc.Entity;

  if (identity.kind === "hound") {
    part(root, "furnace-collar", "box", forgedIron, [.76, .24, .45], [0, .86, .25], [-12, 0, 0]);
    core = part(root, "hound-heat-core", "box", ember, [.22, .16, .18], [0, .94, .47], [0, 0, 45], false);
    for (const side of [-1, 1]) {
      part(root, "cinder-mane-blade", "cone", hotIron, [.16, .5, .16], [side * .28, 1.06, -.06], [-18, 0, side * -18]);
      vents.push(addExhaust(root, `hound-exhaust-${side}`, side * .3, 1.04, -.45, ember));
    }
  } else if (identity.kind === "ram") {
    attackPivot.setLocalPosition(0, .95, 1.15);
    part(attackPivot, "battering-plate", "box", forgedIron, [1.02, .5, .22], [0, 0, 0], [-8, 0, 0]);
    part(attackPivot, "heated-boss", "cone", ember, [.3, .64, .3], [0, -.02, .28], [90, 0, 0], false);
    for (const side of [-1, 1]) part(attackPivot, "reinforced-tine", "cone", brass,
      [.19, .72, .19], [side * .48, .12, .27], [90, 0, side * 10]);
    core = part(root, "ram-furnace", "box", hotIron, [.63, .35, .7], [0, 1.33, -.3]);
    vents.push(addExhaust(root, "ram-stack-left", -.36, 1.58, -.45, ember));
    vents.push(addExhaust(root, "ram-stack-right", .36, 1.58, -.45, ember));
  } else if (identity.kind === "sentry") {
    attackPivot.setLocalPosition(0, 1.22, .38);
    for (const side of [-1, 1]) {
      const barrel = joint(attackPivot, `pressure-barrel-${side}`, [side * .34, 0, 0]);
      part(barrel, "barrel-body", "cylinder", forgedIron, [.16, .82, .16], [0, 0, .35], [90, 0, 0]);
      part(barrel, "barrel-coil", "cylinder", coolant, [.22, .16, .22], [0, 0, .68], [90, 0, 0], false);
    }
    core = part(root, "sentry-reactor", "sphere", coolant, [.29, .29, .29], [0, 1.12, .34], [0, 0, 0], false);
    part(root, "sentry-armour-ring", "cylinder", brass, [.75, .18, .75], [0, 1.03, 0]);
  } else if (identity.kind === "steamcaster") {
    part(root, "steam-boiler", "sphere", forgedIron, [.68, .62, .68], [0, .83, -.35]);
    core = part(root, "boiler-window", "sphere", paleSteam, [.35, .35, .2], [0, .88, -.88], [0, 0, 0], false);
    attackPivot.setLocalPosition(0, .62, .72);
    part(attackPivot, "steam-nozzle", "cylinder", brass, [.25, .78, .25], [0, 0, .25], [90, 0, 0]);
    part(attackPivot, "nozzle-mouth", "cylinder", paleSteam, [.36, .13, .36], [0, 0, .7], [90, 0, 0], false);
    vents.push(addExhaust(root, "steam-release-left", -.43, 1.15, -.4, paleSteam));
    vents.push(addExhaust(root, "steam-release-right", .43, 1.15, -.4, paleSteam));
  } else if (identity.kind === "bloater") {
    core = part(root, "coolant-heart", "sphere", coolant, [.32, .38, .22], [0, .77, .62], [0, 0, 0], false);
    for (const side of [-1, 1]) {
      const tank = joint(recoilPivot, `coolant-tank-${side}`, [side * .63, .89, -.18]);
      part(tank, "tank-body", "cylinder", forgedIron, [.33, .72, .33], [0, 0, 0]);
      part(tank, "tank-window", "sphere", coolant, [.23, .31, .23], [0, .04, .16], [0, 0, 0], false);
      vents.push(tank);
    }
    part(root, "vessel-harness", "box", brass, [1.24, .16, .86], [0, .96, -.18]);
  } else {
    const forgeheart = identity.kind === "forgeheart";
    core = part(root, forgeheart ? "forgeheart-reactor" : "quench-reactor", "sphere",
      forgeheart ? ember : coolant, forgeheart ? [.38, .48, .22] : [.32, .4, .2], [0, 1.15, .51], [0, 0, 0], false);
    for (const side of [-1, 1]) {
      part(root, forgeheart ? "anvil-shoulder" : "quench-shoulder", "box", forgeheart ? hotIron : forgedIron,
        forgeheart ? [.72, .42, .86] : [.58, .34, .7], [side * .78, 1.58, -.04], [0, 0, side * 10]);
      vents.push(addExhaust(root, `${identity.kind}-stack-${side}`, side * .56, 2.0, -.24, forgeheart ? ember : coolant));
    }
    attackPivot.setLocalPosition(.72, 1.18, .1);
    if (forgeheart) {
      part(attackPivot, "forge-hammer-handle", "cylinder", forgedIron, [.17, 1.45, .17], [0, -.65, .12], [0, 0, 0]);
      part(attackPivot, "forge-hammer-head", "box", hotIron, [.82, .42, .5], [0, .62, .12]);
      part(attackPivot, "forge-hammer-core", "box", ember, [.32, .24, .54], [0, .62, .12], [0, 0, 0], false);
    } else {
      part(attackPivot, "quench-gauntlet", "box", forgedIron, [.68, .72, .68], [0, -.32, .24]);
      part(attackPivot, "quench-knuckles", "box", coolant, [.72, .18, .27], [0, -.58, .48], [0, 0, 0], false);
    }
  }
  return { kind: identity.kind, root, attackPivot, recoilPivot, core, vents };
}

export function floorTwoAttackPose(kind: FloorTwoMobKind, attackPattern: string,
  windup: number, attack: number, recovery: number, pulse: number): FloorTwoAttackPose {
  const charged = Math.max(0, Math.min(1, windup));
  const strike = Math.max(0, Math.min(1, attack));
  const settle = Math.max(0, Math.min(1, recovery));
  if (kind === "hound") return {
    rootPitch: charged * -14 + strike * 24, rootY: charged * -.1 + strike * .1, rootZ: strike * .16,
    attackPitch: 0, attackYaw: 0, recoilZ: 0, coreScale: 1 + charged * .28, ventScale: 1 + charged * .36 + pulse * .08,
  };
  if (kind === "ram") return {
    rootPitch: charged * 11 - strike * 8, rootY: charged * -.08, rootZ: strike * .2,
    attackPitch: charged * 38 - strike * 31 + settle * 10, attackYaw: 0, recoilZ: -strike * .12,
    coreScale: 1 + charged * .32, ventScale: 1 + charged * .45 + pulse * .1,
  };
  if (kind === "sentry" || kind === "steamcaster") return {
    rootPitch: -charged * 5 + strike * 8, rootY: 0, rootZ: 0,
    attackPitch: charged * -8, attackYaw: Math.sin(pulse * Math.PI) * charged * 4,
    recoilZ: -strike * .38 + settle * .08, coreScale: 1 + charged * .42 - strike * .16,
    ventScale: 1 + charged * .28 + pulse * .06,
  };
  if (kind === "bloater") return {
    rootPitch: strike * 8, rootY: charged * .06, rootZ: 0, attackPitch: 0, attackYaw: 0,
    recoilZ: 0, coreScale: 1 + charged * .52 - strike * .18, ventScale: 1 + charged * .38 + pulse * .08,
  };
  const barrage = ["rocks", "warden-barrage", "fault-line"].includes(attackPattern);
  const charge = attackPattern === "charge";
  return {
    rootPitch: charge ? charged * 16 - strike * 20 : charged * -7 + strike * 16,
    rootY: charged * -.05, rootZ: charge ? strike * .24 : 0,
    attackPitch: barrage ? -charged * 74 + strike * 26 : -charged * 126 + strike * 92,
    attackYaw: barrage ? charged * 38 : charge ? -charged * 18 : 0,
    recoilZ: -strike * .18, coreScale: 1 + charged * .38 + pulse * .07,
    ventScale: 1 + charged * .42 + pulse * .1,
  };
}

export function animateFloorTwoMobArt(rig: FloorTwoMobRig, time: number, attackPattern: string,
  windup: number, attack: number, recovery: number): void {
  const pulse = .5 + .5 * Math.sin(time * (rig.kind === "hound" ? 10 : 6));
  const pose = floorTwoAttackPose(rig.kind, attackPattern, windup, attack, recovery, pulse);
  rig.root.setLocalPosition(0, pose.rootY, pose.rootZ);
  rig.root.setLocalEulerAngles(pose.rootPitch, 0, 0);
  rig.attackPivot.setLocalEulerAngles(pose.attackPitch, pose.attackYaw, 0);
  rig.recoilPivot.setLocalPosition(0, 0, pose.recoilZ);
  rig.core.setLocalScale(pose.coreScale, pose.coreScale, pose.coreScale);
  for (let index = 0; index < rig.vents.length; index += 1) {
    const scale = pose.ventScale * (1 + Math.sin(time * 8 + index * 1.7) * .035);
    rig.vents[index]!.setLocalScale(scale, scale, scale);
  }
}
