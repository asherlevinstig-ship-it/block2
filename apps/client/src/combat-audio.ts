export type EnemyCue = "warning" | "hurt" | "stagger" | "defeat";
export type PowerCue = "seismicWindup" | "seismicImpact";
export type CallingCue = "callingTank" | "callingMage" | "callingShadow" | "callingThief" | "callingRanger";
export type WeaponCue = "hammerImpact" | "rangedHit" | "acidHit" | "venomHit" | "nearMiss"
  | "swordSwing" | "swordImpact" | "weaponBlocked" | "bowRelease" | "focusRelease";
export type MiningCue = "miningStone" | "miningIron" | "miningSilver" | "miningBreak";
export type DungeonCue = "dungeonGate" | "guardianPhase" | "dungeonVictory" | "townVictoryBell" | "depthsEntrance" | "depthsWing" | "depthsArena";
export type LootCue = "lootPickup" | "lootRare" | "lootEpic" | "lootLegendary" | "levelUp" | "discovery";
export type ArmourCue = "shardDeflect" | "playerHit";
type CombatCue = EnemyCue | PowerCue | CallingCue | WeaponCue | MiningCue | DungeonCue | LootCue | ArmourCue;

interface ToneLayer {
  wave: OscillatorType;
  startHz: number;
  endHz: number;
  gain: number;
  delayMs: number;
  durationMs: number;
}

interface EnemyCueDefinition {
  tones: readonly ToneLayer[];
  minimumIntervalMs: number;
}

export const ENEMY_CUE_DEFINITIONS: Record<EnemyCue, EnemyCueDefinition> = {
  warning: {
    minimumIntervalMs: 260,
    tones: [
      { wave: "sawtooth", startHz: 118, endHz: 205, gain: 0.075, delayMs: 0, durationMs: 170 },
      { wave: "square", startHz: 178, endHz: 248, gain: 0.025, delayMs: 75, durationMs: 150 },
    ],
  },
  hurt: {
    minimumIntervalMs: 85,
    tones: [
      { wave: "square", startHz: 165, endHz: 92, gain: 0.06, delayMs: 0, durationMs: 105 },
      { wave: "sine", startHz: 88, endHz: 58, gain: 0.08, delayMs: 12, durationMs: 135 },
    ],
  },
  stagger: {
    minimumIntervalMs: 180,
    tones: [
      { wave: "triangle", startHz: 520, endHz: 310, gain: 0.055, delayMs: 0, durationMs: 190 },
      { wave: "square", startHz: 760, endHz: 410, gain: 0.022, delayMs: 28, durationMs: 145 },
    ],
  },
  defeat: {
    minimumIntervalMs: 500,
    tones: [
      { wave: "sawtooth", startHz: 230, endHz: 62, gain: 0.065, delayMs: 0, durationMs: 430 },
      { wave: "sine", startHz: 116, endHz: 46, gain: 0.1, delayMs: 45, durationMs: 470 },
    ],
  },
};

export const POWER_CUE_DEFINITIONS: Record<PowerCue, EnemyCueDefinition> = {
  seismicWindup: {
    minimumIntervalMs: 300,
    tones: [
      { wave: "sawtooth", startHz: 92, endHz: 48, gain: 0.055, delayMs: 0, durationMs: 390 },
      { wave: "triangle", startHz: 180, endHz: 88, gain: 0.035, delayMs: 80, durationMs: 310 },
    ],
  },
  seismicImpact: {
    minimumIntervalMs: 220,
    tones: [
      { wave: "square", startHz: 82, endHz: 34, gain: 0.095, delayMs: 0, durationMs: 260 },
      { wave: "sawtooth", startHz: 190, endHz: 52, gain: 0.045, delayMs: 15, durationMs: 340 },
      { wave: "sine", startHz: 54, endHz: 28, gain: 0.12, delayMs: 35, durationMs: 410 },
    ],
  },
};

