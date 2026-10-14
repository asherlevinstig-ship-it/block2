import { isEquipmentItem, ITEM_DEFINITIONS, worldLevelRange, type ForestPortal, type ItemId, type WorldObjectiveUpdate } from "@blockcraft/protocol";
import { WILDERNESS_EVENT_ID, WILDERNESS_EVENT_POSITION, WILDERNESS_EVENT_TRACKING_RADIUS } from "./wilderness-event.js";
import { REALM_BOSS_TRACKING_RADIUS, REALM_EVENT_DEFINITIONS, REALM_EVENT_TRACKING_RADIUS, realmEventDefinition, type RealmEventStatus } from "./realm-event-director.js";
import { ASHEN_SENTRY_IDS, MISTFEN_IDS, MIXED_FRONTIER_IDS } from "./wilderness-encounters.js";
import { ASHEN_SPIRE_POSITION, FOREST_DUNGEON_MOBS, isInAshenReach, isInForestDungeon, TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_SAFE_RADIUS, TOWN_BLACKSMITH_STALL_POSITION, TOWN_SILVER_DEPTHS_PORTAL_POSITION, SILVER_DEPTHS_EXIT_POSITION, SILVER_DEPTHS_MOONSTONE_SEAL_POSITION, SILVER_DEPTHS_CHECKPOINT_POSITION, CRYSTAL_MATRIARCH_HOME } from "@blockcraft/voxel-world";
import { SILVER_DEPTHS_ANTECHAMBER_IDS, SILVER_DEPTHS_ENCOUNTERS, silverDepthsStageSpawns } from "./silver-depths-encounters.js";
import { areaMainMobDefinition } from "./area-mini-bosses.js";
import { GREENWOOD_EVENT_FOLLOWER_PREFIX, greenwoodEventDefinition } from "./greenwood-events.js";
import { MISTFEN_EVENT_FOLLOWER_PREFIX, mistfenEventDefinition } from "./mistfen-events.js";
import { ROAMING_PACKS, roamingMemberId } from "./roaming-packs.js";
type Pose = { x: number; y: number; z: number };
type Mob = Pose & { alive: boolean; name: string; difficultyTier: number; level?: number; combatState: string; targetId: string };
type Player = Pose & { health: number; level?: number; miningExpeditionStage?: number; silverDepthsStage?: number; silverDepthsRunStage?: number; silverDepthsWing?: string; inventory: { get(id: string): { quantity: number } | undefined } };
type Loot = Pose & { ownerId: string; itemId: string; expiresAt: number };
export interface WorldObjectiveProgress { id: string | null; fingerprint: string }
export const createObjectiveProgress = (): WorldObjectiveProgress => ({ id: null, fingerprint: "" });
interface ObjectiveGroup { id: string; title: string; detail: string; ids: string[]; mainId?: string }
const GROUPS: ObjectiveGroup[] = [
  { id: "buried-vault", title: "Breach the Buried Vault", detail: "Mine through the silver seal. Defeat the Vault Crawler and Stone Warden, then claim your personal Miner's Lantern cache.", ids: ["buried-vault-crawler", "buried-chamber-brute"], mainId: "buried-chamber-brute" },
  { id: "frontier-mixed", title: "Frontier Warband", detail: "Draw out the crawler, dodge the brute's rocks, then pressure the support spitter. Counter during recovery.", ids: [...MIXED_FRONTIER_IDS], mainId: "frontier-brute-east" },
  ...REALM_EVENT_DEFINITIONS.map(event => ({ id: event.key === "greenwood" ? "greenwood-event" : event.realmBoss ? "realm-boss" : `${event.key}-event`, title: event.title, detail: event.detail,
    ids: event.key === "greenwood" ? [event.id, ...Array.from({ length: 5 }, (_, index) => `${GREENWOOD_EVENT_FOLLOWER_PREFIX}${index}`)]
      : event.key === "mistfen" ? [event.id, ...Array.from({ length: 5 }, (_, index) => `${MISTFEN_EVENT_FOLLOWER_PREFIX}${index}`)] : [event.id],
    mainId: event.key === "greenwood" || event.key === "mistfen" ? event.id : undefined })),
  { id: "greenwood", title: "Greenwood Crawler Camp", detail: "Follow the dirt road, clear the three root nests, collect crawler items, then mine the exposed iron seam east of the camp.", ids: ["wild-crawler", "greenwood-briar", "greenwood-briar-north"], mainId: "wild-crawler" },
  { id: "silver-guards", title: "Silver Guard Clearing", detail: "Dodge aimed shots and fan gaps using the stone cover. Collect a focus and potion, mine silver, and clear both guards to open the Forest Dungeon portal.", ids: ["cave-spitter", "frontier-spitter"], mainId: "frontier-spitter" },
  { id: "stone-clearing", title: "Stone Brute Clearing", detail: "Dodge the marked slam, then counter during recovery.", ids: ["stone-brute"], mainId: "stone-brute" },
  { id: "frontier-ruins", title: "Frontier Brute Ruins", detail: "Use broken pillars against rock volleys, leave the slam circle, then counter during recovery. Collect the hammer and rich silver.", ids: ["frontier-brute"], mainId: "frontier-brute" },
  { id: "ashen-sentries", title: "Ashglass Sentries", detail: "Use the broken cover and dodge between sweeping fan volleys. Counter after their aimed shot.", ids: [...ASHEN_SENTRY_IDS], mainId: "ashglass-sentry-east" },
  { id: "mistfen", title: "Mistfen Marsh", detail: "Stay on the crossing boardwalks, draw the ambushers out of the toxic pools, then break the Mireback Behemoth during recovery.", ids: [...MISTFEN_IDS], mainId: "mistfen-behemoth" },
  ...ROAMING_PACKS.map(pack => ({ id: pack.id, title: `${pack.id.includes("outskirts") ? "Outskirts" : "Wilds"} Roaming Pack`,
    detail: "Hunt the roaming packleader for the area's richest loot, then clear its followers.",
    ids: pack.offsets.map((_, index) => roamingMemberId(pack, index)), mainId: roamingMemberId(pack, 0) })),
  ...[1, 2, 3].map(stage => ({ id: `forest-stage-${stage}`, title: stage === 3 ? "Ancient Root Guardian" : `Forest Dungeon · Room ${stage}`,
    detail: stage === 3 ? "Use roots against phase-one rock volleys. Below half health, sidestep committed charges and counter during recovery. Collect your equipment bag, then return."
      : stage === 2 ? "Use stone cover and dodge alternating aimed shots and fan gaps to open the guardian gate."
      : "Split the flanking crawlers around the root piles to open the next gate. The entrance return portal remains available.",
    ids: FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage).map(mob => mob.id) })),
];
export function nearbyObjective(playerId: string, player: Player, mobEntries: Iterable<readonly [string, Mob]>, portalEntries: Iterable<readonly [string, ForestPortal]>, lootEntries: Iterable<readonly [string, Loot]>, now: number, previousId: string | null, realmEvent: RealmEventStatus | number = 0, roomKind: "overworld" | "silver-depths" = "overworld"): WorldObjectiveUpdate {
  const legacyEventState = typeof realmEvent === "number";
  const eventStatus: RealmEventStatus = typeof realmEvent === "number" ? {
    phase: realmEvent > now ? "warning" : "idle", eventId: realmEvent > now ? WILDERNESS_EVENT_ID : null,
    eventName: realmEvent > now ? "Greenwood Venom Matriarch" : null, eventTitle: realmEvent > now ? "Venom Matriarch · Public Event" : null,
    eventDetail: null, eventVariant: null, trackingRadius: WILDERNESS_EVENT_TRACKING_RADIUS,
    targetX: WILDERNESS_EVENT_POSITION.x, targetY: WILDERNESS_EVENT_POSITION.y, targetZ: WILDERNESS_EVENT_POSITION.z,
    warningUntil: realmEvent, completed: 0, required: 3, realmBoss: false, eliteKills: 0, eliteRequired: 2,
  } : realmEvent;
  const distance = (point: Pose) => Math.hypot(point.x - player.x, point.z - player.z);
  const sameFloor = (point: Pose) => Math.abs(point.y - player.y) <= 2.5;
  const make = (id: string, title: string, detail: string, point: Pose, kind: WorldObjectiveUpdate["kind"], tier = 0): WorldObjectiveUpdate => ({
    objectiveId: id, title, detail, kind, tier, recommendedLevel: kind === "hub" ? "SAFE" : worldLevelRange(tier).label,
    showMarker: true, targetMobId: "", targetMobIds: [], completedMobIds: [], targetX: point.x, targetY: point.y, targetZ: point.z,
  });
  if (player.health <= 0) return { ...make("defeated", "Return to Town", "Use Return to Town to recover. Your dropped items remain in your recovery bag.", player, "hub"), showMarker: false };
  const mobs = new Map(mobEntries);
  const portals = [...portalEntries], drops = [...lootEntries];
  const localObjective = (includeFallback: boolean): WorldObjectiveUpdate | null => {
    const town = Math.hypot(player.x - TOWN_CENTER_X, player.z - TOWN_CENTER_Z) <= TOWN_SAFE_RADIUS && sameFloor({ x: 0, y: 8, z: 0 });
    if (town) {
      if (!includeFallback) return null;
      const minerals = (player.inventory.get("iron_ore")?.quantity ?? 0) + (player.inventory.get("silver_ore")?.quantity ?? 0);
      return minerals > 0 ? make("blacksmith", "Trade Your Minerals", "Take your minerals to the blacksmith and press E to trade them for gold.", TOWN_BLACKSMITH_STALL_POSITION, "hub")
        : make("leave-town", "Explore the Wilderness", "Leave through the east gate. Nearby threats will be marked as you explore.", { x: 30.5, y: 8, z: 8.5 }, "hub");
    }
    const dungeon = isInForestDungeon(player.x, player.z);
    const expeditionLantern = drops.find(([, drop]) => drop.ownerId === playerId && drop.itemId === "miners_lantern"
      && now < drop.expiresAt && sameFloor(drop) && distance(drop) <= 10);
    if ((player.miningExpeditionStage ?? 0) === 6 && expeditionLantern) {
      return make(`loot-${expeditionLantern[0]}`, "Claim the Miner's Lantern",
        "The Stone Warden is defeated. There are no more enemies required—approach your personal lantern and press E to pick it up.",
        expeditionLantern[1], "loot");
    }
    const groups: ObjectiveGroup[] = [...GROUPS, ...[...mobs].filter(([id]) => !GROUPS.some(group => group.ids.includes(id))).map(([id, mob]) => ({
      id: `mob-${id}`, title: mob.name, detail: "Defeat this nearby enemy and collect your item drops.", ids: [id],
      mainId: areaMainMobDefinition(id) ? id : undefined,
    }))];
    const candidates = groups.flatMap(group => {
      const living = group.ids.flatMap(id => { const mob = mobs.get(id); return mob?.alive && sameFloor(mob) && isInForestDungeon(mob.x, mob.z) === dungeon ? [{ id, mob }] : []; }).sort((a, b) => distance(a.mob) - distance(b.mob));
      const realmDefinition = group.ids.map(id => realmEventDefinition(id)).find(Boolean);
      const acquisitionRadius = realmDefinition ? eventStatus.eventId === realmDefinition.id
        ? eventStatus.trackingRadius ?? (realmDefinition.realmBoss ? REALM_BOSS_TRACKING_RADIUS : REALM_EVENT_TRACKING_RADIUS)
        : realmDefinition.realmBoss ? REALM_BOSS_TRACKING_RADIUS : REALM_EVENT_TRACKING_RADIUS
        : group.id === previousId ? 32 : dungeon ? 48 : 26;
      const nearest = living[0]; if (!nearest || distance(nearest.mob) > acquisitionRadius) return [];
      const main = group.mainId ? living.find(entry => entry.id === group.mainId) : undefined;
      const target = main ?? nearest;
      const miniBoss = main ? areaMainMobDefinition(main.id) : undefined;
      const update = make(group.id, miniBoss ? miniBoss.name : group.title,
        miniBoss ? `AREA MINI-BOSS · Defeat ${miniBoss.name} for its richest personal cache. First victory also guarantees ${ITEM_DEFINITIONS[miniBoss.rewardItemId].name}.` : group.detail,
        target.mob, miniBoss ? "miniboss" : "encounter", target.mob.difficultyTier);
      update.recommendedLevel = `LV ${target.mob.level ?? worldLevelRange(target.mob.difficultyTier).min}`;
      if (realmDefinition && eventStatus.eventId === realmDefinition.id) {
        update.title = eventStatus.eventTitle ?? eventStatus.eventName ?? update.title;
        update.detail = eventStatus.eventDetail ?? update.detail;
      }
      update.targetMobId = target.id; update.targetMobIds = group.ids.filter(id => mobs.has(id)); update.completedMobIds = group.ids.filter(id => mobs.get(id)?.alive === false);
      if (miniBoss) update.progressLabel = "MINI-BOSS · HIGHEST LOOT";
      return [{ update, distance: distance(nearest.mob), engaged: living.some(({ mob }) => mob.targetId === playerId || mob.combatState !== "idle" && distance(mob) <= 8) }];
    }).sort((a, b) => a.distance - b.distance);
    const lockedFrontier = candidates.find(candidate => candidate.update.objectiveId.includes("frontier"));
    if ((player.level ?? 1) < 10 && lockedFrontier && !lockedFrontier.engaged) {
      return { ...lockedFrontier.update, objectiveId: "frontier-locked", title: "Frontier Contracts Locked",
        detail: "Reach character level 10 to track elite Frontier encounters. You may still explore and fight here.",
        recommendedLevel: "UNLOCKS AT LV 10", showMarker: false };
    }
    const activeFight = candidates.find(candidate => candidate.engaged && candidate.update.objectiveId === previousId) ?? candidates.find(candidate => candidate.engaged);
    if (activeFight) return activeFight.update;
    if (eventStatus.phase === "warning" && eventStatus.warningUntil > now) {
      const definition = realmEventDefinition(eventStatus.eventId);
      const point = definition?.position ?? WILDERNESS_EVENT_POSITION;
      const trackingRadius = eventStatus.trackingRadius
        ?? (definition?.realmBoss ? REALM_BOSS_TRACKING_RADIUS : REALM_EVENT_TRACKING_RADIUS);
      if (sameFloor(point) && distance(point) <= (legacyEventState ? WILDERNESS_EVENT_TRACKING_RADIUS : trackingRadius)) {
        const update = make(definition?.realmBoss ? "realm-boss-warning" : `${definition?.key ?? "greenwood"}-event-warning`,
          `${eventStatus.eventTitle ?? eventStatus.eventName ?? "Public event"} · ${Math.ceil((eventStatus.warningUntil - now) / 1000)}s`,
          definition?.realmBoss ? "The realm threat has peaked. Rally at the marker before the Warden arrives."
            : eventStatus.eventDetail ?? "Regional event incoming. Follow the nearby map marker and gather before it arrives.", point, "encounter", definition?.tier ?? 1);
        update.progressLabel = definition?.realmBoss ? "REALM BOSS" : `REALM THREAT ${eventStatus.completed} / ${eventStatus.required}`;
        return update;
      }
    }
    const event = candidates.find(candidate => candidate.update.targetMobIds.some(id => realmEventDefinition(id)));
    if (event) {
      event.update.progressLabel = event.update.objectiveId === "realm-boss" ? "REALM BOSS"
        : greenwoodEventDefinition(eventStatus.eventVariant)?.progressLabel
          ?? mistfenEventDefinition(eventStatus.eventVariant)?.progressLabel
          ?? `REALM THREAT ${eventStatus.completed} / ${eventStatus.required}`;
      return event.update;
    }
    const loot = drops.filter(([, drop]) => (!drop.ownerId || drop.ownerId === playerId) && now < drop.expiresAt && sameFloor(drop) && distance(drop) <= 6
      && (isEquipmentItem(drop.itemId as ItemId) || drop.itemId === "miners_lantern")).sort((a, b) => distance(a[1]) - distance(b[1]))[0];
    if (loot) return make(`loot-${loot[0]}`, "Collect Your Loot", "Approach your personal loot and press E to pick it up.", loot[1], "loot");
    const portal = portals.filter(([, point]) => (point.expiresAt === 0 || now < point.expiresAt) && sameFloor(point) && distance(point) <= 18
      && (!dungeon ? point.kind === "entry" : point.kind === "return" && candidates.length === 0)).sort((a, b) => distance(a[1]) - distance(b[1]))[0];
    if (portal) {
      const update = make(`portal-${portal[0]}`, dungeon ? "Return to the Wilderness" : "Enter the Forest Dungeon", "Approach the glowing portal and press E to travel.", portal[1], "portal", dungeon ? 0 : 2);
      update.recommendedLevel = dungeon ? "SAFE RETURN" : "LV 6–10";
      return update;
    }
    const nearest = candidates[0], previous = candidates.find(candidate => candidate.update.objectiveId === previousId);
    if (nearest && (nearest.distance <= 12 || !isInAshenReach(player.x, player.z)))
      return previous && previous.distance <= nearest.distance + 4 ? previous.update : nearest.update;
    if (sameFloor(ASHEN_SPIRE_POSITION) && distance(ASHEN_SPIRE_POSITION) <= 28)
      return make("ashen-spire", "Investigate the Ashen Spire", "Explore the split spire at the heart of the Ashen Reach. Beware the sentries guarding it.", ASHEN_SPIRE_POSITION, "explore", 3);
    if (nearest) return previous && previous.distance <= nearest.distance + 4 ? previous.update : nearest.update;
    return { ...make("explore", "Explore the Wilderness", "Roam toward nearby threats, collect stronger equipment, and raise the Realm Threat meter.", player, "explore"), showMarker: false };
  };
  // Overworld guidance is deliberately reactive, not a quest log. Internal
  // milestone fields still preserve unlocks and rewards, but they never pin the
  // player to a scripted checklist or blacksmith hand-in.
  if (roomKind !== "silver-depths") return localObjective(true)!;
  const preferNearby = (quest: WorldObjectiveUpdate): WorldObjectiveUpdate => {
    const target = { x: quest.targetX, y: quest.targetY, z: quest.targetZ };
    if (player.y < 7
      || sameFloor(target) && distance(target) <= (previousId === quest.objectiveId ? 22 : 18)) return quest;
    return localObjective(false) ?? quest;
  };
  // A dungeon run is its own room and must not inherit an unfinished town quest.
  const runStage = player.silverDepthsRunStage ?? 1;
  const depthsStage = roomKind === "silver-depths"
    ? runStage <= 1 ? 2 : runStage <= 4 ? 3 : runStage === 5 ? 4 : runStage === 6 ? 5 : 6
    : player.silverDepthsStage ?? 0;
  const depthsUnlocked = roomKind === "silver-depths" || depthsStage > 0 || (player.level ?? 1) >= 7 && (player.inventory.get("miners_lantern")?.quantity ?? 0) > 0;
  const depths = (update: WorldObjectiveUpdate, _step: number): WorldObjectiveUpdate => preferNearby({ ...update, recommendedLevel: "LV 7–12", progressLabel: "SILVER DEPTHS" });
  if (depthsUnlocked && depthsStage === 0) return depths(make("depths-briefing", "Speak to the Blacksmith", "Your first expedition is complete. Return to the blacksmith to unlock The Silver Depths.", TOWN_BLACKSMITH_STALL_POSITION, "hub"), 1);
  if (depthsUnlocked && depthsStage === 1) return depths(make("depths-enter", "Enter the Silver Depths", "Use the violet portal in town to begin the level-7 dungeon run.", TOWN_SILVER_DEPTHS_PORTAL_POSITION, "portal", 3), 2);
  if (depthsUnlocked && depthsStage === 2) return depths(make("depths-moonstone", "Mine the Moonstone Seal", "Mine one glowing Moonstone block to open the six-lane gate into the dungeon wings.", SILVER_DEPTHS_MOONSTONE_SEAL_POSITION, "explore", 3), 3);
  if (depthsUnlocked && depthsStage === 3) {
    const runStage = player.silverDepthsRunStage ?? 2;
    if (runStage === 3 && !player.silverDepthsWing) return depths(make("depths-route-choice", "Choose a Crystal Wing",
      "The first party member to choose a route on the dungeon map locks it for everyone: Iron Bastion or Silver Echo.",
      { x: 91.5, y: 1, z: 14.5 }, "explore", 3), 4);
    const wingGear = runStage >= 4 ? [...lootEntries].find(([id, drop]) => id === `depths-wing-gear:${playerId}`
      && drop.ownerId === playerId && now < drop.expiresAt) : undefined;
    if (wingGear) return depths(make(`loot-${wingGear[0]}`,
      player.silverDepthsWing === "iron" ? "Claim Bastion Plate" : "Claim Echo Prism",
      "Approach your personal route equipment and press E to keep or equip it before the next fight.", wingGear[1], "loot"), 4);
    const wing = player.silverDepthsWing === "iron" || player.silverDepthsWing === "silver" ? player.silverDepthsWing : undefined;
    const ids = runStage >= 4 ? SILVER_DEPTHS_ANTECHAMBER_IDS
      : silverDepthsStageSpawns(runStage >= 3 ? 2 : 1, wing).map(entry => entry.id);
    const living = ids.flatMap(id => { const mob = mobs.get(id); return mob?.alive ? [{ id, mob }] : []; });
    const fallback = runStage >= 4 ? SILVER_DEPTHS_CHECKPOINT_POSITION
      : SILVER_DEPTHS_ENCOUNTERS.find(entry => entry.id === ids[0])!;
    const target = living[0] ?? { id: ids[0]!, mob: fallback };
    const update = make(runStage >= 4 ? "depths-antechamber" : "depths-gallery",
      runStage >= 4 ? "Clear the Crystal Antechamber" : runStage >= 3 ? wing === "iron" ? "Clear the Iron Bastion" : "Clear the Silver Echo" : "Clear Gallery Wave I",
      runStage >= 4 ? "Defeat the Crystal Warden and its escorts to unlock the Matriarch arena."
        : runStage >= 3 ? wing === "iron" ? "Defeat the Warden and crawlers in the northern wing to earn Bastion Plate and iron ore."
          : "Dodge the spitter volleys in the southern wing to earn Echo Prism and silver ore."
        : "Use the stone cover to split the first gallery wave. Then choose a party route.", target.mob, "encounter", 3);
    update.targetMobId = target.id; update.targetMobIds = ids; update.completedMobIds = ids.filter(id => mobs.get(id)?.alive === false);
    return depths(update, 4);
  }
  if (depthsUnlocked && depthsStage === 4) {
    const boss = mobs.get("crystal-matriarch") ?? CRYSTAL_MATRIARCH_HOME;
    const update = make("depths-matriarch", "Defeat the Crystal Matriarch", "Dodge between the marked crystal burst lanes, then counter during her recovery. Below half health she adds two-phase fans.", boss, "encounter", 3);
    update.targetMobId = "crystal-matriarch"; update.targetMobIds = ["crystal-matriarch"];
    return depths(update, 5);
  }
  if (depthsUnlocked && depthsStage === 5) {
    const cache = [...lootEntries].find(([, drop]) => drop.ownerId === playerId && drop.itemId === "matriarch_edge" && now < drop.expiresAt);
    return depths(cache ? make(`loot-${cache[0]}`, "Claim Matriarch's Edge", "Approach your personal weapon cache and press E to claim the fixed equipment reward.", cache[1], "loot")
      : make("depths-recover", "Recover Matriarch's Edge", "If your personal cache expired, defeat the Crystal Matriarch again.", mobs.get("crystal-matriarch") ?? CRYSTAL_MATRIARCH_HOME, "encounter", 3), 6);
  }
  if (depthsUnlocked && depthsStage === 6) return depths(make("depths-return", "Extract to Town", "Use the violet return portal after claiming Matriarch's Edge. The Moonstone you mined will be forged into a permanent weapon bonus.", SILVER_DEPTHS_EXIT_POSITION, "portal", 3), 7);
  if (depthsUnlocked && depthsStage === 7 && Math.hypot(player.x - TOWN_CENTER_X, player.z - TOWN_CENTER_Z) <= TOWN_SAFE_RADIUS && sameFloor({ x: 0, y: 8, z: 0 })) {
    return { ...depths(make("depths-repeat", "Repeat the Silver Depths", "The portal remains open for repeat runs, combat practice, and additional Matriarch encounters.", TOWN_SILVER_DEPTHS_PORTAL_POSITION, "portal", 3), 7), progressLabel: "SILVER DEPTHS · MASTERED" };
  }
  return localObjective(true)!;
}
