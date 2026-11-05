export type TownSpeechTone = "ordinary" | "victory" | "warning" | "service";

export interface TownSocialContext {
  highestFloorCleared: number;
  localPlayerIsMurderer: boolean;
}

export interface TownSocialBeat {
  key: string;
  speakerId: string;
  listenerId?: string;
  speakerName: string;
  line: string;
  tone: TownSpeechTone;
}

const BEAT_MS = 6_000;
const SPOKEN_MS = 4_150;

/** Ambient conversation is deliberately sparse: one readable line at a time,
 * followed by silence. It never enters the popup or notification queues. */
export function townSocialBeat(nowMs: number, context: TownSocialContext): TownSocialBeat | null {
  const beat = Math.floor(Math.max(0, nowMs) / BEAT_MS);
  if (Math.max(0, nowMs) % BEAT_MS >= SPOKEN_MS) return null;
  const slot = beat % 6;
  const suffix = `:${beat}`;
  if (slot === 0) return context.highestFloorCleared > 0 ? {
    key: `victory-gossip${suffix}`, speakerId: "plaza-patron-a", listenerId: "plaza-patron-b", speakerName: "Milo",
    line: `The Chronicle says Floor ${context.highestFloorCleared}. I heard the bell from the market.`, tone: "victory",
  } : {
    key: `tower-rumour${suffix}`, speakerId: "plaza-patron-a", listenerId: "plaza-patron-b", speakerName: "Milo",
    line: "Do you think anyone in Town will clear the first floor?", tone: "ordinary",
  };
  if (slot === 1) return {
    key: `patron-answer${suffix}`, speakerId: "plaza-patron-b", listenerId: "plaza-patron-a", speakerName: "Nessa",
    line: context.highestFloorCleared > 0 ? "They came back alive. That matters more than the trophy." : "Someone will. The tower cannot stay silent forever.",
    tone: context.highestFloorCleared > 0 ? "victory" : "ordinary",
  };
  if (slot === 2) return context.localPlayerIsMurderer ? {
    key: `warden-warning${suffix}`, speakerId: "north-warden", speakerName: "North Warden",
    line: "Red name. This Town is protected—keep your weapon lowered.", tone: "warning",
  } : {
    key: `warden-shift${suffix}`, speakerId: "north-warden", listenerId: "south-warden", speakerName: "North Warden",
    line: "North watch clear. South watch, take the next circuit.", tone: "ordinary",
  };
  if (slot === 3) return {
    key: `sanctuary-care${suffix}`, speakerId: "healer-lyra", listenerId: "sanctuary-visitor", speakerName: "Lyra",
    line: context.highestFloorCleared > 0 ? "The bell is joyful. The wounds returning with it are not." : "Slow breaths. You do not need to prove anything inside these walls.",
    tone: "service",
  };
  if (slot === 4) return {
    key: `forge-delivery${suffix}`, speakerId: "smith-brom", listenerId: "forge-runner", speakerName: "Brom",
    line: context.highestFloorCleared > 0 ? "Put the tower fragments by the anvil. Not beside the coal." : "Ore on the left. Finished steel on the right. Mind the sparks.",
    tone: "service",
  };
  return context.localPlayerIsMurderer ? {
    key: `south-warning${suffix}`, speakerId: "south-warden", speakerName: "South Warden",
    line: "The skull beside your name lasts longer than your excuses.", tone: "warning",
  } : {
    key: `market-close${suffix}`, speakerId: "south-market-keeper", speakerName: "Market Keeper",
    line: context.highestFloorCleared > 0 ? "Victory ribbons are half price until sunset!" : "Fresh rations for the first ascent!", tone: "ordinary",
  };
}
