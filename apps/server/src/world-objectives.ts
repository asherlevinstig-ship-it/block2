import { isEquipmentItem, worldLevelRange, type ForestPortal, type ItemId, type WorldObjectiveUpdate } from "@blockcraft/protocol";
import { WILDERNESS_EVENT_ID, WILDERNESS_EVENT_POSITION } from "./wilderness-event.js";
import { MIXED_FRONTIER_IDS } from "./wilderness-encounters.js";
import { FOREST_DUNGEON_MOBS, isInForestDungeon, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_SAFE_RADIUS, TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
type Pose = { x: number; y: number; z: number };
type Mob = Pose & { alive: boolean; name: string; difficultyTier: number; level?: number; combatState: string; targetId: string };
type Player = Pose & { health: number; miningExpeditionStage?: number; silverDepthsStage?: number; inventory: { get(id: string): { quantity: number } | undefined } };
type Loot = Pose & { ownerId: string; itemId: string; expiresAt: number };
export interface WorldObjectiveProgress { id: string | null; fingerprint: string }
export const createObjectiveProgress = (): WorldObjectiveProgress => ({ id: null, fingerprint: "" });
const GROUPS = [
  { id: "buried-vault", title: "Breach the Buried Vault", detail: "Mine through the silver seal. Defeat the Vault Crawler and Stone Warden, then claim your personal Miner's Lantern cache.", ids: ["buried-vault-crawler", "buried-chamber-brute"] },
  { id: "frontier-mixed", title: "Frontier Warband", detail: "Draw out the crawler, dodge the brute's rocks, then pressure the support spitter. Counter during recovery.", ids: [...MIXED_FRONTIER_IDS] },
  { id: "greenwood-event", title: "Venom Matriarch · Shared Event", detail: "Dodge aimed shots and fan gaps. Fight together: eligible contributors each receive personal equipment.", ids: [WILDERNESS_EVENT_ID] },
  { id: "greenwood", title: "Greenwood Crawler Camp", detail: "Follow the dirt road, clear the three root nests, collect crawler items, then mine the exposed iron seam east of the camp.", ids: ["wild-crawler", "greenwood-briar", "greenwood-briar-north"] },
  { id: "silver-guards", title: "Silver Guard Clearing", detail: "Dodge aimed shots and fan gaps using the stone cover. Collect a focus and potion, mine silver, and clear both guards to open the Forest Dungeon portal.", ids: ["cave-spitter", "frontier-spitter"] },
  { id: "stone-clearing", title: "Stone Brute Clearing", detail: "Dodge the marked slam, then counter during recovery.", ids: ["stone-brute"] },
  { id: "frontier-ruins", title: "Frontier Brute Ruins", detail: "Use broken pillars against rock volleys, leave the slam circle, then counter during recovery. Collect the hammer and rich silver.", ids: ["frontier-brute"] },
  ...[1, 2, 3].map(stage => ({ id: `forest-stage-${stage}`, title: stage === 3 ? "Ancient Root Guardian" : `Forest Dungeon · Room ${stage}`,
    detail: stage === 3 ? "Use roots against phase-one rock volleys. Below half health, sidestep committed charges and counter during recovery. Collect your equipment bag, then return."
      : stage === 2 ? "Use stone cover and dodge alternating aimed shots and fan gaps to open the guardian gate."
      : "Split the flanking crawlers around the root piles to open the next gate. The entrance return portal remains available.",
    ids: FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage).map(mob => mob.id) })),
];
export function nearbyObjective(playerId: string, player: Player, mobEntries: Iterable<readonly [string, Mob]>, portalEntries: Iterable<readonly [string, ForestPortal]>, lootEntries: Iterable<readonly [string, Loot]>, now: number, previousId: string | null, eventWarningUntil = 0): WorldObjectiveUpdate {
  const distance = (point: Pose) => Math.hypot(point.x - player.x, point.z - player.z);
  const sameFloor = (point: Pose) => Math.abs(point.y - player.y) <= 2.5;
  const make = (id: string, title: string, detail: string, point: Pose, kind: WorldObjectiveUpdate["kind"], tier = 0): WorldObjectiveUpdate => ({
    objectiveId: id, title, detail, kind, tier, recommendedLevel: kind === "hub" ? "SAFE" : worldLevelRange(tier).label,
    showMarker: true, targetMobId: "", targetMobIds: [], completedMobIds: [], targetX: point.x, targetY: point.y, targetZ: point.z,
  });
  if (player.health <= 0) return { ...make("defeated", "Return to Town", "Use Return to Town to recover. Your dropped items remain in your recovery bag.", player, "hub"), showMarker: false };
  const mobs = new Map(mobEntries);
  const expeditionStage = player.miningExpeditionStage ?? 8;
  const expedition = (update: WorldObjectiveUpdate, step: number): WorldObjectiveUpdate => ({ ...update, recommendedLevel: "LV 1–4", progressLabel: `STEP ${step} / 8` });
  if (expeditionStage === 0) return expedition(make("expedition-briefing", "Speak to the Blacksmith", "Visit the blacksmith stall and press E to receive your first mining expedition.", TOWN_BLACKSMITH_STALL_POSITION, "hub"), 1);
  if (expeditionStage === 1) return expedition(make("expedition-enter-mine", "Enter the East Ore Mine", "Leave through the east gate and descend beneath the gold mine gateway.", { x: 34.5, y: 3, z: 8.5 }, "explore"), 2);
  if (expeditionStage === 2) return expedition(make("expedition-iron", "Mine Iron Ore", "Find and mine an iron block in the first underground chamber.", { x: 39.5, y: 3, z: 6.5 }, "explore"), 3);
  if (expeditionStage === 3) return expedition(make("expedition-silver", "Mine Silver Ore", "Push deeper, defeat or evade the chamber spitter, and mine a silver block.", { x: 48.5, y: 1, z: 10.5 }, "explore", 2), 4);
  if (expeditionStage === 4) return expedition(make("expedition-breach", "Breach the Buried Vault", "Mine through the silver seal at the eastern wall of the deep chamber.", { x: 52.5, y: 1.5, z: 8.5 }, "explore", 3), 5);
  if (expeditionStage === 5) {
    const ids = ["buried-vault-crawler", "buried-chamber-brute"];
    const living = ids.flatMap(id => { const mob = mobs.get(id); return mob?.alive ? [{ id, mob }] : []; });
    const target = living[0] ?? { id: "buried-chamber-brute", mob: mobs.get("buried-chamber-brute") ?? { x: 56.5, y: 1, z: 9.5 } };
    const update = make("expedition-warden", "Defeat the Stone Warden", "Clear the Vault Crawler, then dodge the Warden's committed strike and counter during recovery.", target.mob, "encounter", 3);
    update.targetMobId = target.id; update.targetMobIds = ids; update.completedMobIds = ids.filter(id => mobs.get(id)?.alive === false);
    return expedition(update, 6);
  }
  if (expeditionStage === 6) {
    const cache = [...lootEntries].find(([, drop]) => drop.ownerId === playerId && drop.itemId === "miners_lantern" && now < drop.expiresAt);
    return expedition(cache
      ? make(`loot-${cache[0]}`, "Claim the Miner's Lantern", "Approach your personal vault cache and press E to claim its fixed reward.", cache[1], "loot")
      : make("expedition-recover-lantern", "Recover the Miner's Lantern", "Your personal cache is inside the vault. If it expired, defeat the Stone Warden again.", mobs.get("buried-chamber-brute") ?? { x: 56.5, y: 1, z: 9.5 }, "encounter", 3), 7);
  }
  if (expeditionStage === 7) return expedition(make("expedition-return", "Return to the Blacksmith", "Bring the Miner's Lantern back to town and press E at the blacksmith stall to complete the expedition.", TOWN_BLACKSMITH_STALL_POSITION, "hub"), 8);
  const depthsStage = player.silverDepthsStage ?? 0;
  const depthsUnlocked = depthsStage > 0 || (player.inventory.get("miners_lantern")?.quantity ?? 0) > 0;
  const depths = (update: WorldObjectiveUpdate, step: number): WorldObjectiveUpdate => ({ ...update, recommendedLevel: "LV 7–12", progressLabel: `SILVER DEPTHS · STEP ${step} / 7` });
  if (depthsUnlocked && depthsStage === 0) return depths(make("depths-briefing", "Speak to the Blacksmith", "Your first expedition is complete. Return to the blacksmith to unlock The Silver Depths.", TOWN_BLACKSMITH_STALL_POSITION, "hub"), 1);
  if (depthsUnlocked && depthsStage === 1) return depths(make("depths-enter", "Follow the Lantern Route", "Pass through the eastern wall of the buried vault. Your Miner's Lantern reveals the route into the Silver Depths.", { x: 61.5, y: 1, z: 9.5 }, "explore", 3), 2);
  if (depthsUnlocked && depthsStage === 2) return depths(make("depths-moonstone", "Mine the Moonstone Seal", "Mine one glowing Moonstone block from the seal dividing the gallery and Matriarch arena.", { x: 68.5, y: 1, z: 9.5 }, "explore", 3), 3);
  if (depthsUnlocked && depthsStage === 3) {
    const ids = ["silver-depths-spitter-a", "silver-depths-spitter-b"];
    const living = ids.flatMap(id => { const mob = mobs.get(id); return mob?.alive ? [{ id, mob }] : []; });
    const target = living[0] ?? { id: ids[0]!, mob: { x: 65.5, y: 1, z: 9.5 } };
    const update = make("depths-gallery", "Clear the Spitter Gallery", "Use the stone gaps to split overlapping aimed shots and fans. Defeat both Moonstone Spitters.", target.mob, "encounter", 3);
    update.targetMobId = target.id; update.targetMobIds = ids; update.completedMobIds = ids.filter(id => mobs.get(id)?.alive === false);
    return depths(update, 4);
  }
  if (depthsUnlocked && depthsStage === 4) {
    const boss = mobs.get("crystal-matriarch") ?? { x: 72.5, y: 1, z: 9.5 };
    const update = make("depths-matriarch", "Defeat the Crystal Matriarch", "Read the committed aimed shot, cross her fan gaps, and punish recovery. Below half health she fires two-phase fans.", boss, "encounter", 3);
    update.targetMobId = "crystal-matriarch"; update.targetMobIds = ["crystal-matriarch"];
    return depths(update, 5);
  }
  if (depthsUnlocked && depthsStage === 5) {
    const cache = [...lootEntries].find(([, drop]) => drop.ownerId === playerId && drop.itemId === "moonstone" && now < drop.expiresAt);
    return depths(cache ? make(`loot-${cache[0]}`, "Claim the Matriarch's Moonstone", "Approach your personal Moonstone cache and press E.", cache[1], "loot")
      : make("depths-recover", "Recover the Moonstone", "If your personal cache expired, defeat the Crystal Matriarch again.", mobs.get("crystal-matriarch") ?? { x: 72.5, y: 1, z: 9.5 }, "encounter", 3), 6);
  }
  if (depthsUnlocked && depthsStage === 6) return depths(make("depths-return", "Forge the Moonstone Edge", "Return the fixed Moonstone reward to the blacksmith. It will permanently add +1 damage to every weapon.", TOWN_BLACKSMITH_STALL_POSITION, "hub"), 7);
  if (Math.hypot(player.x - TOWN_CENTER_X, player.z - TOWN_CENTER_Z) <= TOWN_SAFE_RADIUS && sameFloor({ x: 0, y: 8, z: 0 })) {
    const minerals = (player.inventory.get("iron_ore")?.quantity ?? 0) + (player.inventory.get("silver_ore")?.quantity ?? 0);
    return minerals > 0 ? make("blacksmith", "Trade Your Minerals", "Take your minerals to the blacksmith and press E to trade them for gold.", TOWN_BLACKSMITH_STALL_POSITION, "hub")
      : make("leave-town", "Explore the Wilderness", "Leave through the east gate. Nearby encounters will become your objective as you explore.", { x: 30.5, y: 8, z: 8.5 }, "hub");
  }
  const dungeon = isInForestDungeon(player.x, player.z);
  const groups = [...GROUPS, ...[...mobs].filter(([id]) => !GROUPS.some(group => group.ids.includes(id))).map(([id, mob]) => ({ id: `mob-${id}`, title: mob.name, detail: "Defeat this nearby enemy and collect your item drops.", ids: [id] }))];
  const candidates = groups.flatMap(group => {
    const living = group.ids.flatMap(id => { const mob = mobs.get(id); return mob?.alive && sameFloor(mob) && isInForestDungeon(mob.x, mob.z) === dungeon ? [{ id, mob }] : []; }).sort((a, b) => distance(a.mob) - distance(b.mob));
    const target = living[0]; if (!target || distance(target.mob) > (group.id === previousId ? 32 : dungeon ? 48 : 26)) return [];
    const update = make(group.id, group.title, group.detail, target.mob, "encounter", target.mob.difficultyTier);
    update.recommendedLevel = `LV ${target.mob.level ?? worldLevelRange(target.mob.difficultyTier).min}`;
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
  if (portal) {
    const update = make(`portal-${portal[0]}`, dungeon ? "Return to the Wilderness" : "Enter the Forest Dungeon", "Approach the glowing portal and press E to travel.", portal[1], "portal", dungeon ? 0 : 2);
    update.recommendedLevel = dungeon ? "SAFE RETURN" : "LV 6–10";
    return update;
  }
  const nearest = candidates[0], previous = candidates.find(candidate => candidate.update.objectiveId === previousId);
  if (nearest) return previous && previous.distance <= nearest.distance + 4 ? previous.update : nearest.update;
  return { ...make("explore", "Explore the Wilderness", "Move toward nearby encounters. Your objective changes with your surroundings.", player, "explore"), showMarker: false };
}
