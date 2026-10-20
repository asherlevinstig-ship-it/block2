export type GraphicsQualityMode = "auto" | "high" | "medium" | "low";
export type GraphicsQualityTier = Exclude<GraphicsQualityMode, "auto">;

export interface GraphicsQualityProfile {
  shadowResolution: number;
  particleScale: number;
  ambientDetailModulo: number;
  renderScale: number;
}

export const GRAPHICS_QUALITY_PROFILES: Record<GraphicsQualityTier, GraphicsQualityProfile> = {
  high: { shadowResolution: 2048, particleScale: 1, ambientDetailModulo: 13, renderScale: 1 },
  medium: { shadowResolution: 1024, particleScale: .72, ambientDetailModulo: 26, renderScale: .86 },
  low: { shadowResolution: 512, particleScale: .48, ambientDetailModulo: 39, renderScale: .72 },
};

export interface AutoQualityState {
  tier: GraphicsQualityTier;
  slowSamples: number;
  fastSamples: number;
  changedAt: number;
}

export interface AdaptiveResolutionState {
  scale: number;
  slowSamples: number;
  fastSamples: number;
  changedAt: number;
}

export const AUTO_LOW_RENDER_SCALES = [0.72, 0.62, 0.55] as const;

export function advanceAdaptiveResolution(
  state: AdaptiveResolutionState,
  frameP50Ms: number,
  updatePeakMs: number,
  now: number,
): AdaptiveResolutionState {
  const cooldownComplete = now - state.changedAt >= 8_000;
  const index = Math.max(0, AUTO_LOW_RENDER_SCALES.findIndex(scale => Math.abs(scale - state.scale) < .001));
  const pacingSlow = frameP50Ms > 28 && updatePeakMs < 20;
  const pacingFast = frameP50Ms < 20;
  const slowSamples = pacingSlow ? state.slowSamples + 1 : 0;
  const fastSamples = pacingFast ? state.fastSamples + 1 : 0;
  if (cooldownComplete && slowSamples >= 8 && index < AUTO_LOW_RENDER_SCALES.length - 1) {
    return { scale: AUTO_LOW_RENDER_SCALES[index + 1]!, slowSamples: 0, fastSamples: 0, changedAt: now };
  }
  if (cooldownComplete && fastSamples >= 30 && index > 0) {
    return { scale: AUTO_LOW_RENDER_SCALES[index - 1]!, slowSamples: 0, fastSamples: 0, changedAt: now };
  }
  return { ...state, slowSamples, fastSamples };
}

export function parseGraphicsQualityMode(value: string | null): GraphicsQualityMode {
  return value === "high" || value === "medium" || value === "low" ? value : "auto";
}

export function initialAutoQualityTier(coarsePointer: boolean, logicalPixels: number): GraphicsQualityTier {
  if (coarsePointer || logicalPixels >= 2_000_000) return "medium";
  return "high";
}

export function advanceAutoQuality(state: AutoQualityState, frameP95Ms: number, now: number): AutoQualityState {
  const cooldownComplete = now - state.changedAt >= 8_000;
  const slowSamples = frameP95Ms > 38 ? state.slowSamples + 1 : 0;
  const fastSamples = frameP95Ms < 23 ? state.fastSamples + 1 : 0;
  if (cooldownComplete && slowSamples >= 4 && state.tier !== "low") {
    return { tier: state.tier === "high" ? "medium" : "low", slowSamples: 0, fastSamples: 0, changedAt: now };
  }
  if (cooldownComplete && fastSamples >= 24 && state.tier !== "high") {
    return { tier: state.tier === "low" ? "medium" : "high", slowSamples: 0, fastSamples: 0, changedAt: now };
  }
  return { ...state, slowSamples, fastSamples };
}