export const CALLING_CUE_DEFINITIONS: Record<CallingCue, EnemyCueDefinition> = {
  callingTank: { minimumIntervalMs: 180, tones: [
    { wave: "square", startHz: 92, endHz: 46, gain: .075, delayMs: 0, durationMs: 250 },
    { wave: "triangle", startHz: 260, endHz: 120, gain: .04, delayMs: 24, durationMs: 190 },
  ] },
  callingMage: { minimumIntervalMs: 180, tones: [
    { wave: "sine", startHz: 280, endHz: 980, gain: .05, delayMs: 0, durationMs: 260 },
    { wave: "triangle", startHz: 560, endHz: 1240, gain: .025, delayMs: 80, durationMs: 240 },
  ] },
  callingShadow: { minimumIntervalMs: 180, tones: [
    { wave: "sawtooth", startHz: 440, endHz: 82, gain: .035, delayMs: 0, durationMs: 210 },
    { wave: "sine", startHz: 900, endHz: 240, gain: .025, delayMs: 35, durationMs: 170 },
  ] },
  callingThief: { minimumIntervalMs: 180, tones: [
    { wave: "triangle", startHz: 240, endHz: 72, gain: .032, delayMs: 0, durationMs: 260 },
    { wave: "sine", startHz: 680, endHz: 190, gain: .02, delayMs: 20, durationMs: 190 },
  ] },
  callingRanger: { minimumIntervalMs: 180, tones: [
    { wave: "triangle", startHz: 340, endHz: 760, gain: .04, delayMs: 0, durationMs: 150 },
    { wave: "sine", startHz: 620, endHz: 1180, gain: .022, delayMs: 70, durationMs: 180 },
  ] },
};

export const WEAPON_CUE_DEFINITIONS: Record<WeaponCue, EnemyCueDefinition> = {
  swordImpact: { minimumIntervalMs: 90, tones: [
    { wave: "triangle", startHz: 210, endHz: 72, gain: .065, delayMs: 0, durationMs: 95 },
    { wave: "square", startHz: 640, endHz: 180, gain: .018, delayMs: 0, durationMs: 42 },
  ] },
  weaponBlocked: { minimumIntervalMs: 160, tones: [
    { wave: "triangle", startHz: 960, endHz: 620, gain: .025, delayMs: 0, durationMs: 75 },
  ] },
  swordSwing: { minimumIntervalMs: 90, tones: [
    { wave: "triangle", startHz: 540, endHz: 150, gain: .026, delayMs: 0, durationMs: 105 },
    { wave: "sine", startHz: 270, endHz: 110, gain: .018, delayMs: 20, durationMs: 90 },
  ] },
  bowRelease: { minimumIntervalMs: 110, tones: [
    { wave: "triangle", startHz: 920, endHz: 280, gain: .032, delayMs: 0, durationMs: 90 },
    { wave: "sine", startHz: 170, endHz: 95, gain: .018, delayMs: 12, durationMs: 120 },
  ] },
  focusRelease: { minimumIntervalMs: 100, tones: [
    { wave: "sine", startHz: 260, endHz: 880, gain: .03, delayMs: 0, durationMs: 125 },
    { wave: "triangle", startHz: 720, endHz: 420, gain: .016, delayMs: 45, durationMs: 95 },
  ] },
  nearMiss: { minimumIntervalMs: 350, tones: [{ wave: "triangle", startHz: 700, endHz: 170, gain: .02, delayMs: 0, durationMs: 100 }] },
  acidHit: { minimumIntervalMs: 90, tones: [{ wave: "triangle", startHz: 165, endHz: 65, gain: .035, delayMs: 0, durationMs: 110 }] },
  venomHit: { minimumIntervalMs: 90, tones: [{ wave: "sine", startHz: 720, endHz: 380, gain: .03, delayMs: 0, durationMs: 85 }] },
  rangedHit: { minimumIntervalMs: 90, tones: [{ wave: "sine", startHz: 520, endHz: 300, gain: .035, delayMs: 0, durationMs: 75 }] },
  hammerImpact: {
    minimumIntervalMs: 180,
    tones: [
      { wave: "sine", startHz: 96, endHz: 38, gain: 0.12, delayMs: 0, durationMs: 220 },
      { wave: "triangle", startHz: 360, endHz: 110, gain: 0.045, delayMs: 0, durationMs: 100 },
      { wave: "square", startHz: 140, endHz: 55, gain: 0.035, delayMs: 18, durationMs: 150 },
    ],
  },
};

export const ARMOUR_CUE_DEFINITIONS: Record<ArmourCue, EnemyCueDefinition> = {
  playerHit: { minimumIntervalMs: 90, tones: [
    { wave: "square", startHz: 112, endHz: 46, gain: .095, delayMs: 0, durationMs: 150 },
    { wave: "sine", startHz: 58, endHz: 34, gain: .11, delayMs: 8, durationMs: 190 },
  ] },
  shardDeflect: { minimumIntervalMs: 600, tones: [
    { wave: "triangle", startHz: 1180, endHz: 420, gain: .035, delayMs: 0, durationMs: 115 },
    { wave: "sine", startHz: 520, endHz: 880, gain: .025, delayMs: 45, durationMs: 145 },
  ] },
};

