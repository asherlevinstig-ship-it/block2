import * as pc from "playcanvas";

export const TOWER_CHRONICLE_MONUMENT_URL =
  "/assets/quaternius-wooden-monument/wooden-monument.glb";

export const TOWER_CHRONICLE_MONUMENT_PLACEMENT = {
  position: [67, 8.69, 106] as const,
  yaw: 45,
  scale: 4.55,
} as const;

export function loadTowerChronicleMonument(
  app: pc.Application,
  parent: pc.Entity,
): Promise<pc.Entity> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(TOWER_CHRONICLE_MONUMENT_URL, "container", (error, asset) => {
      const resource = asset?.resource as pc.ContainerResource | undefined;
      if (error || !resource) {
        reject(error ?? new Error("Tower Chronicle monument did not return a container asset."));
        return;
      }
      const monument = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
      monument.name = "tower-chronicle-authored-monument";
      monument.setLocalPosition(...TOWER_CHRONICLE_MONUMENT_PLACEMENT.position);
      monument.setLocalEulerAngles(0, TOWER_CHRONICLE_MONUMENT_PLACEMENT.yaw, 0);
      monument.setLocalScale(
        TOWER_CHRONICLE_MONUMENT_PLACEMENT.scale,
        TOWER_CHRONICLE_MONUMENT_PLACEMENT.scale,
        TOWER_CHRONICLE_MONUMENT_PLACEMENT.scale,
      );
      parent.addChild(monument);
      resolve(monument);
    });
  });
}
