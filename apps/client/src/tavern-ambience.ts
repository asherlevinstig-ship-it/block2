type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/** Low-cost procedural room tone: hearth crackle, distant conversation and a
 * sparse two-note lute-like pulse. It starts only after a player gesture so it
 * respects browser autoplay rules. */
export class TavernAmbience {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private started = false;
  private nextCrackleAt = 0;
  private nextMusicAt = 0;

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
    output.gain.value = .12;
    output.connect(context.destination);

    const seconds = 3;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < data.length; index++) {
      brown = (brown + (Math.random() * 2 - 1) * .035) * .985;
      data[index] = brown;
    }
    const murmur = context.createBufferSource(); murmur.buffer = buffer; murmur.loop = true;
    const low = context.createBiquadFilter(); low.type = "lowpass"; low.frequency.value = 210;
    const murmurGain = context.createGain(); murmurGain.gain.value = .065;
    murmur.connect(low).connect(murmurGain).connect(output); murmur.start();
    this.nextCrackleAt = context.currentTime + .2;
    this.nextMusicAt = context.currentTime + 1.5;
    this.tick();
  }

  private tick = (): void => {
    const context = this.context, output = this.output;
    if (!context || !output || context.state === "closed") return;
    const horizon = context.currentTime + .35;
    while (this.nextCrackleAt < horizon) {
      const oscillator = context.createOscillator(); oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(95 + Math.random() * 90, this.nextCrackleAt);
      oscillator.frequency.exponentialRampToValueAtTime(35, this.nextCrackleAt + .045);
      const gain = context.createGain(); gain.gain.setValueAtTime(.025 + Math.random() * .025, this.nextCrackleAt);
      gain.gain.exponentialRampToValueAtTime(.0001, this.nextCrackleAt + .055);
      oscillator.connect(gain).connect(output); oscillator.start(this.nextCrackleAt); oscillator.stop(this.nextCrackleAt + .06);
      this.nextCrackleAt += .11 + Math.random() * .42;
    }
    while (this.nextMusicAt < horizon) {
      const notes = [146.83, 220, 174.61, 220];
      notes.forEach((frequency, index) => {
        const at = this.nextMusicAt + index * .52;
        const oscillator = context.createOscillator(); oscillator.type = "triangle"; oscillator.frequency.value = frequency;
        const gain = context.createGain(); gain.gain.setValueAtTime(.0001, at);
        gain.gain.linearRampToValueAtTime(.025, at + .025);
        gain.gain.exponentialRampToValueAtTime(.0001, at + .7);
        oscillator.connect(gain).connect(output); oscillator.start(at); oscillator.stop(at + .75);
      });
      this.nextMusicAt += 8.5;
    }
    window.setTimeout(this.tick, 180);
  };
}
