import * as pc from "playcanvas";

const CHAIR_URL = "/assets/kaykit-dungeon/chair.gltf.glb";
const BARRELS_URL = "/assets/kaykit-dungeon/barrel_small_stack.gltf.glb";

function material(color: pc.Color, emissive?: pc.Color): pc.StandardMaterial {
  const result = new pc.StandardMaterial();
  result.diffuse = color;
  if (emissive) result.emissive = emissive;
  result.gloss = .22;
  result.update();
  return result;
}

function box(parent: pc.Entity, name: string, mat: pc.Material, scale: [number, number, number], position: [number, number, number]): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "box", castShadows: true, receiveShadows: true });
  if (entity.render) entity.render.material = mat;
  entity.setLocalScale(...scale); entity.setLocalPosition(...position); parent.addChild(entity);
  return entity;
}

function cylinder(parent: pc.Entity, name: string, mat: pc.Material, scale: [number, number, number], position: [number, number, number]): pc.Entity {
  const entity = new pc.Entity(name);
  entity.addComponent("render", { type: "cylinder", castShadows: true, receiveShadows: true });
  if (entity.render) entity.render.material = mat;
  entity.setLocalScale(...scale); entity.setLocalPosition(...position); parent.addChild(entity);
  return entity;
}

function loadProp(app: pc.Application, url: string, parent: pc.Entity, placements: { position: [number, number, number]; yaw?: number; scale?: number }[]): void {
  app.assets.loadFromUrl(url, "container", (error, asset) => {
    const resource = asset?.resource as pc.ContainerResource | undefined;
    if (error || !resource) { console.warn(`[tavern-assets] Could not load ${url}; authored furniture remains.`, error); return; }
    for (const placement of placements) {
      const entity = resource.instantiateRenderEntity({ castShadows: true, receiveShadows: true });
      entity.setLocalPosition(...placement.position);
      entity.setLocalEulerAngles(0, placement.yaw ?? 0, 0);
      entity.setLocalScale(placement.scale ?? 1, placement.scale ?? 1, placement.scale ?? 1);
      parent.addChild(entity);
    }
  });
}

/** Asset-backed first pass for the dedicated Hearth & Hammer room. */
export function createTavernRoom(app: pc.Application): pc.Entity {
  const root = new pc.Entity("hearth-and-hammer-room"); app.root.addChild(root);
  const oak = material(new pc.Color(.22, .105, .035));
  const oakLight = material(new pc.Color(.38, .19, .07));
  const plaster = material(new pc.Color(.56, .42, .25));
  const stone = material(new pc.Color(.25, .26, .24));
  const iron = material(new pc.Color(.08, .095, .09));
  const rug = material(new pc.Color(.38, .055, .035));
  const gold = material(new pc.Color(.74, .43, .08));
  const fire = material(new pc.Color(1, .3, .03), new pc.Color(1, .12, .005));

  box(root, "timber-floor", oakLight, [19.5, .22, 16.5], [0, 7.88, 0]);
  for (let x = -8; x <= 8; x += 2) box(root, "floor-board-seam", oak, [.035, .025, 16], [x, 8.005, 0]);
  box(root, "back-wall", plaster, [19.5, 5.2, .35], [0, 10.5, -8.15]);
  box(root, "left-wall", plaster, [.35, 5.2, 16.5], [-9.65, 10.5, 0]);
  box(root, "right-wall", plaster, [.35, 5.2, 16.5], [9.65, 10.5, 0]);
  box(root, "front-wall-left", plaster, [8.25, 5.2, .35], [-5.55, 10.5, 8.15]);
  box(root, "front-wall-right", plaster, [8.25, 5.2, .35], [5.55, 10.5, 8.15]);
  box(root, "ceiling", oak, [19.5, .28, 16.5], [0, 13.18, 0]);
  for (let z = -6.5; z <= 6.5; z += 3.25) box(root, "ceiling-rafter", oakLight, [19.8, .34, .38], [0, 12.72, z]);
  for (const x of [-9.25, 9.25]) for (const z of [-7.75, -2.6, 2.6, 7.75])
    box(root, "wall-post", oak, [.42, 5.1, .42], [x, 10.5, z]);

  // Bar and kitchen zone.
  box(root, "bar-front", oak, [8.2, 1.25, .7], [-4.65, 8.62, -4.7]);
  box(root, "bar-top", oakLight, [8.75, .18, 1.15], [-4.65, 9.32, -4.7]);
  for (const x of [-7.5, -5.6, -3.7, -1.8]) cylinder(root, "bar-stool", oakLight, [.72, .22, .72], [x, 8.78, -3.15]);
  for (const x of [-7.8, -5.7, -3.6, -1.5]) {
    box(root, "bottle-shelf", oakLight, [1.25, .12, .35], [x, 10.1, -7.72]);
    cylinder(root, "bottle", x % 2 ? rug : gold, [.12, .42, .12], [x, 10.38, -7.65]);
  }

  // Hearth and warm social centre.
  box(root, "hearth-base", stone, [3.8, .45, 1.6], [5.9, 8.2, -6.7]);
  box(root, "hearth-back", stone, [3.8, 3.3, .5], [5.9, 9.65, -7.75]);
  box(root, "hearth-opening", iron, [2.25, 1.55, .18], [5.9, 9.05, -7.45]);
  box(root, "hearth-fire", fire, [1.55, .65, .28], [5.9, 8.62, -7.28]);
  const hearthLight = new pc.Entity("hearth-light");
  hearthLight.addComponent("light", { type: "omni", color: new pc.Color(1, .46, .16), intensity: 2.4, range: 12, castShadows: false });
  hearthLight.setLocalPosition(5.9, 9.25, -6.4); root.addChild(hearthLight);

  // Dining and Double-or-Quit table.
  const tables: [number, number][] = [[3.6, -1.4], [6.4, 2.4], [1.4, 4.2]];
  for (const [x, z] of tables) {
    cylinder(root, "round-table", oakLight, [1.75, .16, 1.75], [x, 9.0, z]);
    cylinder(root, "table-leg", oak, [.3, .95, .3], [x, 8.48, z]);
  }
  box(root, "quiz-rug", rug, [4.1, .035, 3.25], [3.6, 8.02, -1.4]);
  box(root, "quiz-inlay", gold, [2.6, .045, .12], [3.6, 8.045, -1.4]);

  // Mara gets a clear authored station until the character asset is attached.
  cylinder(root, "mara-body", rug, [.55, 1.15, .55], [-4.6, 9.5, -6]);
  cylinder(root, "mara-head", gold, [.42, .42, .42], [-4.6, 10.75, -6]);

  loadProp(app, CHAIR_URL, root, [
    { position: [2.2, 8.02, -1.4], yaw: 90 }, { position: [5, 8.02, -1.4], yaw: -90 },
    { position: [6.4, 8.02, .95] }, { position: [6.4, 8.02, 3.85], yaw: 180 },
    { position: [.05, 8.02, 4.2], yaw: 90 }, { position: [2.75, 8.02, 4.2], yaw: -90 },
  ]);
  loadProp(app, BARRELS_URL, root, [{ position: [-8.2, 8.02, -6.55], yaw: 20 }, { position: [-7.75, 8.02, 5.9], yaw: -15 }]);

  const fill = new pc.Entity("tavern-fill-light");
  fill.addComponent("light", { type: "omni", color: new pc.Color(1, .72, .43), intensity: 1.35, range: 28, castShadows: false });
  fill.setLocalPosition(0, 11.6, 0); root.addChild(fill);
  return root;
}
