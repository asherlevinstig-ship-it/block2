export type EnemyCue = "warning" | "hurt" | "stagger" | "defeat";
export type PowerCue = "seismicWindup" | "seismicImpact";
export type WeaponCue = "hammerImpact" | "rangedHit";
export type MiningCue = "miningStone" | "miningIron" | "miningSilver" | "miningBreak";
type CombatCue = EnemyCue | PowerCue | WeaponCue | MiningCue;

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

export const WEAPON_CUE_DEFINITIONS: Record<WeaponCue, EnemyCueDefinition> = {
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

export const MINING_CUE_DEFINITIONS: Record<MiningCue, EnemyCueDefinition> = {
  miningStone: { minimumIntervalMs: 90, tones: [{ wave: "triangle", startHz: 170, endHz: 55, gain: 0.08, delayMs: 0, durationMs: 100 }] },
  miningIron: { minimumIntervalMs: 90, tones: [{ wave: "triangle", startHz: 660, endHz: 240, gain: 0.065, delayMs: 0, durationMs: 145 }, { wave: "sine", startHz: 112, endHz: 45, gain: 0.08, delayMs: 0, durationMs: 95 }] },
  miningSilver: { minimumIntervalMs: 90, tones: [{ wave: "sine", startHz: 1050, endHz: 540, gain: 0.06, delayMs: 0, durationMs: 200 }, { wave: "triangle", startHz: 220, endHz: 90, gain: 0.06, delayMs: 0, durationMs: 90 }] },
  miningBreak: { minimumIntervalMs: 90, tones: [{ wave: "sawtooth", startHz: 120, endHz: 40, gain: 0.06, delayMs: 0, durationMs: 150 }] },
};

const COMBAT_CUE_DEFINITIONS: Record<CombatCue, EnemyCueDefinition> = {
  ...ENEMY_CUE_DEFINITIONS,
  ...POWER_CUE_DEFINITIONS,
  ...WEAPON_CUE_DEFINITIONS,
  ...MINING_CUE_DEFINITIONS,
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