export const MINING_CUE_DEFINITIONS: Record<MiningCue, EnemyCueDefinition> = {
  miningStone: { minimumIntervalMs: 90, tones: [{ wave: "triangle", startHz: 170, endHz: 55, gain: 0.08, delayMs: 0, durationMs: 100 }] },
  miningIron: { minimumIntervalMs: 90, tones: [{ wave: "triangle", startHz: 660, endHz: 240, gain: 0.065, delayMs: 0, durationMs: 145 }, { wave: "sine", startHz: 112, endHz: 45, gain: 0.08, delayMs: 0, durationMs: 95 }] },
  miningSilver: { minimumIntervalMs: 90, tones: [{ wave: "sine", startHz: 1050, endHz: 540, gain: 0.06, delayMs: 0, durationMs: 200 }, { wave: "triangle", startHz: 220, endHz: 90, gain: 0.06, delayMs: 0, durationMs: 90 }] },
  miningBreak: { minimumIntervalMs: 90, tones: [{ wave: "sawtooth", startHz: 120, endHz: 40, gain: 0.06, delayMs: 0, durationMs: 150 }] },
};

export const DUNGEON_CUE_DEFINITIONS: Record<DungeonCue, EnemyCueDefinition> = {
  townVictoryBell: { minimumIntervalMs: 4000, tones: [
    { wave: "sine", startHz: 196, endHz: 188, gain: .07, delayMs: 0, durationMs: 1250 },
    { wave: "triangle", startHz: 392, endHz: 376, gain: .035, delayMs: 12, durationMs: 1050 },
    { wave: "sine", startHz: 262, endHz: 250, gain: .06, delayMs: 520, durationMs: 1450 },
    { wave: "triangle", startHz: 523, endHz: 498, gain: .026, delayMs: 540, durationMs: 1200 },
  ] },
  depthsEntrance: { minimumIntervalMs: 2200, tones: [
    { wave: "sine", startHz: 176, endHz: 132, gain: .018, delayMs: 0, durationMs: 460 },
    { wave: "triangle", startHz: 352, endHz: 264, gain: .012, delayMs: 80, durationMs: 480 },
  ] },
  depthsWing: { minimumIntervalMs: 2200, tones: [
    { wave: "triangle", startHz: 240, endHz: 120, gain: .018, delayMs: 0, durationMs: 500 },
    { wave: "sine", startHz: 480, endHz: 320, gain: .012, delayMs: 120, durationMs: 420 },
  ] },
  depthsArena: { minimumIntervalMs: 3000, tones: [
    { wave: "sine", startHz: 88, endHz: 55, gain: .026, delayMs: 0, durationMs: 650 },
    { wave: "triangle", startHz: 174, endHz: 110, gain: .016, delayMs: 100, durationMs: 620 },
  ] },
  dungeonGate: { minimumIntervalMs: 500, tones: [
    { wave: "triangle", startHz: 92, endHz: 48, gain: .065, delayMs: 0, durationMs: 320 },
    { wave: "sine", startHz: 260, endHz: 390, gain: .04, delayMs: 150, durationMs: 260 },
  ] },
  guardianPhase: { minimumIntervalMs: 1000, tones: [
    { wave: "sawtooth", startHz: 72, endHz: 42, gain: .075, delayMs: 0, durationMs: 420 },
    { wave: "triangle", startHz: 180, endHz: 92, gain: .04, delayMs: 110, durationMs: 360 },
  ] },
  dungeonVictory: { minimumIntervalMs: 1500, tones: [
    { wave: "sine", startHz: 262, endHz: 392, gain: .055, delayMs: 0, durationMs: 240 },
    { wave: "sine", startHz: 330, endHz: 494, gain: .05, delayMs: 170, durationMs: 260 },
    { wave: "triangle", startHz: 392, endHz: 784, gain: .045, delayMs: 350, durationMs: 420 },
  ] },
};

