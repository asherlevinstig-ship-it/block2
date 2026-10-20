export const PERFORMANCE_LOG_INTERVAL_MS = 2_000;
export const PERFORMANCE_LOG_RETENTION_MS = 10 * 60_000;
export const PERFORMANCE_LOG_MAX_SAMPLES = PERFORMANCE_LOG_RETENTION_MS / PERFORMANCE_LOG_INTERVAL_MS;

export type PerformanceLogSample = {
  at: number;
  frameP50Ms: number;
  frameP95Ms: number;
  fps: number;
  rttMs: number | null;
  inputAckMs: number | null;
  patchesPerSecond: number;
  bytesPerSecond: number;
  serverTickP50Ms: number | null;
  serverTickP95Ms: number | null;
  serverTickMaxMs: number | null;
  serverTickOverBudgetPercent: number | null;
  activeMobs: number | null;
  sleepingMobs: number | null;
  chunkBuildMs: number;
  chunkBuildPeakMs: number;
  chunkQueue: number;
  graphicsMode: string;
  graphicsTier: string;
  withinBudget: boolean;
  engineUpdateMs: number;
  renderMs: number;
  customUpdateMs: number;
  terrainUpdateMs: number;
  sceneDressingMs: number;
  mobPresentationMs: number;
  worldUiMs: number;
  drawCalls: number;
  renderedTriangles: number;
  shadowMapUpdates: number;
  shadowMapMs: number;
  particleMs: number;
  visibleMobs: number;
  fullDetailMobs: number;
  lodMobs: number;
  gpuMs: number | null;
  presentationWaitMs: number;
  longTaskMs: number;
  loafDurationMs: number;
  loafBlockingMs: number;
  loafRenderDelayMs: number;
  loafStyleLayoutMs: number;
  renderScale: number;
  canvasWidth: number;
  canvasHeight: number;
  devicePixelRatio: number;
  documentVisible: boolean;
  windowFocused: boolean;
  appFrameCount: number;
  browserRafCount: number;
  browserRafP50Ms: number;
  browserRafP95Ms: number;
  frameUnder20Ms: number;
  frame20To42Ms: number;
  frame42To58Ms: number;
  frameOver58Ms: number;
  anomalies: string[];
};

export function automaticPerformanceAnomalies(sample: PerformanceLogSample): string[] {
  return [
    sample.frameP95Ms > 50 ? "FRAME_BUDGET" : "",
    sample.renderMs > 20 ? "RENDER_COST" : "",
    sample.gpuMs !== null && sample.gpuMs > 16.7 ? "GPU_COST" : "",
    sample.presentationWaitMs > 40 && sample.appFrameCount > 0
      && (sample.frame42To58Ms + sample.frameOver58Ms) / sample.appFrameCount > .1 ? "PRESENTATION_WAIT" : "",
    sample.longTaskMs > 50 ? "MAIN_THREAD_LONG_TASK" : "",
    sample.loafDurationMs > 50 ? "LONG_ANIMATION_FRAME" : "",
    sample.loafStyleLayoutMs > 12 ? "STYLE_LAYOUT_COST" : "",
    sample.engineUpdateMs > 20 || sample.customUpdateMs > 20 ? "UPDATE_COST" : "",
    sample.terrainUpdateMs > 16.7 ? "TERRAIN_COST" : "",
    sample.sceneDressingMs > 10 ? "SCENE_DRESSING_COST" : "",
    sample.mobPresentationMs > 12 ? "MOB_PRESENTATION_COST" : "",
    sample.worldUiMs > 10 ? "WORLD_UI_COST" : "",
    sample.rttMs !== null && sample.rttMs > 500 ? "NETWORK_RTT" : "",
    sample.inputAckMs !== null && sample.inputAckMs > 500 ? "INPUT_ACK" : "",
    sample.serverTickP95Ms !== null && sample.serverTickP95Ms > 33.3 ? "SERVER_TICK" : "",
    sample.bytesPerSecond > 256 * 1024 ? "TRAFFIC_BURST" : "",
    sample.chunkBuildPeakMs > 16.7 ? "CHUNK_BUILD" : "",
  ].filter(Boolean);
}

export function appendPerformanceSample(
  samples: readonly PerformanceLogSample[],
  sample: PerformanceLogSample,
): PerformanceLogSample[] {
  const cutoff = sample.at - PERFORMANCE_LOG_RETENTION_MS;
  return [...samples.filter(entry => entry.at >= cutoff), sample].slice(-PERFORMANCE_LOG_MAX_SAMPLES);
}

export function parsePerformanceLog(value: string | null, now = Date.now()): PerformanceLogSample[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((sample): sample is PerformanceLogSample => typeof sample === "object" && sample !== null
      && typeof sample.at === "number" && sample.at >= now - PERFORMANCE_LOG_RETENTION_MS)
      .slice(-PERFORMANCE_LOG_MAX_SAMPLES);
  } catch {
    return [];
  }
}

export function formatPerformanceLog(
  samples: readonly PerformanceLogSample[],
  context: { path: string; room: string; userAgent: string },
): string {
  const header = [
    "BLOCKCRAFT PERFORMANCE LOG v6",
    `captured=${new Date().toISOString()}`,
    `path=${context.path}`,
    `room=${context.room}`,
    `browser=${context.userAgent}`,
    `samples=${samples.length} interval=${PERFORMANCE_LOG_INTERVAL_MS}ms retention=${PERFORMANCE_LOG_RETENTION_MS}ms`,
  ];
  return `${header.join("\n")}\n\n${samples.map(sample => JSON.stringify({
    ...sample,
    at: new Date(sample.at).toISOString(),
  })).join("\n") || "No samples captured yet."}`;
}
