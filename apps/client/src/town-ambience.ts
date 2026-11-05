type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export interface TownSoundPoint { x: number; z: number }
export interface TownAmbienceSnapshot {
  active: boolean;
  listener: TownSoundPoint;
  walkers: readonly TownSoundPoint[];
  celebration: boolean;
  guardCallKey?: string;
}

export interface TownSoundSpatial { gain: number; pan: number }

export function townSoundSpatial(listener: TownSoundPoint, source: TownSoundPoint, radius: number): TownSoundSpatial {
  const distance = Math.hypot(source.x - listener.x, source.z - listener.z);
  const proximity = Math.max(0, 1 - distance / Math.max(.01, radius));
  return {
    gain: proximity * proximity,
    pan: Math.max(-1, Math.min(1, (source.x - listener.x) / Math.max(1, radius * .55))),
  };
}

const MARKET = { x: 82, z: 106 };
const FORGE = { x: 79, z: 136 };
const SANCTUARY = { x: 51, z: 108.5 };
const TAVERN = { x: 74.5, z: 82.5 };

/** Low-cost procedural Town soundscape. Persistent beds are filtered noise;
 * every positional detail is a short oscillator, so no audio asset download
 * or decode work is added to the loading screen. */
export class TownAmbience {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private marketGain: GainNode | null = null;
  private marketPan: StereoPannerNode | null = null;
  private tavernGain: GainNode | null = null;
  private tavernPan: StereoPannerNode | null = null;
  private started = false;
  private snapshot: TownAmbienceSnapshot = { active: false, listener: { x: 0, z: 0 }, walkers: [], celebration: false };
  private nextForgeAt = 0;
  private nextChimeAt = 0;
  private nextFootstepAt = 0;
  private previousCelebration = false;
  private previousGuardCallKey = "";

  update(snapshot: TownAmbienceSnapshot): void {
    this.snapshot = snapshot;
    if (snapshot.active && snapshot.celebration && !this.previousCelebration) this.playVictoryCheer();
    this.previousCelebration = snapshot.active && snapshot.celebration;
    if (snapshot.active && snapshot.guardCallKey && snapshot.guardCallKey !== this.previousGuardCallKey) {
      this.previousGuardCallKey = snapshot.guardCallKey;
      this.playGuardCall();
    }
  }

  start(): void {
    if (this.started) {
      if (this.context?.state === "suspended") void this.context.resume();
      return;
    }
    const AudioContextConstructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return;
    this.started = true;
    const context = this.context = new AudioContextConstructor();
    const output = this.output = context.createGain();
    output.gain.value = 0;
    output.connect(context.destination);
    const makeBed = (lowpassHz: number): { gain: GainNode; pan: StereoPannerNode } => {
      const seconds = 3;
      const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let index = 0; index < data.length; index++) {
        brown = (brown + (Math.random() * 2 - 1) * .03) * .986;
        data[index] = brown;
      }
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = lowpassHz;
      const gain = context.createGain(); gain.gain.value = 0;
      const pan = context.createStereoPanner();
      source.connect(filter).connect(gain).connect(pan).connect(output); source.start();
      return { gain, pan };
    };
    ({ gain: this.marketGain, pan: this.marketPan } = makeBed(310));
    ({ gain: this.tavernGain, pan: this.tavernPan } = makeBed(185));
    this.nextForgeAt = context.currentTime + .4;
    this.nextChimeAt = context.currentTime + 2.2;
    this.nextFootstepAt = context.currentTime + .2;
    window.setInterval(this.tick, 120);
  }

  private spatial(source: TownSoundPoint, radius: number): TownSoundSpatial {
    return townSoundSpatial(this.snapshot.listener, source, radius);
  }

  private tone(source: TownSoundPoint, frequency: number, endFrequency: number, gainValue: number,
    duration: number, wave: OscillatorType = "triangle", delay = 0): void {
    const context = this.context, output = this.output;
    if (!context || !output || !this.snapshot.active) return;
    const spatial = this.spatial(source, 34);
    if (spatial.gain <= .002) return;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator(); oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + duration);
    const envelope = context.createGain(); envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.linearRampToValueAtTime(gainValue * spatial.gain, at + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
    const panner = context.createStereoPanner(); panner.pan.value = spatial.pan;
    oscillator.connect(envelope).connect(panner).connect(output);
    oscillator.start(at); oscillator.stop(at + duration + .02);
  }

  private playVictoryCheer(): void {
    if (!this.context || !this.snapshot.active) return;
    [0, .07, .15, .24, .36].forEach((delay, index) =>
      this.tone(MARKET, 145 + index * 22, 250 + index * 35, .026, .42, index % 2 ? "triangle" : "sine", delay));
  }

  private playGuardCall(): void {
    this.tone({ x: 70, z: 105 }, 196, 247, .02, .24, "triangle");
    this.tone({ x: 70, z: 105 }, 247, 196, .016, .3, "sine", .18);
  }

  private tick = (): void => {
    const context = this.context, output = this.output;
    if (!context || !output || context.state === "closed") return;
    const now = context.currentTime;
    const activeGain = this.snapshot.active ? .18 : 0;
    output.gain.setTargetAtTime(activeGain, now, this.snapshot.active ? .32 : .12);
    const market = this.spatial(MARKET, 31);
    const tavern = this.spatial(TAVERN, 23);
    this.marketGain?.gain.setTargetAtTime(this.snapshot.active ? market.gain * .08 : 0, now, .3);
    this.marketPan?.pan.setTargetAtTime(market.pan, now, .18);
    this.tavernGain?.gain.setTargetAtTime(this.snapshot.active ? tavern.gain * .065 : 0, now, .3);
    this.tavernPan?.pan.setTargetAtTime(tavern.pan, now, .18);
    if (!this.snapshot.active) {
      this.nextForgeAt = now + .5; this.nextChimeAt = now + 1.5; this.nextFootstepAt = now + .2;
      return;
    }
    if (now >= this.nextForgeAt) {
      this.tone(FORGE, 720, 190, .045, .1, "triangle");
      this.tone(FORGE, 105, 48, .055, .16, "sine", .012);
      this.nextForgeAt = now + 1.75 + Math.random() * 1.45;
    }
    if (now >= this.nextChimeAt) {
      const notes = [659, 784, 988];
      notes.forEach((note, index) => this.tone(SANCTUARY, note, note * .985, .018, .7, "sine", index * .16));
      this.nextChimeAt = now + 7 + Math.random() * 4;
    }
    if (now >= this.nextFootstepAt && this.snapshot.walkers.length > 0) {
      const nearest = [...this.snapshot.walkers].sort((left, right) =>
        townSoundSpatial(this.snapshot.listener, left, 18).gain - townSoundSpatial(this.snapshot.listener, right, 18).gain).at(-1)!;
      this.tone(nearest, 105, 58, .02, .065, "sine");
      this.nextFootstepAt = now + .38 + Math.random() * .16;
    }
  };
}
