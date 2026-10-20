type MinimapApi = ReturnType<typeof import("./minimap.js").createMinimap>;
type MinimapMethod = keyof MinimapApi;

export function createLazyMinimap(
  canvas: HTMLCanvasElement,
  detail: HTMLElement,
  storageKey: string,
  onRegionDiscovered?: (name: string) => void,
  onLandmarkDiscovered?: (name: string) => void,
): MinimapApi {
  let actual: MinimapApi | null = null;
  let loading: Promise<MinimapApi> | null = null;
  let latestUpdate: unknown[] | null = null;
  const pendingCalls: Array<{ method: MinimapMethod; args: unknown[] }> = [];
  detail.textContent = "Map ready when opened";

  const load = () => {
    if (actual) return Promise.resolve(actual);
    if (loading) return loading;
    detail.textContent = "Loading map…";
    loading = import("./minimap.js").then(({ createMinimap }) => {
      actual = createMinimap(canvas, detail, storageKey, onRegionDiscovered, onLandmarkDiscovered);
      for (const call of pendingCalls.splice(0)) {
        const method = actual[call.method] as (...args: unknown[]) => unknown;
        Reflect.apply(method, actual, call.args);
      }
      if (latestUpdate) {
        Reflect.apply(actual.update as (...args: unknown[]) => unknown, actual, latestUpdate);
        latestUpdate = null;
      }
      return actual;
    });
    return loading;
  };

  const invoke = (method: MinimapMethod, args: unknown[]): unknown => {
    if (actual) return Reflect.apply(actual[method] as (...values: unknown[]) => unknown, actual, args);
    if (method === "update") {
      latestUpdate = args;
      if (args[3] === true) void load();
      return undefined;
    }
    if (method === "activeSurfaceRoute") return [];
    if (method === "surfaceGuideEnabled") return false;
    pendingCalls.push({ method, args });
    if (pendingCalls.length > 512) pendingCalls.shift();
    if (method === "guideTo") void load();
    return undefined;
  };

  return new Proxy({} as MinimapApi, {
    get: (_target, property) => (...args: unknown[]) => invoke(property as MinimapMethod, args),
  });
}
