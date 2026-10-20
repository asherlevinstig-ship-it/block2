import type * as pc from "playcanvas";

type SceneDressingApi = import("./scene-dressing.js").SceneDressing;
type RebuildArgs = Parameters<SceneDressingApi["rebuild"]>;
type RoadsideArgs = Parameters<SceneDressingApi["setRoadsideEncounterState"]>;

export class LazySceneDressing {
  private actual: SceneDressingApi | null = null;
  private loading: Promise<SceneDressingApi> | null = null;
  private latestRebuild: RebuildArgs | null = null;
  private surfaceVisible = true;
  private ambientDetailModulo = 13;
  private roadsideStates = new Map<string, RoadsideArgs>();

  constructor(private readonly app: pc.Application) {}

  private load(): Promise<SceneDressingApi> {
    if (this.actual) return Promise.resolve(this.actual);
    if (this.loading) return this.loading;
    this.loading = import("./scene-dressing.js").then(({ SceneDressing }) => {
      const actual = new SceneDressing(this.app);
      this.actual = actual;
      actual.setAmbientDetailModulo(this.ambientDetailModulo);
      if (this.latestRebuild) actual.rebuild(...this.latestRebuild);
      actual.setSurfaceVisible(this.surfaceVisible);
      for (const args of this.roadsideStates.values()) actual.setRoadsideEncounterState(...args);
      return actual;
    });
    return this.loading;
  }

  rebuild(...args: RebuildArgs): void {
    this.latestRebuild = args;
    if (this.actual) this.actual.rebuild(...args);
    else void this.load();
  }

  setSurfaceVisible(visible: boolean): void {
    this.surfaceVisible = visible;
    this.actual?.setSurfaceVisible(visible);
  }

  setAmbientDetailModulo(modulo: number): void {
    this.ambientDetailModulo = modulo;
    this.actual?.setAmbientDetailModulo(modulo);
  }

  get keeperVisible(): boolean { return this.actual?.keeperVisible ?? false; }
  get blacksmithVisible(): boolean { return this.actual?.blacksmithVisible ?? false; }
  update(timeMilliseconds: number): void { this.actual?.update(timeMilliseconds); }

  activateRealmWardenVictory(now: number): void {
    if (this.actual) this.actual.activateRealmWardenVictory(now);
    else void this.load().then(actual => actual.activateRealmWardenVictory(now));
  }

  setRoadsideEncounterState(...args: RoadsideArgs): void {
    this.roadsideStates.set(args[0], args);
    this.actual?.setRoadsideEncounterState(...args);
  }
}