export const LOOT_CUE_DEFINITIONS: Record<LootCue, EnemyCueDefinition> = {
  discovery: { minimumIntervalMs: 900, tones: [
    { wave: "sine", startHz: 392, endHz: 523, gain: .022, delayMs: 0, durationMs: 190 },
    { wave: "triangle", startHz: 523, endHz: 784, gain: .018, delayMs: 125, durationMs: 260 },
  ] },
  levelUp: { minimumIntervalMs: 700, tones: [
    { wave: "triangle", startHz: 392, endHz: 588, gain: .035, delayMs: 0, durationMs: 180 },
    { wave: "sine", startHz: 523, endHz: 784, gain: .04, delayMs: 140, durationMs: 220 },
    { wave: "triangle", startHz: 659, endHz: 1046, gain: .03, delayMs: 300, durationMs: 330 },
  ] },
  lootPickup: { minimumIntervalMs: 90, tones: [
    { wave: "sine", startHz: 440, endHz: 720, gain: .025, delayMs: 0, durationMs: 90 },
    { wave: "triangle", startHz: 660, endHz: 980, gain: .018, delayMs: 55, durationMs: 110 },
  ] },
  lootRare: { minimumIntervalMs: 650, tones: [
    { wave: "sine", startHz: 392, endHz: 588, gain: .035, delayMs: 0, durationMs: 150 },
    { wave: "triangle", startHz: 588, endHz: 784, gain: .025, delayMs: 115, durationMs: 190 },
  ] },
  lootEpic: { minimumIntervalMs: 850, tones: [
    { wave: "sine", startHz: 330, endHz: 660, gain: .038, delayMs: 0, durationMs: 220 },
    { wave: "triangle", startHz: 494, endHz: 988, gain: .03, delayMs: 150, durationMs: 260 },
    { wave: "sine", startHz: 660, endHz: 1320, gain: .02, delayMs: 300, durationMs: 280 },
  ] },
  lootLegendary: { minimumIntervalMs: 1200, tones: [
    { wave: "triangle", startHz: 196, endHz: 392, gain: .045, delayMs: 0, durationMs: 300 },
    { wave: "sine", startHz: 392, endHz: 784, gain: .04, delayMs: 180, durationMs: 340 },
    { wave: "sine", startHz: 523, endHz: 1046, gain: .032, delayMs: 390, durationMs: 420 },
    { wave: "triangle", startHz: 784, endHz: 1568, gain: .022, delayMs: 610, durationMs: 460 },
  ] },
};

const COMBAT_CUE_DEFINITIONS: Record<CombatCue, EnemyCueDefinition> = {
  ...ENEMY_CUE_DEFINITIONS,
  ...POWER_CUE_DEFINITIONS,
  ...CALLING_CUE_DEFINITIONS,
  ...WEAPON_CUE_DEFINITIONS,
  ...ARMOUR_CUE_DEFINITIONS,
  ...MINING_CUE_DEFINITIONS,
  ...DUNGEON_CUE_DEFINITIONS,
  ...LOOT_CUE_DEFINITIONS,
};

export interface EnemyCueSnapshot {
  alive: boolean;
  health: number;
  hitSequence: number;
  staggerSequence: number;
  combatState: string;
}

export function enemyCuesForTransition(previous: EnemyCueSnapshot, current: EnemyCueSnapshot): EnemyCue[] {
  const cues: EnemyCue[] = [];
  if (current.combatState === "windup" && previous.combatState !== "windup") cues.push("warning");
  if (current.hitSequence > previous.hitSequence && current.health > 0) cues.push("hurt");
  if (current.staggerSequence > previous.staggerSequence) cues.push("stagger");
  if (!current.alive && previous.alive) cues.push("defeat");
  return cues;
}

export function enemyCuePan(enemyX: number, playerX: number, audibleRange = 9): number {
  if (!Number.isFinite(enemyX) || !Number.isFinite(playerX) || audibleRange <= 0) return 0;
  return Math.max(-1, Math.min(1, (enemyX - playerX) / audibleRange));
}

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class CombatAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  private readonly lastPlayedAt = new Map<CombatCue, number>();

  unlock(): void {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!AudioContextConstructor) return;
      this.context = new AudioContextConstructor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.context.destination);
    }
    this.unlocked = true;
    if (this.context.state === "suspended") void this.context.resume();
  }

  play(cue: CombatCue, pan = 0): void {
    const context = this.context;
    const master = this.master;
    if (!this.unlocked || !context || !master || context.state === "closed") return;
    const definition = COMBAT_CUE_DEFINITIONS[cue];
    const nowMs = performance.now();
    const lastPlayedAt = this.lastPlayedAt.get(cue) ?? -Infinity;
    if (nowMs - lastPlayedAt < definition.minimumIntervalMs) return;
    this.lastPlayedAt.set(cue, nowMs);

    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(master);
    const now = context.currentTime;
    let latestEndMs = 0;
    for (const tone of definition.tones) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const startsAt = now + tone.delayMs / 1000;
      const endsAt = startsAt + tone.durationMs / 1000;
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(tone.startHz, startsAt);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endHz), endsAt);
      envelope.gain.setValueAtTime(0.0001, startsAt);
      envelope.gain.exponentialRampToValueAtTime(tone.gain, startsAt + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
      oscillator.connect(envelope);
      envelope.connect(panner);
      oscillator.start(startsAt);
      oscillator.stop(endsAt + 0.02);
      latestEndMs = Math.max(latestEndMs, tone.delayMs + tone.durationMs);
    }
    window.setTimeout(() => panner.disconnect(), latestEndMs + 100);
  }
}
