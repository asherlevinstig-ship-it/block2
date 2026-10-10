import { isEquipmentItem, type ForestPortal, type ItemId, type WorldObjectiveUpdate } from "@blockcraft/protocol";
import { WILDERNESS_EVENT_ID, WILDERNESS_EVENT_POSITION } from "./wilderness-event.js";
import { MIXED_FRONTIER_IDS } from "./wilderness-encounters.js";
import { FOREST_DUNGEON_MOBS, isInForestDungeon, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_SAFE_RADIUS, TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
type Pose = { x: number; y: number; z: number };
type Mob = Pose & { alive: boolean; name: string; difficultyTier: number; combatState: string; targetId: string };
type Player = Pose & { health: number; inventory: { get(id: string): { quantity: number } | undefined } };
type Loot = Pose & { ownerId: string; itemId: string; expiresAt: number };
export interface WorldObjectiveProgress { id: string | null; fingerprint: string }
export const createObjectiveProgress = (): WorldObjectiveProgress => ({ id: null, fingerprint: "" });
const GROUPS = [
  { id: "frontier-mixed", title: "Frontier Warband", detail: "Draw out the crawler, dodge the brute's rocks, then pressure the support spitter. Counter during recovery.", ids: [...MIXED_FRONTIER_IDS] },
  { id: "greenwood-event", title: "Venom Matriarch · Shared Event", detail: "Dodge aimed shots and fan gaps. Fight together: eligible contributors each receive personal equipment.", ids: [WILDERNESS_EVENT_ID] },
  { id: "greenwood", title: "Greenwood Crawler Camp", detail: "Clear the nearby crawlers and collect their item drops.", ids: ["wild-crawler", "greenwood-briar", "greenwood-briar-north"] },
  { id: "silver-guards", title: "Silver Guard Clearing", detail: "Defeat both spitters to open the Forest Dungeon portal. Use the stone cover.", ids: ["cave-spitter", "frontier-spitter"] },
  { id: "stone-clearing", title: "Stone Brute Clearing", detail: "Dodge the marked slam, then counter during recovery.", ids: ["stone-brute"] },
  { id: "frontier-ruins", title: "Frontier Brute Ruins", detail: "Sidestep the smash and leave the slam circle. Collect the hammer and rich silver.", ids: ["frontier-brute"] },
  ...[1, 2, 3].map(stage => ({ id: `forest-stage-${stage}`, title: stage === 3 ? "Ancient Root Guardian" : `Forest Dungeon · Room ${stage}`,
    detail: stage === 3 ? "Defeat the guardian, collect your equipment bag, then use the return portal." : "Clear this room to open the next gate. The entrance return portal stays available.",
    ids: FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage).map(mob => mob.id) })),
];
export function nearbyObjective(playerId: string, player: Player, mobEntries: Iterable<readonly [string, Mob]>, portalEntries: Iterable<readonly [string, ForestPortal]>, lootEntries: Iterable<readonly [string, Loot]>, now: number, previousId: string | null, eventWarningUntil = 0): WorldObjectiveUpdate {
  const distance = (point: Pose) => Math.hypot(point.x - player.x, point.z - player.z);
  const sameFloor = (point: Pose) => Math.abs(point.y - player.y) <= 2.5;
  const make = (id: string, title: string, detail: string, point: Pose, kind: WorldObjectiveUpdate["kind"], tier = 0): WorldObjectiveUpdate => ({
    objectiveId: id, title, detail, kind, tier, showMarker: true, targetMobId: "", targetMobIds: [], completedMobIds: [], targetX: point.x, targetY: point.y, targetZ: point.z,
  });
  if (player.health <= 0) return { ...make("defeated", "Return to Town", "Use Return to Town to recover. Your dropped items remain in your recovery bag.", player, "hub"), showMarker: false };
  if (Math.hypot(player.x - TOWN_CENTER_X, player.z - TOWN_CENTER_Z) <= TOWN_SAFE_RADIUS && sameFloor({ x: 0, y: 8, z: 0 })) {
    const minerals = (player.inventory.get("iron_ore")?.quantity ?? 0) + (player.inventory.get("silver_ore")?.quantity ?? 0);
    return minerals > 0 ? make("blacksmith", "Trade Your Minerals", "Take your minerals to the blacksmith and press E to trade them for gold.", TOWN_BLACKSMITH_STALL_POSITION, "hub")
      : make("leave-town", "Explore the Wilderness", "Leave through the east gate. Nearby encounters will become your objective as you explore.", { x: 30.5, y: 8, z: 8.5 }, "hub");
  }
  const mobs = new Map(mobEntries), dungeon = isInForestDungeon(player.x, player.z);
  const groups = [...GROUPS, ...[...mobs].filter(([id]) => !GROUPS.some(group => group.ids.includes(id))).map(([id, mob]) => ({ id: `mob-${id}`, title: mob.name, detail: "Defeat this nearby enemy and collect your item drops.", ids: [id] }))];
  const candidates = groups.flatMap(group => {
    const living = group.ids.flatMap(id => { const mob = mobs.get(id); return mob?.alive && sameFloor(mob) && isInForestDungeon(mob.x, mob.z) === dungeon ? [{ id, mob }] : []; }).sort((a, b) => distance(a.mob) - distance(b.mob));
    const target = living[0]; if (!target || distance(target.mob) > (group.id === previousId ? 32 : dungeon ? 48 : 26)) return [];
    const update = make(group.id, group.title, group.detail, target.mob, "encounter", target.mob.difficultyTier);
    update.targetMobId = target.id; update.targetMobIds = group.ids.filter(id => mobs.has(id)); update.completedMobIds = group.ids.filter(id => mobs.get(id)?.alive === false);
    return [{ update, distance: distance(target.mob), engaged: living.some(({ mob }) => mob.targetId === playerId || mob.combatState !== "idle" && distance(mob) <= 8) }];
  }).sort((a, b) => a.distance - b.distance);
  const activeFight = candidates.find(candidate => candidate.engaged && candidate.update.objectiveId === previousId) ?? candidates.find(candidate => candidate.engaged);
  if (activeFight) return activeFight.update;
  if (eventWarningUntil > now && sameFloor(WILDERNESS_EVENT_POSITION) && distance(WILDERNESS_EVENT_POSITION) <= 26)
    return make("greenwood-event-warning", `Venom Matriarch · ${Math.ceil((eventWarningUntil - now) / 1000)}s`, "Shared event incoming at the cleared camp. Gather nearby and prepare to dodge.", WILDERNESS_EVENT_POSITION, "encounter", 1);
  const event = candidates.find(candidate => candidate.update.objectiveId === "greenwood-event");
  if (event) return event.update;
  const loot = [...lootEntries].filter(([, drop]) => (!drop.ownerId || drop.ownerId === playerId) && now < drop.expiresAt && sameFloor(drop) && distance(drop) <= 6 && isEquipmentItem(drop.itemId as ItemId)).sort((a, b) => distance(a[1]) - distance(b[1]))[0];
  if (loot) return make(`loot-${loot[0]}`, "Collect Your Loot", "Approach your equipment bag and press E to inspect or equip the item.", loot[1], "loot");
  const portal = [...portalEntries].filter(([, point]) => (point.expiresAt === 0 || now < point.expiresAt) && sameFloor(point) && distance(point) <= 18
    && (!dungeon ? point.kind === "entry" : point.kind === "return" && candidates.length === 0)).sort((a, b) => distance(a[1]) - distance(b[1]))[0];
  if (portal) return make(`portal-${portal[0]}`, dungeon ? "Return to the Wilderness" : "Enter the Forest Dungeon", "Approach the glowing portal and press E to travel.", portal[1], "portal");
  const nearest = candidates[0], previous = candidates.find(candidate => candidate.update.objectiveId === previousId);
  if (nearest) return previous && previous.distance <= nearest.distance + 4 ? previous.update : nearest.update;
  return { ...make("explore", "Explore the Wilderness", "Move toward nearby encounters. Your objective changes with your surroundings.", player, "explore"), showMarker: false };
}
