import * as pc from "playcanvas";
import { confirmedRangedHit, projectileImpactCue } from "./ranged-feedback.js";
import { heldFireStep } from "./held-fire.js";
import { rangedAimYaw } from "./ranged-aim.js";
import { advanceBossHud, initialBossHud } from "./boss-hud.js";
import { forestDungeonAtmosphere, forestDungeonNotice, portalNoticeFeedback } from "./forest-dungeon-presentation.js";
import { objectiveGuidance, objectiveIcon } from "./objective-guidance.js";
import { createSocialUI } from "./social-ui.js";
import { createPartyUI } from "./party-ui.js";
import { createTradeUI } from "./trade-ui.js";
import { createPlayerInteractionUI, type PlayerInteractionView } from "./player-interaction-ui.js";
import type { RealmEventUpdate } from "@blockcraft/protocol";
import { equipmentForItem, armourForItem, utilityForItem, isEquipmentItem, EQUIPMENT_LOOT_RANGE,
  decodeLootBagItems, encodeLootBagItems, lootBagRepresentative, lootBagTierForItems,
  type LootBagItem, type LootBagTier, type LootCollectAction, type LootCollectResult } from "@blockcraft/protocol";
import { weaponComparison, armourComparison, comparisonTrend } from "./loot-comparison.js";
import { createCharacterPortrait } from "./character-portrait.js";
import { rangedStyle } from "./ranged-style.js";
import { projectileNearMiss } from "./projectile-near-miss.js";
import { BRUTE_VOLLEY, bruteRockLanes } from "@blockcraft/protocol";
import { projectilePresentation } from "./projectile-clock.js";
import { inventoryRenderDue } from "./inventory-render-budget.js";
import { nextInventoryTab, type InventoryTab } from "./inventory-tabs.js";
import { inventoryItemVisible } from "./inventory-ownership.js";
import { playerHud } from "./player-hud.js";
import { combatHud, cooldownState } from "./combat-hud.js";
import { EQUIPMENT_COLLECTION, collectionProgress, equipmentCollectionLabel, equipmentProgressionText } from "./equipment-progression.js";
import { blacksmithShopStock, shopGoldShortfall, type BlacksmithShopTab } from "./blacksmith-shop.js";
import { createStorageUI, type StorageUpdate } from "./storage-ui.js";
import { lootVisibleToPlayer } from "./loot-ownership.js";
import { undergroundThreatVisible } from "./underground-threat-visibility.js";
import { cavernRespawnIndicator } from "./cavern-respawn-indicator.js";
import { SILVER_DEPTHS, SILVER_DEPTHS_CHECKPOINT_POSITION, isInSilverGuardClearing, isInFrontierBruteArena, isInForestDungeon, isInEmberVault } from "@blockcraft/voxel-world";
import { canUseForestPortal, type ForestPortal, type SilverDepthsWing } from "@blockcraft/protocol";
import { portalArrivalSnapshot } from "./portal-travel.js";
import { SPITTER_PATTERN, matriarchSecondVolleyYaw, spitterShotOffsets, spitterWarningLanes } from "@blockcraft/protocol";
import { TOWN_STORAGE_CHEST_POSITION, isAtTownStorage } from "@blockcraft/voxel-world";
import { TOWN_EXPEDITION_BOARD_POSITION } from "@blockcraft/voxel-world";
import { equipmentPickupCard, LOOT_FEED_EQUIPMENT_MS, LOOT_FEED_MATERIAL_MS, LOOT_FEED_MAX_ITEMS } from "./equipment-pickup.js";
import { wildernessTerritoryAt } from "@blockcraft/voxel-world";
import { createMinimap } from "./minimap.js";
import { caveDepthBand, caveCellKey, discoverCave, caveFogRuns } from "./cave-discovery.js";
import {
  DEPTHS_ROUTE_NODES,
  silverDepthsRoute,
  type DepthsNodeId,
  type DepthsRouteState,
} from "./silver-depths-map.js";
import { silverDepthsBreadcrumbPositions, silverDepthsMapRoute, type DungeonMapRoute } from "./silver-depths-navigation.js";
import { SILVER_DEPTHS_ATMOSPHERES, silverDepthsLightColour, silverDepthsZone, type SilverDepthsZone } from "./silver-depths-atmosphere.js";
import { CAVE_CHAMBERS, caveReturnPath, discoverChambers, type CavePosition } from "./cave-navigation.js";
import { miningAvailability, miningReach, miningProgress, miningDurationMs, miningLineClear, miningMessage, type MiningCell } from "./mining-feedback.js";
import type { MineralDepositStatus } from "@blockcraft/protocol";
import { advanceMobMotion, advanceMobTurnLean, trimMobSnapshots, visibleMobGaitSpeed } from "./mob-motion.js";
import { createServerClock, sampleServerClock, enemyAttackPresentation } from "./enemy-timeline.js";
import { bruteRecoveryPose, enemyAwarenessCue, enemyCombatCue, enemyCueLineClear, enemyShotGuideLength } from "./enemy-combat-cues.js";
import { replayPendingMovement, type PredictionFrame } from "./prediction-replay.js";
import { advanceCameraOrbit, cameraOrbitOffset, initialCameraOrbit } from "./camera-orbit.js";
import { advanceCameraFollow } from "./camera-follow.js";
import {
  advanceDodgeVisualOffset,
  advancePredictedDodgeStamina,
  beginDodgeVisualOffset,
  canRequestPredictedDodge,
  canSpendPredictedDodgeStamina,
  DODGE_STAMINA_COST,
} from "./dodge-input.js";
import { animateMobArt, createMobArt, setMobArtEnraged, setMobArtDefeated, type MobArtRig } from "./mob-art";
import { defeatDuration, mobDefeatPose, lootSourceMob, lootMarkerScale } from "./mob-defeat.js";
import { matriarchBodyPose, matriarchRecoil } from "./matriarch-art.js";
import { Client, Predict, getStateCallbacks, type InputHandle, type Room } from "@colyseus/sdk";
import { stepPlayerNetcode } from "@blockcraft/voxel-world";
import {
  BRAMBLE_SNARE,
  playerMeleeStrike,
  sampleMeleeStrike,
  mobMeleeImpactMs,
  mobStrikeGroundOutline,
  BRUTE_SLAM,
  CHAMPION_CHARGE,
  championChargeOutline,
  bruteSlamOutline,
  bruteSmashOutline,
  BLACKSMITH_UPGRADES,
  SILVER_DEPTHS_REWARDS,
  BLACKSMITH_STOCK,
  BLACKSMITH_DISMANTLE,
  BLACKSMITH_REFORGE,
  type BlacksmithStockId,
  type BlacksmithDismantleItemId,
  type BlacksmithReforgeItemId,
  type EquipmentReforgeRanks,
  reforgeWeaponDamageBonus,
  reforgeArmourReduction,
  ARMOUR_DEFINITIONS,
  armourStats,
  type ArmourId,
  APPEARANCE_PALETTE,
  APPEARANCE_STYLES,
  DEFAULT_APPEARANCE,
  PlayerNameSchema,
  resolveAppearance,
  type Appearance,
  IRON_ORE_GOLD_PRICE,
  SILVER_ORE_GOLD_PRICE,
  MAIN_HAND_DEFINITIONS,
  MOMENTUM_TRAIT,
  TRAIT_DEFINITIONS,
  HUNTERS_MARK,
  ITEM_DEFINITIONS,
  ITEM_RARITIES,
  itemRarity,
  lootCarryCapacity,
  equipmentPerkStats,
  type ItemRarity,
  HEALING_POTION,
  type PotionUpdate,
  POWER_DEFINITIONS,
  ROOTBOUND_FINISHER,
  SEISMIC_CLEAVE_UPGRADES,
  SPECIAL_DEFINITIONS,
  WEAPON_ATTACK_DEFINITIONS,
  WORLD_ROOM,
  SILVER_DEPTHS_ROOM,
  type RoomTransfer,
  type ActionRejected,
  type BlacksmithUpdate,
  type BlacksmithUpgradeId,
  type SilverDepthsRewardId,
  type BlockChanged,
  type BrambleSnarePlaced,
  type BrambleSnareTriggered,
  type ChunkRegion,
  type ChunkSnapshot,
  type CombatHit,
  type CombatMiss,
  type CombatReward,
  type CombatStagger,
  type DefenseResolved,
  type DepthsRouteHazard,
  type DungeonRunUpdate,
  type DungeonRewardClaimed,
  type DungeonBoardUpdate,
  type DungeonLobbyUpdate,
  type SilverDepthsLobbyUpdate,
  type ItemId,
  type LootPickedUp,
  type ResourceGathered,
  type TavernQuizUpdate,
  TAVERN_QUIZ_STARTING_COINS,
  type MainHandId,
  type MobHazardPlaced,
  type MobProjectileReleased,
  type PlayerHit,
  type ProjectileResolved,
  type PowerCast,
  type PowerCancelled,
  type PowerId,
  type PowerResolved,
  characterMiningBonus,
  characterPowerBonus,
  characterSpeedMultiplier,
  CHARACTER_MILESTONES,
  blacksmithRequiredLevel,
  enemyThreat,
  experienceToNextLevel,
  worldLevelRange,
  MAX_CHARACTER_STAT_POINTS,
  type CharacterStatId,
  type ProgressionUpdate,
  type SeismicMasteryId,
  type SpecialApplied,
  type SpecialConsumed,
  type SpecialProgressed,
  type SpecialId,
  type TraitId,
  type WorldBootstrap,
  type WorldObjectiveCompleted,
  type WorldObjectiveUpdate,
  type SilverDepthsWingRewardStatus,
  type SilverDepthsCacheStatus,
  type SilverDepthsCheckpointStatus,
  type SilverDepthsPartyStatus,
  type SilverDepthsGateStatus,
  type SilverDepthsPing,
  type WeaponAttackReleased,
} from "@blockcraft/protocol";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  SURFACE_HEIGHT,
  TERMINAL_VELOCITY,
  TOWN_BUILDINGS,
  chunkIndex,
  isInGreenwoodRegion,
  isInGreenwoodCamp,
  isInStoneBruteArena,
  isProtectedVoxel,
  isPlayerSupported,
  resolvePlayerMotion,
  voxelRaycast,
  worldToChunk,
  type BlockId,
  type VoxelRaycastHit,
} from "@blockcraft/voxel-world";
import {
  REMOTE_INTERPOLATION_DELAY_MS,
  approachMovement,
  approachYaw,
  cameraRelativeMovement,
  localReconciliationRate,
  movementDirectionChanged,
  movementYaw,
  quantizeMovementToEightDirections,
  reconciliationVerticalTarget,
  sampleRemotePose,
  smoothVerticalOffset,
  smoothNetworkVisualOffset,
  smoothRecoveryOffset,
  stabilizePilotPose,
  trimRemoteSnapshots,
  useColyseusMovementPilot,
  type PilotPose,
  type RemoteSnapshot,
} from "./movement-network.js";
import {
  bootstrapSliceHeight,
  isAtSurfaceReturnHeight,
  isBelowSurroundingSurface,
  isBelowTerrainSurface,
  isVoxelHiddenForPlayer,
  loweredSliceHeight,
  restoredSliceHeight,
  shouldUseDepthSlice,
  type PlayerCutaway,
} from "./player-visibility.js";
import { hidesTownRoof, hidesTownUpperWall, roofCutawayBuilding } from "./town-roof-visibility.js";
import { MILESTONE_EXIT_STEPS } from "./exit-guidance.js";
import { createVoxelTexturePixels, voxelCornerLight, voxelTextureKind, voxelTint, type VoxelTextureKind } from "./voxel-textures.js";
import { retryConnection } from "./connection-retry.js";
import {
  alternateInteractionMode,
  primaryActionForMode,
  type InteractionMode,
} from "./interaction-mode.js";
import {
  PRIMARY_ACTION_DURATION_MS,
  actionArmSwingWeight,
  advanceLocomotionAnimation,
  advanceTurnLean,
  eruptionPowerPose,
  lungePowerPose,
  primaryActionPose,
  recentTravelSpeed,
  seismicPowerPose,
  shockwavePowerPose,
  shortestYawDelta,
  type TravelFrame,
  voxelCharacterPose,
} from "./character-animation.js";
import { isPowerCompatibleWithMainHand } from "./power-loadout.js";
import { characterCreationNeeded, createGuestProfileToken, finishCharacterCreation, getOrCreateProfileToken } from "./player-profile.js";
import { CombatAudio, enemyCuePan, enemyCuesForTransition, type EnemyCue, type EnemyCueSnapshot } from "./combat-audio.js";
import { SceneDressing } from "./scene-dressing.js";
import { advanceIndoorCameraBlend, indoorCameraOffset } from "./indoor-camera.js";
import { canPlayAtTavernTable, canTalkToTavernKeeper, TAVERN_KEEPER, TAVERN_KEEPER_LINES, TAVERN_QUIZ_TABLE } from "./tavern-keeper.js";
import { BLACKSMITH_STALL, canTradeAtBlacksmithStall } from "./blacksmith.js";
import "./styles.css";

function newGuestProfileToken() {
  return createGuestProfileToken(crypto.getRandomValues(new Uint8Array(16)));
}

function browserProfileToken() {
  try {
    return getOrCreateProfileToken(window.localStorage, newGuestProfileToken);
  } catch {
    return newGuestProfileToken();
  }
}

function consumeAdminInvitation(): string | null {
  const url = new URL(window.location.href);
  const invitation = url.searchParams.get("admin");
  if (!invitation || !/^[a-f0-9]{64}$/i.test(invitation)) return null;
  url.searchParams.delete("admin");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return invitation;
}

let latestDungeonBoard: DungeonBoardUpdate | null = null;
const expeditionPanel = document.createElement("section");
expeditionPanel.id = "expedition-board-panel";
expeditionPanel.hidden = true;
expeditionPanel.innerHTML = '<button class="expedition-close" type="button" aria-label="Close">×</button><small>TOWN OF BEGINNINGS</small><h2>FOREST DUNGEON</h2><p class="expedition-message"></p><ol><li data-stage="1">Breach the forest sentinels</li><li data-stage="2">Defeat the thicket guards</li><li data-stage="3">Slay the Ancient Root Guardian</li><li data-stage="4">Collect the Rootbound Cache and escape</li></ol><div class="expedition-stats"><span>GROUP <strong class="expedition-party">SOLO</strong></span><span>BEST <strong class="expedition-best">—</strong></span></div><div class="expedition-reward"><b>GUARANTEED PERSONAL REWARD</b><strong>Rootbound Hammer</strong><span>Heavy 3-hit combo · finisher roots groups</span></div><button class="expedition-launch" type="button">OPEN DUNGEON PORTAL</button>';
document.body.append(expeditionPanel);
const formatDungeonTime = (milliseconds: number) => milliseconds > 0
  ? `${Math.floor(milliseconds / 60000)}:${String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0")}` : "—";
function renderDungeonBoard(update: DungeonBoardUpdate): void {
  latestDungeonBoard = update;
  expeditionPanel.querySelector(".expedition-message")!.textContent = update.message;
  expeditionPanel.querySelector(".expedition-party")!.textContent = update.partySize > 1 ? `${update.partySize} PLAYERS` : "SOLO";
  expeditionPanel.querySelector(".expedition-best")!.textContent = formatDungeonTime(update.bestTimeMs);
  expeditionPanel.querySelectorAll<HTMLElement>("[data-stage]").forEach(row => {
    const stage = Number(row.dataset.stage); row.classList.toggle("complete", update.stage > stage || update.stage === 3 && stage === 3);
    row.classList.toggle("active", update.active && stage === Math.max(1, update.stage));
  });
  const launch = expeditionPanel.querySelector<HTMLButtonElement>(".expedition-launch")!;
  launch.disabled = !update.available || !update.leader;
  launch.textContent = !update.leader ? "PARTY LEADER REQUIRED" : update.active ? "EXPEDITION OCCUPIED" : update.cooldownUntil > Date.now() ? "EXPEDITION RECOVERING" : "OPEN EXPEDITION PORTAL";
}
function openDungeonBoard(): void {
  expeditionPanel.hidden = false; resetMovementControls(); room?.send("dungeon:board", { action: "sync" });
}
expeditionPanel.querySelector(".expedition-close")!.addEventListener("click", () => { expeditionPanel.hidden = true; });
expeditionPanel.querySelector(".expedition-launch")!.addEventListener("click", () => room?.send("dungeon:board", { action: "open" }));

const dungeonLobbyPanel = document.createElement("section");
dungeonLobbyPanel.id = "dungeon-lobby-panel";
dungeonLobbyPanel.hidden = true;
dungeonLobbyPanel.innerHTML = '<small>FOREST DUNGEON</small><h2>EXPEDITION ASSEMBLY</h2><p class="dungeon-lobby-message"></p><ul class="dungeon-lobby-members"></ul><div class="dungeon-lobby-scaling"></div><div class="dungeon-lobby-actions"><button class="dungeon-ready" type="button">READY</button><button class="dungeon-start" type="button">START EXPEDITION</button></div>';
document.body.append(dungeonLobbyPanel);
function renderDungeonLobby(update: DungeonLobbyUpdate): void {
  if (update.phase === "active") { dungeonLobbyPanel.hidden = true; return; }
  dungeonLobbyPanel.hidden = false; resetMovementControls();
  dungeonLobbyPanel.querySelector(".dungeon-lobby-message")!.textContent = update.message;
  const members = dungeonLobbyPanel.querySelector(".dungeon-lobby-members")!; members.replaceChildren();
  for (const member of update.members) {
    const row = document.createElement("li");
    row.className = member.ready ? "ready" : member.entered ? "entered" : "outside";
    row.innerHTML = `<strong>${member.name}</strong><span>${member.ready ? "READY" : member.entered ? "AT ENTRANCE" : "OUTSIDE"}</span>`;
    members.append(row);
  }
  dungeonLobbyPanel.querySelector(".dungeon-lobby-scaling")!.textContent = `Combat scales to players present when the run begins. Current entry: ${update.members.filter(member => member.entered).length}.`;
  const self = update.members.find(member => member.id === room?.sessionId);
  const ready = dungeonLobbyPanel.querySelector<HTMLButtonElement>(".dungeon-ready")!;
  ready.disabled = !self?.entered || Boolean(self.ready); ready.textContent = self?.ready ? "READY ✓" : "READY";
  const start = dungeonLobbyPanel.querySelector<HTMLButtonElement>(".dungeon-start")!;
  start.hidden = !update.leader; start.disabled = !update.members.some(member => member.entered);
}
dungeonLobbyPanel.querySelector(".dungeon-ready")!.addEventListener("click", () => room?.send("dungeon:lobby", { action: "ready" }));
dungeonLobbyPanel.querySelector(".dungeon-start")!.addEventListener("click", () => room?.send("dungeon:lobby", { action: "start" }));

const silverDepthsLobbyPanel = document.createElement("section");
silverDepthsLobbyPanel.id = "silver-depths-lobby-panel";
silverDepthsLobbyPanel.hidden = true;
silverDepthsLobbyPanel.setAttribute("role", "dialog");
silverDepthsLobbyPanel.setAttribute("aria-label", "Silver Depths party ready check");
silverDepthsLobbyPanel.innerHTML = '<small>THE SILVER DEPTHS</small><h2>PARTY READY CHECK</h2><p class="dungeon-lobby-message"></p><ul class="dungeon-lobby-members"></ul><div class="dungeon-lobby-actions"><button class="depths-lobby-ready" type="button">READY</button><button class="depths-lobby-cancel" type="button">CANCEL ASSEMBLY</button></div>';
document.body.append(silverDepthsLobbyPanel);
function renderSilverDepthsLobby(update: SilverDepthsLobbyUpdate): void {
  if (update.phase === "closed") {
    silverDepthsLobbyPanel.hidden = true;
    status.textContent = update.message;
    return;
  }
  silverDepthsLobbyPanel.hidden = false;
  resetMovementControls();
  silverDepthsLobbyPanel.querySelector(".dungeon-lobby-message")!.textContent = update.message;
  const list = silverDepthsLobbyPanel.querySelector(".dungeon-lobby-members")!;
  list.replaceChildren();
  for (const member of update.members) {
    const row = document.createElement("li");
    row.className = member.ready ? "ready" : "outside";
    const name = document.createElement("strong"); name.textContent = member.name;
    const state = document.createElement("span"); state.textContent = member.ready ? "READY" : "WAITING";
    row.append(name, state); list.append(row);
  }
  const self = update.members.find(member => member.id === room?.sessionId);
  const ready = silverDepthsLobbyPanel.querySelector<HTMLButtonElement>(".depths-lobby-ready")!;
  ready.disabled = !self || self.ready;
  ready.textContent = self?.ready ? "READY ✓" : "READY";
}
silverDepthsLobbyPanel.querySelector(".depths-lobby-ready")!.addEventListener("click", () => room?.send("depths:lobby", { action: "ready" }));
silverDepthsLobbyPanel.querySelector(".depths-lobby-cancel")!.addEventListener("click", () => room?.send("depths:lobby", { action: "cancel" }));

function showDungeonRunResult(update: DungeonRunUpdate): void {
  if (update.phase !== "completed") return;
  document.querySelector("#dungeon-completion")?.remove();
  const panel = document.createElement("section");
  panel.id = "dungeon-completion";
  panel.setAttribute("role", "dialog");
  const silverDepths = update.dungeon === "silver-depths";
  const emberVault = update.dungeon === "ember-vault";
  panel.dataset.dungeon = silverDepths ? "silver-depths" : emberVault ? "ember-vault" : "forest";
  panel.setAttribute("aria-label", silverDepths ? "Silver Depths run results" : emberVault ? "Ember Vault run results" : "Forest Dungeon complete");
  panel.innerHTML = emberVault
    ? '<small>EMBER VAULT · FORGE CONQUERED</small><h2>FORGE COLOSSUS DEFEATED</h2><div class="dungeon-rank"></div><p class="dungeon-run-time"></p><div class="dungeon-stat-grid"><span><small>ENEMIES</small><b data-stat="enemies">0</b></span><span><small>DAMAGE TAKEN</small><b data-stat="damage">0</b></span><span><small>EMBER CORES</small><b data-stat="ember">0</b></span><span><small>CORES HELD</small><b data-stat="wallet">0</b></span><span><small>FORGE LOOT</small><b data-stat="relic">SECURED</b></span></div><strong class="dungeon-run-reward"></strong><p class="dungeon-best-time">The return portal is stable. Collect the Colossus loot before leaving.</p><div class="dungeon-result-actions"><button class="dungeon-return" type="button">CONTINUE</button><button class="dungeon-replay" type="button">RUN AGAIN</button></div>'
    : silverDepths
    ? '<small>SILVER DEPTHS · EXPEDITION COMPLETE</small><h2>CRYSTAL MATRIARCH DEFEATED</h2><div class="dungeon-rank"></div><p class="dungeon-run-time"></p><div class="dungeon-stat-grid"><span><small>ENEMIES</small><b data-stat="enemies">0</b></span><span><small>DAMAGE TAKEN</small><b data-stat="damage">0</b></span><span><small>MOONSTONE AWARD</small><b data-stat="moonstone">0</b></span><span><small>MOONSTONE HELD</small><b data-stat="wallet">0</b></span><span><small>RELIC</small><b data-stat="relic">SECURED</b></span></div><strong class="dungeon-run-reward"></strong><p class="dungeon-best-time"></p><div class="dungeon-result-actions"><button class="dungeon-return" type="button">RETURN TO TOWN</button><button class="dungeon-replay" type="button">RUN AGAIN</button></div>'
    : '<small>FOREST DUNGEON</small><h2>ROOT GUARDIAN DEFEATED</h2><p class="dungeon-run-time"></p><strong class="dungeon-run-reward"></strong><p>Collect your personal equipment bag, then take the return portal.</p><button class="dungeon-return" type="button">CONTINUE</button>';
  const seconds = Math.max(1, Math.round((update.durationMs ?? 0) / 1000));
  panel.querySelector(".dungeon-run-time")!.textContent = `${update.partySize > 1 ? `${update.partySize}-player party` : "Solo clear"} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  panel.querySelector(".dungeon-run-reward")!.textContent = update.reward ?? "Personal reward unlocked";
  if (silverDepths || emberVault) {
    const stats = update.stats;
    panel.dataset.rank = (update.rank ?? "BRONZE").toLowerCase();
    panel.querySelector(".dungeon-rank")!.textContent = `${update.rank ?? "BRONZE"} RANK`;
    panel.querySelector<HTMLElement>('[data-stat="enemies"]')!.textContent = String(stats?.enemiesDefeated ?? 0);
    panel.querySelector<HTMLElement>('[data-stat="damage"]')!.textContent = String(stats?.damageTaken ?? 0);
    if (emberVault) {
      panel.querySelector<HTMLElement>('[data-stat="ember"]')!.textContent = `+${stats?.emberCoresAwarded ?? 0}`;
      panel.querySelector<HTMLElement>('[data-stat="wallet"]')!.textContent = String(stats?.emberCoresTotal ?? 0);
    } else {
      panel.querySelector<HTMLElement>('[data-stat="moonstone"]')!.textContent = `+${stats?.moonstoneAwarded ?? stats?.moonstoneCollected ?? 0} ◆`;
      panel.querySelector<HTMLElement>('[data-stat="wallet"]')!.textContent = `${stats?.moonstoneTotal ?? 0} ◆`;
    }
    panel.querySelector<HTMLElement>('[data-stat="relic"]')!.textContent = stats?.signatureItemObtained ? "OBTAINED" : "SECURED";
    if (silverDepths) {
      const best = Math.max(1, Math.round((update.bestTimeMs ?? update.durationMs ?? 0) / 1000));
      panel.querySelector(".dungeon-best-time")!.textContent = `${update.newBest ? "NEW PERSONAL BEST" : "PERSONAL BEST"} · ${Math.floor(best / 60)}:${String(best % 60).padStart(2, "0")}`;
    }
    panel.querySelector<HTMLButtonElement>(".dungeon-replay")!.addEventListener("click", event => {
      const button = event.currentTarget as HTMLButtonElement; button.disabled = true; button.textContent = "OPENING PORTAL…";
      setTimeout(() => { panel.remove(); room?.send("portal:use", { id: emberVault ? "ember-entry" : "depths-entry" }); }, 1050);
    });
  }
  panel.querySelector<HTMLButtonElement>(".dungeon-return")!.addEventListener("click", () => panel.remove());
  document.body.append(panel);
}

const characterCreationRequired = (() => {
  const query = new URLSearchParams(window.location.search);
  if (query.has("room") || query.has("returnFrom") || query.has("qa")) return false;
  try { return characterCreationNeeded(window.localStorage); } catch { return true; }
})();
const profileToken = browserProfileToken();
const adminInvitation = consumeAdminInvitation();
const minimapPanel = document.querySelector<HTMLDetailsElement>("#minimap")!;
const minimap = createMinimap(document.querySelector<HTMLCanvasElement>("#minimap-canvas")!, document.querySelector<HTMLElement>("#minimap-detail")!, `blockcraft:minimap:v1:${profileToken}`);

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const status = document.querySelector<HTMLElement>("#status")!;
const targetLabel = document.querySelector<HTMLElement>("#target")!;
const tavernDialogue = document.querySelector<HTMLElement>("#tavern-dialogue")!;
const potionBuy = document.querySelector<HTMLButtonElement>("#potion-buy")!;
const potionUse = document.querySelector<HTMLButtonElement>("#potion-use")!;
const potionShopStatus = document.querySelector<HTMLElement>("#potion-shop-status")!;
const quizTablePrompt = document.querySelector<HTMLElement>("#quiz-table-prompt")!;
const blacksmithPrompt = document.querySelector<HTMLElement>("#blacksmith-prompt")!;
const playerTradePrompt = document.querySelector<HTMLButtonElement>("#player-trade-prompt")!;
const playerTradeName = document.querySelector<HTMLElement>("#player-trade-name")!;
const blacksmithPanel = document.querySelector<HTMLElement>("#blacksmith-panel")!;
const blacksmithMessage = document.querySelector<HTMLElement>("#blacksmith-message")!;
const blacksmithOre = document.querySelector<HTMLElement>("#blacksmith-ore")!;
const blacksmithGold = document.querySelector<HTMLElement>("#blacksmith-gold")!;
const blacksmithPrice = document.querySelector<HTMLElement>("#blacksmith-price")!;
const blacksmithSell = document.querySelector<HTMLButtonElement>("#blacksmith-sell")!;
const blacksmithClose = document.querySelector<HTMLButtonElement>("#blacksmith-close")!;
const blacksmithUpgradeCards = [...document.querySelectorAll<HTMLElement>("[data-blacksmith-upgrade]")];
const depthsRewardCards = [...document.querySelectorAll<HTMLElement>("[data-depths-reward]")];
const tavernDialogueLine = document.querySelector<HTMLElement>("#tavern-dialogue-line")!;
const tavernDialogueNext = document.querySelector<HTMLButtonElement>("#tavern-dialogue-next")!;
const tavernDialogueClose = document.querySelector<HTMLButtonElement>("#tavern-dialogue-close")!;
const quizPanel = document.querySelector<HTMLElement>("#tavern-quiz")!;
const quizBalance = document.querySelector<HTMLElement>("#tavern-quiz-balance")!;
const quizBalanceAmount = document.querySelector<HTMLElement>("#tavern-quiz-balance-amount")!;
const quizPotDisplay = document.querySelector<HTMLElement>("#tavern-quiz-pot-display")!;
const quizPotLabel = document.querySelector<HTMLElement>(".quiz-pot-label")!;
const quizWinToast = document.querySelector<HTMLElement>("#quiz-win-toast")!;
const quizAnswerFeedback = document.querySelector<HTMLElement>("#quiz-answer-feedback")!;
const quizFeedbackIcon = document.querySelector<HTMLElement>("#quiz-feedback-icon")!;
const quizFeedbackTitle = document.querySelector<HTMLElement>("#quiz-feedback-title")!;
const quizFeedbackDetail = document.querySelector<HTMLElement>("#quiz-feedback-detail")!;
const quizMessage = document.querySelector<HTMLElement>("#tavern-quiz-message")!;
const quizStakeHeading = document.querySelector<HTMLElement>("#quiz-stake-heading")!;
const quizStakes = document.querySelector<HTMLElement>("#tavern-quiz-stakes")!;
const quizQuestion = document.querySelector<HTMLElement>("#tavern-quiz-question")!;
const quizPot = document.querySelector<HTMLElement>("#tavern-quiz-pot")!;
const quizPrompt = document.querySelector<HTMLElement>("#tavern-quiz-prompt")!;
const quizChoices = document.querySelector<HTMLElement>("#tavern-quiz-choices")!;
const quizDecision = document.querySelector<HTMLElement>("#tavern-quiz-decision")!;
const quizDouble = document.querySelector<HTMLButtonElement>("#tavern-quiz-double")!;
const quizQuit = document.querySelector<HTMLButtonElement>("#tavern-quiz-quit")!;
const quizClose = document.querySelector<HTMLButtonElement>("#tavern-quiz-close")!;
const tavernCoins = document.querySelector<HTMLElement>("#tavern-coins")!;
const playerCount = document.querySelector<HTMLElement>("#players")!;
const dangerZone = document.querySelector<HTMLElement>("#danger-zone")!;
const dangerZoneName = document.querySelector<HTMLElement>("#danger-zone-name")!;
const dangerZoneTier = document.querySelector<HTMLElement>("#danger-zone-tier")!;
const dangerZoneDetail = document.querySelector<HTMLElement>("#danger-zone-detail")!;
const exitGuide = document.querySelector<HTMLElement>("#exit-guide")!;
const performanceToggle = document.querySelector<HTMLButtonElement>("#performance-toggle")!;
const performancePanel = document.querySelector<HTMLElement>("#performance-panel")!;
const movementDebug = document.querySelector<HTMLDetailsElement>("#movement-debug")!;
const movementDebugLive = document.querySelector<HTMLElement>("#movement-debug-live")!;
const movementDebugEvents = document.querySelector<HTMLOListElement>("#movement-debug-events")!;
const movementDebugCopy = document.querySelector<HTMLButtonElement>("#movement-debug-copy")!;
const movementDebugTrace = document.querySelector<HTMLElement>("#movement-debug-trace")!;
const playerHudRoot = document.querySelector<HTMLElement>("#player-hud-root")!;
if (!playerHudRoot) throw new Error("Player HUD root is missing");
playerHud.mount(playerHudRoot);
const playerLevel = document.querySelector<HTMLButtonElement>("#player-level")!;
const inventoryLevel = document.querySelector<HTMLElement>("#inventory-level")!;
const characterPoints = document.querySelector<HTMLElement>("#character-points")!;
const statPower = document.querySelector<HTMLElement>("#stat-power")!;
const statVitality = document.querySelector<HTMLElement>("#stat-vitality")!;
const statAgility = document.querySelector<HTMLElement>("#stat-agility")!;
const statMining = document.querySelector<HTMLElement>("#stat-mining")!;
const levelUpPanel = document.querySelector<HTMLElement>("#level-up-panel")!;
const levelUpTitle = document.querySelector<HTMLElement>("#level-up-title")!;
const levelUpMessage = document.querySelector<HTMLElement>("#level-up-message")!;
const levelUpPoints = document.querySelector<HTMLElement>("#level-up-points")!;
const characterStatButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-character-stat]")];
const defenseSlot = document.querySelector<HTMLButtonElement>("#defense-slot")!;
const traitSlot = document.querySelector<HTMLElement>("#trait-slot")!;
const traitName = document.querySelector<HTMLElement>("#trait-name")!;
const traitDetail = document.querySelector<HTMLElement>("#trait-detail")!;
const traitBonus = document.querySelector<HTMLElement>("#trait-bonus")!;
const traitPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#trait-picker [data-trait]")];
const momentumPips = [...document.querySelectorAll<HTMLElement>("#momentum-pips i")];
const combatHudRoot = document.querySelector<HTMLElement>("#combat-hud-root")!;
if (!combatHudRoot) throw new Error("Combat HUD root is missing");
combatHud.mount(combatHudRoot);
const powerSlot = document.querySelector<HTMLButtonElement>("#power-slot")!;
const powerPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#power-picker [data-power]")];
const powerLoadoutButtons = [...document.querySelectorAll<HTMLButtonElement>("#power-loadout-slots [data-power-slot]")];
const characterMilestones = document.querySelector<HTMLElement>("#character-milestones")!;
const mainHandPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#main-hand-picker [data-main-hand]")];
const seismicUpgrades = document.querySelector<HTMLElement>("#seismic-upgrades")!;
const seismicMasteryButtons = [...document.querySelectorAll<HTMLButtonElement>("#seismic-mastery-picker [data-seismic-mastery]")];
const specialSlot = document.querySelector<HTMLButtonElement>("#special-slot")!;
const specialPickerButtons = [...document.querySelectorAll<HTMLButtonElement>("#special-picker [data-special]")];
const controlsHelp = document.querySelector<HTMLElement>("#controls-help")!;
const combatReticle = document.querySelector<HTMLElement>("#combat-reticle")!;
const combatFeedback = document.querySelector<HTMLElement>("#combat-feedback")!;
const worldObjective = document.querySelector<HTMLElement>("#world-objective")!;
const objectiveTier = document.querySelector<HTMLElement>("#objective-tier")!;
const objectiveTitle = document.querySelector<HTMLElement>("#objective-title")!;
const objectiveDetail = document.querySelector<HTMLElement>("#objective-detail")!;
const objectiveLoot = document.querySelector<HTMLElement>("#objective-loot")!;
const objectiveProgress = document.querySelector<HTMLElement>("#objective-progress")!;
const objectiveDistance = document.querySelector<HTMLElement>("#objective-distance")!;
const objectiveMarker = document.querySelector<HTMLElement>("#objective-marker")!;
const objectiveMarkerDistance = document.querySelector<HTMLElement>("#objective-marker-distance")!;
const objectiveMarkerLabel = document.querySelector<HTMLElement>("#objective-marker-label")!;
const objectiveComplete = document.querySelector<HTMLElement>("#objective-complete")!;
const objectiveCompleteTitle = document.querySelector<HTMLElement>("#objective-complete-title")!;
const objectiveCompleteReward = document.querySelector<HTMLElement>("#objective-complete-reward")!;
const depthsRouteMap = document.querySelector<HTMLElement>("#depths-route-map")!;
const depthsRouteTitle = document.querySelector<HTMLElement>("#depths-route-title")!;
const depthsRouteCount = document.querySelector<HTMLElement>("#depths-route-count")!;
const depthsRouteDistance = document.querySelector<HTMLElement>("#depths-route-distance")!;
const depthsPartyPanel = document.querySelector<HTMLElement>("#depths-party-status")!;
const depthsPartyCount = document.querySelector<HTMLElement>("#depths-party-count")!;
const depthsPartyMembers = document.querySelector<HTMLElement>("#depths-party-members")!;
const depthsRetryPrompt = document.querySelector<HTMLElement>("#depths-retry-prompt")!;
const depthsRetryEnter = document.querySelector<HTMLButtonElement>("#depths-retry-enter")!;
document.querySelector<HTMLButtonElement>("#depths-retry-dismiss")!.addEventListener("click", () => { depthsRetryPrompt.hidden = true; });
depthsRetryEnter.addEventListener("click", () => {
  if (!room || !worldReady) { status.textContent = "Wait for the town to finish loading before re-entering."; return; }
  depthsRetryEnter.disabled = true;
  room.send("portal:use", { id: "depths-entry" });
  window.setTimeout(() => { depthsRetryEnter.disabled = false; }, 2500);
});
const depthsWingChoice = document.querySelector<HTMLElement>("#depths-wing-choice")!;
const depthsWingRewards = document.querySelector<HTMLElement>("#depths-wing-rewards")!;
const depthsRewardsTitle = document.querySelector<HTMLElement>("#depths-rewards-title")!;
const depthsRewardOreName = document.querySelector<HTMLElement>("#depths-reward-ore-name")!;
const depthsRewardOreState = document.querySelector<HTMLElement>("#depths-reward-ore-state")!;
const depthsRewardGearName = document.querySelector<HTMLElement>("#depths-reward-gear-name")!;
const depthsRewardGearState = document.querySelector<HTMLElement>("#depths-reward-gear-state")!;
const depthsRewardParty = document.querySelector<HTMLElement>("#depths-reward-party")!;
const depthsCheckpoint = document.querySelector<HTMLElement>("#depths-checkpoint")!;
const depthsCheckpointCount = document.querySelector<HTMLElement>("#depths-checkpoint-count")!;
const depthsCheckpointHint = document.querySelector<HTMLElement>("#depths-checkpoint-hint")!;
const depthsCheckpointReady = document.querySelector<HTMLButtonElement>("#depths-checkpoint-ready")!;
const depthsWingButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-depths-wing]")];
const depthsRouteNodes = [...document.querySelectorAll<HTMLElement>("[data-depths-node]")];
const inventoryPanel = document.querySelector<HTMLElement>("#inventory-panel")!;
const inventoryTotal = document.querySelector<HTMLElement>("#inventory-total")!;
const inventoryToggle = document.querySelector<HTMLButtonElement>("#inventory-toggle")!;
const inventoryClose = document.querySelector<HTMLButtonElement>("#inventory-close")!;
const inventoryBadge = document.querySelector<HTMLElement>("#inventory-badge")!;
const inventoryEquipped = document.querySelector<HTMLElement>("#inventory-equipped")!;
const inventoryCountElements = new Map<ItemId, HTMLElement>(
  [...document.querySelectorAll<HTMLElement>("[data-item-count]")].map(element => [element.dataset.itemCount as ItemId, element]),
);
const inventoryEquipButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-equip-main-hand]")];
const requiredInventoryMainHands = Object.values(MAIN_HAND_DEFINITIONS).filter(definition => "requiredItemId" in definition).length;
const performanceFields = {
  frame: document.querySelector<HTMLElement>("#perf-frame")!,
  fps: document.querySelector<HTMLElement>("#perf-fps")!,
  rtt: document.querySelector<HTMLElement>("#perf-rtt")!,
  voxels: document.querySelector<HTMLElement>("#perf-voxels")!,
  geometry: document.querySelector<HTMLElement>("#perf-geometry")!,
  chunks: document.querySelector<HTMLElement>("#perf-chunks")!,
  payload: document.querySelector<HTMLElement>("#perf-payload")!,
  memory: document.querySelector<HTMLElement>("#perf-memory")!,
  budget: document.querySelector<HTMLElement>("#perf-budget")!,
};
const joystickZone = document.querySelector<HTMLElement>("#joystick-zone")!;
const joystickKnob = document.querySelector<HTMLElement>("#joystick-knob")!;
const mineButton = document.querySelector<HTMLButtonElement>("#mine-button")!;
const dodgeButton = document.querySelector<HTMLButtonElement>("#dodge-button")!;
const defenseButton = document.querySelector<HTMLButtonElement>("#defense-button")!;
const powerButton = document.querySelector<HTMLButtonElement>("#power-button")!;
const specialButton = document.querySelector<HTMLButtonElement>("#special-button")!;
const touchModeButton = document.querySelector<HTMLButtonElement>("#touch-mode-button")!;
const touchModeLabel = document.querySelector<HTMLElement>("#touch-mode-label")!;
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("#mode-toggle [data-mode]")];
if (!canvas || !status || !targetLabel || !tavernDialogue || !tavernDialogueLine || !tavernDialogueNext || !tavernDialogueClose || !playerCount || !dangerZone || !dangerZoneName || !dangerZoneTier || !dangerZoneDetail || !exitGuide || !performanceToggle || !performancePanel || !inventoryPanel || !inventoryTotal || !inventoryToggle || !inventoryClose || !inventoryBadge || !inventoryEquipped || inventoryCountElements.size !== Object.keys(ITEM_DEFINITIONS).length || inventoryEquipButtons.length !== requiredInventoryMainHands || !movementDebug || !movementDebugLive || !movementDebugEvents || !movementDebugCopy || !joystickZone || !joystickKnob || !mineButton || !dodgeButton || !defenseButton || !powerButton || !specialButton || !touchModeButton || !touchModeLabel || !defenseSlot || !traitSlot || !traitName || !traitDetail || !traitBonus || traitPickerButtons.length !== 3 || momentumPips.length !== MOMENTUM_TRAIT.maxStacks || !powerSlot || !seismicUpgrades || seismicMasteryButtons.length !== 2 || !specialSlot || powerPickerButtons.length !== 4 || specialPickerButtons.length !== 2 || mainHandPickerButtons.length !== 3 || !controlsHelp || !combatReticle || !combatFeedback || modeButtons.length !== 2) {
  throw new Error("Game shell is missing required elements");
}
if ([quizTablePrompt, blacksmithPrompt, playerTradePrompt, playerTradeName, blacksmithPanel, blacksmithMessage, blacksmithOre, blacksmithGold, blacksmithPrice, blacksmithSell, blacksmithClose, quizPanel, quizBalance, quizBalanceAmount, quizPotDisplay, quizPotLabel, quizWinToast, quizAnswerFeedback, quizFeedbackIcon, quizFeedbackTitle, quizFeedbackDetail, quizMessage, quizStakeHeading, quizStakes, quizQuestion, quizPot, quizPrompt, quizChoices, quizDecision, quizDouble, quizQuit, quizClose, tavernCoins].some(element => !element) || blacksmithUpgradeCards.length !== Object.keys(BLACKSMITH_UPGRADES).length) {
  throw new Error("Tavern quiz shell is missing required elements");
}
if ([worldObjective, objectiveTier, objectiveTitle, objectiveDetail, objectiveLoot, objectiveProgress, objectiveDistance, objectiveMarker, objectiveMarkerDistance, objectiveMarkerLabel, objectiveComplete, objectiveCompleteTitle, objectiveCompleteReward].some(element => !element)) {
  throw new Error("World objective shell is missing required elements");
}
if (
  !depthsRouteMap ||
  !depthsRouteTitle ||
  !depthsRouteCount ||
  !depthsRouteDistance ||
  !depthsWingChoice ||
  depthsWingButtons.length !== 2 ||
  depthsRouteNodes.length !== DEPTHS_ROUTE_NODES.length
) {
  throw new Error("Silver Depths route shell is missing required elements");
}
if ([playerLevel, inventoryLevel, characterPoints, statPower, statVitality, statAgility, statMining, levelUpPanel, levelUpTitle, levelUpMessage, levelUpPoints].some(element => !element) || characterStatButtons.length !== 4) {
  throw new Error("Character progression shell is missing required elements");
}

function applyDefensePose(rig: VoxelCharacterRig): void {
  rig.torso.setLocalEulerAngles(7, 0, 0);
  rig.leftArm.setLocalEulerAngles(-82, 0, -32);
  rig.rightArm.setLocalEulerAngles(-68, 0, 28);
}

if (window.matchMedia("(pointer: coarse), (max-width: 820px)").matches) {
  movementDebug.open = false;
}

const app = new pc.Application(canvas, {
  graphicsDeviceOptions: { antialias: true, alpha: false },
  mouse: new pc.Mouse(canvas),
  touch: new pc.TouchDevice(canvas),
});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight = new pc.Color(0.43, 0.48, 0.54);
app.scene.fog.type = pc.FOG_LINEAR;
app.scene.fog.color = new pc.Color(0.21, 0.3, 0.32);
app.scene.fog.start = 34;
app.scene.fog.end = 58;
app.start();

const camera = new pc.Entity("camera");
camera.addComponent("camera", {
  clearColor: new pc.Color(0.21, 0.3, 0.32), farClip: 120, fov: 42,
  toneMapping: pc.TONEMAP_ACES, gammaCorrection: pc.GAMMA_SRGB,
});
app.root.addChild(camera);
let cameraOrbit = initialCameraOrbit();
let indoorCameraBlend = 0;

const light = new pc.Entity("sun");
light.addComponent("light", {
  type: "directional", color: new pc.Color(1, 0.93, 0.82), intensity: 1.45,
  castShadows: true, shadowResolution: 2048, shadowType: pc.SHADOW_PCF3_32F,
  shadowDistance: 55, normalOffsetBias: 0.06, shadowBias: 0.2, numCascades: 1,
});
light.setEulerAngles(52, -28, 0);
app.root.addChild(light);

const skyFill = new pc.Entity("cool-sky-fill");
skyFill.addComponent("light", { type: "directional", color: new pc.Color(0.53, 0.7, 1), intensity: 0.32, castShadows: false });
skyFill.setEulerAngles(35, 145, 0);
app.root.addChild(skyFill);

const caveLight = new pc.Entity("explorer-lantern");
caveLight.addComponent("light", { type: "omni", color: new pc.Color(1, 0.76, 0.44), intensity: 1.7, range: 12, castShadows: false });
caveLight.enabled = false;
app.root.addChild(caveLight);

const worldRoot = new pc.Entity("voxel-world");
app.root.addChild(worldRoot);
const caveFogRoot = new pc.Entity("undiscovered-cave");
app.root.addChild(caveFogRoot);
const caveFogMaterial = new pc.StandardMaterial();
caveFogMaterial.diffuse = new pc.Color(0.018, 0.033, 0.038);
caveFogMaterial.useLighting = false;
caveFogMaterial.useFog = false;
caveFogMaterial.cull = pc.CULLFACE_NONE;
caveFogMaterial.update();
let caveFogMesh: pc.Mesh | null = null;
const caveDiscoveries = new Map<number, Set<string>>();
let caveDiscoverySampleKey = "";
let caveFogViewKey = "";
let caveDiscoveryRevision = 0;
let lastCaveDiscoveryAt = -Infinity;
let buriedChamberDiscovered = false;
const caveLanterns: { root: pc.Entity; x: number; y: number; z: number }[] = [];
const discoveredChambers = new Set<string>();
let caveReturnRoute: CavePosition[] = [];
let caveRouteKey = "";
let lastCaveNavigationAt = -Infinity;

function updateCaveNavigation(position: pc.Vec3, now: number): void {
  if (now - lastCaveNavigationAt < 250) return;
  lastCaveNavigationAt = now;
  discoverChambers(caveDiscoveries, discoveredChambers, readCollisionWorldBlock);
  const enabled = minimap.surfaceGuideEnabled();
  const key = `${caveCellKey(position.x, position.z)}:${Math.floor(position.y + 0.1)}:${caveDiscoveryRevision}:${[...caveDiscoveries].map(([band, cells]) => `${band}:${cells.size}`).join(",")}:${enabled}`;
  if (key !== caveRouteKey) {
    caveRouteKey = key;
    caveReturnRoute = enabled ? caveReturnPath(position, readCollisionWorldBlock, (x, y, z) => {
      // Only the known entrance landing is permitted outside underground discovery bands.
      if (y >= 7) return x >= 31 && x <= 35 && z >= 7 && z <= 9;
      return Boolean(caveDiscoveries.get(caveDepthBand(y))?.has(caveCellKey(x, z)));
    }) : [];
  }
  minimap.setCaveState({ known: caveDiscoveries.get(caveDepthBand(position.y)) ?? new Set(), chambers: CAVE_CHAMBERS.filter(chamber => discoveredChambers.has(chamber.id)), route: caveReturnRoute });
}

function undergroundKnown(x: number, y: number, z: number): boolean {
  if (!playerCutaway.active || localPlayer.getPosition().y >= SURFACE_HEIGHT) return true;
  const band = caveDepthBand(localPlayer.getPosition().y);
  return caveDepthBand(y) === band && Boolean(caveDiscoveries.get(band)?.has(caveCellKey(x, z)));
}

function undergroundMobVisible(x: number, y: number, z: number): boolean {
  const player = localPlayer.getPosition();
  const underground = playerCutaway.active && player.y < SURFACE_HEIGHT;
  const known = undergroundKnown(x, y, z);
  const cutawayHidden = isCutawayHidden(Math.floor(x), Math.floor(y), Math.floor(z));
  const distance = Math.hypot(x - player.x, y - player.y, z - player.z);
  const lineClear = underground && distance <= 20 && Math.abs(y - player.y) <= 3
    ? enemyCueLineClear({ x: player.x, y: player.y + .8, z: player.z }, { x, y: y + .8, z }, readCollisionWorldBlock)
    : false;
  return undergroundThreatVisible({ underground, known, cutawayHidden,
    verticalDistance: Math.abs(y - player.y), distance, lineClear });
}

function updateCaveDiscovery(position: pc.Vec3, now: number): void {
  const active = playerCutaway.active && position.y < SURFACE_HEIGHT;
  caveFogRoot.enabled = active;
  if (!active) {
    caveDiscoverySampleKey = "";
    for (const lantern of caveLanterns) lantern.root.enabled = false;
    return;
  }
  const band = caveDepthBand(position.y);
  let known = caveDiscoveries.get(band);
  if (!known) { known = new Set(); caveDiscoveries.set(band, known); }
  const sampleKey = `${caveCellKey(position.x, position.z)}:${band}:${caveDiscoveryRevision}`;
  let changed = false;
  if (sampleKey !== caveDiscoverySampleKey && now - lastCaveDiscoveryAt >= 200) {
    lastCaveDiscoveryAt = now;
    caveDiscoverySampleKey = sampleKey;
    changed = discoverCave(position, known, readCollisionWorldBlock);
    if (!buriedChamberDiscovered && band === 0 && known.has("54,8") && readWorldBlock(54, 1, 8) === Block.Air) {
      buriedChamberDiscovered = true;
      showCombatFeedback("BURIED CHAMBER DISCOVERED", "dodge");
      logMovementEvent("DISCOVERY buried-chamber");
    }
  }
  for (const lantern of caveLanterns) lantern.root.enabled = undergroundKnown(lantern.x, lantern.y, lantern.z) && Math.hypot(position.x - lantern.x, position.z - lantern.z) < 12;
  for (let i = 0; i < MILESTONE_EXIT_STEPS.length; i++) {
    const step = MILESTONE_EXIT_STEPS[i]!;
    exitTrail.children[i]!.enabled = undergroundKnown(step.x, step.topY, step.z);
  }
  const center = worldToChunk(position.x, position.z);
  const viewKey = `${center.chunkX},${center.chunkZ}:${band}:${playerCutaway.sliceY}`;
  if (!changed && viewKey === caveFogViewKey && caveFogMesh) return;
  caveFogViewKey = viewKey;
  if (caveFogMesh) caveFogMesh.destroy();
  for (const child of [...caveFogRoot.children]) child.destroy();
  const minX = (center.chunkX - ACTIVE_CHUNK_RENDER_RADIUS) * CHUNK_SIZE;
  const minZ = (center.chunkZ - ACTIVE_CHUNK_RENDER_RADIUS) * CHUNK_SIZE;
  const size = (ACTIVE_CHUNK_RENDER_RADIUS * 2 + 1) * CHUNK_SIZE;
  const positions: number[] = [], indices: number[] = [];
  const y = playerCutaway.sliceY + 0.025;
  for (const run of caveFogRuns(known, minX, minX + size, minZ, minZ + size)) {
    const index = positions.length / 3;
    positions.push(run.x, y, run.z, run.endX, y, run.z, run.endX, y, run.z + 1, run.x, y, run.z + 1);
    indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
  }
  const geometry = new pc.Geometry(); geometry.positions = positions; geometry.indices = indices;
  caveFogMesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry);
  const entity = new pc.Entity("cave-fog-mask");
  entity.addComponent("render", { meshInstances: [new pc.MeshInstance(caveFogMesh, caveFogMaterial)], castShadows: false, receiveShadows: false });
  caveFogRoot.addChild(entity);
}
const sceneDressing = new SceneDressing(app);

const exitTrail = new pc.Entity("exit-trail");
const exitTrailMaterial = new pc.StandardMaterial();
exitTrailMaterial.diffuse = new pc.Color(1, 0.72, 0.08);
exitTrailMaterial.emissive = new pc.Color(0.82, 0.34, 0.01);
exitTrailMaterial.opacity = 0.88;
exitTrailMaterial.blendType = pc.BLEND_NORMAL;
exitTrailMaterial.depthWrite = false;
exitTrailMaterial.update();
for (const step of MILESTONE_EXIT_STEPS) {
  const marker = new pc.Entity("exit-step");
  marker.addComponent("render", { type: "box", castShadows: false });
  if (marker.render) marker.render.material = exitTrailMaterial;
  marker.setLocalScale(0.72, 0.06, 0.72);
  marker.setPosition(step.x, step.topY + 0.04, step.z);
  exitTrail.addChild(marker);
}
exitTrail.enabled = false;
app.root.addChild(exitTrail);

const materials = new Map<VoxelTextureKind, pc.StandardMaterial>();

function createVoxelTexture(kind: VoxelTextureKind): pc.Texture {
  const size = 32;
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = size;
  canvasTexture.height = size;
  const context = canvasTexture.getContext("2d")!;
  const imageData = context.createImageData(size, size);
  imageData.data.set(createVoxelTexturePixels(kind, size));
  context.putImageData(imageData, 0, 0);
  const texture = new pc.Texture(app.graphicsDevice, {
    width: size,
    height: size,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_REPEAT,
    addressV: pc.ADDRESS_REPEAT,
  });
  texture.setSource(canvasTexture);
  return texture;
}

function materialFor(kind: VoxelTextureKind): pc.StandardMaterial {
  let material = materials.get(kind);
  if (!material) {
    material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 1, 1);
    material.diffuseMap = createVoxelTexture(kind);
    material.diffuseVertexColor = true;
    const metal = kind === "bronze" || kind === "iron" || kind === "silver" || kind === "moonstone";
    material.specular = new pc.Color(metal ? 0.26 : 0.035, metal ? 0.2 : 0.035, metal ? 0.12 : 0.035);
    material.gloss = metal ? 0.28 : 0.06;
    if (kind === "bronze") material.emissive = new pc.Color(0.05, 0.029, 0.008);
    if (kind === "moonstone") { material.emissive = new pc.Color(.2, .045, .32); material.gloss = .48; }
    material.update();
    materials.set(kind, material);
  }
  return material;
}

const faces = [
  { normal: [1, 0, 0], tangentAxes: [1, 2], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { normal: [-1, 0, 0], tangentAxes: [1, 2], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { normal: [0, 1, 0], tangentAxes: [0, 2], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { normal: [0, -1, 0], tangentAxes: [0, 2], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, 1], tangentAxes: [0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], tangentAxes: [0, 1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
] as const;

const faceUvCorners = [[0, 0], [0, 1], [1, 1], [1, 0]] as const;

interface ClientChunk {
  chunkX: number;
  chunkZ: number;
  revision: number;
  blocks: Uint8Array;
  root: pc.Entity;
  meshes: pc.Mesh[];
  visibleBlocks: number;
  visibleFaces: number;
  renderedSliceKey: string | null;
}

const chunks = new Map<string, ClientChunk>();
let activeChunkViewKey: string | null = null;
let requestedChunkRegionKey: string | null = null;
const ACTIVE_CHUNK_RENDER_RADIUS = 2;
const CACHED_CHUNK_RADIUS = 4;
let indoorRoofBuilding: (typeof TOWN_BUILDINGS)[number] | null = null;
const playerCutaway: PlayerCutaway = {
  active: false,
  sliceY: CHUNK_HEIGHT,
};

function chunkKey(chunkX: number, chunkZ: number): string {
  return `${chunkX},${chunkZ}`;
}

function readWorldBlock(x: number, y: number, z: number): BlockId {
  if (y < 0 || y >= CHUNK_HEIGHT) return Block.Air;
  const address = worldToChunk(x, z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk) return Block.Air;
  return (chunk.blocks[chunkIndex(address.localX, y, address.localZ)] ?? Block.Air) as BlockId;
}

function readCollisionWorldBlock(x: number, y: number, z: number): BlockId {
  if (y < 0) return Block.Bedrock;
  if (y >= CHUNK_HEIGHT) return Block.Air;
  const address = worldToChunk(x, z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk) return Block.Bedrock;
  return (chunk.blocks[chunkIndex(address.localX, y, address.localZ)] ?? Block.Air) as BlockId;
}

function isCutawayHidden(x: number, y: number, z: number): boolean {
  return isVoxelHiddenForPlayer(x, y, z, playerCutaway)
    || hidesTownRoof(indoorRoofBuilding, x, y, z)
    || hidesTownUpperWall(indoorRoofBuilding, x, y, z);
}

function readVisibleWorldBlock(x: number, y: number, z: number): BlockId {
  return isCutawayHidden(x, y, z) ? Block.Air : readWorldBlock(x, y, z);
}

function rebuildChunk(chunk: ClientChunk): void {
  for (const mesh of chunk.meshes) mesh.destroy();
  chunk.meshes = [];
  for (const child of [...chunk.root.children]) child.destroy();
  chunk.visibleBlocks = 0;
  chunk.visibleFaces = 0;
  chunk.renderedSliceKey = cutawayStateKey;
  const buffers = new Map<VoxelTextureKind, { positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[] }>();
  // One padded snapshot amortizes AO lookups and includes adjacent chunks. Hidden
  // roof blocks must not leave dark shadows floating on the player's depth slice.
  const span = CHUNK_SIZE + 2;
  const plane = span * span;
  const strides = [1, plane, span];
  const visible = new Uint8Array(plane * (CHUNK_HEIGHT + 2));
  for (let y = -1; y <= CHUNK_HEIGHT; y += 1) {
    for (let z = -1; z <= CHUNK_SIZE; z += 1) {
      for (let x = -1; x <= CHUNK_SIZE; x += 1) {
        visible[(y + 1) * plane + (z + 1) * span + x + 1] = readVisibleWorldBlock(
          chunk.chunkX * CHUNK_SIZE + x, y, chunk.chunkZ * CHUNK_SIZE + z,
        );
      }
    }
  }
  for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
    for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
      for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
        const block = chunk.blocks[chunkIndex(localX, y, localZ)] ?? Block.Air;
        if (block === Block.Air) continue;
        const x = chunk.chunkX * CHUNK_SIZE + localX;
        const z = chunk.chunkZ * CHUNK_SIZE + localZ;
        if (isCutawayHidden(x, y, z)) continue;
        chunk.visibleBlocks += 1;
        for (const face of faces) {
          const outsideIndex = (y + face.normal[1] + 1) * plane
            + (localZ + face.normal[2] + 1) * span + localX + face.normal[0] + 1;
          const neighbor = visible[outsideIndex];
          if (neighbor !== Block.Air) continue;
          const textureKind = voxelTextureKind(block, face.normal[1], x, y, z);
          let buffer = buffers.get(textureKind);
          if (!buffer) {
            buffer = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
            buffers.set(textureKind, buffer);
          }
          chunk.visibleFaces += 1;
          const base = buffer.positions.length / 3;
          const tint = voxelTint(x, y, z, textureKind);
          for (const corner of face.corners) {
            buffer.positions.push(x + corner[0], y + corner[1], z + corner[2]);
            buffer.normals.push(...face.normal);
            const axisA = face.tangentAxes[0];
            const axisB = face.tangentAxes[1];
            const offsetA = (corner[axisA] === 0 ? -1 : 1) * strides[axisA]!;
            const offsetB = (corner[axisB] === 0 ? -1 : 1) * strides[axisB]!;
            const shade = voxelCornerLight(
              visible[outsideIndex + offsetA] !== Block.Air,
              visible[outsideIndex + offsetB] !== Block.Air,
              visible[outsideIndex + offsetA + offsetB] !== Block.Air,
            );
            buffer.colors.push(Math.round(tint[0] * shade * 255), Math.round(tint[1] * shade * 255), Math.round(tint[2] * shade * 255), 255);
          }
          const rotate = face.normal[1] > 0 && (textureKind === "grass-top" || textureKind === "dirt" || textureKind === "stone")
            ? (Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) & 3 : 0;
          for (let i = 0; i < 4; i += 1) buffer.uvs.push(...faceUvCorners[(i + rotate) % 4]!);
          // The less-occluded diagonal avoids a bright triangle through dark corners.
          if (buffer.colors[base * 4]! + buffer.colors[(base + 2) * 4]!
            > buffer.colors[(base + 1) * 4]! + buffer.colors[(base + 3) * 4]!) {
            buffer.indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
          } else buffer.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  const meshInstances: pc.MeshInstance[] = [];
  for (const [textureKind, buffer] of buffers) {
    if (buffer.indices.length === 0) continue;
    const geometry = new pc.Geometry();
    geometry.positions = buffer.positions;
    geometry.normals = buffer.normals;
    geometry.uvs = buffer.uvs;
    geometry.colors = buffer.colors;
    geometry.indices = buffer.indices;
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry);
    chunk.meshes.push(mesh);
    meshInstances.push(new pc.MeshInstance(mesh, materialFor(textureKind)));
  }
  if (meshInstances.length === 0) return;
  const entity = new pc.Entity(`chunk-mesh:${chunk.chunkX},${chunk.chunkZ}`);
  entity.addComponent("render", { meshInstances, castShadows: true, receiveShadows: true });
  chunk.root.addChild(entity);
}

function installChunk(snapshot: ChunkSnapshot): ClientChunk {
  const key = chunkKey(snapshot.chunkX, snapshot.chunkZ);
  const previous = chunks.get(key);
  if (previous && previous.revision >= snapshot.revision) return previous;
  for (const mesh of previous?.meshes ?? []) mesh.destroy();
  previous?.root.destroy();
  const root = new pc.Entity(`chunk:${key}`);
  worldRoot.addChild(root);
  const chunk = {
    chunkX: snapshot.chunkX,
    chunkZ: snapshot.chunkZ,
    revision: snapshot.revision,
    blocks: Uint8Array.from(snapshot.blocks),
    root,
    meshes: [],
    visibleBlocks: 0,
    visibleFaces: 0,
    renderedSliceKey: null,
  };
  chunks.set(key, chunk);
  return chunk;
}

function rebuildChunkAndNeighbors(chunk: ClientChunk, x: number, z: number): void {
  if (chunk.root.enabled) rebuildChunk(chunk);
  else chunk.renderedSliceKey = null;
  const address = worldToChunk(x, z);
  const neighborKeys = new Set<string>();
  if (address.localX === 0) neighborKeys.add(chunkKey(address.chunkX - 1, address.chunkZ));
  if (address.localX === CHUNK_SIZE - 1) neighborKeys.add(chunkKey(address.chunkX + 1, address.chunkZ));
  if (address.localZ === 0) neighborKeys.add(chunkKey(address.chunkX, address.chunkZ - 1));
  if (address.localZ === CHUNK_SIZE - 1) neighborKeys.add(chunkKey(address.chunkX, address.chunkZ + 1));
  // A changed corner also changes the diagonal chunk's baked contact shadow.
  const edgeX = address.localX === 0 ? -1 : address.localX === CHUNK_SIZE - 1 ? 1 : 0;
  const edgeZ = address.localZ === 0 ? -1 : address.localZ === CHUNK_SIZE - 1 ? 1 : 0;
  if (edgeX && edgeZ) neighborKeys.add(chunkKey(address.chunkX + edgeX, address.chunkZ + edgeZ));
  for (const key of neighborKeys) {
    const neighbor = chunks.get(key);
    if (neighbor?.root.enabled) rebuildChunk(neighbor);
    else if (neighbor) neighbor.renderedSliceKey = null;
  }
}

function updateActiveChunkMeshes(position: { x: number; z: number }): void {
  const address = worldToChunk(position.x, position.z);
  const regionKey = chunkKey(address.chunkX, address.chunkZ);
  if (regionKey !== requestedChunkRegionKey && room && worldReady) {
    requestedChunkRegionKey = regionKey;
    room.send("world:chunks", {
      chunkX: address.chunkX, chunkZ: address.chunkZ,
      knownChunks: [...chunks.values()].slice(0, 121).map(chunk => ({
        chunkX: chunk.chunkX, chunkZ: chunk.chunkZ, revision: chunk.revision,
      })),
    });
  }
  const viewKey = `${address.chunkX},${address.chunkZ}:${cutawayStateKey}`;
  if (viewKey === activeChunkViewKey) return;
  activeChunkViewKey = viewKey;
  for (const chunk of chunks.values()) {
    const nearby = Math.abs(chunk.chunkX - address.chunkX) <= ACTIVE_CHUNK_RENDER_RADIUS
      && Math.abs(chunk.chunkZ - address.chunkZ) <= ACTIVE_CHUNK_RENDER_RADIUS;
    chunk.root.enabled = nearby;
    if (nearby && chunk.renderedSliceKey !== cutawayStateKey) rebuildChunk(chunk);
  }
}

function applyChunkRegion(payload: ChunkRegion): void {
  if (payload.chunks.length === 0) return;
  const buildStartedAt = performance.now();
  payload.chunks.forEach(installChunk);
  const position = localPlayer.getPosition();
  const center = worldToChunk(position.x, position.z);
  for (const [key, chunk] of chunks) {
    if (Math.abs(chunk.chunkX - center.chunkX) <= CACHED_CHUNK_RADIUS
      && Math.abs(chunk.chunkZ - center.chunkZ) <= CACHED_CHUNK_RADIUS) continue;
    for (const mesh of chunk.meshes) mesh.destroy();
    chunk.root.destroy();
    chunks.delete(key);
  }
  activeChunkViewKey = null;
  updateActiveChunkMeshes(position);
  sceneDressing.rebuild(readWorldBlock, [...chunks.values()], indoorRoofBuilding);
  sceneDressing.setSurfaceVisible(!playerCutaway.active);
  lastChunkBuildMs = performance.now() - buildStartedAt;
  logMovementEvent(`CHUNK STREAM count=${payload.chunks.length} build=${lastChunkBuildMs.toFixed(1)}ms`);
}

const localPlayer = new pc.Entity("local-player");
const silhouetteMaterial = new pc.StandardMaterial();
silhouetteMaterial.diffuse = new pc.Color(1, 0.72, 0.18);
silhouetteMaterial.emissive = new pc.Color(1, 0.42, 0.04);
silhouetteMaterial.opacity = 0.22;
silhouetteMaterial.blendType = pc.BLEND_NORMAL;
silhouetteMaterial.depthTest = false;
silhouetteMaterial.depthWrite = false;
silhouetteMaterial.update();

function appearanceColor(group: keyof typeof APPEARANCE_PALETTE, id: string): pc.Color {
  const options = APPEARANCE_PALETTE[group] as readonly { id: string; color: string }[];
  const hex = (options.find(option => option.id === id) ?? options[0]!).color;
  return new pc.Color(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
}
const bootMaterial = new pc.StandardMaterial();
bootMaterial.diffuse = new pc.Color(0.23, 0.15, 0.105);
bootMaterial.update();
const faceMaterial = new pc.StandardMaterial();
faceMaterial.diffuse = new pc.Color(0.035, 0.045, 0.05);
faceMaterial.emissive = new pc.Color(0.02, 0.03, 0.035);
faceMaterial.update();
const trousersMaterial = coloredMaterial(new pc.Color(0.12, 0.19, 0.24));
const coatTrimMaterial = coloredMaterial(new pc.Color(0.12, 0.25, 0.28));
const brassMaterial = coloredMaterial(new pc.Color(0.83, 0.59, 0.27));
const scarfMaterial = coloredMaterial(new pc.Color(0.84, 0.36, 0.16));
const eyeWhiteMaterial = coloredMaterial(new pc.Color(0.93, 0.87, 0.73));
const bladeMaterial = coloredMaterial(new pc.Color(0.72, 0.84, 0.87));
bladeMaterial.metalness = 0.55;
bladeMaterial.useMetalness = true;
bladeMaterial.shininess = 55;
bladeMaterial.update();
const weaponWoodMaterial = coloredMaterial(new pc.Color(0.34, 0.19, 0.08));
const fangWeaponMaterial = coloredMaterial(new pc.Color(0.9, 0.84, 0.66));
const coreWeaponMaterial = coloredMaterial(new pc.Color(0.42, 0.52, 0.56));
const coreGlowMaterial = new pc.StandardMaterial();
coreGlowMaterial.diffuse = new pc.Color(0.95, 0.48, 0.08);
coreGlowMaterial.emissive = new pc.Color(0.55, 0.18, 0.02);
coreGlowMaterial.update();
const acidWeaponMaterial = new pc.StandardMaterial();
acidWeaponMaterial.diffuse = new pc.Color(0.48, 0.82, 0.12);
acidWeaponMaterial.emissive = new pc.Color(0.2, 0.55, 0.04);
acidWeaponMaterial.update();
const focusMaterial = new pc.StandardMaterial();
focusMaterial.diffuse = new pc.Color(0.2, 0.52, 0.96);
focusMaterial.emissive = new pc.Color(0.08, 0.3, 0.85);
focusMaterial.update();

function coloredMaterial(color: pc.Color): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.update();
  return material;
}

interface VoxelCharacterRig {
  appearanceMaterials: { skin: pc.StandardMaterial; hair: pc.StandardMaterial; coat: pc.StandardMaterial };
  hairStyles: Record<Appearance["hairStyle"], pc.Entity>;
  coatStyles: Record<Appearance["coatStyle"], pc.Entity>;
  root: pc.Entity;
  torso: pc.Entity;
  head: pc.Entity;
  leftArm: pc.Entity;
  rightArm: pc.Entity;
  leftLeg: pc.Entity;
  rightLeg: pc.Entity;
  leftElbow: pc.Entity;
  rightElbow: pc.Entity;
  leftKnee: pc.Entity;
  rightKnee: pc.Entity;
  scarf: pc.Entity;
  minersLantern: pc.Entity;
  silhouette: pc.Entity | null;
  mainHands: Record<MainHandId, pc.Entity>;
  armour: Record<"leather_armour" | "iron_armour" | "rootguard_armour" | "bastion_plate", pc.Entity>;
  locomotionPhase: number;
  locomotionWeight: number;
  travelFrames: TravelFrame[];
  lastFacingYaw: number | null;
  turnLean: number;
}

function addBox(
  parent: pc.Entity,
  name: string,
  material: pc.StandardMaterial,
  scale: [number, number, number],
  position: [number, number, number],
): pc.Entity {
  const box = new pc.Entity(name);
  box.addComponent("render", { type: "box", castShadows: true });
  if (box.render) box.render.material = material;
  box.setLocalScale(...scale);
  box.setLocalPosition(...position);
  parent.addChild(box);
  return box;
}

const lanternMetal = coloredMaterial(new pc.Color(0.2, 0.16, 0.1));
const lanternGlow = new pc.StandardMaterial();
lanternGlow.diffuse = new pc.Color(1, 0.7, 0.24);
lanternGlow.emissive = new pc.Color(1, 0.5, 0.12);
lanternGlow.update();
// Entrance supports flank the stairs, never obstructing the three-block-wide route.
const mineGate = new pc.Entity("east-ore-mine-gateway");
const mineTimber = coloredMaterial(new pc.Color(.29, .19, .10));
for (const z of [6.4, 10.6]) {
  addBox(mineGate, "mine-gate-post", mineTimber, [.38, 2.8, .38], [31.5, 9.4, z]);
  addBox(mineGate, "mine-gate-foot", lanternMetal, [.52, .25, .52], [31.5, 8.125, z]);
}
addBox(mineGate, "mine-gate-beam", mineTimber, [.5, .38, 4.7], [31.5, 10.75, 8.5]);
addBox(mineGate, "mine-gate-sign", lanternMetal, [.18, .65, 1.8], [31.18, 10.18, 8.5]);
for (const z of [8.05, 8.5, 8.95]) addBox(mineGate, "ore-sign-inlay", lanternGlow, [.04, .24, .24], [31.06, 10.18, z]);
app.root.addChild(mineGate);
for (const point of [
  { x: 32.5, y: 7, z: 7.25 }, { x: 36.5, y: 3, z: 7.25 },
  { x: 41.5, y: 3, z: 7.25 }, { x: 44.5, y: 1, z: 7.25 },
  { x: 50.5, y: 1, z: 7.25 }, { x: 56.5, y: 1, z: 7.25 },
  { x: 37.5, y: 3, z: 5.3 }, { x: 45.5, y: 1, z: 12.3 },
]) {
  const root = new pc.Entity("return-route-lantern");
  root.setPosition(point.x, point.y, point.z);
  addBox(root, "lantern-base", lanternMetal, [0.24, 0.12, 0.24], [0, 0.1, 0]);
  addBox(root, "lantern-glass", lanternGlow, [0.16, 0.28, 0.16], [0, 0.3, 0]);
  addBox(root, "lantern-cap", lanternMetal, [0.24, 0.08, 0.24], [0, 0.48, 0]);
  const glow = new pc.Entity("lantern-light");
  glow.addComponent("light", { type: "omni", color: new pc.Color(1, 0.73, 0.35), intensity: 1.4, range: 5, castShadows: false });
  glow.setLocalPosition(0, 0.4, 0); root.addChild(glow);
  root.enabled = false; app.root.addChild(root);
  caveLanterns.push({ root, ...point });
}

// Silver Depths dressing is deliberately sparse: the voxel cover remains the
// real collision/shot geometry while these crystals provide identity and light.
const silverDepthsRoot = new pc.Entity("silver-depths-atmosphere");
const silverDepthsFixtures: { entity: pc.Entity; x: number; z: number; intensity: number }[] = [];
const moonstoneCrystal = new pc.StandardMaterial();
moonstoneCrystal.diffuse = new pc.Color(.48, .16, .76);
moonstoneCrystal.emissive = new pc.Color(.32, .07, .58);
moonstoneCrystal.gloss = .62;
moonstoneCrystal.update();
const moonstoneCore = new pc.StandardMaterial();
moonstoneCore.diffuse = new pc.Color(.32, .82, 1);
moonstoneCore.emissive = new pc.Color(.12, .55, .9);
moonstoneCore.useLighting = false;
moonstoneCore.update();
const depthsStone = coloredMaterial(new pc.Color(.12, .12, .19));
for (const [name, z, tint] of [
  ["iron-bastion", 1.5, new pc.Color(1, .42, .12)],
  ["silver-echo", 27.5, new pc.Color(.38, .86, 1)],
] as const) {
  addBox(silverDepthsRoot, `${name}-marker-base`, depthsStone, [.9, .32, .9], [90.5, 1.16, z]);
  const marker = addBox(silverDepthsRoot, `${name}-marker-crystal`, coloredMaterial(tint), [.3, 1.05, .3], [90.5, 1.82, z]);
  marker.setLocalEulerAngles(0, 45, 12);
  const light = new pc.Entity(`${name}-marker-light`);
  light.addComponent("light", { type: "omni", color: tint, intensity: 1.8, range: 6.5, castShadows: false });
  light.setPosition(90.5, 2.1, z); silverDepthsRoot.addChild(light);
  silverDepthsFixtures.push({ entity: light, x: 90.5, z, intensity: 1.8 });
}
for (const z of [5.15, 19.85]) {
  addBox(silverDepthsRoot, "depths-entrance-pillar", depthsStone, [.48, 2.8, .48], [60.15, 2.4, z]);
  const shard = addBox(silverDepthsRoot, "entrance-moonstone", moonstoneCrystal, [.22, .95, .22], [60.02, 2.2, z + (z < 12 ? .42 : -.42)]);
  shard.setLocalEulerAngles(0, 0, z < 12 ? -18 : 18);
}
addBox(silverDepthsRoot, "depths-entrance-lintel", depthsStone, [.55, .4, 15.15], [60.15, 4.05, 12.5]);
const crystalSites = [
  [62.1, 1.35, 6.0, -.18], [62.1, 1.5, 19.0, .2], [72.1, 1.4, 6.0, -.12], [72.1, 1.3, 19.0, .14],
  [85.0, 1.55, 4.0, -.18], [85.0, 1.45, 25.5, .18], [97.0, 1.65, -13.0, -.22], [103.0, 1.55, 34.0, .22],
  [112.0, 1.6, 11.0, -.2], [121.0, 1.5, 21.0, .2], [126.0, 1.6, 0.0, -.2], [138.0, 1.5, 30.0, .2],
] as const;
for (const [x, y, z, lean] of crystalSites) {
  const cluster = new pc.Entity("moonstone-crystal-cluster"); cluster.setPosition(x, y, z); silverDepthsRoot.addChild(cluster);
  for (const [index, offset] of [[0, 0], [-.27, -.08], [.25, .06]] as const) {
    const shard = addBox(cluster, "moonstone-shard", index === 0 ? moonstoneCore : moonstoneCrystal,
      [index === 0 ? .22 : .15, index === 0 ? 1.05 : .68, index === 0 ? .22 : .15], [offset, index === 0 ? .2 : -.02, offset * .5]);
    shard.setLocalEulerAngles(0, index * 36, (lean + index * .18) * 55);
  }
}
for (const [x, z] of [[64, 12], [78, 12], [90, 8], [90, 22], [101, -7], [103, 31], [113, 15], [122, 15], [128, 4], [132, 15], [136, 27]] as const) {
  const glow = new pc.Entity("moonstone-cavern-light");
  const tint = silverDepthsLightColour(x, z);
  const intensity = x >= 124 ? 1.45 : x < 83 ? 1.3 : 1.15;
  glow.addComponent("light", { type: "omni", color: new pc.Color(...tint), intensity, range: 8.5, castShadows: false });
  glow.setPosition(x, 2.2, z); silverDepthsRoot.addChild(glow);
  silverDepthsFixtures.push({ entity: glow, x, z, intensity });
}
const silverDepthsMotes: { entity: pc.Entity; baseY: number; phase: number }[] = [];
for (let index = 0; index < 54; index++) {
  const mote = addBox(silverDepthsRoot, "moonstone-mote", moonstoneCore, [.035, .035, .035],
    [61 + (index * 47 % 780) / 10, 1.35 + (index % 5) * .42, -14 + (index * 31 % 490) / 10]);
  silverDepthsMotes.push({ entity: mote, baseY: mote.getLocalPosition().y, phase: index * 1.73 });
}
silverDepthsRoot.enabled = false;
app.root.addChild(silverDepthsRoot);
const emberVaultRoot = new pc.Entity("ember-vault-atmosphere");
for (const [x, z, intensity, range] of [[216, 165.5, 1.8, 10], [227.5, 165.5, 2.25, 12], [236, 165.5, 2.8, 13]] as const) {
  const forgeLight = new pc.Entity("ember-forge-light");
  forgeLight.addComponent("light", { type: "omni", color: new pc.Color(1, .22, .035), intensity, range, castShadows: false });
  forgeLight.setPosition(x, 9.1, z);
  emberVaultRoot.addChild(forgeLight);
}
emberVaultRoot.enabled = false;
app.root.addChild(emberVaultRoot);
const depthsBreadcrumbRoot = new pc.Entity("silver-depths-breadcrumbs");
const depthsBreadcrumbs = Array.from({ length: 6 }, (_, index) => {
  const shard = addBox(depthsBreadcrumbRoot, "route-crystal", moonstoneCore, [.1, .22, .1], [0, 0, 0]);
  shard.setLocalEulerAngles(0, index * 37, 45); return shard;
});
depthsBreadcrumbRoot.enabled = false;
app.root.addChild(depthsBreadcrumbRoot);
let localSilverDepthsRunStage = 0;
let localSilverDepthsWing: SilverDepthsWing | null = null;
for (const button of depthsWingButtons) {
  button.addEventListener("click", () => {
    if (!room || localSilverDepthsRunStage !== 3 || localSilverDepthsWing) return;
    const wing = button.dataset.depthsWing;
    if (wing === "iron" || wing === "silver") room.send("depths:route", { wing });
  });
}
depthsCheckpointReady.addEventListener("click", () => {
  if (room && depthsCheckpointStatus?.phase === "waiting") room.send("depths:ready");
});

function createVoxelCharacter(parent: pc.Entity, clothing: pc.StandardMaterial, withSilhouette = false, appearance: Appearance = DEFAULT_APPEARANCE): VoxelCharacterRig {
  const root = new pc.Entity("voxel-character");
  parent.addChild(root);
  const skinMaterial = coloredMaterial(appearanceColor("skin", appearance.skin));
  skinMaterial.shininess = 12; skinMaterial.update();
  const hairMaterial = coloredMaterial(appearanceColor("hair", appearance.hair));
  clothing.diffuse = appearanceColor("coat", appearance.coat); clothing.update();

  // Transform pivots stay at unit scale: attachments retain their real voxel
  // dimensions instead of inheriting the dimensions of a head or torso box.
  const torso = new pc.Entity("torso-pivot");
  torso.setLocalPosition(0, 0.82, 0);
  root.addChild(torso);
  addBox(torso, "expedition-coat", clothing, [0.5, 0.54, 0.32], [0, 0, 0]);
  addBox(torso, "left-lapel", coatTrimMaterial, [0.075, 0.34, 0.025], [-0.065, 0.055, 0.173]);
  addBox(torso, "right-lapel", coatTrimMaterial, [0.075, 0.34, 0.025], [0.065, 0.055, 0.173]);
  addBox(torso, "leather-belt", bootMaterial, [0.515, 0.075, 0.335], [0, -0.185, 0]);
  addBox(torso, "belt-buckle", brassMaterial, [0.105, 0.085, 0.035], [0, -0.185, 0.184]);
  addBox(torso, "field-pack", bootMaterial, [0.35, 0.38, 0.16], [0, 0.025, -0.235]);
  addBox(torso, "pack-flap", brassMaterial, [0.37, 0.08, 0.18], [0, 0.17, -0.245]);
  addBox(torso, "scarf-collar", scarfMaterial, [0.34, 0.1, 0.35], [0, 0.28, 0]);
  const coatStyles = {
    explorer: new pc.Entity("explorer-coat-shape"),
    short: new pc.Entity("short-jacket-shape"),
    long: new pc.Entity("long-coat-shape"),
  };
  for (const style of Object.values(coatStyles)) torso.addChild(style);
  for (const x of [-.21, .21]) {
    addBox(coatStyles.explorer, "explorer-pocket", bootMaterial, [.11, .105, .025], [x, -.115, .18]);
    addBox(coatStyles.short, "jacket-shoulder", clothing, [.14, .13, .37], [x * 1.38, .2, 0]);
    addBox(coatStyles.short, "jacket-hem", coatTrimMaterial, [.22, .085, .355], [x / 2, -.27, 0]);
    addBox(coatStyles.long, "coat-tail", clothing, [.215, .29, .06], [x / 2, -.39, -.19]);
    addBox(coatStyles.long, "coat-front-panel", clothing, [.215, .25, .055], [x / 2, -.35, .17]);
  }
  addBox(coatStyles.short, "jacket-front-zip", brassMaterial, [.035, .4, .025], [0, 0, .176]);
  addBox(coatStyles.long, "long-coat-back-seam", coatTrimMaterial, [.04, .36, .025], [0, -.35, -.228]);
  const scarf = new pc.Entity("scarf-pivot");
  scarf.setLocalPosition(-0.12, 0.29, -0.2);
  torso.addChild(scarf);
  addBox(scarf, "trailing-scarf", scarfMaterial, [0.15, 0.32, 0.045], [0, -0.15, 0]);

  const head = new pc.Entity("head-pivot");
  head.setLocalPosition(0, 0.46, 0.015);
  torso.addChild(head);
  addBox(head, "face", skinMaterial, [0.4, 0.38, 0.38], [0, 0, 0]);
  const hairStyles = {
    swept: new pc.Entity("swept-hair"),
    spiked: new pc.Entity("spiked-hair"),
    long: new pc.Entity("long-hair"),
  };
  for (const style of Object.values(hairStyles)) head.addChild(style);
  addBox(hairStyles.swept, "hair-cap", hairMaterial, [.43, .105, .415], [0, .2, -.006]);
  addBox(hairStyles.swept, "swept-fringe", hairMaterial, [.26, .085, .055], [-.08, .13, .191]);
  addBox(hairStyles.spiked, "hair-base", hairMaterial, [.43, .09, .41], [0, .19, 0]);
  for (const x of [-.145, 0, .145]) {
    const spike = addBox(hairStyles.spiked, "hair-spike", hairMaterial, [.115, .18, .12], [x, .32, -.025]);
    spike.setLocalEulerAngles(0, 0, x * -65);
  }
  addBox(hairStyles.long, "hair-crown", hairMaterial, [.44, .115, .43], [0, .19, 0]);
  addBox(hairStyles.long, "hair-back", hairMaterial, [.42, .34, .08], [0, -.005, -.235]);
  for (const x of [-.215, .215]) addBox(hairStyles.long, "hair-side", hairMaterial, [.075, .28, .33], [x, -.04, -.035]);
  addBox(head, "left-eye", eyeWhiteMaterial, [0.077, 0.055, 0.022], [-0.09, 0.025, 0.195]);
  addBox(head, "right-eye", eyeWhiteMaterial, [0.077, 0.055, 0.022], [0.09, 0.025, 0.195]);
  addBox(head, "left-pupil", faceMaterial, [0.035, 0.05, 0.025], [-0.076, 0.025, 0.209]);
  addBox(head, "right-pupil", faceMaterial, [0.035, 0.05, 0.025], [0.104, 0.025, 0.209]);
  const minersLantern = new pc.Entity("miners-lantern-headgear");
  head.addChild(minersLantern);
  addBox(minersLantern, "lantern-headband", lanternMetal, [.46, .08, .43], [0, .17, 0]);
  addBox(minersLantern, "lantern-mount", lanternMetal, [.23, .2, .09], [0, .22, .225]);
  addBox(minersLantern, "lantern-lens", lanternGlow, [.14, .12, .055], [0, .22, .285]);
  addBox(minersLantern, "lantern-cap", brassMaterial, [.27, .06, .11], [0, .32, .225]);
  minersLantern.enabled = false;

  const leftArm = new pc.Entity("left-arm-pivot");
  leftArm.setLocalPosition(-0.34, 0.22, 0);
  torso.addChild(leftArm);
  addBox(leftArm, "left-sleeve", clothing, [0.19, 0.27, 0.23], [0, -0.105, 0]);
  const leftElbow = new pc.Entity("left-elbow-pivot");
  leftElbow.setLocalPosition(0, -0.23, 0);
  leftArm.addChild(leftElbow);
  addBox(leftElbow, "left-forearm", clothing, [0.17, 0.22, 0.2], [0, -0.09, 0]);
  addBox(leftElbow, "left-cuff", brassMaterial, [0.18, 0.055, 0.21], [0, -0.18, 0]);
  addBox(leftElbow, "left-hand", skinMaterial, [0.17, 0.13, 0.19], [0, -0.26, 0]);

  const rightArm = new pc.Entity("right-arm-pivot");
  rightArm.setLocalPosition(0.34, 0.22, 0);
  torso.addChild(rightArm);
  addBox(rightArm, "right-sleeve", clothing, [0.19, 0.27, 0.23], [0, -0.105, 0]);
  const rightElbow = new pc.Entity("right-elbow-pivot");
  rightElbow.setLocalPosition(0, -0.23, 0);
  rightArm.addChild(rightElbow);
  addBox(rightElbow, "right-forearm", clothing, [0.17, 0.22, 0.2], [0, -0.09, 0]);
  addBox(rightElbow, "right-cuff", brassMaterial, [0.18, 0.055, 0.21], [0, -0.18, 0]);
  addBox(rightElbow, "right-hand", skinMaterial, [0.17, 0.13, 0.19], [0, -0.26, 0]);

  const longsword = new pc.Entity("main-hand-longsword");
  longsword.setLocalPosition(0, -0.29, 0.085);
  addBox(longsword, "sword-grip", weaponWoodMaterial, [0.085, 0.2, 0.09], [0, 0, 0]);
  addBox(longsword, "sword-pommel", brassMaterial, [0.12, 0.075, 0.12], [0, 0.115, 0]);
  addBox(longsword, "sword-guard", brassMaterial, [0.33, 0.07, 0.115], [0, -0.105, 0]);
  addBox(longsword, "sword-blade", bladeMaterial, [0.115, 0.44, 0.065], [0, -0.335, 0]);
  addBox(longsword, "sword-tip", bladeMaterial, [0.065, 0.075, 0.055], [0, -0.59, 0]);
  addBox(longsword, "blade-spine", eyeWhiteMaterial, [.028, .4, .018], [0, -.335, .043]);
  rightElbow.addChild(longsword);

  const bow = new pc.Entity("main-hand-bow");
  bow.setLocalPosition(0, -0.27, 0.1);
  addBox(bow, "bow-center", weaponWoodMaterial, [0.08, 0.34, 0.08], [0, 0, 0]);
  const bowTop = addBox(bow, "bow-top", weaponWoodMaterial, [0.08, 0.42, 0.08], [0.075, 0.32, 0]);
  bowTop.setLocalEulerAngles(0, 0, -24);
  const bowBottom = addBox(bow, "bow-bottom", weaponWoodMaterial, [0.08, 0.42, 0.08], [0.075, -0.32, 0]);
  bowBottom.setLocalEulerAngles(0, 0, 24);
  addBox(bow, "bow-string", eyeWhiteMaterial, [0.014, 1.02, 0.014], [0.16, 0, 0]);
  addBox(bow, "bow-grip-wrap", brassMaterial, [0.095, 0.13, 0.095], [0, 0, 0]);
  for (const y of [-.48, .48]) addBox(bow, "bow-limb-cap", brassMaterial, [.13, .09, .12], [.13, y, 0]);
  rightElbow.addChild(bow);

  const magicFocus = new pc.Entity("main-hand-magic-focus");
  magicFocus.setLocalPosition(0, -0.28, 0.11);
  addBox(magicFocus, "focus-handle", weaponWoodMaterial, [0.09, 0.45, 0.09], [0, 0, 0]);
  addBox(magicFocus, "focus-crystal", focusMaterial, [0.25, 0.25, 0.25], [0, -0.34, 0]);
  addBox(magicFocus, "focus-collar", brassMaterial, [0.3, 0.06, 0.3], [0, -0.19, 0]);
  const focusPoint = addBox(magicFocus, "focus-point", focusMaterial, [.16, .2, .16], [0, -.5, 0]);
  focusPoint.setLocalEulerAngles(0, 45, 0);
  rightElbow.addChild(magicFocus);

  const fangDagger = new pc.Entity("main-hand-fang-dagger");
  fangDagger.setLocalPosition(0, -0.28, 0.1);
  addBox(fangDagger, "dagger-grip", weaponWoodMaterial, [0.09, 0.25, 0.09], [0, 0, 0]);
  addBox(fangDagger, "dagger-guard", fangWeaponMaterial, [0.25, 0.07, 0.11], [0, -0.12, 0]);
  const fangBlade = addBox(fangDagger, "dagger-fang", fangWeaponMaterial, [0.16, 0.46, 0.11], [0, -0.38, 0]);
  fangBlade.setLocalEulerAngles(0, 0, 8);
  addBox(fangDagger, "fang-edge", eyeWhiteMaterial, [.06, .3, .025], [.07, -.38, .065]);
  rightElbow.addChild(fangDagger);

  const stoneCoreHammer = new pc.Entity("main-hand-stone-core-hammer");
  stoneCoreHammer.setLocalPosition(0, -0.28, 0.1);
  addBox(stoneCoreHammer, "hammer-handle", weaponWoodMaterial, [0.11, 0.52, 0.11], [0, -0.12, 0]);
  addBox(stoneCoreHammer, "hammer-head", coreWeaponMaterial, [0.62, 0.3, 0.36], [0, -0.42, 0]);
  addBox(stoneCoreHammer, "hammer-core", coreGlowMaterial, [0.17, 0.22, 0.38], [0, -0.42, 0]);
  for (const x of [-.23, .23]) addBox(stoneCoreHammer, "hammer-binding", brassMaterial, [.055, .34, .4], [x, -.42, 0]);
  rightElbow.addChild(stoneCoreHammer);

  const rootboundHammer = new pc.Entity("main-hand-rootbound-hammer");
  rootboundHammer.setLocalPosition(0, -0.28, 0.1);
  const rootWood = coloredMaterial(new pc.Color(0.24, 0.13, 0.055));
  const rootStone = coloredMaterial(new pc.Color(0.16, 0.28, 0.17));
  const rootGlow = coloredMaterial(new pc.Color(0.34, 0.92, 0.3));
  addBox(rootboundHammer, "rootbound-handle", rootWood, [0.13, 0.58, 0.13], [0, -0.1, 0]);
  addBox(rootboundHammer, "rootbound-head", rootStone, [0.7, 0.34, 0.4], [0, -0.46, 0]);
  addBox(rootboundHammer, "rootbound-heart", rootGlow, [0.2, 0.24, 0.42], [0, -0.46, 0]);
  for (const x of [-.28, .28]) addBox(rootboundHammer, "rootbound-root", rootWood, [.08, .4, .44], [x, -.46, 0]);
  for (const x of [-.18, .18]) addBox(rootboundHammer, "rootbound-rune", rootGlow, [.045, .27, .45], [x, -.46, 0]);
  for (const z of [-.24, .24]) {
    const thorn = addBox(rootboundHammer, "rootbound-thorn", rootWood, [.12, .18, .12], [0, -.49, z]);
    thorn.setLocalEulerAngles(z < 0 ? -28 : 28, 0, 45);
  }
  addBox(rootboundHammer, "rootbound-crown", rootGlow, [.38, .07, .12], [0, -.25, 0]);
  rightElbow.addChild(rootboundHammer);

  const acidGlandFocus = new pc.Entity("main-hand-acid-gland-focus");
  acidGlandFocus.setLocalPosition(0, -0.28, 0.11);
  addBox(acidGlandFocus, "acid-focus-handle", weaponWoodMaterial, [0.1, 0.48, 0.1], [0, 0, 0]);
  addBox(acidGlandFocus, "acid-focus-cage", coreWeaponMaterial, [0.34, 0.1, 0.34], [0, -0.34, 0]);
  addBox(acidGlandFocus, "acid-focus-gland", acidWeaponMaterial, [0.25, 0.3, 0.25], [0, -0.42, 0]);
  for (const x of [-.17, .17]) addBox(acidGlandFocus, "acid-cage-prong", coreWeaponMaterial, [.06, .33, .08], [x, -.44, 0]);
  rightElbow.addChild(acidGlandFocus);

  const forgedSword = longsword.clone(); rightElbow.addChild(forgedSword);
  const forgedBow = bow.clone(); rightElbow.addChild(forgedBow);
  const forgedFocus = magicFocus.clone(); rightElbow.addChild(forgedFocus);
  addBox(forgedBow, "forged-bow-bracing", bladeMaterial, [.1, .4, .1], [.075, .32, 0]);
  addBox(forgedSword, "forged-sword-collar", bladeMaterial, [.18, .09, .13], [0, -.16, 0]);
  addBox(forgedFocus, "forged-focus-frame", bladeMaterial, [.34, .07, .34], [0, -.34, 0]);
  forgedSword.enabled = forgedBow.enabled = forgedFocus.enabled = false;
  const matriarchEdge = longsword.clone();
  matriarchEdge.name = "main-hand-matriarch-edge";
  rightElbow.addChild(matriarchEdge);
  const moonstoneBlade = coloredMaterial(new pc.Color(.58, .28, .9));
  const moonstoneGlow = coloredMaterial(new pc.Color(.42, .82, 1));
  addBox(matriarchEdge, "matriarch-edge-rune", moonstoneGlow, [.045, .38, .025], [0, -.35, .05]);
  addBox(matriarchEdge, "matriarch-edge-crystal", moonstoneBlade, [.17, .13, .12], [0, -.14, 0]).setLocalEulerAngles(0, 45, 0);
  matriarchEdge.enabled = false;
  const venomFocus = acidGlandFocus.clone();
  venomFocus.name = "venom-focus";
  acidGlandFocus.parent!.addChild(venomFocus);
  addBox(venomFocus, "matriarch-jade-prongs", coloredMaterial(new pc.Color(.15, .9, .65)), [.45, .1, .18], [0, -.3, 0]);
  venomFocus.enabled = false;
  const echoPrism = magicFocus.clone();
  echoPrism.name = "main-hand-echo-prism";
  rightElbow.addChild(echoPrism);
  const echoCrystal = coloredMaterial(new pc.Color(.55, .87, 1));
  const echoFrame = coloredMaterial(new pc.Color(.35, .31, .62));
  addBox(echoPrism, "echo-prism-cage", echoFrame, [.36, .12, .36], [0, -.34, 0]);
  addBox(echoPrism, "echo-prism-crystal", echoCrystal, [.25, .34, .25], [0, -.45, 0]).setLocalEulerAngles(0, 45, 0);
  echoPrism.enabled = false;
  const mainHands = {
    echo_prism: echoPrism,
    venom_focus: venomFocus,
    forged_sword: forgedSword,
    forged_bow: forgedBow,
    forged_focus: forgedFocus,
    longsword,
    bow,
    magic_focus: magicFocus,
    fang_dagger: fangDagger,
    stone_core_hammer: stoneCoreHammer,
    rootbound_hammer: rootboundHammer,
    matriarch_edge: matriarchEdge,
    acid_gland_focus: acidGlandFocus,
  };
  bow.enabled = false;
  magicFocus.enabled = false;
  fangDagger.enabled = false;
  stoneCoreHammer.enabled = false;
  rootboundHammer.enabled = false;
  acidGlandFocus.enabled = false;

  const leftLeg = new pc.Entity("left-leg-pivot");
  leftLeg.setLocalPosition(-0.135, 0.57, 0);
  root.addChild(leftLeg);
  addBox(leftLeg, "left-trousers", trousersMaterial, [0.205, 0.28, 0.23], [0, -0.12, 0]);
  const leftKnee = new pc.Entity("left-knee-pivot");
  leftKnee.setLocalPosition(0, -0.25, 0);
  leftLeg.addChild(leftKnee);
  addBox(leftKnee, "left-shin", bootMaterial, [0.21, 0.23, 0.24], [0, -0.12, 0]);
  addBox(leftKnee, "left-boot-cuff", brassMaterial, [0.22, 0.045, 0.25], [0, -0.035, 0]);
  addBox(leftKnee, "left-boot", bootMaterial, [0.23, 0.14, 0.33], [0, -0.25, 0.045]);

  const rightLeg = new pc.Entity("right-leg-pivot");
  rightLeg.setLocalPosition(0.135, 0.57, 0);
  root.addChild(rightLeg);
  addBox(rightLeg, "right-trousers", trousersMaterial, [0.205, 0.28, 0.23], [0, -0.12, 0]);
  const rightKnee = new pc.Entity("right-knee-pivot");
  rightKnee.setLocalPosition(0, -0.25, 0);
  rightLeg.addChild(rightKnee);
  addBox(rightKnee, "right-shin", bootMaterial, [0.21, 0.23, 0.24], [0, -0.12, 0]);
  addBox(rightKnee, "right-boot-cuff", brassMaterial, [0.22, 0.045, 0.25], [0, -0.035, 0]);
  addBox(rightKnee, "right-boot", bootMaterial, [0.23, 0.14, 0.33], [0, -0.25, 0.045]);

  let silhouette: pc.Entity | null = null;
  if (withSilhouette) {
    silhouette = new pc.Entity("player-silhouette");
    addBox(silhouette, "silhouette-body", silhouetteMaterial, [0.62, 1.02, 0.42], [0, 0.72, 0]);
    addBox(silhouette, "silhouette-head", silhouetteMaterial, [0.46, 0.46, 0.46], [0, 1.28, 0]);
    silhouette.enabled = false;
    root.addChild(silhouette);
  }
  const armour = { leather_armour: new pc.Entity("leather-armour"), iron_armour: new pc.Entity("iron-armour"),
    rootguard_armour: new pc.Entity("rootguard-armour"), bastion_plate: new pc.Entity("bastion-plate") };
  for (const [id, layer] of Object.entries(armour)) {
    const bastion = id === "bastion_plate";
    const iron = id === "iron_armour" || bastion;
    const rootguard = id === "rootguard_armour";
    const material = iron ? bladeMaterial : rootguard ? coloredMaterial(new pc.Color(.16, .34, .18)) : weaponWoodMaterial;
    torso.addChild(layer);
    addBox(layer, "chest-protection", material, [.53, .43, .07], [0, -.025, .205]);
    addBox(layer, "armour-back", material, [.53, .43, .06], [0, -.025, -.185]);
    for (const x of [-.28, .28]) {
      addBox(layer, "shoulder-rim", bootMaterial, [iron || rootguard ? .28 : .21, .08, iron || rootguard ? .44 : .36], [x, .235, 0]);
      addBox(layer, "shoulder-protection", material, [iron || rootguard ? .25 : .19, iron || rootguard ? .17 : .1, iron || rootguard ? .42 : .34], [x, .28, 0]);
      addBox(layer, "shoulder-rivet", brassMaterial, [.055, .045, .025], [x, .29, iron ? .224 : .184]);
    }
    if (iron) {
      addBox(layer, "iron-ridge", brassMaterial, [.09, .43, .025], [0, -.025, .253]);
      addBox(layer, "iron-collar", bladeMaterial, [.4, .095, .4], [0, .225, 0]);
      for (const y of [-.15, -.05]) addBox(layer, "iron-lower-plate", bladeMaterial, [.56, .07, .04], [0, y, .26]);
      if (bastion) {
        addBox(layer, "bastion-crest", brassMaterial, [.22, .23, .035], [0, .025, .29]);
        for (const x of [-.29, .29]) addBox(layer, "bastion-pauldrons", brassMaterial, [.08, .12, .46], [x, .3, 0]);
      }
    } else if (rootguard) {
      addBox(layer, "rootguard-heart", coreGlowMaterial, [.16, .18, .04], [0, .02, .253]).setLocalEulerAngles(0, 0, 45);
      addBox(layer, "rootguard-collar", weaponWoodMaterial, [.43, .11, .4], [0, .225, 0]);
      for (const x of [-.22, .22]) addBox(layer, "rootguard-vine", weaponWoodMaterial, [.075, .48, .055], [x, -.03, .255]).setLocalEulerAngles(0, 0, x < 0 ? -18 : 18);
    } else {
      const strap = addBox(layer, "leather-cross-strap", bootMaterial, [.06, .47, .035], [0, -.015, .26]);
      strap.setLocalEulerAngles(0, 0, -28);
      addBox(layer, "leather-clasp", brassMaterial, [.1, .09, .025], [.065, .09, .288]);
    }
    layer.enabled = false;
  }
  const rig: VoxelCharacterRig = { root, torso, head, leftArm, rightArm, leftElbow, rightElbow, leftLeg, rightLeg, leftKnee, rightKnee, scarf, minersLantern, silhouette, mainHands, armour, hairStyles, coatStyles, appearanceMaterials: { skin: skinMaterial, hair: hairMaterial, coat: clothing }, locomotionPhase: 0, locomotionWeight: 0, travelFrames: [], lastFacingYaw: null, turnLean: 0 };
  setRigAppearance(rig, appearance);
  return rig;
}

function setRigAppearance(rig: VoxelCharacterRig, appearance: Appearance): void {
  for (const group of ["skin", "hair", "coat"] as const) {
    const material = rig.appearanceMaterials[group];
    material.diffuse = appearanceColor(group, appearance[group]);
    material.update();
  }
  for (const [id, style] of Object.entries(rig.hairStyles)) style.enabled = id === appearance.hairStyle;
  for (const [id, style] of Object.entries(rig.coatStyles)) style.enabled = id === appearance.coatStyle;
}

function setRigArmour(rig: VoxelCharacterRig, id: string): void {
  for (const [key, entity] of Object.entries(rig.armour)) entity.enabled = key === id;
}

function setRigMainHand(rig: VoxelCharacterRig, mainHandId: MainHandId): void {
  for (const [id, entity] of Object.entries(rig.mainHands)) entity.enabled = id === mainHandId;
}

function animateVoxelCharacter(
  rig: VoxelCharacterRig,
  time: number,
  deltaTime: number,
  verticalVelocity: number,
  grounded: boolean,
  actionElapsedMilliseconds: number | null,
  actionStep = 0,
  actionMainHandId: MainHandId | null = null,
  powerElapsedMilliseconds: number | null = null,
  powerId: PowerId | null = null,
  actionYaw?: number | null,
  travelDistance = 0,
  facingYaw?: number,
): void {
  const measuredSpeed = recentTravelSpeed(rig.travelFrames, travelDistance, deltaTime);
  const animationSpeed = measuredSpeed < 0.12 ? 0 : Math.min(measuredSpeed, 4.2);
  const locomotion = advanceLocomotionAnimation(
    { phase: rig.locomotionPhase, weight: rig.locomotionWeight },
    animationSpeed,
    deltaTime,
  );
  rig.locomotionPhase = locomotion.phase;
  rig.locomotionWeight = locomotion.weight;
  const pose = voxelCharacterPose(animationSpeed, time, verticalVelocity, grounded, 4.2, locomotion);
  const yawDelta = facingYaw === undefined || rig.lastFacingYaw === null ? 0 : shortestYawDelta(rig.lastFacingYaw, facingYaw);
  rig.lastFacingYaw = facingYaw ?? rig.lastFacingYaw;
  rig.turnLean = advanceTurnLean(rig.turnLean, yawDelta, deltaTime);
  const powerPose = powerId === "shockwave"
    ? shockwavePowerPose(powerElapsedMilliseconds)
    : powerId === "eruption"
      ? eruptionPowerPose(powerElapsedMilliseconds)
      : powerId === "lunge_strike"
        ? lungePowerPose(powerElapsedMilliseconds)
      : seismicPowerPose(powerElapsedMilliseconds);
  const action = powerPose.active ? powerPose : primaryActionPose(actionElapsedMilliseconds, actionStep, actionMainHandId);
  rig.root.setLocalPosition(0, pose.bodyY, 0);
  rig.torso.setLocalEulerAngles(pose.torsoPitch, action.torsoYaw + rig.turnLean * 7, pose.torsoRoll - rig.turnLean * 4);
  rig.head.setLocalEulerAngles(pose.headPitch, pose.headYaw - action.torsoYaw * 0.25 - rig.turnLean * 5, -pose.torsoRoll * 0.5);
  // Ease walking arms out and back in with the actual action pose. A boolean
  // active switch snaps the gait at both ends of an otherwise smooth attack.
  const armSwing = actionArmSwingWeight(action);
  rig.leftArm.setLocalEulerAngles(pose.leftArmPitch * armSwing + action.leftArmPitch, 0, action.leftArmRoll + 4);
  rig.rightArm.setLocalEulerAngles(-12 + pose.rightArmPitch * armSwing + action.rightArmPitch, 0, action.rightArmRoll - 4);
  rig.leftElbow.setLocalEulerAngles(pose.leftElbowPitch, 0, 0);
  rig.rightElbow.setLocalEulerAngles(pose.rightElbowPitch - 8, 0, 0);
  const pivot = rig.turnLean * (1 - locomotion.weight) * 6;
  rig.leftLeg.setLocalEulerAngles(pose.leftLegPitch + pivot, 0, 0);
  rig.rightLeg.setLocalEulerAngles(pose.rightLegPitch - pivot, 0, 0);
  rig.leftKnee.setLocalEulerAngles(pose.leftKneePitch, 0, 0);
  rig.rightKnee.setLocalEulerAngles(pose.rightKneePitch, 0, 0);
  rig.scarf.setLocalEulerAngles(pose.scarfPitch, 0, pose.torsoRoll * -1.5);
  for (const id of ["longsword", "forged_sword", "matriarch_edge", "fang_dagger", "stone_core_hammer", "rootbound_hammer"] as const) {
    const weapon = rig.mainHands[id];
    const sword = id === "longsword" || id === "forged_sword" || id === "matriarch_edge";
    weapon.setLocalPosition(0, sword ? -0.29 : -0.28, sword ? 0.085 : 0.1);
    weapon.setLocalEulerAngles(0, 0, 0);
    weapon.setLocalScale(1, 1, 1);
  }
  const strike = actionMainHandId ? playerMeleeStrike(actionMainHandId, actionStep) : null;
  if (strike && actionMainHandId && actionElapsedMilliseconds !== null && !powerPose.active) {
    const timing = WEAPON_ATTACK_DEFINITIONS[actionMainHandId].attacks[actionStep - 1];
    if (timing) {
      const start = timing.impactMs - strike.beforeImpactMs;
      const end = timing.impactMs + strike.afterImpactMs;
      const elapsed = actionElapsedMilliseconds;
      const blend = Math.max(0, Math.min(1, elapsed / Math.max(1, start), (timing.durationMs - elapsed) / Math.max(1, timing.durationMs - end)));
      const blade = sampleMeleeStrike(rig.root.getPosition(), actionYaw ?? rig.root.getEulerAngles().y, strike, (elapsed - start) / (end - start));
      const weapon = rig.mainHands[actionMainHandId];
      const delta = new pc.Vec3(blade.tip.x - blade.base.x, blade.tip.y - blade.base.y, blade.tip.z - blade.base.z);
      const rotation = new pc.Quat().setFromEulerAngles(-90 - Math.atan2(delta.y, Math.hypot(delta.x, delta.z)) * 180 / Math.PI, Math.atan2(delta.x, delta.z) * 180 / Math.PI, 0);
      weapon.setPosition(new pc.Vec3().lerp(weapon.getPosition(), new pc.Vec3(blade.base.x, blade.base.y, blade.base.z), blend));
      weapon.setRotation(new pc.Quat().slerp(weapon.getRotation(), rotation, blend));
      weapon.setLocalScale(1, 1 + (delta.length() / strike.weaponLength - 1) * blend, 1);
    }
  }
}

const localPlayerVisual = new pc.Entity("local-player-visual");
localPlayer.addChild(localPlayerVisual);
const localPlayerRig = createVoxelCharacter(localPlayerVisual, coloredMaterial(new pc.Color(0.12, 0.45, 0.46)), true);
const localPlayerSilhouette = localPlayerRig.silhouette;
localPlayer.setPosition(8.5, 11, 8.5);
app.root.addChild(localPlayer);

interface NetworkPlayer {
  appearanceSkin: string;
  appearanceHair: string;
  appearanceCoat: string;
  appearanceHairStyle: string;
  appearanceCoatStyle: string;
  potionCooldownUntil: number;
  x: number;
  y: number;
  z: number;
  pilotVy: number;
  yaw: number;
  lastProcessedInput: number;
  actionSequence: number;
  attackStep: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  level: number;
  experience: number;
  unspentStatPoints: number;
  powerPoints: number;
  vitalityPoints: number;
  agilityPoints: number;
  miningPoints: number;
  coins: number;
  blacksmithUpgrades: number;
  silverDepthsRunStage: number;
  silverDepthsWing: string;
  dodgeSequence: number;
  invulnerableUntil: number;
  mainHandId: string;
  armourId: string;
  mainHandTag: string;
  equippedPower: string;
  equippedPowerSecondary: string;
  activePower: string;
  seismicMastery: string;
  powerCooldownUntil: number;
  powerSequence: number;
  powerCastStartedAt: number;
  specialCooldownUntil: number;
  equippedSpecial: string;
  dangerTier: number;
  isAdmin: boolean;
  name: string;
  defending: boolean;
  defenseStartedAt: number;
  momentumStacks: number;
  equippedTrait: string;
  inventory: unknown;
  recoveryBags?: Map<string, { x: number; y: number; z: number; items: Map<string, { quantity: number }> }>;
}

interface RemotePlayerVisual {
  entity: pc.Entity;
  rig: VoxelCharacterRig;
  snapshots: RemoteSnapshot[];
  actionStartedAt: number | null;
  actionStep: number;
  actionMainHandId: MainHandId | null;
  lastActionSequence: number;
  powerStartedAt: number | null;
  powerId: PowerId | null;
  lastPowerSequence: number;
  defending: boolean;
}

interface NetworkMob {
  awarenessState: string;
  alertUntil: number;
  isChampion: boolean;
  isMiniBoss: boolean;
  isElite: boolean;
  eliteKind: string;
  enraged?: boolean;
  attackPattern: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  hitSequence: number;
  actionSequence: number;
  combatState: string;
  aimCommitted: boolean;
  attackStartedAt: number;
  attackReleaseAt: number;
  attackContactAt: number;
  attackStrikeX: number;
  attackStrikeY: number;
  attackStrikeZ: number;
  attackContactEndAt: number;
  attackRecoveryEndAt: number;
  stateUntil: number;
  targetId: string;
  staggerSequence: number;
  respawnAt: number;
  materializeUntil: number;
  yaw: number;
  name: string;
  archetype: string;
  armor: number;
  difficultyTier: number;
  level: number;
  attackDamage: number;
  speedMultiplier: number;
  rewardMultiplier: number;
}

interface NetworkLootDrop {
  ownerId?: string;
  itemId: string;
  quantity: number;
  contentsJson?: string;
  x: number;
  y: number;
  z: number;
  expiresAt: number;
}

const LOOT_BAG_TIER_LABEL: Record<LootBagTier, string> = {
  brown: "Brown Loot Bag",
  blue: "Blue Loot Bag",
  purple: "Purple Loot Bag",
  white: "White Loot Bag",
};
const LOOT_BAG_TIER_RARITY: Record<LootBagTier, ItemRarity> = {
  brown: "common",
  blue: "rare",
  purple: "epic",
  white: "legendary",
};
function lootItems(drop: NetworkLootDrop): LootBagItem[] {
  return decodeLootBagItems(drop.contentsJson ?? "", drop.itemId, drop.quantity);
}
function isEnemyLootBag(drop: NetworkLootDrop): boolean {
  return Boolean(drop.contentsJson);
}

interface LootVisual {
  root: pc.Entity;
  marker: pc.Entity;
  revealAt: number;
  landedAt: number;
  tossFrom: pc.Vec3;
  state: NetworkLootDrop;
  phase: number;
  audioPlayed: boolean;
}

interface MobVisual {
  locomotionSpeed: number;
  renderYaw: number;
  turnLean: number;
  entity: pc.Entity;
  snapshots: RemoteSnapshot[];
  bodyRoot: pc.Entity;
  bodyMaterial: pc.StandardMaterial;
  art: MobArtRig;
  statusRoot: pc.Entity;
  frameAlive: boolean;
  defeatAt: number;
  warning: pc.Entity;
  warningMaterial: pc.StandardMaterial;
  warningScale: number;
  warningMesh: pc.Mesh | null;
  warningYaw: number;
  warningPattern: string;
  warningChargeLength: number;
  warningSequence: number;
  combatCue: HTMLDivElement;
  combatCueLabel: HTMLSpanElement;
  combatCueFill: HTMLSpanElement;
  levelTag: HTMLDivElement;
  respawnTag: HTMLDivElement;
  recovery: pc.Entity;
  respawnCue: pc.Entity;
  respawnCueMaterial: pc.StandardMaterial;
  eliteAura: pc.Entity;
  eliteAuraMaterial: pc.StandardMaterial;
  healthFill: pc.Entity;
  healthWidth: number;
  healthBarY: number;
  isBrute: boolean;
  isSpitter: boolean;
  mark: pc.Entity;
  markMaterial: pc.StandardMaterial;
  markPips: pc.Entity[];
  marks: Map<string, MarkVisualState>;
  state: NetworkMob;
  lastHitSequence: number;
  hitAt: number;
  lastActionSequence: number;
  actionAt: number;
  lastImpactStartedAt: number;
  lastStaggerSequence: number;
  staggerAt: number;
  lastCombatState: string;
  lastAlive: boolean;
}

interface MarkVisualState {
  expiresAt: number;
  stacks: number;
  maxStacks: number;
}

const remotePlayers = new Map<string, RemotePlayerVisual>();
const social = createSocialUI((type, payload) => { if (!room || !worldReady) return false; room.send(type, payload); return true; }, () => { resetMovementControls(); requestDefense(false); cancelPowerAim(); cancelSpecialAim(); });
const tradeUI = createTradeUI(request => { if (!room || !worldReady) return false; room.send("trade:request", request); return true; }, () => { resetMovementControls(); requestDefense(false); cancelPowerAim(); cancelSpecialAim(); });
const partyUI = createPartyUI(request => { if (!room || !worldReady) return false; room.send("party:request", request); return true; }, () => { resetMovementControls(); requestDefense(false); cancelPowerAim(); cancelSpecialAim(); }, id => tradeUI.invite(id), () => room?.sessionId ?? "");
const playerInteractionUI = createPlayerInteractionUI({
  stop: () => { resetMovementControls(); requestDefense(false); cancelPowerAim(); cancelSpecialAim(); },
  trade: id => tradeUI.invite(id),
  party: id => partyUI.invite(id),
});
let activeRealmEventId = "";
let lastNameplateSampleAt = -Infinity;
let nearbyTradePlayerId: string | null = null;

function playerInteractionView(id: string): PlayerInteractionView | null {
  if (!room) return null;
  const player = (room.state.players as Map<string, NetworkPlayer>).get(id);
  const remote = remotePlayers.get(id);
  if (!player || !remote) return null;
  const appearance = resolveAppearance({
    skin: player.appearanceSkin,
    hair: player.appearanceHair,
    coat: player.appearanceCoat,
    hairStyle: player.appearanceHairStyle,
    coatStyle: player.appearanceCoatStyle,
  });
  const handId = Object.hasOwn(MAIN_HAND_DEFINITIONS, player.mainHandId)
    ? player.mainHandId as keyof typeof MAIN_HAND_DEFINITIONS
    : "longsword";
  const armourId = Object.hasOwn(ARMOUR_DEFINITIONS, player.armourId) ? player.armourId as ArmourId : "none";
  const coatStyle = APPEARANCE_STYLES.coatStyle.find(option => option.id === appearance.coatStyle)?.name ?? "Explorer";
  const hairStyle = APPEARANCE_STYLES.hairStyle.find(option => option.id === appearance.hairStyle)?.name ?? "Swept";
  const coatColour = APPEARANCE_PALETTE.coat.find(option => option.id === appearance.coat)?.name ?? "Teal";
  const position = remote.entity.getPosition();
  const local = localPlayer.getPosition();
  const distance = Math.hypot(position.x - local.x, position.z - local.z);
  const state = player.health <= 0 ? "Defeated"
    : player.defending ? "Guarding"
      : remote.actionStartedAt !== null || remote.powerStartedAt !== null ? "In combat"
        : player.health < player.maxHealth ? "Recovering" : "Exploring";
  return {
    id,
    name: player.name || "Explorer",
    level: player.level,
    health: player.health,
    maxHealth: player.maxHealth,
    state,
    stateTone: player.health <= 0 ? "down" : state === "In combat" || state === "Guarding" ? "busy" : "ready",
    weapon: MAIN_HAND_DEFINITIONS[handId].name,
    armour: ARMOUR_DEFINITIONS[armourId].name,
    trait: Object.hasOwn(TRAIT_DEFINITIONS, player.equippedTrait)
      ? TRAIT_DEFINITIONS[player.equippedTrait as keyof typeof TRAIT_DEFINITIONS].name : "None",
    appearance: coatColour + " " + coatStyle + " · " + hairStyle + " hair",
    handId,
    armourId,
    appearanceKey: appearance.skin + ":" + appearance.hair + ":" + appearance.coat + ":" + appearance.hairStyle + ":" + appearance.coatStyle,
    characterRoot: remote.rig.root,
    distance,
    partyState: distance > 4 ? "far" : partyUI.isMember(id) ? "member" : partyUI.isFull() ? "full" : "invite",
  };
}

function openNearbyPlayerInteraction(): void {
  if (!nearbyTradePlayerId || tradeUI.isOpen()) return;
  const view = playerInteractionView(nearbyTradePlayerId);
  if (view) playerInteractionUI.open(view);
}

playerTradePrompt.addEventListener("click", openNearbyPlayerInteraction);

function updatePlayerTradePrompt(blocked: boolean): void {
  nearbyTradePlayerId = null;
  if (playerInteractionUI.isOpen()) {
    const targetId = playerInteractionUI.targetId();
    const view = targetId ? playerInteractionView(targetId) : null;
    if (view) playerInteractionUI.update(view);
    else playerInteractionUI.close();
    playerTradePrompt.hidden = true;
    return;
  }
  if (blocked || !room || !worldReady || !camera.camera || tradeUI.isOpen() || !defeatScreen.hidden) {
    playerTradePrompt.hidden = true;
    return;
  }
  const local = localPlayer.getPosition();
  let nearest: { id: string; position: pc.Vec3; distance: number; name: string } | null = null;
  for (const [id, remote] of remotePlayers) {
    if (!remote.entity.enabled) continue;
    const position = remote.entity.getPosition();
    const horizontal = Math.hypot(position.x - local.x, position.z - local.z);
    if (horizontal > 4 || Math.abs(position.y - local.y) > 1.5 || horizontal >= (nearest?.distance ?? Infinity)) continue;
    const player = (room.state.players as Map<string, NetworkPlayer>).get(id);
    if (!player || player.health <= 0) continue;
    nearest = { id, position, distance: horizontal, name: player.name || "Explorer" };
  }
  if (!nearest) {
    playerTradePrompt.hidden = true;
    return;
  }
  const screen = camera.camera.worldToScreen(new pc.Vec3(nearest.position.x, nearest.position.y + 2.35, nearest.position.z));
  const rect = canvas.getBoundingClientRect();
  if (screen.z <= 0 || screen.x < 0 || screen.x > rect.width || screen.y < 0 || screen.y > rect.height) {
    playerTradePrompt.hidden = true;
    return;
  }
  nearbyTradePlayerId = nearest.id;
  playerTradeName.textContent = nearest.name;
  playerTradePrompt.style.left = `${rect.left + screen.x}px`;
  playerTradePrompt.style.top = `${rect.top + screen.y}px`;
  playerTradePrompt.hidden = false;
  playerTradePrompt.setAttribute("aria-label", `Interact with ${nearest.name}`);
}
const mobVisuals = new Map<string, MobVisual>();
const lootVisuals = new Map<string, LootVisual>();
const lootPanel = document.querySelector<HTMLElement>("#loot-panel")!;
const lootWorldLabel = document.querySelector<HTMLButtonElement>("#loot-world-label")!;
const lootWorldName = document.querySelector<HTMLElement>("#loot-world-name")!;
const lootWorldAction = document.querySelector<HTMLElement>("#loot-world-action")!;
const lootWorldVerdict = document.querySelector<HTMLElement>("#loot-world-verdict")!;
const lootWorldStats = document.querySelector<HTMLElement>("#loot-world-stats")!;
const lootWorldCarry = document.querySelector<HTMLElement>("#loot-world-carry")!;
const lootHeadingLabel = document.querySelector<HTMLElement>(".loot-heading span")!;
const lootClose = document.querySelector<HTMLButtonElement>("#loot-close")!;
const lootEquip = document.querySelector<HTMLButtonElement>("#loot-equip")!;
const lootKeep = document.querySelector<HTMLButtonElement>("#loot-keep")!;
const lootDismantle = document.querySelector<HTMLButtonElement>("#loot-dismantle")!;
const lootAcquisitionState = document.querySelector<HTMLElement>("#loot-acquisition-state")!;
const lootSource = document.querySelector<HTMLElement>("#loot-source")!;
const lootMessage = document.querySelector<HTMLElement>("#loot-message")!;
let inspectedDropId: string | null = null;
let lootPending = false;
const pendingFloorLoot = new Map<string, number>();
let lootWorldDetailKey = "";
function closeLoot() {
  lootPanel.hidden = true; inspectedDropId = null; lootPending = false;
}
function nearestVisibleLootDrop(maxDistance: number): { id: string; distance: number } | null {
  const player = localPlayer.getPosition();
  let nearest: string | null = null; let distance = maxDistance;
  for (const [id, visual] of lootVisuals) {
    const drop = visual.state;
    const d = Math.hypot(drop.x - player.x, drop.y - player.y, drop.z - player.z);
    if (!isItemId(drop.itemId) || !visual.root.enabled || performance.now() < visual.landedAt || d > distance
      || !enemyCueLineClear({ x: player.x, y: player.y + .72, z: player.z },
        { x: drop.x, y: drop.y + .72, z: drop.z }, readCollisionWorldBlock)) continue;
    nearest = id; distance = d;
  }
  return nearest ? { id: nearest, distance } : null;
}
function nearestLootDrop(): string | null {
  return nearestVisibleLootDrop(EQUIPMENT_LOOT_RANGE)?.id ?? null;
}
function lootHasDetails(dropId: string, drop: NetworkLootDrop): boolean {
  if (isEnemyLootBag(drop)) return false;
  return dropId.startsWith("forest-cache:") || isEquipmentItem(drop.itemId) || Boolean(utilityForItem(drop.itemId));
}
function lootWouldOverflow(dropId: string, drop: NetworkLootDrop): boolean {
  if (dropId.startsWith("forest-cache:") || !isItemId(drop.itemId)) return false;
  if (isEnemyLootBag(drop)) return lootItems(drop).every(entry =>
    (inventoryCounts.get(entry.itemId) ?? 0) >= lootCarryCapacity(entry.itemId, blacksmithIronCapacity));
  return (inventoryCounts.get(drop.itemId) ?? 0) + drop.quantity > lootCarryCapacity(drop.itemId, blacksmithIronCapacity);
}
function interactWithLoot(dropId: string): void {
  const drop = lootVisuals.get(dropId)?.state;
  if (!drop || !room || !worldReady) return;
  if (lootWouldOverflow(dropId, drop)) {
    const message = `Your ${isItemId(drop.itemId) ? ITEM_DEFINITIONS[drop.itemId].name : "loot"} capacity is full.`;
    status.textContent = message;
    showCombatFeedback("INVENTORY FULL", "hurt");
    return;
  }
  if ((pendingFloorLoot.get(dropId) ?? 0) > performance.now()) return;
  pendingFloorLoot.set(dropId, performance.now() + 2_000);
  room.send("loot:collect", { dropId, action: "keep" });
  status.textContent = isEnemyLootBag(drop)
    ? `Opening ${LOOT_BAG_TIER_LABEL[lootBagTierForItems(lootItems(drop))]}...`
    : `Picking up ${isItemId(drop.itemId) ? ITEM_DEFINITIONS[drop.itemId].name : "loot"}...`;
}
function appendWorldLootStat(label: string, value: string, trend: "better" | "worse" | "same" = "same"): void {
  const stat = document.createElement("span");
  stat.dataset.trend = trend;
  stat.textContent = `${label} ${value}`;
  lootWorldStats.append(stat, document.createTextNode(" · "));
}
function updateLootWorldDetails(dropId: string, drop: NetworkLootDrop): void {
  if (!isItemId(drop.itemId)) return;
  if (isEnemyLootBag(drop)) {
    const items = lootItems(drop);
    const detailKey = `${dropId}:${drop.contentsJson}:${[...inventoryCounts].map(([id, quantity]) => `${id}:${quantity}`).join(",")}:${blacksmithIronCapacity}`;
    if (detailKey === lootWorldDetailKey) return;
    lootWorldDetailKey = detailKey;
    lootWorldStats.replaceChildren();
    for (const entry of items) {
      const owned = inventoryCounts.get(entry.itemId) ?? 0;
      const capacity = lootCarryCapacity(entry.itemId, blacksmithIronCapacity);
      appendWorldLootStat(ITEM_DEFINITIONS[entry.itemId].name, `×${entry.quantity}${capacity < 65_535 ? ` · ${owned}/${capacity}` : ""}`,
        owned >= capacity ? "worse" : "same");
    }
    if (lootWorldStats.lastChild?.nodeType === Node.TEXT_NODE) lootWorldStats.lastChild.remove();
    const blocked = items.filter(entry => (inventoryCounts.get(entry.itemId) ?? 0) >= lootCarryCapacity(entry.itemId, blacksmithIronCapacity)).length;
    lootWorldVerdict.textContent = blocked === items.length ? "FULL" : blocked > 0 ? "PARTIAL" : "READY";
    lootWorldCarry.textContent = `${items.length} ITEM TYPE${items.length === 1 ? "" : "S"} · PICKS UP EVERYTHING THAT FITS`;
    return;
  }
  const owned = inventoryCounts.get(drop.itemId) ?? 0;
  const hand = equipmentForItem(drop.itemId);
  const armour = armourForItem(drop.itemId);
  const detailKey = `${dropId}:${drop.itemId}:${drop.quantity}:${owned}:${blacksmithIronCapacity}:${localMainHandId}:${localArmourId}:${localIronSwordOwned}:${equipmentRank(drop.itemId)}`;
  if (detailKey === lootWorldDetailKey) return;
  lootWorldDetailKey = detailKey;
  lootWorldStats.replaceChildren();
  let verdict = owned > 0 ? "DUPLICATE" : "NEW";
  if (hand) {
    const candidate = weaponComparison(hand, localIronSwordOwned || drop.itemId === "forged_sword", equipmentRank(drop.itemId));
    const worn = weaponComparison(localMainHandId, localIronSwordOwned, equipmentRank(itemForMainHand(localMainHandId)));
    const damageTrend = comparisonTrend(candidate.damageValue, worn.damageValue);
    const rangeTrend = comparisonTrend(candidate.rangeValue, worn.rangeValue);
    const speedTrend = comparisonTrend(candidate.speedValue, worn.speedValue, true);
    const score = [damageTrend, rangeTrend, speedTrend].reduce((total, trend) => total + (trend === "better" ? 1 : trend === "worse" ? -1 : 0), 0);
    if (owned === 0) verdict = score > 0 ? "UPGRADE" : "SIDEGRADE";
    appendWorldLootStat("DMG", candidate.damage, damageTrend);
    appendWorldLootStat("RANGE", candidate.range, rangeTrend);
    appendWorldLootStat("SPEED", candidate.speed, speedTrend);
  } else if (armour) {
    const candidate = armourComparison(armour, equipmentRank(drop.itemId));
    const worn = armourComparison(localArmourId, equipmentRank(localArmourId === "none" ? null : localArmourId));
    const reductionTrend = comparisonTrend(candidate.reductionValue, worn.reductionValue);
    const speedTrend = comparisonTrend(candidate.speedValue, worn.speedValue);
    if (owned === 0 && localArmourId !== "none") verdict = reductionTrend === "better" && speedTrend !== "worse" ? "UPGRADE" : "SIDEGRADE";
    appendWorldLootStat("ARMOUR", candidate.reduction, reductionTrend);
    appendWorldLootStat("MOVE", candidate.speed, speedTrend);
    appendWorldLootStat("RANGED", candidate.ranged, comparisonTrend(candidate.rangedValue, worn.rangedValue));
  } else {
    const description = document.createElement("span");
    description.textContent = ITEM_DEFINITIONS[drop.itemId].description;
    lootWorldStats.append(description);
  }
  if (lootWorldStats.lastChild?.nodeType === Node.TEXT_NODE) lootWorldStats.lastChild.remove();
  const capacity = lootCarryCapacity(drop.itemId, blacksmithIronCapacity);
  const full = lootWouldOverflow(dropId, drop);
  lootWorldVerdict.textContent = full ? "FULL" : verdict;
  lootWorldCarry.textContent = capacity < 65_535 && !dropId.startsWith("forest-cache:")
    ? `DROP ×${drop.quantity} · PACK ${owned} / ${capacity}`
    : `DROP ×${drop.quantity} · PACK ${owned} → ${owned + drop.quantity}`;
}
function updateLootWorldLabel(): void {
  lootWorldLabel.hidden = true;
  if (!worldReady || !camera.camera || !lootPanel.hidden || !inventoryPanel.hidden || !defeatScreen.hidden) { lootWorldDetailKey = ""; return; }
  const nearest = nearestVisibleLootDrop(8);
  if (!nearest) return;
  const drop = lootVisuals.get(nearest.id)?.state;
  if (!drop || !isItemId(drop.itemId)) return;
  const rect = canvas.getBoundingClientRect();
  const screen = camera.camera.worldToScreen(new pc.Vec3(drop.x, drop.y + 1.4, drop.z));
  if (screen.z <= 0 || screen.x < 0 || screen.x > rect.width || screen.y < 0 || screen.y > rect.height) return;
  const seconds = Math.max(0, Math.ceil((drop.expiresAt - Date.now()) / 1000));
  const near = nearest.distance <= EQUIPMENT_LOOT_RANGE;
  const items = lootItems(drop);
  const bagTier = isEnemyLootBag(drop) ? lootBagTierForItems(items) : null;
  const rarity = bagTier ? LOOT_BAG_TIER_RARITY[bagTier] : itemRarity(drop.itemId);
  const hasDetails = lootHasDetails(nearest.id, drop);
  const equippable = Boolean(equipmentForItem(drop.itemId) || armourForItem(drop.itemId));
  const full = lootWouldOverflow(nearest.id, drop);
  updateLootWorldDetails(nearest.id, drop);
  lootWorldLabel.dataset.rarity = rarity;
  lootWorldName.textContent = bagTier
    ? `${LOOT_BAG_TIER_LABEL[bagTier]} · ${items.reduce((total, entry) => total + entry.quantity, 0)} ITEMS`
    : `${drop.quantity > 1 ? `${drop.quantity}× ` : ""}${ITEM_DEFINITIONS[drop.itemId].name}${hasDetails || equippable ? ` · ${ITEM_RARITIES[rarity].label.toUpperCase()}` : ""}`;
  lootWorldAction.textContent = `${near ? full ? "INVENTORY FULL" : "E · PICK UP" : `${nearest.distance.toFixed(1)}m · MOVE CLOSER`}${drop.expiresAt < Number.MAX_SAFE_INTEGER ? ` · ${seconds}s` : ""}`;
  lootWorldLabel.dataset.near = String(near);
  lootWorldLabel.dataset.full = String(full);
  lootWorldLabel.hidden = false;
}
function itemForMainHand(id: MainHandId): ItemId | null {
  const definition = MAIN_HAND_DEFINITIONS[id];
  return "requiredItemId" in definition ? definition.requiredItemId as ItemId : null;
}
function equipmentRank(itemId: ItemId | null): number {
  return itemId ? blacksmithReforgeRanks[itemId as BlacksmithReforgeItemId] ?? 0 : 0;
}
function appendComparisonRow(element: HTMLElement, label: string, value: string, selectedValue: number,
  wornValue?: number, lowerIsBetter = false): void {
  const row = document.createElement("div"); row.className = "loot-stat";
  if (wornValue !== undefined) row.dataset.trend = comparisonTrend(selectedValue, wornValue, lowerIsBetter);
  const key = document.createElement("span"); key.textContent = label;
  const stat = document.createElement("span"); stat.textContent = value;
  row.append(key, stat); element.append(row);
}
function appendEquipmentIdentity(element: HTMLElement, itemId: ItemId | null, rank: number): void {
  const rankNode = document.createElement("small"); rankNode.className = "inventory-rank";
  rankNode.textContent = itemId ? rankLabel(rank) : "STARTER"; element.append(rankNode);
  if (!itemId) return;
  const perk = equipmentPerkStats(itemId, rank);
  if (!perk) return;
  const perkNode = document.createElement("p"); perkNode.className = "inventory-perk";
  const perkName = document.createElement("strong"); perkName.textContent = perk.name.toUpperCase();
  perkNode.append(perkName, document.createTextNode(perk.detail)); element.append(perkNode);
}
function fillLootComparison(element: HTMLElement, id: MainHandId, rank = equipmentRank(itemForMainHand(id)), compareId?: MainHandId) {
  const comparison = weaponComparison(id, localIronSwordOwned, rank);
  const worn = compareId ? weaponComparison(compareId, localIronSwordOwned, equipmentRank(itemForMainHand(compareId))) : null;
  element.replaceChildren();
  const title = document.createElement("strong"); title.textContent = comparison.name; element.append(title);
  const itemId = itemForMainHand(id);
  if (itemId) { const rarity = document.createElement("b"); rarity.className = "loot-rarity"; rarity.dataset.rarity = itemRarity(itemId); rarity.textContent = ITEM_RARITIES[itemRarity(itemId)].label; element.append(rarity); }
  appendEquipmentIdentity(element, itemId, rank);
  appendComparisonRow(element, "Damage", comparison.damage, comparison.damageValue, worn?.damageValue);
  appendComparisonRow(element, "Reach", comparison.range, comparison.rangeValue, worn?.rangeValue);
  appendComparisonRow(element, "First attack", comparison.speed, comparison.speedValue, worn?.speedValue, true);
  const note = document.createElement("p"); note.textContent = `${comparison.style} · ${comparison.benefit}`; element.append(note);
}
function fillArmourComparison(element: HTMLElement, id: ArmourId, rank = equipmentRank(id === "none" ? null : id), compareId?: ArmourId) {
  const comparison = armourComparison(id, rank);
  const worn = compareId ? armourComparison(compareId, equipmentRank(compareId === "none" ? null : compareId)) : null;
  element.replaceChildren();
  const title = document.createElement("strong"); title.textContent = comparison.name; element.append(title);
  if (id !== "none") { const rarity = document.createElement("b"); rarity.className = "loot-rarity"; rarity.dataset.rarity = itemRarity(id); rarity.textContent = ITEM_RARITIES[itemRarity(id)].label; element.append(rarity); }
  appendEquipmentIdentity(element, id === "none" ? null : id, rank);
  appendComparisonRow(element, "Reduction", comparison.reduction, comparison.reductionValue, worn?.reductionValue);
  appendComparisonRow(element, "Movement", comparison.speed, comparison.speedValue, worn?.speedValue);
  appendComparisonRow(element, "Projectiles", comparison.ranged, comparison.rangedValue, worn?.rangedValue);
  appendComparisonRow(element, "Hazards", comparison.hazards, comparison.hazardValue, worn?.hazardValue);
  appendComparisonRow(element, "Minimum hit", comparison.minimum, 1, worn ? 1 : undefined);
  const note = document.createElement("p"); note.textContent = comparison.note; element.append(note);
}
function openLoot(id: string) {
  const drop = lootVisuals.get(id)?.state;
  const rewardCache = id.startsWith("forest-cache:");
  const hand = drop && equipmentForItem(drop.itemId);
  const armour = drop && armourForItem(drop.itemId);
  const utility = drop && utilityForItem(drop.itemId);
  if (!drop || (!rewardCache && !hand && !armour && !utility) || !room || !worldReady) return;
  setInventoryOpen(false); quizPanel.hidden = true; blacksmithPanel.hidden = true; closeTavernDialogue();
  if (localDefending) requestDefense(false);
  resetMovementControls();
  inspectedDropId = id; lootPending = false; lootPanel.hidden = false;
  const rarity = itemRarity(drop.itemId);
  const owned = inventoryCounts.get(drop.itemId as ItemId) ?? 0;
  const duplicate = owned > 0;
  lootPanel.dataset.rarity = rarity;
  lootAcquisitionState.dataset.duplicate = String(duplicate);
  lootAcquisitionState.textContent = duplicate ? `DUPLICATE · ${owned} OWNED` : "NEW FIND";
  const sourceId = lootSourceMob(id);
  lootSource.textContent = sourceId ? `Dropped by ${mobVisuals.get(sourceId)?.state.name ?? "enemy"}` : rewardCache ? "Personal dungeon reward" : "Personal equipment drop";
  lootHeadingLabel.textContent = rewardCache ? "PERSONAL DUNGEON CACHE" : `${ITEM_RARITIES[rarity].label.toUpperCase()} · ENEMY EQUIPMENT`;
  document.querySelector<HTMLElement>("#loot-title")!.textContent = rewardCache ? "Personal Rootbound Cache" : ITEM_DEFINITIONS[drop.itemId as ItemId].name;
  document.querySelector<HTMLElement>("#loot-description")!.textContent = rewardCache
    ? `Your secured dungeon reward features ${isItemId(drop.itemId) ? ITEM_DEFINITIONS[drop.itemId].name : "veteran supplies"}.`
    : `${drop.quantity} item · ${isItemId(drop.itemId) ? ITEM_DEFINITIONS[drop.itemId].description : "Enemy equipment"}`;
  if (rewardCache) {
    const featuredName = isItemId(drop.itemId) ? ITEM_DEFINITIONS[drop.itemId].name : "Veteran supplies";
    document.querySelector<HTMLElement>("#loot-new")!.innerHTML = `<strong>Featured: ${featuredName}</strong><p>Also contains gold · Stone Cores · Iron Ore · Healing Potion${drop.itemId === "silver_ore" ? " · bonus Silver Ore" : ""}</p>`;
    document.querySelector<HTMLElement>("#loot-current")!.innerHTML = `<strong>${hand || armour ? "New fixed equipment" : "Repeat-clear supplies"}</strong><p>Only you can see and claim this cache. Duplicate equipment converts into silver, materials, and gold.</p>`;
  } else if (armour) {
    const dropRank = owned > 0 ? equipmentRank(drop.itemId as ItemId) : 0;
    fillArmourComparison(document.querySelector<HTMLElement>("#loot-new")!, armour, dropRank, localArmourId);
    fillArmourComparison(document.querySelector<HTMLElement>("#loot-current")!, localArmourId);
  } else if (hand) {
    const dropRank = owned > 0 ? equipmentRank(drop.itemId as ItemId) : 0;
    fillLootComparison(document.querySelector<HTMLElement>("#loot-new")!, hand, dropRank, localMainHandId);
    fillLootComparison(document.querySelector<HTMLElement>("#loot-current")!, localMainHandId);
  } else if (utility) {
    document.querySelector<HTMLElement>("#loot-new")!.innerHTML = utility === "moonstone"
      ? `<strong>Matriarch's Moonstone</strong><p>Fixed expedition reward · forge a permanent weapon upgrade</p>`
      : `<strong>Miner's Lantern</strong><p>18-block cave light · brighter warm glow · auto-equipped</p>`;
    document.querySelector<HTMLElement>("#loot-current")!.innerHTML = utility === "moonstone"
      ? `<strong>Moonstone Edge</strong><p>Return this stone to the blacksmith · +1 damage to every weapon</p>`
      : `<strong>${(inventoryCounts.get("miners_lantern") ?? 0) > 0 ? "Already owned" : "Explorer's lamp"}</strong><p>12-block cave light · standard intensity</p>`;
  }
  lootMessage.textContent = rewardCache ? "Claim this cache before using the victory portal."
    : utility === "moonstone" ? "The Crystal Matriarch's personal cache. Return it to the blacksmith."
    : utility ? "The Stone Warden's personal cache. The lantern auto-equips when claimed."
    : "Choose how to use this item. The world keeps moving.";
  lootEquip.hidden = rewardCache || Boolean(utility);
  lootKeep.textContent = rewardCache ? "CLAIM CACHE" : utility ? "CLAIM & AUTO-EQUIP" : "KEEP IN PACK";
  const dismantleRecipe = Object.hasOwn(BLACKSMITH_DISMANTLE, drop.itemId)
    ? BLACKSMITH_DISMANTLE[drop.itemId as BlacksmithDismantleItemId] : null;
  lootDismantle.hidden = rewardCache || Boolean(utility) || !dismantleRecipe;
  lootDismantle.textContent = dismantleRecipe ? `DISMANTLE · +${dismantleRecipe.gold} GOLD` : "DISMANTLE";
  lootEquip.disabled = lootKeep.disabled = lootDismantle.disabled = false;
  lootClose.focus();
}
function collectInspectedLoot(action: LootCollectAction) {
  if (!room || !inspectedDropId || lootPending) return;
  lootPending = true; lootEquip.disabled = lootKeep.disabled = lootDismantle.disabled = true;
  lootMessage.textContent = action === "dismantle" ? "Dismantling…" : "Collecting…";
  const id = inspectedDropId;
  // Keep/equip can cross an older rolling server safely; dismantle omits the
  // legacy flag so an old server rejects it instead of accidentally keeping it.
  room.send("loot:collect", action === "dismantle"
    ? { dropId: id, action }
    : { dropId: id, action, equip: action === "equip" });
  window.setTimeout(() => {
    if (inspectedDropId !== id || !lootPending) return;
    lootPending = false; lootEquip.disabled = lootKeep.disabled = lootDismantle.disabled = false;
    lootMessage.textContent = "No confirmation yet. You can try again.";
  }, 3000);
}
lootClose.addEventListener("click", closeLoot);
lootEquip.addEventListener("click", () => collectInspectedLoot("equip"));
lootKeep.addEventListener("click", () => collectInspectedLoot("keep"));
lootDismantle.addEventListener("click", () => collectInspectedLoot("dismantle"));
lootWorldLabel.addEventListener("click", () => {
  const nearby = nearestVisibleLootDrop(EQUIPMENT_LOOT_RANGE);
  if (nearby) interactWithLoot(nearby.id);
});
const inventoryCounts = new Map<ItemId, number>(Object.keys(ITEM_DEFINITIONS).map(itemId => [itemId as ItemId, 0]));
let blacksmithReforgeRanks: EquipmentReforgeRanks = {};
const rankLabel = (rank: number): string => rank <= 0 ? "UNFORGED" : `RANK ${["I", "II", "III"][Math.min(3, rank) - 1]}`;
const equipmentCollectionGrid = document.querySelector<HTMLElement>("#equipment-collection-grid")!;
for (const entry of EQUIPMENT_COLLECTION) {
  const card = document.createElement("article");
  card.dataset.collectionItem = entry.itemId;
  card.dataset.slot = entry.slot;
  card.innerHTML = `<i aria-hidden="true"></i><div class="collection-item-copy"><small class="collection-state">UNDISCOVERED</small><strong>${ITEM_DEFINITIONS[entry.itemId].name}</strong><span>${entry.source}</span><p class="collection-upgrade"></p></div><button type="button" disabled>PREVIEW</button>`;
  card.querySelector<HTMLButtonElement>("button")!.addEventListener("click", () => {
    const hand = equipmentForItem(entry.itemId);
    const armour = armourForItem(entry.itemId);
    if (hand && isMainHandId(hand)) { previewHand = hand; previewSlot = "weapon"; selectedInventoryItem = entry.itemId; }
    else if (armour) { previewArmour = armour; previewSlot = "armour"; selectedInventoryItem = entry.itemId; }
    else return;
    inventoryPreviewDrawer.open = true;
    refreshInventoryPreview();
    inventoryPreviewDrawer.scrollIntoView({ block: "nearest" });
  });
  equipmentCollectionGrid.append(card);
}
const combatAudio = new CombatAudio();
const unlockCombatAudio = (): void => combatAudio.unlock();
window.addEventListener("pointerdown", unlockCombatAudio, { once: true, capture: true });
window.addEventListener("keydown", unlockCombatAudio, { once: true, capture: true });
const authoritativeLocalPosition = new pc.Vec3(8.5, 11, 8.5);
let localFacingYaw = 0;
let localVisualVerticalOffset = 0;
let localNetworkVisualOffset = { x: 0, z: 0 };
let localRecoveryVisualOffset = { x: 0, z: 0 };
let localDodgeVisualOffset = { x: 0, z: 0 };
const localPowerVisualOffset = new pc.Vec3();
let localActionStartedAt: number | null = null;
let localActionFacingYaw: number | null = null;
let localActionStep = 0;
let localActionMainHandId: MainHandId | null = null;
let localComboStep = 0;
let localComboExpiresAt = 0;
let localHitPauseUntil = 0;
let localDodgeStartedAt: number | null = null;
let localDodgeRequestedAt = Number.NEGATIVE_INFINITY;
let localPredictedDodgeStamina = 0;
let localPredictedDodgeStaminaAt = 0;
let localPredictedDodgeStaminaMaximum = 100;
let localPredictedDodgeStaminaReady = false;
let localDefending = false;
let localMomentumStacks = 0;
let localTraitId: TraitId = "momentum";
let localPowerStartedAt: number | null = null;
let localPowerFacingYaw: number | null = null;
let localPowerStepApplied = false;
let localPowerCooldownUntil = 0;
let localSpecialCooldownUntil = 0;
let localMainHandId: MainHandId = "longsword";
let localArmourId: ArmourId = "none";
let localIronSwordOwned = false;
let localDepthsRewardFlags = 0;
let localIsAdmin = false;
let localCharacterProgression: ProgressionUpdate = {
  reason: "sync", level: 1, experience: 0, experienceRequired: 40, unspentStatPoints: 0,
  powerPoints: 0, vitalityPoints: 0, agilityPoints: 0, miningPoints: 0,
};
let localEquippedPower: PowerId = "shockwave";
let localPrimaryPower: PowerId = "shockwave";
let localSecondaryPower: PowerId = "eruption";
let activePowerSlot: "primary" | "secondary" = "primary";
let powerAimKey: "KeyR" | "KeyT" | null = null;
let localSeismicMastery: SeismicMasteryId = "advancing_fault";
let localEquippedSpecial: SpecialId = "hunters_mark";
let localActivePower: PowerId | null = null;
let powerSequence = 0;
let specialSequence = 0;
let specialEquipSequence = 0;
let powerEquipSequence = 0;
let seismicMasterySequence = 0;
let mainHandEquipSequence = 0;
let defenseSequence = 0;
let traitEquipSequence = 0;
let localLastPowerSequence = 0;
let powerServerReady = false;
let powerAimActive = false;
let powerAimYaw = 0;
let powerAimPointerId: number | null = null;
const powerAimTarget = new pc.Vec3();
let powerAimTargetValid = true;
let specialAimActive = false;
let specialAimPointerId: number | null = null;
let specialAimYaw = 0;
const specialAimTarget = new pc.Vec3();
let specialAimTargetValid = true;
let cameraShakeUntil = 0;
let cameraShakeStrength = 0;
let lastProcessedInputSequence = 0;
const pendingPredictionFrames: PredictionFrame[] = [];
let lastAuthoritativeMovementAt = 0;
let lastAcknowledgementAdvancedAt = 0;
let pendingStopInputSequence: number | null = null;
let pendingStopDeadline = 0;
const cameraFocus = new pc.Vec3(8.5, 11, 8.5);
const cameraTarget = new pc.Vec3(8.5, 11, 8.5);
let cameraFollow = { x: 8.5, z: 8.5 };

function isPowerId(value: string): value is PowerId {
  return value in POWER_DEFINITIONS;
}

function isSeismicMasteryId(value: string): value is SeismicMasteryId {
  return value === "advancing_fault" || value === "tectonic_stand";
}

function seismicPowerShape(masteryId = localSeismicMastery): { range: number; width: number; forwardStep: number } {
  const mastery = SEISMIC_CLEAVE_UPGRADES.masteries[masteryId];
  return {
    range: POWER_DEFINITIONS.seismic_cleave.range + SEISMIC_CLEAVE_UPGRADES.faultReachBonus,
    width: mastery.width,
    forwardStep: mastery.forwardStep,
  };
}

function activePowerShape(powerId: PowerId): { range: number; width: number; forwardStep: number } {
  const definition = POWER_DEFINITIONS[powerId];
  return powerId === "seismic_cleave" ? seismicPowerShape() : definition;
}

function isSpecialId(value: string): value is SpecialId {
  return value in SPECIAL_DEFINITIONS;
}

function isMainHandId(value: string): value is MainHandId {
  return value in MAIN_HAND_DEFINITIONS;
}

function isTraitId(value: string): value is TraitId {
  return value in TRAIT_DEFINITIONS;
}

function refreshPowerCompatibility(): void {
  combatHud.setWeapon(localMainHandId, localIronSwordOwned);
  refreshInventoryEquipped();
  for (const button of inventoryEquipButtons) {
    const equipped = button.dataset.equipMainHand === localMainHandId;
    button.setAttribute("aria-pressed", String(equipped));
    button.textContent = equipped ? "EQUIPPED" : "EQUIP";
  }
  setRigMainHand(localPlayerRig, localMainHandId);
}

function refreshInventoryEquipped(): void {
  const tool = (inventoryCounts.get("reinforced_pickaxe") ?? 0) > 0 ? "Reinforced Pickaxe" : "Starter Pickaxe";
  inventoryEquipped.textContent = `${MAIN_HAND_DEFINITIONS[localMainHandId].name} · ${tool} · ${armourStats(localArmourId).name}`;
  const handDefinition = MAIN_HAND_DEFINITIONS[localMainHandId];
  const handItem = ("requiredItemId" in handDefinition ? handDefinition.requiredItemId : null) as ItemId | null;
  const armourItem = localArmourId === "none" ? null : localArmourId as ItemId;
  const slotValues: Record<string, { name: string; detail: string; rarity?: ItemRarity }> = {
    weapon: {
      name: localMainHandId === "longsword" && localIronSwordOwned ? "Iron Sword" : handDefinition.name,
      detail: handItem ? rankLabel(blacksmithReforgeRanks[handItem as BlacksmithReforgeItemId] ?? 0) : "STARTER",
      rarity: handItem ? itemRarity(handItem) : undefined,
    },
    armour: {
      name: armourStats(localArmourId).name,
      detail: armourItem ? rankLabel(blacksmithReforgeRanks[armourItem as BlacksmithReforgeItemId] ?? 0) : "EMPTY",
      rarity: armourItem ? itemRarity(armourItem) : undefined,
    },
    tool: { name: tool, detail: "AUTO" },
    light: { name: (inventoryCounts.get("miners_lantern") ?? 0) > 0 ? "Miner's Lantern" : "Explorer's Lamp", detail: "AUTO" },
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-loadout-slot]")) {
    const value = slotValues[button.dataset.loadoutSlot!]!;
    button.querySelector("strong")!.textContent = value.name;
    button.querySelector("span")!.textContent = value.detail;
    if (value.rarity) button.dataset.rarity = value.rarity; else delete button.dataset.rarity;
  }
  const slot = document.querySelector<HTMLElement>("#inventory-armour-slot");
  if (slot) slot.textContent = `ARMOUR SLOT: ${armourStats(localArmourId).name}`;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-equip-armour]")) {
    const id = button.dataset.equipArmour!;
    button.disabled = id === localArmourId || (id !== "none" && (inventoryCounts.get(id as ItemId) ?? 0) <= 0);
    button.textContent = id === localArmourId ? "EQUIPPED" : id === "none" ? "REMOVE ARMOUR" : "EQUIP";
    button.setAttribute("aria-pressed", String(id === localArmourId));
  }
  if (!inventoryPanel.hidden) refreshInventoryPreview();
}

let inventoryPortrait: ReturnType<typeof createCharacterPortrait> | undefined;
let localAppearance: Appearance = { ...DEFAULT_APPEARANCE };
const appearanceOptions = document.querySelector<HTMLElement>("#appearance-options")!;
function updateLocalAppearance(appearance: Appearance): void {
  localAppearance = appearance;
  setRigAppearance(localPlayerRig, appearance);
  for (const button of appearanceOptions.querySelectorAll<HTMLButtonElement>("button[data-appearance-group]")) {
    const group = button.dataset.appearanceGroup as keyof Appearance;
    button.setAttribute("aria-pressed", String(appearance[group] === button.dataset.appearanceId));
  }
  refreshInventoryPreview();
}
for (const group of ["skin", "hair", "coat"] as const) {
  const row = document.createElement("div"); row.className = "appearance-choice";
  const label = document.createElement("span"); label.textContent = group === "coat" ? "Coat" : group === "hair" ? "Hair" : "Skin";
  row.append(label);
  for (const option of APPEARANCE_PALETTE[group]) {
    const button = document.createElement("button"); button.type = "button";
    button.dataset.appearanceGroup = group; button.dataset.appearanceId = option.id;
    button.style.setProperty("--swatch", option.color);
    button.setAttribute("aria-label", `${label.textContent}: ${option.name}`);
    button.setAttribute("title", `${label.textContent}: ${option.name}`);
    button.setAttribute("aria-pressed", String(localAppearance[group] === option.id));
    button.addEventListener("click", () => {
      if (!room) { status.textContent = "Connect to the world before changing your look."; return; }
      const next = resolveAppearance({ ...localAppearance, [group]: option.id });
      updateLocalAppearance(next);
      room.send("player:appearance", next);
    });
    row.append(button);
  }
  appearanceOptions.append(row);
}
for (const group of ["hairStyle", "coatStyle"] as const) {
  const row = document.createElement("div"); row.className = "appearance-choice appearance-style-choice";
  const label = document.createElement("span"); label.textContent = group === "hairStyle" ? "Hair shape" : "Outfit shape";
  row.append(label);
  for (const option of APPEARANCE_STYLES[group]) {
    const button = document.createElement("button"); button.type = "button";
    button.dataset.appearanceGroup = group; button.dataset.appearanceId = option.id;
    button.textContent = option.name;
    button.setAttribute("aria-pressed", String(localAppearance[group] === option.id));
    button.addEventListener("click", () => {
      if (!room) { status.textContent = "Connect to the world before changing your look."; return; }
      const next = resolveAppearance({ ...localAppearance, [group]: option.id });
      updateLocalAppearance(next);
      room.send("player:appearance", next);
    });
    row.append(button);
  }
  appearanceOptions.append(row);
}
let previewHand: MainHandId | undefined;
let previewArmour: ArmourId | undefined;
let selectedInventoryItem: ItemId | undefined;
let previewSlot: "weapon" | "armour" = "weapon";
let inventoryComparisonKey = "";
let inventoryBackgroundFrameAt = 0;
const inventorySelectionActions = document.querySelector<HTMLElement>("#inventory-selection-actions")!;
const inventorySelectedEquip = document.querySelector<HTMLButtonElement>("#inventory-selected-equip")!;
const inventorySelectedKeep = document.querySelector<HTMLButtonElement>("#inventory-selected-keep")!;
const inventorySelectedDismantle = document.querySelector<HTMLButtonElement>("#inventory-selected-dismantle")!;

function refreshInventorySelectionActions(): void {
  const itemId = selectedInventoryItem;
  const hand = itemId ? equipmentForItem(itemId) : null;
  const armour = itemId ? armourForItem(itemId) : null;
  const owned = itemId ? (inventoryCounts.get(itemId) ?? 0) > 0 : false;
  inventorySelectionActions.hidden = !itemId || !owned || (!hand && !armour);
  if (inventorySelectionActions.hidden) return;
  const equipped = hand ? hand === localMainHandId : armour === localArmourId;
  inventorySelectedEquip.disabled = equipped;
  inventorySelectedEquip.textContent = equipped ? "EQUIPPED" : "EQUIP NOW";
  const recipe = Object.hasOwn(BLACKSMITH_DISMANTLE, itemId!)
    ? BLACKSMITH_DISMANTLE[itemId! as BlacksmithDismantleItemId] : null;
  inventorySelectedDismantle.hidden = !recipe;
  inventorySelectedDismantle.disabled = !recipe || (equipped && (inventoryCounts.get(itemId!) ?? 0) <= 1);
  inventorySelectedDismantle.textContent = recipe
    ? `${inventorySelectedDismantle.disabled ? "EQUIPPED · " : ""}DISMANTLE AT SMITH · +${recipe.gold} GOLD`
    : "DISMANTLE AT SMITH";
}

function refreshInventoryPreview(): void {
  if (inventoryPanel.hidden || !document.querySelector<HTMLDetailsElement>("#inventory-preview-drawer")!.open) return;
  if (!inventoryPortrait) {
    inventoryPortrait = createCharacterPortrait(document.querySelector<HTMLCanvasElement>("#inventory-portrait")!, localPlayerRig.root,
      (hand, armour) => {
        setRigMainHand(localPlayerRig, hand);
        setRigArmour(localPlayerRig, armour);
        return () => {
          setRigMainHand(localPlayerRig, localMainHandId);
          setRigArmour(localPlayerRig, localArmourId);
        };
      });
  }
  const hand = previewHand ?? localMainHandId;
  const armour = previewArmour ?? localArmourId;
  const appearanceKey = `${hand}:${armour}:${localAppearance.skin}:${localAppearance.hair}:${localAppearance.coat}:${localAppearance.hairStyle}:${localAppearance.coatStyle}`;
  const comparisonKey = `${appearanceKey}:${localMainHandId}:${localArmourId}:${localIronSwordOwned}:${previewSlot}:${selectedInventoryItem ?? "worn"}:${JSON.stringify(blacksmithReforgeRanks)}`;
  inventoryPortrait.refresh(hand, armour, appearanceKey);
  if (comparisonKey === inventoryComparisonKey) return;
  inventoryComparisonKey = comparisonKey;
  const worn = document.querySelector<HTMLElement>("#inventory-worn-stats")!;
  const selected = document.querySelector<HTMLElement>("#inventory-selected-stats")!;
  if (previewSlot === "armour") {
    fillArmourComparison(worn, localArmourId); fillArmourComparison(selected, armour, equipmentRank(selectedInventoryItem ?? (armour === "none" ? null : armour)), localArmourId);
  } else {
    fillLootComparison(worn, localMainHandId); fillLootComparison(selected, hand, equipmentRank(selectedInventoryItem ?? itemForMainHand(hand)), localMainHandId);
  }
  refreshInventorySelectionActions();
  const changed = hand !== localMainHandId || armour !== localArmourId;
  document.querySelector<HTMLElement>("#inventory-preview-label")!.textContent = changed ? "Preview only · not equipped" : "Currently equipped";
}

function updatePowerLoadout(powerId: PowerId): void {
  localPrimaryPower = powerId;
  if (activePowerSlot === "primary") activatePowerSlot("primary", false);
  else combatHud.setPowerLoadout(localPrimaryPower, localSecondaryPower, activePowerSlot, localCharacterProgression.level);
}

function updateSecondaryPowerLoadout(powerId: PowerId): void {
  localSecondaryPower = powerId;
  if (activePowerSlot === "secondary") activatePowerSlot("secondary", false);
  else combatHud.setPowerLoadout(localPrimaryPower, localSecondaryPower, activePowerSlot, localCharacterProgression.level);
}

function activatePowerSlot(slot: "primary" | "secondary", announce = true): boolean {
  if (slot === "secondary" && localCharacterProgression.level < 3) {
    if (announce) status.textContent = "The second Power slot unlocks at character level 3.";
    return false;
  }
  activePowerSlot = slot;
  localEquippedPower = slot === "primary" ? localPrimaryPower : localSecondaryPower;
  combatHud.setPowerLoadout(localPrimaryPower, localSecondaryPower, activePowerSlot, localCharacterProgression.level);
  updateControlsHelp();
  refreshPowerCompatibility();
  return true;
}

function updateSeismicMastery(masteryId: SeismicMasteryId): void {
  localSeismicMastery = masteryId;
  combatHud.setSeismicMastery(masteryId);
}

function requestSeismicMastery(masteryId: SeismicMasteryId): void {
  if (!room || !worldReady || masteryId === localSeismicMastery) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = "Finish or cancel Seismic Cleave before changing its mastery.";
    return;
  }
  seismicMasterySequence += 1;
  room.send("power:seismic-mastery", {
    requestId: `seismic-mastery-${seismicMasterySequence}`,
    masteryId,
  });
  status.textContent = `Equipping ${SEISMIC_CLEAVE_UPGRADES.masteries[masteryId].name}...`;
}

function updateControlsHelp(): void {
  const power = POWER_DEFINITIONS[localEquippedPower];
  const special = SPECIAL_DEFINITIONS[localEquippedSpecial];
  const powerHint = power.castType === "tap" ? `R ${power.name}` : `Hold R ${power.core === "ground" ? "place" : "aim"} ${power.name}`;
  const specialHint = special.castType === "tap" ? `F ${special.name}` : `Hold F place ${special.name}`;
  const fireHint = WEAPON_ATTACK_DEFINITIONS[localMainHandId].projectileTravelMs > 0 ? " · Mouse aim · Hold left-click fire" : "";
  const secondaryHint = localCharacterProgression.level >= 3 ? ` · T ${POWER_DEFINITIONS[localSecondaryPower].name}` : "";
  controlsHelp.textContent = `WASD move · Arrows camera · I inventory · H potion · Hold C/right-click Guard · Space dodge/cancel · ${powerHint}${secondaryHint} · ${specialHint} · Q mode · E/click acts${fireHint}`;
}

function updateSpecialLoadout(specialId: SpecialId): void {
  localEquippedSpecial = specialId;
  combatHud.setSpecial(specialId);
  specialButton.textContent = specialId === "venom_fan" ? "Fan" : specialId === "hunters_mark" ? "Mark" : "Snare";
  updateControlsHelp();
}

function requestSpecialEquip(specialId: SpecialId): void {
  if (!room || !worldReady || specialId === localEquippedSpecial) return;
  if (specialAimActive || localPowerStartedAt !== null || localActionStartedAt !== null) {
    status.textContent = "Finish or cancel the current action before changing Special.";
    return;
  }
  specialEquipSequence += 1;
  room.send("special:equip", { requestId: `special-equip-${specialEquipSequence}`, specialId });
  status.textContent = `Equipping ${SPECIAL_DEFINITIONS[specialId].name}...`;
}

function updateMainHandLoadout(mainHandId: MainHandId): void {
  localMainHandId = mainHandId;
  localComboStep = 0;
  localComboExpiresAt = 0;
  targetStateKey = "";
  refreshPowerCompatibility();
}

function requestPowerEquip(powerId: PowerId): void {
  if (!room || !worldReady || powerId === localEquippedPower) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = "Finish or cancel the current Power before changing it.";
    return;
  }
  if (!isPowerCompatibleWithMainHand(POWER_DEFINITIONS[powerId], localMainHandId)) {
    const mainHand = MAIN_HAND_DEFINITIONS[localMainHandId];
    status.textContent = `${POWER_DEFINITIONS[powerId].name} is not compatible with ${mainHand.name}.`;
    showCombatFeedback("INCOMPATIBLE POWER", "hurt");
    return;
  }
  powerEquipSequence += 1;
  room.send("power:equip", { requestId: `power-equip-${powerEquipSequence}`, powerId, slot: activePowerSlot });
  status.textContent = `Equipping ${POWER_DEFINITIONS[powerId].name} to the ${activePowerSlot} slot...`;
}

function requestMainHandEquip(mainHandId: MainHandId): void {
  if (!room || !worldReady || mainHandId === localMainHandId) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = "Finish or cancel the current Power before changing main hand.";
    return;
  }
  mainHandEquipSequence += 1;
  room.send("main-hand:equip", { requestId: `main-hand-equip-${mainHandEquipSequence}`, mainHandId });
  status.textContent = `Equipping ${MAIN_HAND_DEFINITIONS[mainHandId].name}...`;
}

function updateTraitLoadout(traitId: TraitId): void {
  localTraitId = traitId;
  const definition = TRAIT_DEFINITIONS[traitId];
  traitName.textContent = definition.name;
  traitDetail.textContent = definition.description;
  traitSlot.dataset.trait = traitId;
  momentumPips[0]?.parentElement?.toggleAttribute("hidden", traitId !== "momentum");
  traitBonus.hidden = traitId === "momentum";
  traitBonus.textContent = traitId === "bulwark" ? "−35% GUARD" : traitId === "executioner" ? "+1 VULNERABLE" : "";
  for (const button of traitPickerButtons) button.setAttribute("aria-pressed", String(button.dataset.trait === traitId));
  if (traitId !== "momentum") updateMomentum(0);
  else updateMomentum(localMomentumStacks);
}

function requestTraitEquip(traitId: TraitId): void {
  if (!room || !worldReady || traitId === localTraitId) return;
  if (powerAimActive || specialAimActive || localPowerStartedAt !== null || localActionStartedAt !== null || localDefending) {
    status.textContent = "Finish the current combat action before changing Trait.";
    return;
  }
  traitEquipSequence += 1;
  room.send("trait:equip", { requestId: `trait-equip-${traitEquipSequence}`, traitId });
  status.textContent = `Equipping ${TRAIT_DEFINITIONS[traitId].name}...`;
}

function updatePlayerHealth(health: number, maximumHealth: number): void {
  potionHealth = health;
  potionMaxHealth = maximumHealth;
  playerHud.setHealth(health, maximumHealth);
}

function updatePlayerStamina(stamina: number, maximumStamina: number): void {
  playerHud.setStamina(stamina, maximumStamina);
}

function syncPredictedDodgeStamina(stamina: number, maximumStamina: number): void {
  const now = performance.now();
  localPredictedDodgeStaminaMaximum = maximumStamina;
  if (!localPredictedDodgeStaminaReady) {
    localPredictedDodgeStamina = stamina;
    localPredictedDodgeStaminaReady = true;
  } else {
    const recovered = advancePredictedDodgeStamina(
      localPredictedDodgeStamina,
      now - localPredictedDodgeStaminaAt,
      maximumStamina,
    );
    // A delayed server patch must never refund stamina already reserved by a
    // newer local dodge prediction.
    localPredictedDodgeStamina = Math.min(stamina, recovered);
  }
  localPredictedDodgeStaminaAt = now;
}

function renderCharacterProgression(update: ProgressionUpdate, maximumHealth = potionMaxHealth): void {
  localCharacterProgression = update;
  const required = Math.max(0, update.experienceRequired);
  playerHud.setProgression(update.level, update.experience, required);
  combatHud.setPowerLoadout(localPrimaryPower, localSecondaryPower, activePowerSlot, update.level);
  inventoryLevel.textContent = required > 0 ? `${update.level} · ${update.experience}/${required} XP` : `${update.level} · MAX`;
  characterPoints.textContent = update.unspentStatPoints > 0 ? `${update.unspentStatPoints} POINT${update.unspentStatPoints === 1 ? "" : "S"} AVAILABLE` : "NO POINTS AVAILABLE";
  statPower.textContent = `${update.powerPoints} · +${characterPowerBonus(update.powerPoints)} damage`;
  statVitality.textContent = `${update.vitalityPoints} · ${maximumHealth} max HP`;
  statAgility.textContent = `${update.agilityPoints} · ${Math.round(characterSpeedMultiplier(update.agilityPoints) * 100)}% speed`;
  statMining.textContent = `${update.miningPoints} · ×${1 + characterMiningBonus(update.miningPoints)} yield`;
  characterMilestones.replaceChildren(...CHARACTER_MILESTONES.map(milestone => {
    const row = document.createElement("article");
    const unlocked = update.level >= milestone.level;
    row.dataset.unlocked = String(unlocked);
    row.innerHTML = `<span>${unlocked ? "✓" : `LV ${milestone.level}`}</span><div><strong>${milestone.name}</strong><small>${milestone.detail}</small></div>`;
    return row;
  }));
  activatePowerSlot(activePowerSlot, false);
  levelUpTitle.textContent = `Level ${update.level}!`;
  levelUpMessage.textContent = update.reason === "level_up" ? `You earned ${update.experienceGranted ?? 0} XP from ${update.source ?? "adventuring"}. Choose one permanent improvement.` : "Choose one permanent improvement.";
  levelUpPoints.textContent = `${update.unspentStatPoints} point${update.unspentStatPoints === 1 ? "" : "s"} available`;
  for (const button of characterStatButtons) {
    const stat = button.dataset.characterStat as CharacterStatId;
    button.disabled = update.unspentStatPoints <= 0 || update[`${stat}Points` as keyof ProgressionUpdate] as number >= MAX_CHARACTER_STAT_POINTS;
  }
  levelUpPanel.hidden = update.unspentStatPoints <= 0;
}

function updateMomentum(stacksValue: number): void {
  const safeStacks = Number.isFinite(stacksValue) ? stacksValue : 0;
  localMomentumStacks = Math.max(0, Math.min(MOMENTUM_TRAIT.maxStacks, Math.floor(safeStacks)));
  momentumPips.forEach((pip, index) => pip.classList.toggle("active", index < localMomentumStacks));
  traitSlot.setAttribute("aria-label", localTraitId === "momentum"
    ? `${MOMENTUM_TRAIT.name} trait, ${localMomentumStacks} of ${MOMENTUM_TRAIT.maxStacks} stacks`
    : `${TRAIT_DEFINITIONS[localTraitId].name} trait. ${TRAIT_DEFINITIONS[localTraitId].description}`);
  traitSlot.dataset.stacks = String(localMomentumStacks);
}

function localMovementSpeed(): number {
  const baseSpeed = (localDefending ? 2.1 : 4.2) * armourStats(localArmourId).speed;
  const traitSpeed = localTraitId === "momentum"
    ? baseSpeed * (1 + localMomentumStacks * MOMENTUM_TRAIT.movementSpeedBonusPerStack)
    : baseSpeed;
  return traitSpeed * characterSpeedMultiplier(localCharacterProgression.agilityPoints);
}

const DANGER_ZONE_LABELS = [
  { name: "TOWN OF BEGINNINGS", detail: "Protected sanctuary · enemies cannot attack here" },
  { name: "OUTSKIRTS", detail: "Standard enemies and standard rewards" },
  { name: "WILDS", detail: "Tougher, faster enemies · improved rewards" },
  { name: "DEEP FRONTIER", detail: "Elite enemies · highest danger and rewards" },
] as const;

let localDangerTier = 0;
let dangerZoneKey = "";

function updateDangerZone(tierValue: number, position = localPlayer.getPosition()): void {
  const tier = Math.max(0, Math.min(3, Math.floor(tierValue)));
  localDangerTier = tier;
  const greenwood = tier > 0 && isInGreenwoodRegion(position.x, position.z);
  const camp = tier > 0 && isInGreenwoodCamp(position.x, position.z);
  const arena = tier > 0 && isInStoneBruteArena(position.x, position.z);
  const territory = position.y >= SURFACE_HEIGHT && tier > 0 ? wildernessTerritoryAt(position.x, position.z) : null;
  const silverGuard = position.y >= SURFACE_HEIGHT && isInSilverGuardClearing(position.x, position.z);
  const frontierArena = position.y >= SURFACE_HEIGHT && isInFrontierBruteArena(position.x, position.z);
  const dungeonAtmosphere = forestDungeonAtmosphere(position.x, position.z);
  const forestDungeon = dungeonAtmosphere.room > 0;
  const silverDepths = position.y < 6 && position.x >= SILVER_DEPTHS.minX - .5 && position.x <= SILVER_DEPTHS.maxX + 1.5
    && position.z >= SILVER_DEPTHS.minZ - 1 && position.z <= SILVER_DEPTHS.maxZ + 1;
  const depthsZone = silverDepths ? silverDepthsZone(position) : null;
  const depthsProfile = depthsZone ? SILVER_DEPTHS_ATMOSPHERES[depthsZone] : null;
  const emberVault = isInEmberVault(position.x, position.z);
  const dungeonDetail = dungeonAtmosphere.room === 1 ? "Split the rootbound crawlers · the return portal remains behind you"
    : dungeonAtmosphere.room === 2 ? "Use stone cover · read aimed shots and fan gaps"
      : "Root volleys become committed charges below half health";
  const label = emberVault ? { name: position.x >= 232 ? "COLOSSUS FORGE" : position.x >= 223 ? "EMBER CRUCIBLE" : "THE EMBER VAULT", detail: position.x >= 232 ? "Read the Colossus · dodge the committed smash · claim its forge loot" : "Use iron pillars as cover · clear each sealed forge chamber" }
    : depthsProfile ? { name: depthsProfile.name, detail: depthsProfile.detail }
    : forestDungeon ? { name: dungeonAtmosphere.name, detail: dungeonDetail } : frontierArena ? { name: "FRONTIER BRUTE RUINS", detail: "Sidestep the smash · leave the slam circle · counter during recovery · rich silver and a guaranteed hammer" } : silverGuard ? { name: "SILVER GUARD CLEARING", detail: "Two alternating spitters · use stone cover and fan gaps · dirt trail leads west to the south gate" } : arena ? { name: "STONE BRUTE CLEARING", detail: "One heavy opponent · dodge the marked slam · collect a Stone Core Hammer on defeat" }
    : camp ? { name: "GREENWOOD CRAWLER CAMP", detail: "Three roaming crawlers · exposed iron on the east edge · defeat mobs and collect item drops" } : greenwood
    ? { name: "GREENWOOD OUTSKIRTS", detail: "Ancient oaks · harvest timber · Briar Crawlers roam the camp" }
    : territory ?? DANGER_ZONE_LABELS[tier]!;
  const recommendedLevel = emberVault ? position.x >= 232 ? "LV 14–16" : "LV 12–14"
    : tier === 0 ? "SAFE"
      : silverDepths ? depthsZone === "arena" ? "LV 10–12" : "LV 7–10"
      : forestDungeon ? dungeonAtmosphere.room === 3 ? "LV 10–12" : dungeonAtmosphere.room === 2 ? "LV 8–10" : "LV 6–8"
        : frontierArena ? "LV 9–12" : silverGuard ? "LV 5–8" : arena ? "LV 4–6" : worldLevelRange(territory?.tier ?? tier).label;
  const nextKey = `${tier}:${greenwood}:${camp}:${arena}:${silverGuard}:${frontierArena}:${dungeonAtmosphere.room}:${territory?.name ?? ""}:${depthsZone}:${emberVault}:${recommendedLevel}`;
  if (nextKey === dangerZoneKey) return;
  dangerZoneKey = nextKey;
  dangerZone.dataset.tier = String(tier);
  dangerZoneName.textContent = label.name;
  dangerZoneTier.textContent = recommendedLevel;
  dangerZoneDetail.textContent = `${label.detail} · Recommended ${recommendedLevel}`;
}

function actionDuration(step: number): number {
  if (step < 1 || step > 3 || localActionMainHandId === null) return PRIMARY_ACTION_DURATION_MS;
  return WEAPON_ATTACK_DEFINITIONS[localActionMainHandId].attacks[step - 1]?.durationMs ?? PRIMARY_ACTION_DURATION_MS;
}

function remoteActionDuration(mainHandId: MainHandId | null, step: number): number {
  if (!mainHandId || step < 1 || step > 3) return PRIMARY_ACTION_DURATION_MS;
  return WEAPON_ATTACK_DEFINITIONS[mainHandId].attacks[step - 1]?.durationMs ?? PRIMARY_ACTION_DURATION_MS;
}

function powerDuration(powerId: PowerId | null): number {
  if (!powerId) return 0;
  const definition = POWER_DEFINITIONS[powerId];
  return definition.windupMs + definition.activeMs + definition.recoveryMs;
}

function showCombatFeedback(text: string, style: "hit" | "hurt" | "dodge" | "miss" | "block" | "stagger" = "hit"): void {
  combatFeedback.textContent = text;
  combatFeedback.classList.remove("show", "hurt", "dodge", "miss", "block", "stagger");
  void combatFeedback.offsetWidth;
  if (style !== "hit") combatFeedback.classList.add(style);
  combatFeedback.classList.add("show");
}

let rangedReticleHitUntil = 0;
let rangedPopupSequence = 0;
const rangedPopups: { element: HTMLElement; position: pc.Vec3; startedAt: number; duration: number; damage: boolean; offset: number }[] = [];
function createRangedPopup(position: pc.Vec3, text: string, kind: "damage" | "melee" | "stagger" | "enemy" | "terrain" | "near-miss", defeated = false, color?: readonly number[]): void {
  const element = document.createElement("span");
  element.className = `ranged-popup ranged-popup-${kind}${defeated ? " defeated" : ""}`;
  element.textContent = text; element.setAttribute("aria-hidden", "true");
  if (color) element.style.color = `rgb(${color.map(channel => Math.round(channel * 255)).join(",")})`;
  document.body.append(element);
  const combatCue = kind === "damage" || kind === "melee" || kind === "stagger";
  rangedPopups.push({ element, position: position.clone(), startedAt: performance.now(), duration: combatCue ? 800 : kind === "near-miss" ? 160 : 240,
    damage: combatCue, offset: combatCue ? (++rangedPopupSequence % 3 - 1) * 14 : 0 });
  while (rangedPopups.length > 32) rangedPopups.shift()!.element.remove();
}
function updateRangedFeedback(now: number): void {
  const hit = now < rangedReticleHitUntil;
  if (combatReticle.dataset.hit !== String(hit)) combatReticle.dataset.hit = String(hit);
  if (!rangedPopups.length) return;
  const rect = canvas.getBoundingClientRect();
  for (let index = rangedPopups.length - 1; index >= 0; index--) {
    const popup = rangedPopups[index]!, fraction = (now - popup.startedAt) / popup.duration;
    if (fraction >= 1 || !worldReady) { popup.element.remove(); rangedPopups.splice(index, 1); continue; }
    const screen = camera.camera?.worldToScreen(popup.position);
    popup.element.hidden = !screen || screen.z <= 0 || screen.x < 0 || screen.y < 0 || screen.x > rect.width || screen.y > rect.height;
    if (popup.element.hidden || !screen) continue;
    popup.element.style.left = `${rect.left + screen.x + popup.offset}px`;
    popup.element.style.top = `${rect.top + screen.y - (popup.damage ? fraction * 38 : 0)}px`;
    popup.element.style.opacity = String(Math.min(1, (1 - fraction) * 2));
    popup.element.style.transform = `translate(-50%, -50%) scale(${popup.damage ? 1 + Math.max(0, .15 - fraction) : .65 + fraction * .7})`;
  }
}

interface PowerTelegraphVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  startedAt: number;
  windupMs: number;
}

interface PowerImpactVisual {
  root: pc.Entity;
  fractureRoot: pc.Entity;
  material: pc.StandardMaterial;
  startedAt: number;
  powerId: PowerId;
  waveSegments: PowerAimSegment[];
  fractureSegments: PowerAimSegment[];
}

interface PowerAimSegment {
  entity: pc.Entity;
  distance: number;
}

interface PowerAimVisual {
  root: pc.Entity;
  validMaterial: pc.StandardMaterial;
  blockedMaterial: pc.StandardMaterial;
  segments: PowerAimSegment[];
  kind: "line" | "ground";
}

interface PowerDebrisVisual {
  entity: pc.Entity;
  velocity: pc.Vec3;
  spin: pc.Vec3;
  startedAt: number;
  delayMs?: number;
}

interface MarkPayoffVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  startedAt: number;
  durationMs?: number;
}

interface BrambleSnareVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  expiresAt: number;
  triggeredAt: number | null;
}

interface WeaponProjectileVisual {
  projectileId: string;
  enemy?: boolean;
  sampled?: boolean;
  nearMissPlayed?: boolean;
  entity: pc.Entity;
  material: pc.StandardMaterial;
  start: pc.Vec3;
  end: pc.Vec3;
  startedAt: number;
  durationMs: number;
}

interface MobHazardVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  expiresAt: number;
}

interface DepthsHazardVisual {
  root: pc.Entity;
  material: pc.StandardMaterial;
  impactAt: number;
  expiresAt: number;
}

const powerTelegraphs = new Map<string, PowerTelegraphVisual>();
const powerImpactVisuals: PowerImpactVisual[] = [];
const powerDebrisVisuals: PowerDebrisVisual[] = [];
const markPayoffVisuals: MarkPayoffVisual[] = [];
const brambleSnareVisuals = new Map<string, BrambleSnareVisual>();
const weaponProjectileVisuals: WeaponProjectileVisual[] = [];
let nextNearMissAt = 0;
// Retain impact style after the short-lived mesh ends, until server confirmation arrives.
const projectileWeapons = new Map<string, MainHandId>();
const mobHazardVisuals = new Map<string, MobHazardVisual>();
const depthsHazardVisuals = new Map<string, DepthsHazardVisual>();
let powerAimVisual: PowerAimVisual | null = null;
let specialAimVisual: PowerAimVisual | null = null;

function powerMaterial(color: pc.Color, opacity: number): pc.StandardMaterial {
  const material = new pc.StandardMaterial();
  material.diffuse = color;
  material.emissive = color.clone().mulScalar(0.72);
  material.opacity = opacity;
  material.blendType = pc.BLEND_NORMAL;
  material.depthWrite = false;
  material.update();
  return material;
}

function createWeaponProjectile(message: WeaponAttackReleased): void {
  projectileWeapons.set(message.projectileId, message.mainHandId);
  while (projectileWeapons.size > 128) projectileWeapons.delete(projectileWeapons.keys().next().value!);
  const flight = projectilePresentation(message.releasedAt, serverClock.offset, performance.now(), message.travelMs);
  if (flight.expired) return;
  const style = rangedStyle(message.mainHandId);
  const entity = new pc.Entity(`${message.mainHandId}-projectile`);
  entity.addComponent("render", { type: style.shape });
  const material = powerMaterial(new pc.Color(style.color[0]!, style.color[1]!, style.color[2]!), 0.96);
  if (entity.render) entity.render.material = material;
  entity.setLocalScale(style.scale[0]!, style.scale[1]!, style.scale[2]!);
  const start = new pc.Vec3(message.x, message.y + 1.05, message.z);
  const end = new pc.Vec3(message.targetX, message.targetY + 0.72, message.targetZ);
  entity.setPosition(start);
  if (style.shape === "box") entity.lookAt(end);
  app.root.addChild(entity);
  weaponProjectileVisuals.push({
    projectileId: message.projectileId,
    entity,
    material,
    start,
    end,
    startedAt: flight.startedAt,
    durationMs: flight.durationMs,
  });
}

function createMobProjectile(message: MobProjectileReleased): void {
  const flight = projectilePresentation(message.releasedAt, serverClock.offset, performance.now(), message.travelMs);
  if (flight.expired) return;
  const rock = message.kind === "rock";
  const crystal = message.kind === "crystal";
  const entity = new pc.Entity(rock ? "rock-projectile" : crystal ? "crystal-projectile" : "acid-projectile");
  entity.addComponent("render", { type: rock || crystal ? "box" : "sphere" });
  const material = powerMaterial(rock ? new pc.Color(.72, .57, .38) : crystal ? new pc.Color(.75, .42, 1) : new pc.Color(0.54, 1, 0.08), 0.94);
  if (entity.render) entity.render.material = material;
  entity.setLocalScale(0.3, 0.3, 0.3);
  if (rock || crystal) entity.setEulerAngles(28, 35, 18);
  const start = new pc.Vec3(message.x, message.y + 1.05, message.z);
  const end = new pc.Vec3(message.targetX, message.targetY + 0.08, message.targetZ);
  entity.setPosition(start);
  app.root.addChild(entity);
  weaponProjectileVisuals.push({
    projectileId: message.projectileId,
    enemy: true,
    entity,
    material,
    start,
    end,
    startedAt: flight.startedAt,
    durationMs: flight.durationMs,
  });
}

function createMobHazard(message: MobHazardPlaced): void {
  mobHazardVisuals.get(message.hazardId)?.root.destroy();
  const root = new pc.Entity(`mob-hazard:${message.hazardId}`);
  const rootHazard = message.kind === "root";
  const material = powerMaterial(rootHazard ? new pc.Color(.52, .3, .08) : new pc.Color(0.4, 0.9, 0.06), rootHazard ? .74 : .58);
  const pieces = rootHazard ? 7 : 18;
  for (let index = 0; index < pieces; index += 1) {
    const angle = index / pieces * Math.PI * 2;
    const radius = message.radius * (0.38 + (index % 3) * 0.22);
    const blob = addBox(
      root,
      rootHazard ? "root-spike" : "acid-puddle",
      material,
      rootHazard ? [.13, .1 + index % 2 * .08, .58] : [0.32 + index % 2 * 0.16, 0.035, 0.3 + (index + 1) % 2 * 0.16],
      [Math.sin(angle) * radius, rootHazard ? .08 : .035, Math.cos(angle) * radius],
    );
    blob.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
  }
  root.setPosition(message.x, message.y + 0.015, message.z);
  app.root.addChild(root);
  mobHazardVisuals.set(message.hazardId, { root, material, expiresAt: message.expiresAt });
}

function createDepthsHazard(message: DepthsRouteHazard): void {
  depthsHazardVisuals.get(message.hazardId)?.root.destroy();
  const root = new pc.Entity(`depths-hazard:${message.hazardId}`);
  const rock = message.kind === "falling-rock";
  const material = powerMaterial(rock ? new pc.Color(1, .48, .12) : new pc.Color(.72, .32, 1), .7);
  for (let index = 0; index < 16; index++) {
    const angle = index / 16 * Math.PI * 2;
    const marker = addBox(root, "impact-warning", material, [.38, .035, .12],
      [Math.sin(angle) * message.radius, .045, Math.cos(angle) * message.radius]);
    marker.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
  }
  const center = addBox(root, rock ? "falling-rock-shadow" : "crystal-pulse-core", material,
    rock ? [.5, .04, .5] : [.36, .07, .36], [0, .055, 0]);
  center.setLocalEulerAngles(0, 45, 0);
  root.setPosition(message.x, message.y, message.z);
  app.root.addChild(root);
  depthsHazardVisuals.set(message.hazardId, { root, material, impactAt: message.impactAt, expiresAt: message.expiresAt });
}

function startPowerTelegraph(
  casterId: string,
  powerId: PowerId,
  x: number,
  y: number,
  z: number,
  yaw: number,
  windupMs: number,
  shape?: { range?: number; width?: number },
): void {
  powerTelegraphs.get(casterId)?.root.destroy();
  const root = new pc.Entity(`power-telegraph:${casterId}`);
  const definition = POWER_DEFINITIONS[powerId];
  const range = shape?.range ?? definition.range;
  const width = shape?.width ?? definition.width;
  const material = powerMaterial(
    powerId === "shockwave"
      ? new pc.Color(0.18, 0.72, 1)
      : powerId === "eruption"
        ? new pc.Color(1, 0.18, 0.04)
        : powerId === "lunge_strike"
          ? new pc.Color(0.2, 1, 0.62)
        : new pc.Color(1, 0.43, 0.06),
    0.28,
  );
  if (definition.core === "burst") {
    for (let index = 0; index < 20; index += 1) {
      const angle = index / 20 * Math.PI * 2;
      const segment = addBox(
        root,
        "shockwave-warning",
        material,
        [0.46, 0.025, 0.14],
        [Math.sin(angle) * range, 0.035, Math.cos(angle) * range],
      );
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
  } else if (definition.core === "ground") {
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const segment = addBox(
        root,
        "eruption-warning",
        material,
        [0.42, 0.03, 0.13],
        [Math.sin(angle) * width, 0.04, Math.cos(angle) * width],
      );
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
    addBox(root, "eruption-center", material, [0.34, 0.035, 0.34], [0, 0.045, 0]);
  } else {
    for (let distance = 0.8; distance <= range; distance += 0.8) {
      addBox(root, "seismic-warning", material, [width, 0.025, 0.66], [0, 0.035, distance]);
    }
  }
  root.setPosition(x, y + 0.08, z);
  root.setEulerAngles(0, yaw, 0);
  app.root.addChild(root);
  powerTelegraphs.set(casterId, { root, material, startedAt: performance.now(), windupMs });
}

function destroyPowerAimVisual(): void {
  powerAimVisual?.root.destroy();
  powerAimVisual = null;
}

function createPowerAimVisual(): void {
  destroyPowerAimVisual();
  const root = new pc.Entity("power-aim-preview");
  const validMaterial = powerMaterial(new pc.Color(0.2, 0.95, 0.52), 0.42);
  const blockedMaterial = powerMaterial(new pc.Color(1, 0.16, 0.08), 0.5);
  const segments: PowerAimSegment[] = [];
  const definition = POWER_DEFINITIONS[localEquippedPower];
  const shape = activePowerShape(localEquippedPower);
  const kind = definition.core === "ground" ? "ground" : "line";
  if (kind === "ground") {
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const entity = addBox(
        root,
        "eruption-aim",
        validMaterial,
        [0.42, 0.028, 0.13],
        [Math.sin(angle) * definition.width, 0.045, Math.cos(angle) * definition.width],
      );
      entity.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
      segments.push({ entity, distance: definition.width });
    }
    segments.push({ entity: addBox(root, "eruption-aim-center", validMaterial, [0.32, 0.03, 0.32], [0, 0.05, 0]), distance: 0 });
  } else {
    for (let distance = 0.8; distance <= shape.range; distance += 0.8) {
      const entity = addBox(root, "seismic-aim", validMaterial, [shape.width, 0.028, 0.66], [0, 0.045, distance]);
      segments.push({ entity, distance });
    }
  }
  app.root.addChild(root);
  powerAimVisual = { root, validMaterial, blockedMaterial, segments, kind };
}

function updatePowerAimVisual(): void {
  if (!powerAimActive || !powerAimVisual) return;
  const player = localPlayer.getPosition();
  if (powerAimVisual.kind === "ground") {
    powerAimTargetValid = Math.hypot(powerAimTarget.x - player.x, powerAimTarget.z - player.z) <= POWER_DEFINITIONS.eruption.range + 0.05
      && isPlayerSupported(readCollisionWorldBlock, powerAimTarget.x, powerAimTarget.y, powerAimTarget.z);
    powerAimVisual.root.setPosition(powerAimTarget.x, powerAimTarget.y + 0.08, powerAimTarget.z);
    for (const segment of powerAimVisual.segments) {
      if (segment.entity.render) segment.entity.render.material = powerAimTargetValid ? powerAimVisual.validMaterial : powerAimVisual.blockedMaterial;
    }
    return;
  }
  powerAimVisual.root.setPosition(player.x, player.y, player.z);
  powerAimVisual.root.setEulerAngles(0, powerAimYaw, 0);
  const radians = powerAimYaw * Math.PI / 180;
  let pathBlocked = false;
  for (const segment of powerAimVisual.segments) {
    const x = Math.floor(player.x + Math.sin(radians) * segment.distance);
    const z = Math.floor(player.z + Math.cos(radians) * segment.distance);
    const feetY = Math.floor(player.y + 0.1);
    pathBlocked ||= readCollisionWorldBlock(x, feetY, z) !== Block.Air
      || readCollisionWorldBlock(x, feetY + 1, z) !== Block.Air;
    if (segment.entity.render) {
      segment.entity.render.material = pathBlocked ? powerAimVisual.blockedMaterial : powerAimVisual.validMaterial;
    }
  }
}

function destroySpecialAimVisual(): void {
  specialAimVisual?.root.destroy();
  specialAimVisual = null;
}

function createSpecialAimVisual(): void {
  destroySpecialAimVisual();
  const root = new pc.Entity("special-aim-preview");
  const validMaterial = powerMaterial(new pc.Color(0.22, 0.95, 0.34), 0.48);
  const blockedMaterial = powerMaterial(new pc.Color(1, 0.16, 0.08), 0.52);
  const segments: PowerAimSegment[] = [];
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * Math.PI * 2;
    const entity = addBox(
      root,
      "bramble-aim",
      validMaterial,
      [0.32, 0.035, 0.11],
      [Math.sin(angle) * BRAMBLE_SNARE.radius, 0.05, Math.cos(angle) * BRAMBLE_SNARE.radius],
    );
    entity.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    segments.push({ entity, distance: BRAMBLE_SNARE.radius });
  }
  segments.push({ entity: addBox(root, "bramble-aim-center", validMaterial, [0.24, 0.04, 0.24], [0, 0.05, 0]), distance: 0 });
  app.root.addChild(root);
  specialAimVisual = { root, validMaterial, blockedMaterial, segments, kind: "ground" };
}

function updateSpecialAimVisual(): void {
  if (!specialAimActive || !specialAimVisual) return;
  const player = localPlayer.getPosition();
  specialAimTargetValid = Math.hypot(specialAimTarget.x - player.x, specialAimTarget.z - player.z) <= BRAMBLE_SNARE.range + 0.05
    && isPlayerSupported(readCollisionWorldBlock, specialAimTarget.x, specialAimTarget.y, specialAimTarget.z);
  specialAimVisual.root.setPosition(specialAimTarget.x, specialAimTarget.y + 0.08, specialAimTarget.z);
  for (const segment of specialAimVisual.segments) {
    if (segment.entity.render) segment.entity.render.material = specialAimTargetValid ? specialAimVisual.validMaterial : specialAimVisual.blockedMaterial;
  }
}

function createBrambleSnareVisual(message: BrambleSnarePlaced): void {
  brambleSnareVisuals.get(message.casterId)?.root.destroy();
  const root = new pc.Entity(`bramble-snare:${message.casterId}`);
  const material = powerMaterial(new pc.Color(0.18, 0.72, 0.22), 0.72);
  for (let index = 0; index < 20; index += 1) {
    const angle = index / 20 * Math.PI * 2;
    const radius = message.radius * (0.66 + (index % 2) * 0.28);
    const thorn = addBox(root, "bramble-thorn", material, [0.12, 0.18 + (index % 3) * 0.06, 0.36], [Math.sin(angle) * radius, 0.1, Math.cos(angle) * radius]);
    thorn.setLocalEulerAngles(index % 2 ? 24 : -24, angle * 180 / Math.PI, 0);
  }
  root.setPosition(message.x, message.y + 0.04, message.z);
  app.root.addChild(root);
  brambleSnareVisuals.set(message.casterId, { root, material, expiresAt: message.expiresAt, triggeredAt: null });
}

function triggerBrambleSnareVisual(message: BrambleSnareTriggered): void {
  const visual = brambleSnareVisuals.get(message.casterId);
  if (visual) {
    visual.triggeredAt = performance.now();
    visual.expiresAt = Date.now() + 700;
  }
  const mob = mobVisuals.get(message.mobId);
  if (!mob) return;
  const material = visual?.material ?? powerMaterial(new pc.Color(0.18, 0.82, 0.25), 0.8);
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const vine = new pc.Entity("bramble-root-vine");
    vine.addComponent("render", { type: "box" });
    if (vine.render) vine.render.material = material;
    vine.setLocalScale(0.1, 0.65 + (index % 3) * 0.18, 0.1);
    vine.setPosition(mob.state.x + Math.sin(angle) * 0.52, mob.state.y + 0.3, mob.state.z + Math.cos(angle) * 0.52);
    vine.setEulerAngles(index % 2 ? 20 : -20, angle * 180 / Math.PI, 0);
    app.root.addChild(vine);
    powerDebrisVisuals.push({ entity: vine, velocity: new pc.Vec3(0, 0.3, 0), spin: new pc.Vec3(0, 40, 0), startedAt: performance.now() });
  }
}

function createPowerImpact(message: PowerResolved): void {
  powerTelegraphs.get(message.casterId)?.root.destroy();
  powerTelegraphs.delete(message.casterId);
  const root = new pc.Entity(`power-impact:${message.casterId}`);
  const fractureRoot = new pc.Entity(`power-fractures:${message.casterId}`);
  const definition = POWER_DEFINITIONS[message.powerId];
  const impactRange = message.range ?? definition.range;
  const impactWidth = message.width ?? definition.width;
  const waveSegments: PowerAimSegment[] = [];
  const fractureSegments: PowerAimSegment[] = [];
  const material = powerMaterial(
    message.rootbound
      ? new pc.Color(0.28, 0.92, 0.25)
      : message.powerId === "shockwave"
      ? new pc.Color(0.2, 0.76, 1)
      : message.powerId === "eruption"
        ? new pc.Color(1, 0.22, 0.035)
        : message.powerId === "lunge_strike"
          ? new pc.Color(0.24, 1, 0.68)
        : message.seismicMastery === "tectonic_stand"
          ? new pc.Color(1, 0.38, 0.08)
          : new pc.Color(1, 0.68, 0.14),
    0.78,
  );
  if (definition.core === "burst") {
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const segment = addBox(root, "shockwave-ring", material, [0.55, 0.12, 0.18], [Math.sin(angle) * 1.15, 0.12, Math.cos(angle) * 1.15]);
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
  } else if (definition.core === "ground") {
    for (let index = 0; index < 28; index += 1) {
      const angle = index / 28 * Math.PI * 2;
      const radius = 0.65 + (index % 2) * 0.42;
      const pillar = addBox(
        root,
        "eruption-pillar",
        material,
        [0.24 + (index % 3) * 0.05, 0.8 + (index % 5) * 0.22, 0.24 + (index % 2) * 0.05],
        [Math.sin(angle) * radius, 0.2, Math.cos(angle) * radius],
      );
      pillar.setLocalEulerAngles((index % 3 - 1) * 8, angle * 180 / Math.PI, (index % 2 ? 1 : -1) * 6);
    }
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      const segment = addBox(root, "eruption-ring", material, [0.5, 0.1, 0.16], [Math.sin(angle) * definition.width, 0.1, Math.cos(angle) * definition.width]);
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    }
  } else if (definition.core === "mobility") {
    for (let index = -5; index <= 5; index += 1) {
      const angle = index / 5 * Math.PI * 0.34;
      const segment = addBox(
        root,
        "lunge-impact",
        material,
        [0.18, 0.18, 0.52],
        [Math.sin(angle) * 1.05, 0.22, Math.cos(angle) * 1.05],
      );
      segment.setLocalEulerAngles(0, angle * 180 / Math.PI, -index * 4);
    }
    addBox(root, "lunge-core", material, [definition.width, 0.16, 0.35], [0, 0.18, 0.42]);
  } else {
    for (let distance = 0.65; distance <= impactRange; distance += 0.65) {
      const wave = addBox(root, "seismic-wave", material, [impactWidth * 0.84, 0.12, 0.42], [0, 0.12, distance]);
      wave.enabled = false;
      waveSegments.push({ entity: wave, distance });
      for (const side of [-1, 1]) {
        const branch = addBox(
          root,
          "seismic-branch",
          material,
          [0.32 + (Math.floor(distance * 10) % 3) * 0.07, 0.06, 0.1],
          [side * (impactWidth * 0.45 + (Math.floor(distance * 10) % 2) * 0.16), 0.08, distance + side * 0.08],
        );
        branch.setLocalEulerAngles(0, side * (24 + distance * 3), 0);
        branch.enabled = false;
        waveSegments.push({ entity: branch, distance });
      }
      if (message.rootbound) {
        for (const side of [-1, 1]) {
          const rootSpike = addBox(root, "rootbound-surge", material, [0.1, 0.45 + (Math.floor(distance * 10) % 3) * 0.12, 0.1], [side * impactWidth * 0.34, 0.22, distance]);
          rootSpike.setLocalEulerAngles(side * 12, 0, side * 24);
          rootSpike.enabled = false;
          waveSegments.push({ entity: rootSpike, distance });
        }
      }
    }
    if ((message.aftershockHitCount ?? 0) > 0) {
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        const burst = addBox(root, "seismic-aftershock", material, [0.28, 0.22, 0.28], [Math.sin(angle) * 0.8, 0.22, impactRange + Math.cos(angle) * 0.8]);
        burst.setLocalEulerAngles(index * 11, angle * 180 / Math.PI, 45);
      }
    }
  }
  for (const fracture of message.fractures) {
    const fractureEntity = addBox(fractureRoot, "terrain-fracture", material, [0.72, 0.035, 0.16], [fracture.x + 0.5, fracture.y + 1.025, fracture.z + 0.5]);
    const fractureDistance = Math.hypot(fracture.x + 0.5 - message.x, fracture.z + 0.5 - message.z);
    if (message.powerId === "seismic_cleave") fractureEntity.enabled = false;
    fractureSegments.push({ entity: fractureEntity, distance: fractureDistance });
  }
  root.setPosition(message.x, message.y + 0.04, message.z);
  root.setEulerAngles(0, message.yaw, 0);
  app.root.addChild(root);
  app.root.addChild(fractureRoot);
  powerImpactVisuals.push({ root, fractureRoot, material, startedAt: performance.now(), powerId: message.powerId, waveSegments, fractureSegments });
  const radians = message.yaw * Math.PI / 180;
  for (let index = 0; index < 14; index += 1) {
    const debrisAngle = message.powerId === "shockwave" || message.powerId === "eruption" ? index / 14 * Math.PI * 2 : radians;
    const directionX = Math.sin(debrisAngle);
    const directionZ = Math.cos(debrisAngle);
    const distance = message.powerId === "eruption"
      ? 0.45 + (index % 7) * 0.26
      : 0.5 + (index % 7) * 0.66;
    const side = index % 2 === 0 ? -1 : 1;
    const debris = new pc.Entity(`${message.powerId}-debris`);
    debris.addComponent("render", { type: "box" });
    if (debris.render) debris.render.material = material;
    const size = 0.09 + (index % 3) * 0.035;
    debris.setLocalScale(size, size, size);
    debris.setPosition(
      message.x + directionX * distance + directionZ * side * 0.22,
      message.y + 0.12,
      message.z + directionZ * distance - directionX * side * 0.22,
    );
    const delayMs = message.powerId === "seismic_cleave" ? Math.max(0, distance / impactRange * 360 - 40) : 0;
    if (delayMs > 0) debris.enabled = false;
    app.root.addChild(debris);
    powerDebrisVisuals.push({
      entity: debris,
      velocity: new pc.Vec3(directionX * (0.5 + index % 3 * 0.18) + directionZ * side * 0.55, 2.1 + index % 4 * 0.28, directionZ * (0.5 + index % 3 * 0.18) - directionX * side * 0.55),
      spin: new pc.Vec3(170 + index * 13, 120 + index * 17, 90 + index * 19),
      startedAt: performance.now(),
      delayMs,
    });
  }
  const player = localPlayer.getPosition();
  const distanceToImpact = Math.hypot(player.x - message.x, player.z - message.z);
  const seismicBoost = message.powerId === "seismic_cleave" ? 0.09 : 0;
  cameraShakeStrength = Math.max(cameraShakeStrength, Math.max(0.08, 0.28 + seismicBoost - distanceToImpact * 0.025));
  cameraShakeUntil = performance.now() + (message.powerId === "seismic_cleave" ? 440 : 360);
  if (message.powerId === "seismic_cleave" && distanceToImpact <= 14) {
    combatAudio.play("seismicImpact", enemyCuePan(message.x, player.x, 14));
  }
}

function createHuntersMarkPayoff(mob: MobVisual): void {
  const root = new pc.Entity("hunters-mark-payoff");
  const material = powerMaterial(new pc.Color(0.72, 0.16, 1), 0.92);
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * Math.PI * 2;
    const radius = index % 2 === 0 ? 0.78 : 1.08;
    const shard = addBox(
      root,
      "mark-payoff-shard",
      material,
      [0.12, 0.5 + (index % 3) * 0.12, 0.12],
      [Math.sin(angle) * radius, 0.45 + (index % 4) * 0.16, Math.cos(angle) * radius],
    );
    shard.setLocalEulerAngles(index % 2 === 0 ? -24 : 24, angle * 180 / Math.PI, 45);
  }
  for (let index = 0; index < HUNTERS_MARK.maxStacks; index += 1) {
    const angle = index / HUNTERS_MARK.maxStacks * Math.PI * 2;
    addBox(root, "mark-payoff-core", material, [0.28, 0.28, 0.28], [Math.sin(angle) * 0.42, 1.18, Math.cos(angle) * 0.42]);
  }
  root.setPosition(mob.state.x, mob.state.y + 0.04, mob.state.z);
  app.root.addChild(root);
  markPayoffVisuals.push({ root, material, startedAt: performance.now() });
  cameraShakeStrength = Math.max(cameraShakeStrength, 0.26);
  cameraShakeUntil = performance.now() + 420;
}

function updateStrikeWarningMesh(mesh: pc.Mesh, archetype: string, yaw: number, pattern = "slam", chargeLength: number = CHAMPION_CHARGE.distance,
  shotOrigin: { x: number; y: number; z: number; name?: string; actionSequence?: number } = { x: 0, y: 0, z: 0 }): void {
  const rockVolley = pattern === "rocks" || pattern === "falling-rocks" || pattern === "warden-barrage";
  if (rockVolley || archetype === "cave_spitter" && pattern !== "pool") {
    const offsets = rockVolley ? BRUTE_VOLLEY.offsets : spitterShotOffsets(pattern);
    const lengths = offsets.map(offset => enemyShotGuideLength({ x: shotOrigin.x, y: shotOrigin.y + 1.05, z: shotOrigin.z }, yaw + offset, readCollisionWorldBlock, rockVolley ? BRUTE_VOLLEY.range : SPITTER_PATTERN.range));
    const doubleVolley = pattern === "double-fan" || pattern === "teleport-burst" || pattern === "warden-barrage";
    const secondYaw = matriarchSecondVolleyYaw(yaw, Math.max(0, (shotOrigin.actionSequence ?? 1) - 1));
    const secondLengths = doubleVolley ? offsets.map(offset => enemyShotGuideLength(
      { x: shotOrigin.x, y: shotOrigin.y + 1.05, z: shotOrigin.z }, secondYaw + offset, readCollisionWorldBlock, rockVolley ? BRUTE_VOLLEY.range : SPITTER_PATTERN.range)) : undefined;
    const lanes = rockVolley ? [...bruteRockLanes(yaw, lengths), ...(doubleVolley ? bruteRockLanes(secondYaw, secondLengths) : [])]
      : doubleVolley ? [...spitterWarningLanes(yaw, pattern, lengths), ...spitterWarningLanes(secondYaw, pattern, secondLengths)]
      : spitterWarningLanes(yaw, pattern, lengths);
    mesh.setPositions(lanes.flatMap(lane => lane.flatMap(point => [point.x, 0, point.z])));
    mesh.setNormals(lanes.flatMap(lane => lane.flatMap(() => [0, 1, 0])));
    mesh.setIndices(lanes.flatMap((_lane, index) => { const i = index * 4; return [i, i + 1, i + 2, i, i + 2, i + 3]; }));
    mesh.update(pc.PRIMITIVE_TRIANGLES); return;
  }
  const angle = yaw * Math.PI / 180;
  const outline = pattern === "pool" ? Array.from({ length: 48 }, (_, i) => ({ x: Math.cos(i * Math.PI / 24) * 1.6, z: Math.sin(i * Math.PI / 24) * 1.6 }))
    : pattern === "fan" ? [{ x: 0, z: 0 }, { x: Math.sin(angle + 22 * Math.PI / 180) * 7, z: Math.cos(angle + 22 * Math.PI / 180) * 7 }, { x: Math.sin(angle - 22 * Math.PI / 180) * 7, z: Math.cos(angle - 22 * Math.PI / 180) * 7 }]
    : pattern === "charge" ? championChargeOutline(yaw, chargeLength) : archetype === "stone_brute"
    ? pattern === "smash" ? bruteSmashOutline(yaw) : bruteSlamOutline()
    : mobStrikeGroundOutline(archetype, yaw);
  mesh.setPositions(outline.flatMap(point => [point.x, 0, point.z]));
  mesh.setNormals(outline.flatMap(() => [0, 1, 0]));
  const indices: number[] = [];
  for (let i = 1; i < outline.length - 1; i++) indices.push(0, i + 1, i);
  mesh.setIndices(indices); mesh.update(pc.PRIMITIVE_TRIANGLES);
}

function createHammerHitImpact(mob: MobVisual): void {
  const root = new pc.Entity("hammer-hit-chips");
  const material = powerMaterial(new pc.Color(0.72, 0.82, 0.86), 0.88);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const chip = addBox(root, "stone-chip", material, [0.13, 0.12, 0.18],
      [Math.sin(angle) * 0.38, 0.2 + i % 3 * 0.12, Math.cos(angle) * 0.38]);
    chip.setLocalEulerAngles(i * 19, i * 41, 25);
  }
  const position = mob.entity.getPosition();
  root.setPosition(position.x, position.y + 0.35, position.z);
  app.root.addChild(root);
  markPayoffVisuals.push({ root, material, startedAt: performance.now(), durationMs: 380 });
  combatAudio.play("hammerImpact", enemyCuePan(position.x, localPlayer.getPosition().x));
}

function createRootboundShockwave(mob: MobVisual): void {
  const root = new pc.Entity("rootbound-finisher-wave");
  const material = powerMaterial(new pc.Color(0.28, 0.92, 0.24), 0.92);
  for (let index = 0; index < 16; index += 1) {
    const angle = index / 16 * Math.PI * 2;
    const rootSpike = addBox(root, "root-shockwave-spike", material, [0.13, 0.12 + index % 3 * 0.06, 0.42],
      [Math.sin(angle) * ROOTBOUND_FINISHER.radius / 1.8, 0.08, Math.cos(angle) * ROOTBOUND_FINISHER.radius / 1.8]);
    rootSpike.setLocalEulerAngles(index % 2 ? -12 : 12, angle * 180 / Math.PI, 0);
  }
  const position = mob.entity.getPosition();
  root.setPosition(position.x, position.y + 0.04, position.z);
  app.root.addChild(root);
  markPayoffVisuals.push({ root, material, startedAt: performance.now(), durationMs: 560 });
  cameraShakeStrength = Math.max(cameraShakeStrength, 0.18);
  cameraShakeUntil = performance.now() + 260;
}

function createBruteSlamImpact(mob: MobVisual): void {
  const root = new pc.Entity("stone-brute-slam");
  const material = powerMaterial(new pc.Color(0.92, 0.34, 0.07), 0.9);
  const smashEdge = bruteSmashOutline(mob.state.yaw);
  for (let index = 0; index < 28; index += 1) {
    const angle = index / 28 * Math.PI * 2;
    const radius = index % 2 === 0 ? BRUTE_SLAM.radius * .7 : BRUTE_SLAM.radius;
    const edge = Math.floor(index / 7), t = (index % 7) / 7;
    const from = smashEdge[edge]!, to = smashEdge[(edge + 1) % 4]!;
    const position = mob.state.attackPattern === "smash"
      ? [from.x + (to.x - from.x) * t, .1, from.z + (to.z - from.z) * t]
      : [Math.sin(angle) * radius, .1, Math.cos(angle) * radius];
    const segment = addBox(
      root,
      "brute-slam-ring",
      material,
      [0.36 + index % 3 * 0.08, 0.1, 0.18],
      position as [number, number, number],
    );
    segment.setLocalEulerAngles(0, angle * 180 / Math.PI, index % 2 === 0 ? 8 : -8);
  }
  root.setPosition(mob.state.attackStrikeX, mob.state.attackStrikeY + 0.03, mob.state.attackStrikeZ);
  app.root.addChild(root);
  markPayoffVisuals.push({ root, material, startedAt: performance.now() });
  const playerPosition = localPlayer.getPosition();
  const distance = Math.hypot(playerPosition.x - mob.state.x, playerPosition.z - mob.state.z);
  if (distance <= 9) {
    cameraShakeStrength = Math.max(cameraShakeStrength, Math.max(0.12, 0.36 - distance * 0.025));
    cameraShakeUntil = performance.now() + 420;
    combatAudio.play("seismicImpact", enemyCuePan(mob.state.x, playerPosition.x, 9));
  }
}

function updatePlayerCount(): void {
  const count = room ? remotePlayers.size + 1 : 0;
  playerCount.textContent = `${count} player${count === 1 ? "" : "s"} online`;
}

function createRemotePlayer(sessionId: string, player: NetworkPlayer): RemotePlayerVisual {
  const entity = new pc.Entity(`remote-player:${sessionId}`);
  const appearance = resolveAppearance({ skin: player.appearanceSkin, hair: player.appearanceHair, coat: player.appearanceCoat,
    hairStyle: player.appearanceHairStyle, coatStyle: player.appearanceCoatStyle });
  const rig = createVoxelCharacter(entity, coloredMaterial(appearanceColor("coat", appearance.coat)), false, appearance);
  if (isMainHandId(player.mainHandId)) setRigMainHand(rig, player.mainHandId);
  setRigArmour(rig, player.armourId);
  entity.setPosition(player.x, player.y, player.z);
  app.root.addChild(entity);
  return {
    entity,
    rig,
    snapshots: [{ receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw }],
    actionStartedAt: null,
    actionStep: player.attackStep,
    actionMainHandId: isMainHandId(player.mainHandId) ? player.mainHandId : null,
    lastActionSequence: player.actionSequence,
    powerStartedAt: null,
    powerId: isPowerId(player.equippedPower) ? player.equippedPower : null,
    lastPowerSequence: player.powerSequence,
    defending: player.defending,
  };
}

function recordRemoteSnapshot(remote: RemotePlayerVisual, player: NetworkPlayer): void {
  const snapshot = { receivedAt: performance.now(), x: player.x, y: player.y, z: player.z, yaw: player.yaw };
  const latest = remote.snapshots[remote.snapshots.length - 1];
  if (latest && snapshot.receivedAt - latest.receivedAt < 1) remote.snapshots[remote.snapshots.length - 1] = snapshot;
  else remote.snapshots.push(snapshot);
}

function createMobVisual(mobId: string, mob: NetworkMob): MobVisual {
  const entity = new pc.Entity(`mob:${mobId}`);
  const bodyRoot = new pc.Entity("mob-body");
  entity.addChild(bodyRoot);
  const isBrute = mob.archetype === "stone_brute";
  const isSpitter = mob.archetype === "cave_spitter";
  const isAshglass = mobId.startsWith("ashglass-sentry-");
  const isBriar = mob.archetype === "briar_crawler";
  const tierColor = mob.difficultyTier >= 3
    ? new pc.Color(1, 0.2, 0.08)
    : mob.difficultyTier === 2
      ? new pc.Color(1, 0.62, 0.08)
      : new pc.Color(0.35, 0.9, 0.28);
  const bodyMaterial = coloredMaterial(
    isBrute ? new pc.Color(0.38, 0.43, 0.48) : isAshglass ? new pc.Color(0.31, 0.22, 0.2) : isSpitter ? new pc.Color(0.34, 0.29, 0.43) : isBriar ? new pc.Color(0.31, 0.19, 0.12) : new pc.Color(0.28, 0.42, 0.21),
  );
  bodyMaterial.shininess = 12;
  // Keep the emissive shader feature active while varying cue intensity.
  bodyMaterial.emissive.set(0.001, 0.001, 0.001);
  bodyMaterial.update();
  const healthBackMaterial = coloredMaterial(new pc.Color(0.16, 0.025, 0.02));
  const healthMaterial = coloredMaterial(isAshglass ? new pc.Color(1, 0.63, 0.19) : mob.difficultyTier > 1 ? tierColor : isBrute ? new pc.Color(0.94, 0.48, 0.12) : isSpitter ? new pc.Color(0.58, 0.92, 0.12) : tierColor);
  const warningMaterial = new pc.StandardMaterial();
  warningMaterial.diffuse = new pc.Color(0.9, 0.16, 0.06);
  warningMaterial.emissive = new pc.Color(0.7, 0.08, 0.02);
  warningMaterial.opacity = 0.32;
  warningMaterial.blendType = pc.BLEND_NORMAL;
  warningMaterial.depthWrite = false;
  warningMaterial.useLighting = false;
  warningMaterial.update();
  const markMaterial = new pc.StandardMaterial();
  markMaterial.diffuse = new pc.Color(0.48, 0.12, 0.78);
  markMaterial.emissive = new pc.Color(0.42, 0.08, 0.74);
  markMaterial.opacity = 0.48;
  markMaterial.blendType = pc.BLEND_NORMAL;
  markMaterial.depthWrite = false;
  markMaterial.update();
  const matriarch = mobId === "greenwood-venom-matriarch" || mobId === "crystal-matriarch";
  const rootGuardian = mobId === "forest-guardian";
  if (rootGuardian) { bodyMaterial.diffuse.set(.28, .24, .16); bodyMaterial.update(); bodyRoot.setLocalScale(1.16, 1.16, 1.16); }
  const art = createMobArt(bodyRoot, mob.archetype, bodyMaterial, matriarch, rootGuardian);
  if (isAshglass) {
    const glass = coloredMaterial(new pc.Color(0.95, 0.42, 0.11));
    glass.emissive.set(0.33, 0.08, 0.015); glass.update();
    addBox(bodyRoot, "ashglass-back", glass, [.58, .2, .62], [0, .83, -.25]);
    for (const side of [-1, 1]) {
      const spike = addBox(bodyRoot, `ashglass-spike-${side}`, glass, [.18, .48, .2], [side * .42, 1.08, -.32]);
      spike.setLocalEulerAngles(0, 0, side * -25);
    }
  }
  if ((mob.isChampion || mob.isMiniBoss) && !matriarch && !rootGuardian) {
    const crestMaterial = coloredMaterial(new pc.Color(.87, .58, .16));
    const crestY = isSpitter ? 1.18 : 2.02;
    addBox(bodyRoot, "champion-stone-crest", crestMaterial, [.75, .22, .28], [0, crestY, 0]);
    for (const x of [-.28, 0, .28]) addBox(bodyRoot, "champion-crest-point", crestMaterial, [.15, .23, .18], [x, crestY + .16, 0]);
  }
  const statusRoot = new pc.Entity("mob-status");
  entity.addChild(statusRoot);
  const healthWidth = isBrute ? 1.46 : isSpitter ? 1.12 : 0.96;
  const healthBarY = matriarch ? 2.5 : mob.isChampion || mob.isMiniBoss ? isSpitter ? 1.9 : isBrute ? 3.08 : 1.72 : isBrute ? 2.32 : isSpitter ? 1.43 : 1.34;
  addBox(statusRoot, "health-back", healthBackMaterial, [healthWidth + 0.06, 0.1, 0.08], [0, healthBarY, 0]);
  const healthFill = addBox(statusRoot, "health-fill", healthMaterial, [healthWidth, 0.065, 0.09], [0, healthBarY, 0.01]);
  const tierMaterial = coloredMaterial(tierColor);
  for (let index = 0; index < mob.difficultyTier; index += 1) {
    const pipX = (index - (mob.difficultyTier - 1) / 2) * 0.22;
    const pip = addBox(statusRoot, `danger-tier-${index + 1}`, tierMaterial, [0.12, 0.12, 0.12], [pipX, healthBarY + 0.2, 0]);
    pip.setLocalEulerAngles(0, 45, 45);
  }
  const warning = new pc.Entity("lunge-warning");
  const warningMesh = new pc.Mesh(app.graphicsDevice);
  if (warningMesh) {
    updateStrikeWarningMesh(warningMesh, mob.archetype, mob.yaw, mob.attackPattern, CHAMPION_CHARGE.distance, mob);
    warning.addComponent("render", { meshInstances: [new pc.MeshInstance(warningMesh, warningMaterial)], castShadows: false, receiveShadows: false });
  }
  warning.setLocalPosition(0, 0.035, 0);
  const warningScale = 1;
  warning.setLocalScale(1, 1, 1);
  warning.enabled = false;
  entity.addChild(warning);
  const combatCue = document.createElement("div");
  combatCue.className = "enemy-combat-cue";
  combatCue.hidden = true;
  const combatCueLabel = document.createElement("span");
  const combatCueTrack = document.createElement("span");
  combatCueTrack.className = "enemy-combat-cue-track";
  const combatCueFill = document.createElement("span");
  combatCueTrack.append(combatCueFill);
  combatCue.append(combatCueLabel, combatCueTrack);
  document.body.append(combatCue);
  const levelTag = document.createElement("div");
  levelTag.className = "enemy-level-tag";
  levelTag.hidden = true;
  document.body.append(levelTag);
  const respawnTag = document.createElement("div");
  respawnTag.className = "enemy-respawn-tag";
  respawnTag.hidden = true;
  document.body.append(respawnTag);
  const recovery = new pc.Entity("enemy-recovery-opening");
  const recoveryMaterial = coloredMaterial(new pc.Color(0.15, 0.9, 1));
  recoveryMaterial.useLighting = false;
  recoveryMaterial.update();
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const segment = addBox(recovery, "opening-ring", recoveryMaterial, [.22, .025, .075],
      [Math.sin(angle) * .72, .045, Math.cos(angle) * .72]);
    segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
  }
  recovery.enabled = false;
  entity.addChild(recovery);
  const respawnCue = new pc.Entity("enemy-materialization");
  const respawnCueMaterial = powerMaterial(new pc.Color(.34, 1, .52), .42);
  for (let index = 0; index < 12; index++) {
    const angle = index * Math.PI / 6;
    const segment = addBox(respawnCue, "materialization-ring", respawnCueMaterial, [.28, .035, .08],
      [Math.sin(angle) * .82, .04, Math.cos(angle) * .82]);
    segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
  }
  const respawnCore = new pc.Entity("materialization-core");
  respawnCore.addComponent("render", { type: "cylinder", material: respawnCueMaterial, castShadows: false, receiveShadows: false });
  respawnCore.setLocalPosition(0, .025, 0);
  respawnCore.setLocalScale(1.12, .018, 1.12);
  respawnCue.addChild(respawnCore);
  respawnCue.enabled = false;
  entity.addChild(respawnCue);
  const eliteAura = new pc.Entity("elite-aura");
  const eliteAuraMaterial = powerMaterial(mob.isMiniBoss ? new pc.Color(1, .63, .12) : new pc.Color(.88, .38, 1), .5);
  for (let index = 0; index < 10; index++) {
    const angle = index * Math.PI / 5;
    const shard = addBox(eliteAura, "elite-aura-shard", eliteAuraMaterial, [.12, .12 + index % 2 * .1, .28],
      [Math.sin(angle) * .78, .16 + index % 2 * .13, Math.cos(angle) * .78]);
    shard.setLocalEulerAngles(0, angle * 180 / Math.PI, index % 2 ? 28 : -28);
  }
  eliteAura.enabled = false;
  entity.addChild(eliteAura);
  const mark = new pc.Entity("hunters-mark");
  mark.addComponent("render", { type: "cylinder" });
  if (mark.render) mark.render.material = markMaterial;
  mark.setLocalPosition(0, 0.055, 0);
  mark.setLocalScale(1.55, 0.022, 1.55);
  mark.enabled = false;
  entity.addChild(mark);
  const markPips = [-0.24, 0, 0.24].map((x, index) => {
    const pip = addBox(statusRoot, `hunters-mark-stack-${index + 1}`, markMaterial, [0.14, 0.14, 0.14], [x, healthBarY + 0.21, 0]);
    pip.setLocalEulerAngles(0, 45, 45);
    pip.enabled = false;
    return pip;
  });
  entity.setPosition(mob.x, mob.y, mob.z);
  app.root.addChild(entity);
  return {
    entity,
    snapshots: [{ receivedAt: performance.now(), x: mob.x, y: mob.y, z: mob.z, yaw: mob.yaw }],
    bodyRoot,
    bodyMaterial,
    art,
    statusRoot,
    frameAlive: mob.alive,
    defeatAt: -Infinity,
    warning,
    warningMaterial,
    warningScale,
    warningMesh,
    warningYaw: mob.yaw,
    warningPattern: mob.attackPattern,
    warningChargeLength: CHAMPION_CHARGE.distance,
    warningSequence: mob.actionSequence,
    combatCue, combatCueLabel, combatCueFill, levelTag, respawnTag, recovery, respawnCue, respawnCueMaterial, eliteAura, eliteAuraMaterial,
    healthFill,
    healthWidth,
    healthBarY,
    isBrute,
    isSpitter,
    mark,
    markMaterial,
    markPips,
    marks: new Map(),
    state: mob,
    locomotionSpeed: 0,
    renderYaw: mob.yaw,
    turnLean: 0,
    lastHitSequence: mob.hitSequence,
    hitAt: 0,
    lastActionSequence: mob.actionSequence,
    actionAt: 0,
    lastImpactStartedAt: 0,
    lastStaggerSequence: mob.staggerSequence,
    staggerAt: 0,
    lastCombatState: mob.combatState,
    lastAlive: mob.alive,
  };
}

const lootMaterials: Record<ItemId, pc.StandardMaterial> = {
  leather_armour: coloredMaterial(new pc.Color(.44, .26, .12)),
  iron_armour: coloredMaterial(new pc.Color(.76, .8, .85)),
  rootguard_armour: coloredMaterial(new pc.Color(.2, .55, .24)),
  bastion_plate: coloredMaterial(new pc.Color(.56, .63, .73)),
  forged_sword: coloredMaterial(new pc.Color(.76, .8, .85)),
  forged_bow: coloredMaterial(new pc.Color(.65, .45, .25)),
  forged_focus: coloredMaterial(new pc.Color(.3, .65, .95)),
  healing_potion: coloredMaterial(new pc.Color(.85, .15, .3)),
  iron_ore: coloredMaterial(new pc.Color(0.57, 0.65, 0.68)),
  silver_ore: coloredMaterial(new pc.Color(0.7, 0.88, 0.98)),
  moonstone: coloredMaterial(new pc.Color(0.68, 0.32, 0.94)),
  ember_core: powerMaterial(new pc.Color(1, .18, .025), .9),
  timber: coloredMaterial(new pc.Color(0.48, 0.3, 0.14)),
  reinforced_pickaxe: coloredMaterial(new pc.Color(0.76, 0.8, 0.78)),
  miners_lantern: coloredMaterial(new pc.Color(1, 0.68, 0.2)),
  moss_fibre: coloredMaterial(new pc.Color(0.28, 0.68, 0.2)),
  crawler_fang: coloredMaterial(new pc.Color(0.92, 0.84, 0.62)),
  stone_core: coloredMaterial(new pc.Color(0.38, 0.52, 0.62)),
  acid_gland: coloredMaterial(new pc.Color(0.58, 0.9, 0.1)),
  fang_dagger: coloredMaterial(new pc.Color(0.92, 0.84, 0.62)),
  stone_core_hammer: coloredMaterial(new pc.Color(0.42, 0.52, 0.58)),
  rootbound_hammer: coloredMaterial(new pc.Color(0.22, 0.58, 0.25)),
  matriarch_edge: coloredMaterial(new pc.Color(.58, .28, .9)),
  acid_gland_focus: coloredMaterial(new pc.Color(0.62, 0.96, 0.12)),
  venom_focus: coloredMaterial(new pc.Color(.15, .95, .65)),
  echo_prism: coloredMaterial(new pc.Color(.55, .87, 1)),
};

function isItemId(value: string): value is ItemId {
  return value in ITEM_DEFINITIONS;
}

const rarityLootMaterials: Record<ItemRarity, pc.StandardMaterial> = {
  common: powerMaterial(new pc.Color(.72, .76, .72), .18),
  uncommon: powerMaterial(new pc.Color(.28, .88, .4), .32),
  rare: powerMaterial(new pc.Color(.25, .58, 1), .45),
  epic: powerMaterial(new pc.Color(.72, .3, 1), .6),
  legendary: powerMaterial(new pc.Color(1, .58, .12), .82),
};
const lootBagMaterials: Record<LootBagTier, pc.StandardMaterial> = {
  brown: powerMaterial(new pc.Color(.48, .27, .1), .24),
  blue: powerMaterial(new pc.Color(.16, .5, 1), .5),
  purple: powerMaterial(new pc.Color(.7, .22, 1), .68),
  white: powerMaterial(new pc.Color(1, 1, 1), .95),
};
const fullLootMarkerMaterial = powerMaterial(new pc.Color(1, .12, .06), .65);
function addDroppedEquipmentModel(root: pc.Entity, itemId: ItemId, material: pc.StandardMaterial): boolean {
  if (armourForItem(itemId)) {
    addBox(root, "dropped-armour-chest", material, [.64, .58, .3], [0, 0, 0]);
    addBox(root, "dropped-armour-waist", material, [.5, .18, .28], [0, -.37, 0]);
    addBox(root, "dropped-armour-left-shoulder", material, [.25, .2, .38], [-.43, .18, 0]);
    addBox(root, "dropped-armour-right-shoulder", material, [.25, .2, .38], [.43, .18, 0]);
    if (itemId === "rootguard_armour") {
      addBox(root, "rootguard-vine-a", weaponWoodMaterial, [.09, .78, .09], [-.22, 0, -.19]).setLocalEulerAngles(0, 0, 18);
      addBox(root, "rootguard-vine-b", weaponWoodMaterial, [.09, .68, .09], [.2, -.04, -.19]).setLocalEulerAngles(0, 0, -20);
    } else {
      addBox(root, "armour-buckle", brassMaterial, [.16, .15, .05], [0, -.12, -.18]);
    }
    return true;
  }
  const hand = equipmentForItem(itemId);
  if (!hand) return false;
  if (hand === "fang_dagger") {
    addBox(root, "dropped-dagger-grip", weaponWoodMaterial, [.12, .34, .12], [0, .28, 0]);
    addBox(root, "dropped-dagger-guard", brassMaterial, [.34, .1, .12], [0, .06, 0]);
    addBox(root, "dropped-dagger-fang", material, [.19, .62, .13], [0, -.3, 0]).setLocalEulerAngles(0, 0, 8);
    return true;
  }
  if (hand === "stone_core_hammer" || hand === "rootbound_hammer") {
    addBox(root, "dropped-hammer-handle", weaponWoodMaterial, [.13, .92, .13], [0, -.05, 0]);
    addBox(root, "dropped-hammer-head", material, [.82, .38, .44], [0, .48, 0]);
    addBox(root, "dropped-hammer-core", hand === "rootbound_hammer" ? coreGlowMaterial : brassMaterial, [.26, .25, .48], [0, .48, 0]);
    return true;
  }
  if (hand === "forged_sword" || hand === "matriarch_edge") {
    addBox(root, "dropped-sword-grip", weaponWoodMaterial, [.13, .42, .13], [0, .42, 0]);
    addBox(root, "dropped-sword-guard", brassMaterial, [.52, .11, .16], [0, .16, 0]);
    addBox(root, "dropped-sword-blade", material, [.2, .95, .12], [0, -.38, 0]);
    addBox(root, "dropped-sword-tip", material, [.14, .24, .1], [0, -.96, 0]).setLocalEulerAngles(0, 0, 45);
    return true;
  }
  if (hand === "forged_bow") {
    addBox(root, "dropped-bow-grip", weaponWoodMaterial, [.14, .34, .14], [0, 0, 0]);
    addBox(root, "dropped-bow-upper", material, [.12, .72, .12], [-.16, .48, 0]).setLocalEulerAngles(0, 0, -24);
    addBox(root, "dropped-bow-lower", material, [.12, .72, .12], [-.16, -.48, 0]).setLocalEulerAngles(0, 0, 24);
    addBox(root, "dropped-bow-string", eyeWhiteMaterial, [.035, 1.25, .035], [.15, 0, 0]);
    return true;
  }
  if (hand === "acid_gland_focus" || hand === "venom_focus" || hand === "echo_prism" || hand === "forged_focus") {
    addBox(root, "dropped-focus-handle", weaponWoodMaterial, [.12, .76, .12], [0, -.2, 0]);
    addBox(root, "dropped-focus-head", material, [.42, .42, .42], [0, .36, 0]).setLocalEulerAngles(20, 45, 15);
    addBox(root, "dropped-focus-prong-left", material, [.1, .34, .1], [-.2, .58, 0]).setLocalEulerAngles(0, 0, -25);
    addBox(root, "dropped-focus-prong-right", material, [.1, .34, .1], [.2, .58, 0]).setLocalEulerAngles(0, 0, 25);
    return true;
  }
  return false;
}

function createLootVisual(dropId: string, drop: NetworkLootDrop, settled = false): LootVisual {
  const root = new pc.Entity(`loot:${dropId}`);
  const itemId = isItemId(drop.itemId) ? drop.itemId : "moss_fibre";
  const bagItems = lootItems(drop);
  const groupedBag = isEnemyLootBag(drop);
  const bagTier = groupedBag ? lootBagTierForItems(bagItems) : null;
  const rarity = bagTier ? LOOT_BAG_TIER_RARITY[bagTier] : itemRarity(itemId);
  const presentationMaterial = bagTier ? lootBagMaterials[bagTier] : rarityLootMaterials[rarity];
  const material = lootMaterials[itemId];
  const sourceId = lootSourceMob(dropId);
  const rewardCache = dropId.startsWith("forest-cache:");
  const vaultCache = sourceId === "buried-chamber-brute" && itemId === "miners_lantern";
  const guardianDrop = rewardCache || vaultCache || sourceId === "forest-guardian" && isEquipmentItem(itemId);
  if (groupedBag) {
    addBox(root, `${bagTier}-personal-loot-bag`, presentationMaterial, [.72, .46, .58], [0, -.12, 0]);
    addBox(root, "loot-bag-fold", presentationMaterial, [.62, .18, .5], [0, .2, .01]).setLocalEulerAngles(0, 0, 4);
    addBox(root, "loot-bag-clasp", brassMaterial, [.18, .14, .06], [0, -.02, -.31]);
    addBox(root, "loot-bag-emblem", material, [.28, .22, .065], [0, -.02, -.35]);
  } else if (!rewardCache && !isEquipmentItem(itemId)) {
    addBox(root, `${rarity}-personal-loot-bag`, rarityLootMaterials[rarity], [.64, .2, .52], [0, -.4, 0]);
    addBox(root, "loot-bag-clasp", brassMaterial, [.15, .11, .05], [0, -.36, -.27]);
  }
  if (groupedBag) {
    // Enemy rewards are represented by one RotMG-style bag, regardless of how
    // many item stacks it contains.
  } else if (rewardCache) {
    addBox(root, "rootbound-cache-base", weaponWoodMaterial, [1.05, .55, .72], [0, 0, 0]);
    addBox(root, "rootbound-cache-lid", material, [1.08, .22, .76], [0, .38, 0]);
    addBox(root, "rootbound-cache-band", coreGlowMaterial, [.14, .78, .8], [0, .12, 0]);
    addBox(root, "rootbound-cache-lock", coreGlowMaterial, [.26, .26, .08], [0, .12, -.4]);
    for (const side of [-1, 1]) addBox(root, `rootbound-cache-root-${side}`, weaponWoodMaterial, [.14, .72, .14], [side * .5, .02, 0]).setLocalEulerAngles(0, 0, side * 25);
  } else if (isEquipmentItem(itemId)) {
    addBox(root, `${rarity}-personal-loot-bag`, rarityLootMaterials[rarity], [.68, .18, .54], [0, -.46, 0]);
    addBox(root, "loot-bag-clasp", brassMaterial, [.16, .12, .05], [0, -.42, -.29]);
    if (!addDroppedEquipmentModel(root, itemId, material)) {
      addBox(root, guardianDrop ? "rootbound-equipment-cache" : "loot-bag", weaponWoodMaterial, guardianDrop ? [.7, .5, .54] : [.55, .42, .44], [0, 0, 0]);
      addBox(root, "equipment-emblem", material, [.28, .2, .06], [0, .02, -.25]);
    }
    if (vaultCache) {
      addBox(root, "lantern-frame", lanternMetal, [.36, .5, .36], [0, .04, -.3]);
      addBox(root, "lantern-glow", lanternGlow, [.2, .28, .2], [0, .04, -.34]);
      addBox(root, "lantern-handle", lanternMetal, [.4, .07, .08], [0, .38, -.3]);
    }
  } else if (itemId === "miners_lantern") {
    addBox(root, "lantern-frame", lanternMetal, [.48, .6, .48], [0, 0, 0]);
    addBox(root, "lantern-glow", lanternGlow, [.29, .38, .29], [0, 0, 0]);
    addBox(root, "lantern-handle", lanternMetal, [.52, .08, .1], [0, .43, 0]);
  } else if (itemId === "healing_potion") {
    addBox(root, "potion-bottle", material, [.34, .46, .34], [0, -.04, 0]);
    addBox(root, "potion-neck", eyeWhiteMaterial, [.16, .2, .16], [0, .28, 0]);
    addBox(root, "potion-cork", weaponWoodMaterial, [.2, .12, .2], [0, .42, 0]);
  } else if (itemId === "iron_ore" || itemId === "silver_ore" || itemId === "moonstone" || itemId === "ember_core") {
    addBox(root, "mineral-core", material, [.46, .52, .42], [0, 0, 0]).setLocalEulerAngles(18, 42, 8);
    addBox(root, "mineral-shard-a", material, [.2, .36, .2], [.28, .08, 0]).setLocalEulerAngles(0, 0, 35);
    addBox(root, "mineral-shard-b", material, [.16, .28, .16], [-.25, -.04, .12]).setLocalEulerAngles(20, 0, -28);
  } else if (itemId === "crawler_fang") {
    addBox(root, "fang", material, [0.17, 0.48, 0.17], [0, 0, 0]).setLocalEulerAngles(0, 0, 32);
    addBox(root, "fang-tip", material, [0.12, 0.2, 0.12], [0.13, -0.2, 0]).setLocalEulerAngles(0, 0, 45);
  } else if (itemId === "stone_core") {
    addBox(root, "core", material, [0.38, 0.38, 0.38], [0, 0, 0]).setLocalEulerAngles(20, 45, 15);
    addBox(root, "core-shard", material, [0.16, 0.28, 0.16], [0.22, 0.08, 0]).setLocalEulerAngles(0, 0, 38);
  } else if (itemId === "acid_gland") {
    addBox(root, "gland", material, [0.38, 0.32, 0.38], [0, 0, 0]).setLocalEulerAngles(15, 45, 0);
    addBox(root, "gland-neck", material, [0.15, 0.24, 0.15], [0, 0.24, 0]);
  } else {
    addBox(root, "fibre-a", material, [0.12, 0.48, 0.12], [-0.08, 0, 0]).setLocalEulerAngles(28, 0, 18);
    addBox(root, "fibre-b", material, [0.12, 0.42, 0.12], [0.09, 0.02, 0]).setLocalEulerAngles(-22, 0, -18);
  }
  root.setPosition(drop.x, drop.y + 0.36, drop.z);
  const marker = new pc.Entity("personal-loot-marker");
  marker.addComponent("render", { type: "cylinder", material: presentationMaterial, castShadows: false, receiveShadows: false });
  marker.setLocalScale(.85, .012, .85); marker.enabled = false;
  root.addChild(marker);
  const equipmentDrop = groupedBag ? bagItems.some(entry => isEquipmentItem(entry.itemId)) : isEquipmentItem(itemId);
  const legendaryDrop = bagTier === "white" || rarity === "legendary";
  const source = sourceId ? mobVisuals.get(sourceId) : undefined;
  const miniBossDrop = source?.state.isMiniBoss === true;
  const beam = new pc.Entity(`loot-${rarity}-beam`);
  beam.addComponent("render", { type: "cylinder", material: presentationMaterial, castShadows: false, receiveShadows: false });
  const beamHeight = miniBossDrop ? 2.65 : equipmentDrop ? legendaryDrop ? 2.4 : 1.8 : legendaryDrop ? 1.7 : 1.35;
  beam.setLocalScale(miniBossDrop ? .072 : equipmentDrop ? legendaryDrop ? .065 : .05 : .04, beamHeight, miniBossDrop ? .072 : equipmentDrop ? legendaryDrop ? .065 : .05 : .04);
  beam.setLocalPosition(0, beamHeight * .52, 0); root.addChild(beam);
  if (miniBossDrop || ITEM_RARITIES[rarity].order >= ITEM_RARITIES.rare.order) {
    const halo = new pc.Entity(`loot-${rarity}-halo`);
    halo.addComponent("render", { type: "cylinder", material: presentationMaterial, castShadows: false, receiveShadows: false });
    halo.setLocalScale(miniBossDrop ? 1.38 : legendaryDrop ? 1.25 : .95, .018, miniBossDrop ? 1.38 : legendaryDrop ? 1.25 : .95);
    halo.setLocalPosition(0, -.42, 0); root.addChild(halo);
  }
  const glow = new pc.Entity(`loot-${rarity}-light`);
  const tint = miniBossDrop ? new pc.Color(1, .62, .12) : bagTier === "white" ? new pc.Color(1, 1, 1) : bagTier === "purple" ? new pc.Color(.7, .25, 1)
    : bagTier === "blue" ? new pc.Color(.2, .55, 1) : bagTier === "brown" ? new pc.Color(.55, .3, .12)
      : legendaryDrop ? new pc.Color(1, .52, .12) : rarity === "epic" ? new pc.Color(.7, .25, 1)
        : rarity === "rare" ? new pc.Color(.25, .55, 1) : rarity === "uncommon" ? new pc.Color(.28, .88, .4) : new pc.Color(.72, .76, .72);
  glow.addComponent("light", { type: "omni", color: tint, intensity: miniBossDrop ? 1.8 : legendaryDrop ? 1.6 : equipmentDrop ? .85 : .45,
    range: miniBossDrop ? 6 : legendaryDrop ? 5.5 : equipmentDrop ? 3.5 : 2.8, castShadows: false });
  glow.setLocalPosition(0, .45, 0); root.addChild(glow);
  const now = performance.now();
  const revealAt = settled ? now : source ? Math.max(now, Number.isFinite(source.defeatAt) ? source.defeatAt : now) + defeatDuration(source.art.rootGuardian ? "root_guardian" : source.state.archetype) : now + 180;
  const landedAt = settled ? now : revealAt + (source ? 520 : 260);
  const tossFrom = source
    ? new pc.Vec3(source.state.x, source.state.y + .72, source.state.z)
    : new pc.Vec3(drop.x, drop.y + 1.05, drop.z);
  app.root.addChild(root);
  return { root, marker, revealAt, landedAt, tossFrom, state: drop, phase: [...dropId].reduce((total, character) => total + character.charCodeAt(0), 0) % 17, audioPlayed: false };
}

function removeLootVisual(dropId: string, collectedHere: boolean): void {
  const visual = lootVisuals.get(dropId);
  if (visual && collectedHere) {
    lootPickupBurst(visual.state);
    combatAudio.play("lootPickup");
  }
  visual?.root.destroy();
  lootVisuals.delete(dropId);
  pendingFloorLoot.delete(dropId);
}

function updateRemainingLootBag(dropId: string, items: LootBagItem[]): void {
  const visual = lootVisuals.get(dropId);
  const representative = lootBagRepresentative(items);
  if (!visual || !representative) return;
  const next: NetworkLootDrop = {
    ...visual.state,
    itemId: representative.itemId,
    quantity: representative.quantity,
    contentsJson: encodeLootBagItems(items),
  };
  visual.root.destroy();
  lootVisuals.set(dropId, createLootVisual(dropId, next, true));
  pendingFloorLoot.delete(dropId);
}

function bindLootDrops(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const state = joinedRoom.state as any;
  const showDrop = (dropId: string, drop: NetworkLootDrop) => {
    if (!lootVisibleToPlayer(drop.ownerId, joinedRoom.sessionId)) return;
    lootVisuals.get(dropId)?.root.destroy();
    lootVisuals.set(dropId, createLootVisual(dropId, drop));
  };
  joinedRoom.onMessage("loot:spawned", (message: NetworkLootDrop & { dropId: string }) => {
    const { dropId, ...drop } = message;
    showDrop(dropId, drop);
  });
  if (!state.lootDrops) return;
  const drops = callbacks(joinedRoom.state).lootDrops;
  drops.onAdd((drop: NetworkLootDrop, dropId: string) => {
    showDrop(dropId, drop);
  }, true);
  drops.onRemove((_drop: NetworkLootDrop, dropId: string) => {
    const collectedHere = pendingFloorLoot.has(dropId) || inspectedDropId === dropId && lootPending;
    removeLootVisual(dropId, collectedHere);
    if (inspectedDropId === dropId && !lootPending) {
      lootMessage.textContent = "That bag was collected or expired.";
      lootEquip.disabled = lootKeep.disabled = true;
    }
  });
}

function refreshOwnedInventory(): void {
  for (const card of inventoryPanel.querySelectorAll<HTMLElement>("article[data-item]")) {
    const itemId = card.dataset.item as ItemId;
    card.hidden = !inventoryItemVisible(inventoryCounts.get(itemId));
    if ((equipmentForItem(itemId) || armourForItem(itemId)) && !card.querySelector(".item-rarity")) {
      const rarity = itemRarity(itemId);
      card.dataset.rarity = rarity;
      const badge = document.createElement("span"); badge.className = "item-rarity"; badge.dataset.rarity = rarity;
      badge.textContent = ITEM_RARITIES[rarity].label;
      card.querySelector("div")?.append(badge);
    }
  }
  for (const section of inventoryPanel.querySelectorAll<HTMLElement>("[data-inventory-category]")) {
    if (section.dataset.inventoryCategory === "collection") continue;
    let empty = section.querySelector<HTMLElement>(".inventory-empty");
    if (!empty) {
      empty = document.createElement("p"); empty.className = "inventory-empty";
      const category = section.dataset.inventoryCategory!;
      empty.textContent = `No ${category} in your pack yet.${category === "weapons" ? " Starter gear is shown in your character preview." : ""}`;
      section.append(empty);
    }
    empty.hidden = [...section.querySelectorAll<HTMLElement>("article[data-item]")].some(card => !card.hidden);
  }
  refreshEquipmentProgression();
}

function refreshEquipmentProgression(): void {
  const progress = collectionProgress(inventoryCounts);
  document.querySelector<HTMLElement>("#collection-progress")!.textContent = `${progress.found} / ${progress.total}`;
  for (const entry of EQUIPMENT_COLLECTION) {
    const card = equipmentCollectionGrid.querySelector<HTMLElement>(`[data-collection-item="${entry.itemId}"]`)!;
    const owned = (inventoryCounts.get(entry.itemId) ?? 0) > 0;
    const rank = blacksmithReforgeRanks[entry.itemId as BlacksmithReforgeItemId] ?? 0;
    card.classList.toggle("discovered", owned);
    card.dataset.rarity = owned ? itemRarity(entry.itemId) : "locked";
    card.querySelector<HTMLElement>(".collection-state")!.textContent = equipmentCollectionLabel(entry.itemId, owned, rank);
    card.querySelector<HTMLElement>(".collection-upgrade")!.textContent = owned ? equipmentProgressionText(entry.itemId, rank) : "Find this item to reveal its rarity and upgrade path.";
    const button = card.querySelector<HTMLButtonElement>("button")!;
    button.disabled = !owned || (!equipmentForItem(entry.itemId) && !armourForItem(entry.itemId));
    button.textContent = button.disabled && owned ? "AUTO-EQUIPPED" : "PREVIEW";
  }
}

function updateInventoryItem(itemId: ItemId, total: number): void {
  inventoryCounts.set(itemId, total);
  if (itemId === "miners_lantern") localPlayerRig.minersLantern.enabled = total > 0;
  refreshOwnedInventory();
  if (itemId === "iron_ore" || itemId === "silver_ore") {
    const iron = inventoryCounts.get("iron_ore") ?? 0;
    const silver = inventoryCounts.get("silver_ore") ?? 0;
    blacksmithOre.textContent = `${iron} / ${blacksmithIronCapacity}`;
    document.querySelector<HTMLElement>("#blacksmith-silver")!.textContent = `${silver} / ${blacksmithIronCapacity}`;
    document.querySelector<HTMLElement>("#blacksmith-sale-value")!.textContent = `${iron * IRON_ORE_GOLD_PRICE + silver * SILVER_ORE_GOLD_PRICE} gold`;
    blacksmithSell.disabled = iron + silver <= 0 || blacksmithPending || tavernCoinBalance >= 1_000_000;
  }
  const count = inventoryCountElements.get(itemId);
  if (count) count.textContent = String(total);
  const equipButton = inventoryPanel.querySelector<HTMLButtonElement>(`[data-item="${itemId}"] [data-equip-main-hand]`);
  if (equipButton) equipButton.disabled = total <= 0;
  const grandTotal = [...inventoryCounts.values()].reduce((sum, quantity) => sum + quantity, 0);
  inventoryTotal.textContent = grandTotal === 0 ? "EMPTY" : `${grandTotal} ITEM${grandTotal === 1 ? "" : "S"}`;
  inventoryBadge.textContent = grandTotal > 999 ? "999+" : String(grandTotal);
  inventoryToggle.setAttribute("aria-label", `Open inventory, ${grandTotal} item${grandTotal === 1 ? "" : "s"}`);
  refreshInventoryEquipped();
  const card = inventoryPanel.querySelector<HTMLElement>(`[data-item="${itemId}"]`);
  if (card) {
    card.classList.toggle("empty", total <= 0);
    card.classList.remove("loot-added");
    if (total > 0) {
      requestAnimationFrame(() => card.classList.add("loot-added"));
      window.setTimeout(() => card.classList.remove("loot-added"), 650);
    }
  }
}

function playMobCue(mob: MobVisual, cue: EnemyCue): void {
  const player = localPlayer.getPosition();
  if (!undergroundMobVisible(mob.state.x, mob.state.y, mob.state.z)
    || !enemyCueLineClear({ x: player.x, y: player.y + .8, z: player.z },
      { x: mob.state.x, y: mob.state.y + .8, z: mob.state.z }, readCollisionWorldBlock)) return;
  combatAudio.play(cue, enemyCuePan(mob.state.x, player.x));
}

function updateMobVisual(mob: MobVisual): void {
  const previousCueState: EnemyCueSnapshot = {
    alive: mob.lastAlive,
    health: mob.state.health,
    hitSequence: mob.lastHitSequence,
    staggerSequence: mob.lastStaggerSequence,
    combatState: mob.lastCombatState,
  };
  const currentCueState: EnemyCueSnapshot = {
    alive: mob.state.alive,
    health: mob.state.health,
    hitSequence: mob.state.hitSequence,
    staggerSequence: mob.state.staggerSequence,
    combatState: mob.state.combatState,
  };
  for (const cue of enemyCuesForTransition(previousCueState, currentCueState)) playMobCue(mob, cue);
  const healthFraction = Math.max(0, Math.min(1, mob.state.health / Math.max(1, mob.state.maxHealth)));
  mob.healthFill.setLocalScale(mob.healthWidth * healthFraction, 0.065, 0.09);
  mob.healthFill.setLocalPosition(-mob.healthWidth * 0.5 * (1 - healthFraction), mob.healthBarY, 0.01);
  if (mob.state.hitSequence > mob.lastHitSequence) {
    mob.lastHitSequence = mob.state.hitSequence;
    mob.hitAt = performance.now();
  }
  if (mob.state.actionSequence > mob.lastActionSequence) {
    mob.lastActionSequence = mob.state.actionSequence;
    mob.actionAt = performance.now();
  }
  if (mob.state.staggerSequence > mob.lastStaggerSequence) {
    mob.lastStaggerSequence = mob.state.staggerSequence;
    mob.staggerAt = performance.now();
  }
  mob.lastCombatState = mob.state.combatState;
  mob.lastAlive = mob.state.alive;
}

function bindMobs(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const mobs = callbacks(joinedRoom.state).mobs;
  mobs.onAdd((mob: NetworkMob, mobId: string) => {
    const visual = createMobVisual(mobId, mob);
    mobVisuals.set(mobId, visual);
    const mobCallbacks = callbacks(mob);
    let snapshotQueued = false;
    const queueSnapshot = (): void => {
      if (snapshotQueued) return;
      snapshotQueued = true;
      // Colyseus invokes each field listener separately. Capture the complete
      // patch after those listeners finish so X and Z move together.
      queueMicrotask(() => {
        snapshotQueued = false;
        if (mobVisuals.get(mobId) !== visual) return;
        const snapshot = { receivedAt: performance.now(), x: mob.x, y: mob.y, z: mob.z, yaw: mob.yaw };
        const latest = visual.snapshots[visual.snapshots.length - 1];
        if (latest && Math.hypot(snapshot.x - latest.x, snapshot.z - latest.z) > 2.5) {
          visual.snapshots.length = 0;
          visual.entity.setPosition(snapshot.x, snapshot.y, snapshot.z);
          visual.renderYaw = snapshot.yaw;
          visual.turnLean = 0;
          visual.entity.setEulerAngles(0, snapshot.yaw, 0);
        }
        visual.snapshots.push(snapshot);
        updateMobVisual(visual);
      });
    };
    for (const field of ["awarenessState", "alertUntil", "isChampion", "isMiniBoss", "isElite", "eliteKind", "attackPattern", "x", "y", "z", "health", "maxHealth", "alive", "hitSequence", "actionSequence", "combatState", "aimCommitted", "attackStartedAt", "attackReleaseAt", "attackContactAt", "attackContactEndAt", "attackRecoveryEndAt", "attackStrikeX", "attackStrikeY", "attackStrikeZ", "stateUntil", "targetId", "staggerSequence", "respawnAt", "materializeUntil", "yaw", "archetype", "armor", "name", "difficultyTier", "level", "attackDamage", "speedMultiplier", "rewardMultiplier"] as const) {
      mobCallbacks.listen(field, () => {
        // Capture movement and combat transitions once from the complete patch.
        // State changes also supply a stationary sample when pursuit stops.
        queueSnapshot();
      }, true);
    }
  }, true);
  mobs.onRemove((_mob: NetworkMob, mobId: string) => {
    mobVisuals.get(mobId)?.warningMesh?.destroy();
    mobVisuals.get(mobId)?.combatCue.remove();
    mobVisuals.get(mobId)?.levelTag.remove();
    mobVisuals.get(mobId)?.respawnTag.remove();
    mobVisuals.get(mobId)?.entity.destroy();
    mobVisuals.delete(mobId);
  });
}

function nearestLivingMob(position: pc.Vec3, maximumRange: number): { id: string; visual: MobVisual; distance: number } | null {
  let nearest: { id: string; visual: MobVisual; distance: number } | null = null;
  for (const [id, visual] of mobVisuals) {
    if (!visual.state.alive || !undergroundMobVisible(visual.state.x, visual.state.y, visual.state.z)) continue;
    const distance = Math.hypot(visual.state.x - position.x, visual.state.y - position.y, visual.state.z - position.z);
    if (distance > maximumRange || (nearest && distance >= nearest.distance)) continue;
    nearest = { id, visual, distance };
  }
  return nearest;
}

function bindPlayers(joinedRoom: Room): void {
  const callbacks = getStateCallbacks(joinedRoom as Room<any, any>) as any;
  const players = callbacks(joinedRoom.state).players;
  players.onAdd((player: NetworkPlayer, sessionId: string) => {
    const isLocal = sessionId === joinedRoom.sessionId;
    if (isLocal) {
      activateMovementPilot(joinedRoom);
      localSilverDepthsRunStage = player.silverDepthsRunStage;
      localSilverDepthsWing = player.silverDepthsWing === "iron" || player.silverDepthsWing === "silver" ? player.silverDepthsWing : null;
      updateTavernCoins(player.coins);
      renderCharacterProgression({ reason: "sync", level: player.level, experience: player.experience,
        experienceRequired: experienceToNextLevel(player.level), unspentStatPoints: player.unspentStatPoints,
        powerPoints: player.powerPoints, vitalityPoints: player.vitalityPoints,
        agilityPoints: player.agilityPoints, miningPoints: player.miningPoints }, player.maxHealth);
      if (isMainHandId(player.mainHandId)) updateMainHandLoadout(player.mainHandId);
      if (isSeismicMasteryId(player.seismicMastery)) updateSeismicMastery(player.seismicMastery);
      powerServerReady = isPowerId(player.equippedPower);
      if (isPowerId(player.equippedPower)) updatePowerLoadout(player.equippedPower);
      if (isPowerId(player.equippedPowerSecondary)) updateSecondaryPowerLoadout(player.equippedPowerSecondary);
      if (isSpecialId(player.equippedSpecial)) updateSpecialLoadout(player.equippedSpecial);
      if (isTraitId(player.equippedTrait)) updateTraitLoadout(player.equippedTrait);
    }
    let remote = isLocal ? undefined : remotePlayers.get(sessionId);
    if (!isLocal && !remote) {
      remote = createRemotePlayer(sessionId, player);
      remotePlayers.set(sessionId, remote);
      updatePlayerCount();
    }

    const updateAppearance = () => {
      const appearance = resolveAppearance({ skin: player.appearanceSkin, hair: player.appearanceHair, coat: player.appearanceCoat,
        hairStyle: player.appearanceHairStyle, coatStyle: player.appearanceCoatStyle });
      if (isLocal) updateLocalAppearance(appearance);
      else if (remote) setRigAppearance(remote.rig, appearance);
    };

    const updatePosition = () => {
      if (isLocal) {
        captureLocalSnapshot();
      }
      else if (remote) recordRemoteSnapshot(remote, player);
    };
    let snapshotQueued = false;
    const captureLocalSnapshot = () => {
      if (snapshotQueued) return;
      snapshotQueued = true;
      queueMicrotask(() => {
        snapshotQueued = false;
        if (room !== joinedRoom) return;
        if (pendingPortalDestination) {
          if (!portalArrivalSnapshot(pendingPortalDestination, player)) return;
          pendingPortalDestination = null;
        }
        authoritativeLocalPosition.set(player.x, player.y, player.z);
        if (player.lastProcessedInput > lastProcessedInputSequence) lastAcknowledgementAdvancedAt = performance.now();
        lastProcessedInputSequence = player.lastProcessedInput;
        lastAuthoritativeMovementAt = performance.now();
      });
    };
    const playerCallbacks = callbacks(player);
    const updateLocalProgression = () => {
      if (!isLocal) return;
      renderCharacterProgression({ reason: "sync", level: player.level, experience: player.experience,
        experienceRequired: experienceToNextLevel(player.level), unspentStatPoints: player.unspentStatPoints,
        powerPoints: player.powerPoints, vitalityPoints: player.vitalityPoints,
        agilityPoints: player.agilityPoints, miningPoints: player.miningPoints }, player.maxHealth);
    };
    if (isLocal) for (const field of ["level", "experience", "unspentStatPoints", "powerPoints", "vitalityPoints", "agilityPoints", "miningPoints"] as const)
      playerCallbacks.listen(field, updateLocalProgression);
    playerCallbacks.listen("silverDepthsRunStage", () => {
      if (isLocal) localSilverDepthsRunStage = player.silverDepthsRunStage;
    }, true);
    playerCallbacks.listen("silverDepthsWing", () => {
      if (isLocal) localSilverDepthsWing = player.silverDepthsWing === "iron" || player.silverDepthsWing === "silver" ? player.silverDepthsWing : null;
    }, true);
    if (isLocal) {
      playerCallbacks.inventory.onAdd((item: { quantity: number }, itemId: string) => {
        if (!isItemId(itemId)) return;
        updateInventoryItem(itemId, item.quantity);
        callbacks(item).listen("quantity", () => updateInventoryItem(itemId, item.quantity));
      }, true);
      playerCallbacks.inventory.onRemove((_item: { quantity: number }, itemId: string) => {
        if (isItemId(itemId)) updateInventoryItem(itemId, 0);
      });
    }
    playerCallbacks.listen("x", updatePosition, true);
    playerCallbacks.listen("y", updatePosition, true);
    playerCallbacks.listen("z", updatePosition, true);
    playerCallbacks.listen("yaw", () => {
      if (remote) recordRemoteSnapshot(remote, player);
    }, true);
    playerCallbacks.listen("lastProcessedInput", () => {
      if (isLocal) {
        captureLocalSnapshot();
      }
    }, true);
    playerCallbacks.listen("actionSequence", () => {
      if (!remote || player.actionSequence <= remote.lastActionSequence) return;
      remote.lastActionSequence = player.actionSequence;
      remote.actionStep = player.attackStep;
      remote.actionMainHandId = player.attackStep > 0 && isMainHandId(player.mainHandId) ? player.mainHandId : null;
      remote.actionStartedAt = performance.now();
    }, true);
    playerCallbacks.listen("powerSequence", () => {
      if (isLocal) {
        if (player.powerSequence <= localLastPowerSequence) return;
        localLastPowerSequence = player.powerSequence;
        if (!localActivePower && isPowerId(player.activePower)) localActivePower = player.activePower;
        localPowerStartedAt ??= performance.now();
        return;
      }
      if (!remote || player.powerSequence <= remote.lastPowerSequence) return;
      remote.lastPowerSequence = player.powerSequence;
      remote.powerId = isPowerId(player.activePower) ? player.activePower : null;
      remote.powerStartedAt = performance.now();
    }, true);
    playerCallbacks.listen("defending", () => {
      if (isLocal) setDefensePresentation(player.defending);
      else if (remote) remote.defending = player.defending;
    }, true);
    playerCallbacks.listen("momentumStacks", () => {
      if (isLocal) updateMomentum(player.momentumStacks);
    }, true);
    playerCallbacks.listen("equippedTrait", () => {
      if (!isLocal || !isTraitId(player.equippedTrait)) return;
      updateTraitLoadout(player.equippedTrait);
      updateMomentum(player.momentumStacks);
      status.textContent = `${TRAIT_DEFINITIONS[player.equippedTrait].name} Trait equipped.`;
    }, true);
    playerCallbacks.listen("powerCooldownUntil", () => {
      if (isLocal) localPowerCooldownUntil = player.powerCooldownUntil;
    }, true);
    playerCallbacks.listen("specialCooldownUntil", () => {
      if (isLocal) localSpecialCooldownUntil = player.specialCooldownUntil;
    }, true);
    playerCallbacks.listen("equippedPower", () => {
      if (!isLocal) return;
      powerServerReady = isPowerId(player.equippedPower);
      if (isPowerId(player.equippedPower)) {
        updatePowerLoadout(player.equippedPower);
        status.textContent = `${POWER_DEFINITIONS[player.equippedPower].name} equipped.`;
      }
    }, true);
    playerCallbacks.listen("equippedPowerSecondary", () => {
      if (!isLocal || !isPowerId(player.equippedPowerSecondary)) return;
      updateSecondaryPowerLoadout(player.equippedPowerSecondary);
      status.textContent = `${POWER_DEFINITIONS[player.equippedPowerSecondary].name} equipped to the secondary Power slot.`;
    }, true);
    playerCallbacks.listen("seismicMastery", () => {
      if (!isLocal || !isSeismicMasteryId(player.seismicMastery)) return;
      updateSeismicMastery(player.seismicMastery);
      status.textContent = `${SEISMIC_CLEAVE_UPGRADES.masteries[player.seismicMastery].name} equipped for Seismic Cleave.`;
    }, true);
    playerCallbacks.listen("equippedSpecial", () => {
      if (!isLocal || !isSpecialId(player.equippedSpecial)) return;
      updateSpecialLoadout(player.equippedSpecial);
      localSpecialCooldownUntil = player.specialCooldownUntil;
      status.textContent = `${SPECIAL_DEFINITIONS[player.equippedSpecial].name} equipped.`;
    }, true);
    playerCallbacks.listen("mainHandId", () => {
      if (isLocal && isMainHandId(player.mainHandId)) {
        updateMainHandLoadout(player.mainHandId);
        const mainHand = MAIN_HAND_DEFINITIONS[player.mainHandId];
        status.textContent = `${mainHand.name} equipped · Attack: ${mainHand.attackName}.`;
      } else if (remote && isMainHandId(player.mainHandId)) {
        setRigMainHand(remote.rig, player.mainHandId);
      }
    }, true);
    playerCallbacks.listen("armourId", () => {
      if (isLocal) {
        localArmourId = Object.hasOwn(ARMOUR_DEFINITIONS, player.armourId) ? player.armourId as ArmourId : "none";
        setRigArmour(localPlayerRig, localArmourId); refreshInventoryEquipped();
      } else if (remote) setRigArmour(remote.rig, player.armourId);
    }, true);
    for (const field of ["appearanceSkin", "appearanceHair", "appearanceCoat", "appearanceHairStyle", "appearanceCoatStyle"] as const) {
      playerCallbacks.listen(field, updateAppearance, true);
    }
    playerCallbacks.listen("blacksmithUpgrades", () => {
      if (!isLocal) return;
      localDepthsRewardFlags = player.blacksmithUpgrades;
      localIronSwordOwned = (player.blacksmithUpgrades & 2) !== 0;
      refreshPowerCompatibility();
    }, true);
    playerCallbacks.listen("isAdmin", () => {
      if (!isLocal) return;
      localIsAdmin = player.isAdmin;
      if (localIsAdmin) status.textContent = "ADMIN ACCESS ACTIVE · progression gates are bypassed for testing.";
    }, true);
    playerCallbacks.listen("health", () => {
      if (isLocal) {
        updatePlayerHealth(player.health, player.maxHealth);
        if (player.health > 0) awaitingReturnState = false;
        if (player.health <= 0 && defeatScreen.hidden && !awaitingReturnState) showDefeat("An enemy");
      }
    }, true);
    playerCallbacks.listen("maxHealth", () => {
      if (isLocal) { updatePlayerHealth(player.health, player.maxHealth); updateLocalProgression(); }
    }, true);
    playerCallbacks.listen("potionCooldownUntil", () => {
      if (isLocal) potionCooldownUntil = player.potionCooldownUntil;
    }, true);
    playerCallbacks.listen("stamina", () => {
      if (isLocal) {
        updatePlayerStamina(player.stamina, player.maxStamina);
        syncPredictedDodgeStamina(player.stamina, player.maxStamina);
      }
    }, true);
    playerCallbacks.listen("maxStamina", () => {
      if (isLocal) {
        updatePlayerStamina(player.stamina, player.maxStamina);
        syncPredictedDodgeStamina(player.stamina, player.maxStamina);
      }
    }, true);
    playerCallbacks.listen("coins", () => {
      if (isLocal) updateTavernCoins(player.coins);
    }, true);
    playerCallbacks.listen("dangerTier", () => {
      if (isLocal) updateDangerZone(player.dangerTier);
    }, true);
  }, true);
  players.onRemove((_player: NetworkPlayer, sessionId: string) => {
    const remote = remotePlayers.get(sessionId);
    if (!remote) return;
    if (playerInteractionUI.targetId() === sessionId) playerInteractionUI.close();
    remote.entity.destroy();
    remotePlayers.delete(sessionId);
    updatePlayerCount();
  });
}

const targetMarker = new pc.Entity("mining-target");
targetMarker.addComponent("render", { type: "box" });
const targetMaterial = new pc.StandardMaterial();
targetMaterial.diffuse = new pc.Color(1, 0.78, 0.12);
targetMaterial.emissive = new pc.Color(0.45, 0.24, 0.02);
targetMaterial.opacity = 0.32;
targetMaterial.blendType = pc.BLEND_NORMAL;
targetMaterial.depthWrite = false;
targetMaterial.update();
if (targetMarker.render) targetMarker.render.material = targetMaterial;
targetMarker.setLocalScale(1.04, 1.04, 1.04);
targetMarker.enabled = false;
app.root.addChild(targetMarker);

const pointer = { x: canvas.width / 2, y: canvas.height / 2 };
const rangedPointer = { active: false, x: 0, y: 0 };
let rangedFirePointer: number | null = null;
function rangedFireAllowed(): boolean {
  const combatMenuPanels = [inventoryPanel, lootPanel, defeatScreen, quizPanel, blacksmithPanel, tavernDialogue];
  return Boolean(room && worldReady && interactionMode === "combat" && rangedPointer.active && !document.hidden
    && WEAPON_ATTACK_DEFINITIONS[localMainHandId].projectileTravelMs > 0
    && combatMenuPanels.every(panel => panel.hidden === true) && !tradeUI.isOpen() && !playerInteractionUI.isOpen()
    && !(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)
    && !powerAimActive && !specialAimActive && localPowerStartedAt === null && !localDefending);
}
function mouseRangedYaw(fallback: number): number {
  if (!rangedPointer.active || !camera.camera) return fallback;
  const rect = canvas.getBoundingClientRect();
  const x = rangedPointer.x - rect.left, y = rangedPointer.y - rect.top;
  return rangedAimYaw(camera.camera.screenToWorld(x, y, camera.camera.nearClip), camera.camera.screenToWorld(x, y, camera.camera.farClip), localPlayer.getPosition(), fallback);
}
function updateRangedReticle(): void {
  const ranged = WEAPON_ATTACK_DEFINITIONS[localMainHandId].projectileTravelMs > 0;
  const active = rangedPointer.active && ranged && interactionMode === "combat" && worldReady && defeatScreen.hidden === true && inventoryPanel.hidden === true;
  combatReticle.hidden = !active;
  canvas.classList.toggle("ranged-aim", active);
  if (active) { combatReticle.style.left = `${rangedPointer.x}px`; combatReticle.style.top = `${rangedPointer.y}px`; }
}
let currentTarget: VoxelRaycastHit | null = null;
let targetStateKey = "";
let interactionMode: InteractionMode = "build";
const miningHud = document.querySelector<HTMLElement>("#mining-progress")!;
const miningFill = document.querySelector<HTMLElement>("#mining-progress-fill")!;
const miningCaption = document.querySelector<HTMLElement>("#mining-progress-label")!;
const resourceToasts = document.querySelector<HTMLElement>("#resource-toasts")!;
const caveEntranceSign = document.querySelector<HTMLElement>("#cave-entrance")!;
let miningSwing: { cell: MiningCell; startedAt: number; requestId: string; stage: number; origin: pc.Vec3 } | null = null;
let pendingMine: { requestId: string; startedAt: number } | null = null;
const miningChips: { entity: pc.Entity; origin: pc.Vec3; velocity: pc.Vec3; startedAt: number }[] = [];
const chipStoneMaterial = coloredMaterial(new pc.Color(0.45, 0.53, 0.56));
const chipIronMaterial = coloredMaterial(new pc.Color(0.94, 0.56, 0.22));
const chipSilverMaterial = coloredMaterial(new pc.Color(0.68, 0.9, 1));

// One small draw call, updated only when a crack stage changes; never touches chunk meshes.
const miningCracks = new pc.Entity("progressive-mining-cracks");
const crackMaterial = coloredMaterial(new pc.Color(0.12, 0.06, 0.025));
crackMaterial.useLighting = false;
crackMaterial.update();
const crackMesh = new pc.Mesh(app.graphicsDevice);
miningCracks.enabled = false;
app.root.addChild(miningCracks);
let crackKey = "";

function updateMiningCracks(cell: MiningCell, stage: number): void {
  const key = `${cell.x},${cell.y},${cell.z}:${cell.block}:${stage}`;
  miningCracks.enabled = stage > 0;
  if (key === crackKey || stage === 0) return;
  crackKey = key;
  miningCracks.setPosition(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
  const segments = [[-0.3, -0.3, 0.05, 0.1], [0.05, 0.1, 0.25, 0.36], [0.02, 0.06, -0.25, 0.22], [0.05, 0.1, 0.34, -0.16], [-0.19, -0.17, -0.36, -0.05], [0.25, 0.36, 0.37, 0.27]];
  const positions: number[] = [], indices: number[] = [];
  for (let face = 0; face < 6; face++) for (const [ax, ay, bx, by] of segments.slice(0, stage * 2) as [number, number, number, number][]) {
    const length = Math.hypot(bx - ax, by - ay);
    const ox = -(by - ay) / length * 0.014, oy = (bx - ax) / length * 0.014;
    const base = positions.length / 3;
    for (const [u, v] of [[ax + ox, ay + oy], [ax - ox, ay - oy], [bx - ox, by - oy], [bx + ox, by + oy]] as [number, number][]) {
      if (face < 2) positions.push(face === 0 ? -0.506 : 0.506, u, v);
      else if (face < 4) positions.push(u, face === 2 ? -0.506 : 0.506, v);
      else positions.push(u, v, face === 4 ? -0.506 : 0.506);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  crackMesh.setPositions(positions);
  crackMesh.setIndices(indices);
  crackMesh.update(pc.PRIMITIVE_TRIANGLES);
  crackMaterial.diffuse = cell.block === Block.SilverOre ? new pc.Color(0.06, 0.16, 0.22) : cell.block === Block.IronOre ? new pc.Color(0.24, 0.1, 0.025) : new pc.Color(0.04, 0.05, 0.055);
  crackMaterial.cull = pc.CULLFACE_NONE;
  crackMaterial.update();
  if (!miningCracks.render) miningCracks.addComponent("render", { meshInstances: [new pc.MeshInstance(crackMesh, crackMaterial)], castShadows: false, receiveShadows: false });
}

function cancelMining(reason?: string): void {
  const active = Boolean(pendingMine || miningSwing);
  if (pendingMine) room?.send("mine:cancel", { requestId: pendingMine.requestId });
  miningSwing = null;
  pendingMine = null;
  miningCracks.enabled = false;
  if (active && reason) {
    status.textContent = miningMessage(reason);
    logMovementEvent(`MINE CANCEL ${reason}`);
  }
}

function miningMovementRequested(): boolean {
  return ["KeyW", "KeyA", "KeyS", "KeyD"].some(code => keys.has(code)) || Math.hypot(touchStrafe, touchForward) > 0.05;
}

function miningBurst(cell: MiningCell, count: number): void {
  for (let i = 0; i < count; i++) {
    if (miningChips.length >= 24) miningChips.shift()!.entity.destroy();
    const angle = i * 2.4;
    const material = cell.block === Block.IronOre ? chipIronMaterial : cell.block === Block.SilverOre ? chipSilverMaterial : chipStoneMaterial;
    const origin = new pc.Vec3(cell.x + 0.5, cell.y + 0.85, cell.z + 0.5);
    const entity = addBox(app.root, "mining-chip", material, [0.08, 0.08, 0.08], [origin.x, origin.y, origin.z]);
    if (entity.render) entity.render.castShadows = false;
    miningChips.push({ entity, origin, velocity: new pc.Vec3(Math.sin(angle) * 1.6, 1.6 + i % 3 * 0.3, Math.cos(angle) * 1.6), startedAt: performance.now() });
  }
}

function lootPickupBurst(drop: NetworkLootDrop): void {
  const itemId = isItemId(drop.itemId) ? drop.itemId : "moss_fibre";
  const bagItems = lootItems(drop);
  const bagTier = isEnemyLootBag(drop) ? lootBagTierForItems(bagItems) : null;
  const origin = new pc.Vec3(drop.x, drop.y + .42, drop.z);
  const quantity = bagItems.reduce((total, entry) => total + entry.quantity, 0);
  const count = Math.min(10, 5 + Math.ceil(Math.log2(Math.max(1, quantity))));
  for (let index = 0; index < count; index++) {
    if (miningChips.length >= 24) miningChips.shift()!.entity.destroy();
    const angle = index / count * Math.PI * 2;
    const entity = addBox(app.root, "loot-pickup-spark", bagTier ? lootBagMaterials[bagTier] : rarityLootMaterials[itemRarity(itemId)], [.07, .07, .07], [origin.x, origin.y, origin.z]);
    if (entity.render) entity.render.castShadows = false;
    miningChips.push({
      entity,
      origin,
      velocity: new pc.Vec3(Math.sin(angle) * 1.25, 1.45 + index % 3 * .22, Math.cos(angle) * 1.25),
      startedAt: performance.now(),
    });
  }
}

function queueLootToast(toast: HTMLElement, lifetimeMs: number): void {
  resourceToasts.prepend(toast);
  while (resourceToasts.children.length > LOOT_FEED_MAX_ITEMS) resourceToasts.lastElementChild!.remove();
  setTimeout(() => toast.remove(), lifetimeMs);
}

function showResourcePickup(name: string, quantity: number, itemId?: string): void {
  const toast = document.createElement("div");
  toast.className = "resource-toast";
  if (itemId) toast.dataset.item = itemId;
  toast.textContent = `+${quantity} ${name}`;
  queueLootToast(toast, LOOT_FEED_MATERIAL_MS);
}

function showEquipmentPickup(itemId: ItemId, quantity: number, total: number): void {
  const card = equipmentPickupCard(itemId, quantity);
  if (!card) return;
  const toast = document.createElement("div"); toast.className = "resource-toast equipment-pickup";
  toast.dataset.category = card.category.toLowerCase();
  const rarity = itemRarity(itemId); toast.dataset.rarity = rarity;
  const title = document.createElement("small"); title.textContent = `${total > quantity ? "DUPLICATE" : "NEW"} · ${ITEM_RARITIES[rarity].label.toUpperCase()} ${card.category.toUpperCase()}`;
  const name = document.createElement("strong"); name.textContent = `${card.name}${card.quantity}`;
  const hint = document.createElement("span"); hint.textContent = card.hint;
  toast.append(title, name, hint);
  queueLootToast(toast, LOOT_FEED_EQUIPMENT_MS);
}

function updateMining(now: number): void {
  for (let i = miningChips.length - 1; i >= 0; i--) {
    const chip = miningChips[i]!;
    const t = (now - chip.startedAt) / 1000;
    if (t >= 0.5) { chip.entity.destroy(); miningChips.splice(i, 1); continue; }
    chip.entity.setPosition(chip.origin.x + chip.velocity.x * t, chip.origin.y + chip.velocity.y * t - 5 * t * t, chip.origin.z + chip.velocity.z * t);
    chip.entity.setLocalScale(0.08 * (1 - t), 0.08 * (1 - t), 0.08 * (1 - t));
  }
  if (pendingMine && now - pendingMine.startedAt > 5000) cancelMining("timeout");
  if (miningSwing) {
    const { cell, startedAt } = miningSwing;
    const player = localPlayer.getPosition();
    const availability = miningAvailability(player, cell);
    if (miningMovementRequested() || Math.hypot(player.x - miningSwing.origin.x, player.z - miningSwing.origin.z) > 0.12 || Math.abs(player.y - miningSwing.origin.y) > 0.2) {
      cancelMining("moving");
    } else if (availability !== "ready") {
      cancelMining(availability);
    } else if (readWorldBlock(cell.x, cell.y, cell.z) !== cell.block) {
      cancelMining("missing");
    } else if (!miningLineClear(player, cell, readCollisionWorldBlock)) {
      cancelMining("collision");
    } else if (!worldReady || !room || interactionMode !== "build" || !defeatScreen.hidden || !inventoryPanel.hidden || !quizPanel.hidden || !blacksmithPanel.hidden) {
      cancelMining();
    } else {
      const progress = miningProgress(startedAt, now, miningDurationMs(cell.block));
      miningFill.style.width = `${progress * 100}%`;
      const name = cell.block === Block.MoonstoneOre ? "Moonstone" : cell.block === Block.SilverOre ? "Silver" : cell.block === Block.IronOre ? "Iron" : "Block";
      miningCaption.textContent = progress >= 1 ? "Impact · confirming…" : `${name} · ${Math.round(progress * 100)}%`;
      const stage = Math.min(3, 1 + Math.floor(progress * 3));
      updateMiningCracks(cell, stage);
      if (stage > miningSwing.stage) {
        miningSwing.stage = stage;
        localActionStartedAt = now;
        combatAudio.play(cell.block === Block.SilverOre ? "miningSilver" : cell.block === Block.IronOre ? "miningIron" : "miningStone");
        miningBurst(cell, 2);
      }
    }
  }
  miningHud.hidden = (!miningSwing && !pendingMine) || interactionMode !== "build" || !defeatScreen.hidden;
  if (!miningSwing) miningCracks.enabled = false;
}
let tavernDialogueIndex = -1;
let potionCooldownUntil = 0;
let potionPendingUntil = 0;
let potionHealth = 5;
let potionMaxHealth = 5;
let potionUiKey = "";

function refreshPotionUi(): void {
  const quantity = inventoryCounts.get("healing_potion") ?? 0;
  const remaining = Math.max(0, potionCooldownUntil - (performance.now() + serverClock.offset));
  const pending = performance.now() < potionPendingUntil;
  const nearby = canTalkToTavernKeeper(localPlayer.getPosition(), sceneDressing.keeperVisible);
  const key = `${quantity}:${Math.ceil(remaining / 1000)}:${pending}:${nearby}:${Boolean(room)}:${tavernCoinBalance}:${potionHealth}:${potionMaxHealth}`;
  if (key === potionUiKey) return;
  potionUiKey = key;
  potionBuy.disabled = !room || pending || !nearby || quantity >= HEALING_POTION.capacity || tavernCoinBalance < HEALING_POTION.price;
  potionBuy.textContent = quantity >= HEALING_POTION.capacity ? "POUCH FULL" : "BUY · 5 GOLD";
  potionUse.disabled = !room || pending || quantity === 0 || potionHealth <= 0 || potionHealth >= potionMaxHealth || remaining > 0;
  potionUse.textContent = `POTION ${quantity} / 3 · ${remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : "H"}`;
  potionUse.title = `Restore 2 HP · ${quantity} potions · 5 second cooldown`;
  if (!pending) potionShopStatus.textContent = `${quantity} / 3 potions · ${tavernCoinBalance} gold`;
}
function requestPotion(buying = false): void {
  if (!room || performance.now() < potionPendingUntil) return;
  if (buying && !canTalkToTavernKeeper(localPlayer.getPosition(), sceneDressing.keeperVisible)) return;
  potionPendingUntil = performance.now() + 3000;
  potionShopStatus.textContent = buying ? "Buying potion…" : "Drinking potion…";
  room.send(buying ? "potion:buy" : "potion:use");
  refreshPotionUi();
}
potionBuy.addEventListener("click", () => requestPotion(true));
potionUse.addEventListener("click", () => requestPotion());

function closeTavernDialogue(): void {
  tavernDialogue.hidden = true;
  tavernDialogueIndex = -1;
}

function advanceTavernDialogue(): void {
  if (tavernDialogueIndex >= TAVERN_KEEPER_LINES.length - 1) {
    closeTavernDialogue();
    return;
  }
  tavernDialogueIndex += 1;
  tavernDialogueLine.textContent = TAVERN_KEEPER_LINES[tavernDialogueIndex]!;
  tavernDialogueNext.textContent = tavernDialogueIndex === TAVERN_KEEPER_LINES.length - 1 ? "Goodbye" : "Continue";
  tavernDialogue.hidden = false;
}

tavernDialogueNext.addEventListener("click", advanceTavernDialogue);
tavernDialogueClose.addEventListener("click", closeTavernDialogue);

function setInventoryOpen(open: boolean): void {
  if (open) closeLoot();
  inventoryPanel.hidden = !open;
  delete inventoryPanel.dataset.storage;
  document.querySelector("#inventory-title")!.textContent = "Inventory";
  document.querySelector<HTMLElement>("#personal-storage")!.hidden = true;
  inventoryToggle.setAttribute("aria-expanded", String(open));
  if (open) {
    closeTavernDialogue();
    inventoryPreviewDrawer.open = true;
    refreshOwnedInventory();
    inventoryPanel.scrollTop = 0;
    previewHand = undefined; previewArmour = undefined; selectedInventoryItem = undefined;
    previewSlot = inventoryTabs.find(tab => tab.getAttribute("aria-selected") === "true")?.dataset.inventoryTab === "armour" ? "armour" : "weapon";
    refreshInventoryPreview();
    performancePanel.hidden = true;
    performanceToggle.setAttribute("aria-expanded", "false");
    resetMovementControls();
    inventoryClose.focus();
  } else {
    inventoryPortrait?.hide();
    app.autoRender = true;
    inventoryToggle.focus();
  }
}

inventoryToggle.addEventListener("click", () => setInventoryOpen(inventoryPanel.hasAttribute("hidden")));
inventoryClose.addEventListener("click", () => setInventoryOpen(false));
playerLevel.addEventListener("click", () => {
  if (localCharacterProgression.unspentStatPoints > 0) levelUpPanel.hidden = false;
  else setInventoryOpen(true);
});
for (const button of characterStatButtons) button.addEventListener("click", () => {
  const stat = button.dataset.characterStat as CharacterStatId;
  if (!room || localCharacterProgression.unspentStatPoints <= 0) return;
  characterStatButtons.forEach(choice => { choice.disabled = true; });
  room.send("progression:choose", { stat });
});
const storageUI = createStorageUI(document.querySelector<HTMLElement>("#storage-content")!, (type, payload) => room?.send(type, payload));
const storagePrompt = document.createElement("button"); storagePrompt.id = "storage-prompt"; storagePrompt.type = "button";
storagePrompt.textContent = "PERSONAL CHEST · E"; storagePrompt.hidden = true; document.body.append(storagePrompt);
function openPersonalStorage(): void {
  if (!room || !worldReady || !isAtTownStorage(localPlayer.getPosition())) return;
  blacksmithPanel.hidden = true; quizPanel.hidden = true;
  setInventoryOpen(true); inventoryPanel.dataset.storage = "true";
  document.querySelector("#inventory-title")!.textContent = "Personal Chest";
  document.querySelector<HTMLElement>("#personal-storage")!.hidden = false;
  storageUI.open();
}
storagePrompt.addEventListener("click", openPersonalStorage);
const recoveryMarker = document.createElement("button"); recoveryMarker.id = "recovery-marker";
recoveryMarker.type = "button"; recoveryMarker.hidden = true; document.body.append(recoveryMarker);
const recoveryVisuals = new Map<string, pc.Entity>();
let nearbyRecoveryBag: string | null = null;
let recoveryPendingUntil = 0;
function recoverNearbyBag(): void {
  if (!room || !nearbyRecoveryBag || performance.now() < recoveryPendingUntil) return;
  recoveryPendingUntil = performance.now() + 1500;
  room.send("recovery:collect", { bagId: nearbyRecoveryBag });
}
recoveryMarker.addEventListener("click", recoverNearbyBag);
function updateRecoveryMarker(): void {
  const own = room ? (room.state as { players?: { get(id: string): NetworkPlayer | undefined } }).players?.get(room.sessionId) : undefined;
  const bags = own?.recoveryBags;
  for (const [id, entity] of recoveryVisuals) if (!bags?.has(id)) { entity.destroy(); recoveryVisuals.delete(id); }
  let nearest: { id: string; x: number; y: number; z: number; distance: number; items: number } | null = null;
  const player = localPlayer.getPosition();
  if (bags) for (const [id, bag] of bags) {
    let entity = recoveryVisuals.get(id);
    if (!entity) {
      entity = new pc.Entity(`recovery:${id}`);
      addBox(entity, "personal-bag", weaponWoodMaterial, [.65, .5, .5], [0, .25, 0]);
      addBox(entity, "gold-tie", lanternGlow, [.25, .12, .25], [0, .55, 0]);
      const beacon = addBox(entity, "recovery-beacon", lanternGlow, [.06, 1.2, .06], [0, 1.25, 0]);
      if (beacon.render) beacon.render.castShadows = false;
      entity.setPosition(bag.x, bag.y, bag.z);
      app.root.addChild(entity); recoveryVisuals.set(id, entity);
    }
    const distance = Math.hypot(player.x - bag.x, player.y - bag.y, player.z - bag.z);
    entity.enabled = worldReady && distance <= 70 && undergroundKnown(bag.x, bag.y, bag.z) && !isCutawayHidden(Math.floor(bag.x), Math.floor(bag.y), Math.floor(bag.z));
    if (!nearest || distance < nearest.distance) nearest = { id, x: bag.x, y: bag.y, z: bag.z, distance, items: [...bag.items.values()].reduce((total, item) => total + item.quantity, 0) };
  }
  nearbyRecoveryBag = nearest && Math.hypot(player.x - nearest.x, player.z - nearest.z) <= 2 && Math.abs(player.y - nearest.y) <= 1.5 ? nearest.id : null;
  recoveryMarker.hidden = !nearest || !worldReady || !defeatScreen.hidden || !inventoryPanel.hidden || !quizPanel.hidden || !blacksmithPanel.hidden;
  if (nearest) {
    recoveryMarker.disabled = !nearbyRecoveryBag || performance.now() < recoveryPendingUntil;
    const depth = Math.round(nearest.y - player.y);
    const direction = `${nearest.z < player.z - 2 ? "N" : nearest.z > player.z + 2 ? "S" : ""}${nearest.x < player.x - 2 ? "W" : nearest.x > player.x + 2 ? "E" : ""}`;
    const label = nearbyRecoveryBag ? `YOUR BAG · ${nearest.items} items · E to recover` : `YOUR BAG · ${Math.ceil(nearest.distance)}m ${direction}${Math.abs(depth) > 1 ? ` · ${Math.abs(depth)}m ${depth < 0 ? "below" : "above"}` : ""} · (${Math.round(nearest.x)}, ${Math.round(nearest.z)})`;
    if (recoveryMarker.textContent !== label) recoveryMarker.textContent = label;
  }
}
const inventoryPreviewDrawer = document.querySelector<HTMLDetailsElement>("#inventory-preview-drawer")!;
document.querySelector<HTMLButtonElement>("#inventory-customize")!.addEventListener("click", () => {
  inventoryPreviewDrawer.open = true;
  document.querySelector<HTMLElement>("#appearance-customizer")!.scrollIntoView({ block: "center" });
});
const inventoryTabs = [...inventoryPanel.querySelectorAll<HTMLButtonElement>("[data-inventory-tab]")];
function selectInventoryCategory(category: InventoryTab, focus = false): void {
  for (const tab of inventoryTabs) {
    const selected = tab.dataset.inventoryTab === category;
    tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
    if (selected && focus) tab.focus();
  }
  for (const section of inventoryPanel.querySelectorAll<HTMLElement>("[data-inventory-category]")) {
    section.hidden = section.dataset.inventoryCategory !== category;
  }
  previewHand = undefined; previewArmour = undefined; selectedInventoryItem = undefined;
  previewSlot = category === "armour" ? "armour" : "weapon";
  if (category === "collection") inventoryPreviewDrawer.open = false;
  refreshInventoryPreview();
  inventoryPanel.scrollTop = 0;
}
for (const tab of inventoryTabs) {
  tab.addEventListener("click", () => selectInventoryCategory(tab.dataset.inventoryTab as InventoryTab));
  tab.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    selectInventoryCategory(nextInventoryTab(tab.dataset.inventoryTab as InventoryTab, event.key), true);
  });
}
inventoryPreviewDrawer.addEventListener("toggle", () => { if (inventoryPreviewDrawer.open) refreshInventoryPreview(); });
refreshOwnedInventory();
document.querySelector("#inventory-preview-reset")!.addEventListener("click", () => {
  previewHand = undefined; previewArmour = undefined; selectedInventoryItem = undefined; inventoryComparisonKey = ""; refreshInventoryPreview();
});
document.querySelector<HTMLButtonElement>("#inventory-turn-left")!.addEventListener("click", () => inventoryPortrait?.turn(-45));
document.querySelector<HTMLButtonElement>("#inventory-turn-right")!.addEventListener("click", () => inventoryPortrait?.turn(45));
for (const card of inventoryPanel.querySelectorAll<HTMLElement>("article.equipment")) {
  const button = document.createElement("button"); button.type = "button"; button.className = "inventory-preview-button";
  button.textContent = "PREVIEW";
  button.setAttribute("aria-label", `Preview ${card.querySelector("strong")!.textContent}`);
  button.addEventListener("click", () => {
    const hand = card.querySelector<HTMLElement>("[data-equip-main-hand]")?.dataset.equipMainHand;
    const armour = card.querySelector<HTMLElement>("[data-equip-armour]")?.dataset.equipArmour;
    if (hand && isMainHandId(hand)) { previewHand = hand; previewSlot = "weapon"; selectedInventoryItem = card.dataset.item as ItemId; }
    else if (armour && armourForItem(armour)) { previewArmour = armourForItem(armour)!; previewSlot = "armour"; selectedInventoryItem = card.dataset.item as ItemId; }
    inventoryPreviewDrawer.open = true;
    refreshInventoryPreview();
    inventoryPreviewDrawer.scrollIntoView({ block: "nearest" });
  });
  const actions = document.createElement("div"); actions.className = "inventory-item-actions";
  const equip = card.querySelector<HTMLButtonElement>("[data-equip-main-hand], [data-equip-armour]")!;
  actions.append(equip, button); card.append(actions);
}
inventorySelectedEquip.addEventListener("click", () => {
  if (!selectedInventoryItem) return;
  const hand = equipmentForItem(selectedInventoryItem);
  const armour = armourForItem(selectedInventoryItem);
  if (hand && isMainHandId(hand)) requestMainHandEquip(hand);
  else if (armour && room && worldReady) room.send("armour:equip", { armourId: armour });
});
inventorySelectedKeep.addEventListener("click", () => {
  previewHand = undefined; previewArmour = undefined; selectedInventoryItem = undefined;
  inventoryComparisonKey = ""; refreshInventoryPreview();
});
inventorySelectedDismantle.addEventListener("click", () => {
  if (!selectedInventoryItem || inventorySelectedDismantle.disabled) return;
  if (!canTradeAtBlacksmithStall(localPlayer.getPosition(), sceneDressing.blacksmithVisible)) {
    setInventoryOpen(false);
    status.textContent = "Take this item to the Town of Beginnings blacksmith to dismantle it.";
    showCombatFeedback("BLACKSMITH REQUIRED", "hurt");
    return;
  }
  openBlacksmith(); blacksmithShopTab = "dismantle"; renderWeaponShop();
});
window.addEventListener("pagehide", event => {
  if (event.persisted) { inventoryPortrait?.hide(); return; }
  inventoryPortrait?.destroy(); inventoryPortrait = undefined;
});
window.addEventListener("pageshow", () => { if (!inventoryPanel.hidden) refreshInventoryPreview(); });

let tavernCoinBalance = TAVERN_QUIZ_STARTING_COINS;
let quizPending = false;
let coinCountAnimationActive = false;
let coinCountAnimationFrame = 0;
const coinLabel = (amount: number): string => `${amount} ${amount === 1 ? "coin" : "coins"}`;

function updateTavernCoins(coins: number): void {
  tavernCoinBalance = Math.max(0, Math.floor(coins));
  tavernCoins.textContent = tavernCoinBalance.toLocaleString();
  blacksmithGold.textContent = tavernCoinBalance.toLocaleString();
  blacksmithSell.disabled = blacksmithPending || ((inventoryCounts.get("iron_ore") ?? 0) + (inventoryCounts.get("silver_ore") ?? 0)) <= 0 || tavernCoinBalance >= 1_000_000;
  if (!coinCountAnimationActive) quizBalanceAmount.textContent = tavernCoinBalance.toLocaleString();
  for (const button of quizStakes.querySelectorAll<HTMLButtonElement>("[data-quiz-stake]")) {
    button.disabled = quizPending || Number(button.dataset.quizStake) > tavernCoinBalance;
  }
}

let blacksmithPending = false;
let blacksmithIronCapacity = 12;
let blacksmithShopTab: BlacksmithShopTab = "sell";
let blacksmithCharacterLevel = 1;
let selectedDepthsRewardId: SilverDepthsRewardId = "depths_compass";
let lastShopPurchaseCategory: InventoryTab = "weapons";
const weaponShop = document.createElement("div");
weaponShop.id = "blacksmith-weapons";
blacksmithClose.before(weaponShop);
const dismantleShop = document.createElement("div");
dismantleShop.id = "blacksmith-dismantle";
blacksmithClose.before(dismantleShop);
const reforgeShop = document.createElement("div");
reforgeShop.id = "blacksmith-reforge";
blacksmithClose.before(reforgeShop);
function renderReforgeShop(): void {
  reforgeShop.replaceChildren();
  reforgeShop.hidden = blacksmithShopTab !== "reforge";
  if (reforgeShop.hidden) return;
  const heading = document.createElement("h3"); heading.className = "blacksmith-shop-heading";
  heading.textContent = "REFORGE OWNED EQUIPMENT · MAXIMUM RANK III";
  const help = document.createElement("p"); help.className = "blacksmith-reforge-help";
  help.textContent = "Fixed upgrades only—no random rarity. Every weapon rank adds +1 damage; armour gains reinforcement at Ranks I and III.";
  reforgeShop.append(heading, help);
  let shown = 0;
  for (const itemId of Object.keys(BLACKSMITH_REFORGE) as BlacksmithReforgeItemId[]) {
    if ((inventoryCounts.get(itemId) ?? 0) <= 0) continue;
    shown++;
    const recipe = BLACKSMITH_REFORGE[itemId];
    const rank = blacksmithReforgeRanks[itemId] ?? 0;
    const complete = rank >= 3;
    const cost = complete ? undefined : recipe.costs[rank];
    const held = inventoryCounts.get(recipe.materialId) ?? 0;
    const armour = armourForItem(itemId);
    const currentBonus = armour ? reforgeArmourReduction(rank) : reforgeWeaponDamageBonus(rank);
    const nextBonus = armour ? reforgeArmourReduction(rank + 1) : reforgeWeaponDamageBonus(rank + 1);
    const card = document.createElement("article"); card.className = complete ? "complete" : "";
    card.dataset.rarity = itemRarity(itemId);
    const title = document.createElement("header");
    title.innerHTML = `<strong>${ITEM_DEFINITIONS[itemId].name}<small class="smith-rarity">${ITEM_RARITIES[itemRarity(itemId)].label}</small></strong><b>${rankLabel(rank)}</b>`;
    const comparison = document.createElement("p");
    comparison.textContent = complete ? `${armour ? "Reinforcement" : "Weapon damage"} bonus +${currentBonus} · fully reforged`
      : `${armour ? "Reinforcement" : "Weapon damage"} +${currentBonus} → +${nextBonus}`;
    const costs = document.createElement("small");
    costs.textContent = cost ? `${tavernCoinBalance} / ${cost.gold} gold · ${held} / ${cost.material} ${ITEM_DEFINITIONS[recipe.materialId].name}` : "Maximum forge rank reached";
    const button = document.createElement("button"); button.type = "button";
    const canAfford = !!cost && tavernCoinBalance >= cost.gold && held >= cost.material;
    button.textContent = complete ? "FULLY REFORGED" : blacksmithPending ? "PLEASE WAIT…" : canAfford ? `REFORGE TO ${rankLabel(rank + 1)}` : "MATERIALS REQUIRED";
    button.disabled = complete || blacksmithPending || !room || !canAfford;
    button.addEventListener("click", () => {
      if (!room || blacksmithPending || !canAfford) return;
      blacksmithPending = true; renderReforgeShop();
      blacksmithMessage.textContent = `Reforging ${ITEM_DEFINITIONS[itemId].name}...`;
      room.send("blacksmith:reforge", { itemId });
    });
    card.append(title, comparison, costs, button); reforgeShop.append(card);
  }
  if (shown === 0) {
    const empty = document.createElement("p"); empty.className = "blacksmith-reforge-empty";
    empty.textContent = "No reforgeable equipment in your pack yet. Buy gear or recover equipment from enemies and dungeons.";
    reforgeShop.append(empty);
  }
}
function renderDismantleShop(): void {
  dismantleShop.replaceChildren();
  dismantleShop.hidden = blacksmithShopTab !== "dismantle";
  if (dismantleShop.hidden) return;
  const heading = document.createElement("h3"); heading.className = "blacksmith-shop-heading";
  heading.textContent = "DISMANTLE EQUIPMENT · ONE ITEM AT A TIME";
  const help = document.createElement("p"); help.className = "blacksmith-dismantle-help";
  help.textContent = "Break unwanted gear into gold and useful materials. Your last equipped copy is protected.";
  dismantleShop.append(heading, help);
  let shown = 0;
  for (const itemId of Object.keys(BLACKSMITH_DISMANTLE) as BlacksmithDismantleItemId[]) {
    const owned = inventoryCounts.get(itemId) ?? 0;
    if (owned <= 0) continue;
    shown++;
    const recipe = BLACKSMITH_DISMANTLE[itemId];
    const hand = equipmentForItem(itemId);
    const armour = armourForItem(itemId);
    const equipped = hand === localMainHandId || armour === localArmourId;
    const protectedLastCopy = equipped && owned <= 1;
    const card = document.createElement("article");
    card.dataset.rarity = itemRarity(itemId);
    card.className = protectedLastCopy ? "protected" : "";
    const title = document.createElement("strong"); title.textContent = `${ITEM_DEFINITIONS[itemId].name} · ${ITEM_RARITIES[itemRarity(itemId)].label} ×${owned}`;
    const reward = document.createElement("p");
    const material = "materialId" in recipe ? ` + ${recipe.materialQuantity} ${ITEM_DEFINITIONS[recipe.materialId].name}` : "";
    reward.textContent = `Returns ${recipe.gold} gold${material}`;
    const note = document.createElement("small");
    note.textContent = protectedLastCopy ? "Equipped · keep or equip something else first" : equipped ? "Duplicate copy · equipped copy remains safe" : "Removes one item from your pack";
    const button = document.createElement("button"); button.type = "button";
    button.textContent = protectedLastCopy ? "EQUIPPED · PROTECTED" : blacksmithPending ? "PLEASE WAIT…" : "DISMANTLE ONE";
    button.disabled = protectedLastCopy || blacksmithPending || !room || tavernCoinBalance + recipe.gold > 1_000_000;
    button.addEventListener("click", () => {
      if (!room || blacksmithPending || protectedLastCopy) return;
      blacksmithPending = true; renderDismantleShop();
      blacksmithMessage.textContent = `Dismantling ${ITEM_DEFINITIONS[itemId].name}...`;
      room.send("blacksmith:dismantle", { itemId });
    });
    card.append(title, reward, note, button); dismantleShop.append(card);
  }
  if (shown === 0) {
    const empty = document.createElement("p"); empty.className = "blacksmith-dismantle-empty";
    empty.textContent = "No dismantlable equipment in your pack. Enemy weapons and armour will appear here.";
    dismantleShop.append(empty);
  }
}
function renderWeaponShop(): void {
  weaponShop.replaceChildren();
  const shopping = blacksmithShopTab === "weapons" || blacksmithShopTab === "armour";
  weaponShop.hidden = !shopping;
  document.querySelector<HTMLElement>("#blacksmith-mineral-shop")!.hidden = blacksmithShopTab !== "sell";
  document.querySelector<HTMLElement>("#blacksmith-upgrade-shop")!.hidden = blacksmithShopTab !== "upgrades";
  document.querySelector<HTMLElement>("#blacksmith-depths-shop")!.hidden = blacksmithShopTab !== "depths";
  renderDismantleShop();
  renderReforgeShop();
  for (const tab of blacksmithPanel.querySelectorAll<HTMLButtonElement>("[data-smith-tab]")) {
    tab.setAttribute("aria-pressed", String(tab.dataset.smithTab === blacksmithShopTab));
  }
  if (!shopping) return;
  const heading = document.createElement("h3"); heading.className = "blacksmith-shop-heading";
  heading.textContent = `${blacksmithShopTab.toUpperCase()} · BUY WITH GOLD · EQUIP FROM YOUR PACK`; weaponShop.append(heading);
  const current = weaponComparison(localMainHandId, localIronSwordOwned);
  for (const id of blacksmithShopStock(blacksmithShopTab)) {
    const armour = id === "leather_armour" || id === "iron_armour" ? armourStats(id) : null;
    const stats = armour ? null : weaponComparison(id as MainHandId);
    const card = document.createElement("article");
    card.dataset.rarity = itemRarity(id);
    const title = document.createElement("strong"); title.textContent = `${ITEM_DEFINITIONS[id].name} · ${ITEM_RARITIES[itemRarity(id)].label}`;
    const description = document.createElement("p");
    description.textContent = armour ? `Damage reduction ${armour.reduction} · movement ${Math.round(armour.speed * 100)}% · minimum hit 1` : `Damage ${stats!.damage} · attack ${stats!.speed} · reach ${stats!.range}`;
    const comparison = document.createElement("small");
    const worn = armourStats(localArmourId);
    comparison.textContent = armour ? `Worn: ${worn.name} — reduction ${worn.reduction}, movement ${Math.round(worn.speed * 100)}%. Buy, then equip from your pack.` : `Equipped: ${current.name} — damage ${current.damage}, attack ${current.speed}, reach ${current.range}. Lower ms = faster.`;
    const button = document.createElement("button");
    const owned = inventoryCounts.get(id) ?? 0;
    const price = document.createElement("span"); price.className = "blacksmith-item-price";
    price.textContent = `${BLACKSMITH_STOCK[id].price} GOLD${owned ? ` · ${owned} owned` : ""}`;
    const shortfall = shopGoldShortfall(id, tavernCoinBalance);
    const requiredLevel = blacksmithRequiredLevel(id);
    const levelLocked = blacksmithCharacterLevel < requiredLevel;
    button.textContent = levelLocked ? `UNLOCKS AT LEVEL ${requiredLevel}` : blacksmithPending ? "PLEASE WAIT…" : shortfall ? `NEED ${shortfall} MORE GOLD` : "BUY · ADD TO PACK";
    button.disabled = levelLocked || !room || blacksmithPending || tavernCoinBalance < BLACKSMITH_STOCK[id].price || owned >= 65535;
    button.addEventListener("click", () => {
      if (!room || blacksmithPending) return;
      lastShopPurchaseCategory = armour ? "armour" : "weapons";
      blacksmithPending = true; renderWeaponShop();
      blacksmithMessage.textContent = `Buying ${ITEM_DEFINITIONS[id].name}...`;
      room.send("blacksmith:buy", { itemId: id });
    });
    card.append(title, price, description, comparison, button); weaponShop.append(card);
  }
}
for (const tab of blacksmithPanel.querySelectorAll<HTMLButtonElement>("[data-smith-tab]")) {
  tab.addEventListener("click", () => {
    blacksmithShopTab = tab.dataset.smithTab as BlacksmithShopTab;
    renderWeaponShop(); blacksmithPanel.scrollTop = 0;
  });
}
document.querySelector("#blacksmith-open-pack")!.addEventListener("click", () => {
  blacksmithPanel.hidden = true;
  selectInventoryCategory(lastShopPurchaseCategory); setInventoryOpen(true);
});
blacksmithPrice.textContent = `Iron ${IRON_ORE_GOLD_PRICE} · Silver ${SILVER_ORE_GOLD_PRICE} gold`;

function renderBlacksmith(update: BlacksmithUpdate): void {
  blacksmithPending = false;
  blacksmithPanel.dataset.phase = update.phase;
  blacksmithMessage.textContent = update.phase === "idle"
    ? "Sell iron for 3 gold and silver for 8. Choose Weapons or Armour, buy gear, then open your pack to equip it."
    : update.phase === "traded" ? `${update.message} Choose Weapons or Armour to spend your gold.` : update.message;
  blacksmithIronCapacity = update.ironCapacity;
  blacksmithCharacterLevel = update.characterLevel;
  updateInventoryItem("iron_ore", update.ironOre);
  const silver = update.silverOre ?? 0;
  updateInventoryItem("silver_ore", silver);
  updateInventoryItem("moonstone", update.moonstone ?? 0);
  document.querySelector<HTMLElement>("#blacksmith-silver")!.textContent = `${silver} / ${update.ironCapacity}`;
  document.querySelector<HTMLElement>("#blacksmith-sale-value")!.textContent = `${update.ironOre * IRON_ORE_GOLD_PRICE + silver * SILVER_ORE_GOLD_PRICE} gold`;
  blacksmithOre.textContent = `${update.ironOre.toLocaleString()} / ${update.ironCapacity.toLocaleString()}`;
  updateTavernCoins(update.gold);
  for (const id of Object.keys(BLACKSMITH_STOCK) as BlacksmithStockId[]) updateInventoryItem(id, update.weapons?.[id] ?? 0);
  for (const id of Object.keys(BLACKSMITH_DISMANTLE) as BlacksmithDismantleItemId[]) updateInventoryItem(id, update.dismantleItems?.[id] ?? 0);
  for (const [id, quantity] of Object.entries(update.reforgeMaterials ?? {})) updateInventoryItem(id as ItemId, quantity ?? 0);
  blacksmithReforgeRanks = update.reforgeRanks ?? {};
  refreshEquipmentProgression();
  refreshInventoryEquipped();
  renderWeaponShop();
  blacksmithSell.disabled = update.ironOre + silver <= 0 || blacksmithPending || update.gold >= 1_000_000;
  const owned = new Set(update.ownedUpgrades);
  for (const card of blacksmithUpgradeCards) {
    const upgradeId = card.dataset.blacksmithUpgrade as BlacksmithUpgradeId;
    const button = card.querySelector<HTMLButtonElement>("button")!;
    const isOwned = owned.has(upgradeId);
    const recipe = BLACKSMITH_UPGRADES[upgradeId];
    const ironCost = card.querySelector<HTMLElement>('[data-cost="iron"]');
    const goldCost = card.querySelector<HTMLElement>('[data-cost="gold"]');
    if (ironCost) {
      ironCost.textContent = `${update.ironOre} / ${recipe.ironOre} IRON`;
      ironCost.classList.toggle("met", update.ironOre >= recipe.ironOre);
    }
    if (goldCost) {
      goldCost.textContent = `${update.gold} / ${recipe.price} GOLD`;
      goldCost.classList.toggle("met", update.gold >= recipe.price);
    }
    card.classList.toggle("owned", isOwned);
    const expeditionLocked = upgradeId === "moonstone_edge" && !isOwned;
    button.disabled = isOwned || expeditionLocked || blacksmithPending || update.gold < recipe.price || update.ironOre < recipe.ironOre;
    button.textContent = isOwned ? "EQUIPPED" : expeditionLocked ? "BOSS DROP REQUIRED" : upgradeId === "reinforced_pickaxe" ? `BUY · ${recipe.price} GOLD` : "FORGE";
  }
  const ownedDepths = new Set(update.ownedDepthsRewards ?? []);
  const moonstone = update.moonstone ?? 0;
  const depthsUnlocked = owned.has("moonstone_edge");
  if (ownedDepths.has(selectedDepthsRewardId)) {
    selectedDepthsRewardId = (Object.keys(SILVER_DEPTHS_REWARDS) as SilverDepthsRewardId[]).find(id => !ownedDepths.has(id)) ?? selectedDepthsRewardId;
  }
  document.querySelector<HTMLElement>("#blacksmith-moonstone")!.textContent = `${moonstone} ◆`;
  for (const card of depthsRewardCards) {
    const rewardId = card.dataset.depthsReward as SilverDepthsRewardId;
    const reward = SILVER_DEPTHS_REWARDS[rewardId];
    const button = card.querySelector<HTMLButtonElement>("button")!;
    const isOwned = ownedDepths.has(rewardId);
    card.classList.toggle("owned", isOwned);
    card.classList.toggle("selected", selectedDepthsRewardId === rewardId);
    button.disabled = isOwned || !depthsUnlocked || blacksmithPending || moonstone < reward.cost;
    button.textContent = isOwned ? "ATTUNED" : !depthsUnlocked ? "EXPEDITION LOCKED" : moonstone < reward.cost ? `NEED ${reward.cost - moonstone} MORE ◆` : `ATTUNE · ${reward.cost} ◆`;
  }
  const selectedReward = SILVER_DEPTHS_REWARDS[selectedDepthsRewardId];
  const goal = document.querySelector<HTMLElement>("#blacksmith-depths-goal")!;
  goal.querySelector("strong")!.textContent = `${selectedReward.name} · ${Math.min(moonstone, selectedReward.cost)} / ${selectedReward.cost} ◆`;
  goal.style.setProperty("--depths-progress", `${Math.min(100, moonstone / selectedReward.cost * 100)}%`);
  if (update.phase === "traded" && update.goldGranted) {
    showCombatFeedback(`+${update.goldGranted} GOLD`, "dodge");
    status.textContent = update.message;
  }
  if (update.phase === "purchased" && update.purchasedUpgradeId) {
    showCombatFeedback(update.purchasedUpgradeId === "reinforced_pickaxe" ? "PICKAXE BOUGHT · EQUIPPED" : "EQUIPMENT FORGED", "dodge");
    status.textContent = update.message;
  }
  if (update.phase === "purchased" && update.purchasedDepthsRewardId) {
    showCombatFeedback(`${SILVER_DEPTHS_REWARDS[update.purchasedDepthsRewardId].name.toUpperCase()} ATTUNED`, "dodge");
    status.textContent = update.message;
  }
  if (update.phase === "purchased" && !update.purchasedUpgradeId && !update.purchasedDepthsRewardId) {
    showCombatFeedback("EQUIPMENT ADDED TO PACK", "dodge");
    status.textContent = update.message;
  }
  if (update.phase === "dismantled" && update.dismantledItemId) {
    const material = update.materialGranted && update.materialQuantity
      ? ` · +${update.materialQuantity} ${ITEM_DEFINITIONS[update.materialGranted].name}` : "";
    showCombatFeedback(`DISMANTLED · +${update.goldGranted ?? 0} GOLD${material}`.toUpperCase(), "dodge");
    status.textContent = update.message;
  }
  if (update.phase === "reforged" && update.reforgedItemId) {
    const rank = blacksmithReforgeRanks[update.reforgedItemId] ?? 0;
    showCombatFeedback(`${ITEM_DEFINITIONS[update.reforgedItemId].name.toUpperCase()} · ${rankLabel(rank)}`, "dodge");
    status.textContent = update.message;
  }
}

function openBlacksmith(): void {
  closeTavernDialogue();
  setInventoryOpen(false);
  blacksmithPanel.hidden = false;
  blacksmithShopTab = "sell";
  blacksmithPanel.scrollTop = 0;
  renderWeaponShop();
  blacksmithMessage.textContent = "Checking your minerals...";
  if (room) room.send("blacksmith:sync");
}

blacksmithClose.addEventListener("click", () => { blacksmithPanel.hidden = true; });
blacksmithSell.addEventListener("click", () => {
  if (!room || blacksmithPending) return;
  blacksmithPending = true;
  blacksmithSell.disabled = true;
  room.send("blacksmith:sell");
});
for (const card of blacksmithUpgradeCards) {
  const button = card.querySelector<HTMLButtonElement>("button")!;
  button.addEventListener("click", () => {
    if (!room || blacksmithPending) return;
    const upgradeId = card.dataset.blacksmithUpgrade as BlacksmithUpgradeId;
    blacksmithPending = true;
    button.disabled = true;
    blacksmithMessage.textContent = `${upgradeId === "reinforced_pickaxe" ? "Buying" : "Forging"} ${BLACKSMITH_UPGRADES[upgradeId].name}...`;
    room.send("blacksmith:forge", { upgradeId });
  });
}
for (const card of depthsRewardCards) {
  card.addEventListener("click", event => {
    if ((event.target as HTMLElement).closest("button")) return;
    selectedDepthsRewardId = card.dataset.depthsReward as SilverDepthsRewardId;
    if (room) room.send("blacksmith:sync");
  });
  card.querySelector<HTMLButtonElement>("button")!.addEventListener("click", () => {
    if (!room || blacksmithPending) return;
    const rewardId = card.dataset.depthsReward as SilverDepthsRewardId;
    blacksmithPending = true;
    blacksmithMessage.textContent = `Attuning ${SILVER_DEPTHS_REWARDS[rewardId].name}...`;
    room.send("blacksmith:depths-buy", { rewardId });
  });
}

function animateQuizPayout(payout: number, total: number): void {
  if (payout <= 0 || quizPanel.hidden) return;
  quizWinToast.textContent = `+${payout.toLocaleString()} coins`;
  quizWinToast.hidden = false;
  quizWinToast.classList.remove("pop");
  void quizWinToast.offsetWidth;
  quizWinToast.classList.add("pop");
  window.setTimeout(() => { quizWinToast.hidden = true; }, 1150);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const source = quizPotDisplay.getBoundingClientRect();
  const destination = quizBalance.getBoundingClientRect();
  const sourceX = source.left + source.width / 2;
  const sourceY = source.top + source.height / 2;
  const endX = destination.left + 16;
  const endY = destination.top + destination.height / 2;
  for (let index = 0; index < 7; index += 1) {
    const coin = document.createElement("span");
    coin.className = "coin-fly";
    coin.textContent = "✦";
    coin.setAttribute("aria-hidden", "true");
    const jitterX = (index - 3) * 11;
    const jitterY = (index % 3 - 1) * 7;
    coin.style.left = `${sourceX + jitterX}px`;
    coin.style.top = `${sourceY + jitterY}px`;
    coin.style.setProperty("--coin-dx", `${endX - sourceX - jitterX}px`);
    coin.style.setProperty("--coin-dy", `${endY - sourceY - jitterY}px`);
    coin.style.animationDelay = `${index * 65}ms`;
    coin.addEventListener("animationend", () => coin.remove(), { once: true });
    document.body.append(coin);
  }

  window.cancelAnimationFrame(coinCountAnimationFrame);
  coinCountAnimationActive = true;
  const start = Math.max(0, total - payout);
  const began = performance.now();
  const tick = (now: number): void => {
    const fraction = Math.min(1, (now - began) / 800);
    const eased = 1 - Math.pow(1 - fraction, 3);
    quizBalanceAmount.textContent = Math.round(start + (total - start) * eased).toLocaleString();
    if (fraction < 1) coinCountAnimationFrame = window.requestAnimationFrame(tick);
    else {
      coinCountAnimationActive = false;
      quizBalanceAmount.textContent = tavernCoinBalance.toLocaleString();
    }
  };
  coinCountAnimationFrame = window.requestAnimationFrame(tick);
}

function renderTavernQuiz(update: TavernQuizUpdate): void {
  quizPending = false;
  updateTavernCoins(update.coins);
  quizMessage.textContent = update.message ?? "Place a stake, then answer Mara's question.";
  if (update.phase === "error") {
    quizPanel.dataset.phase = "error";
    quizAnswerFeedback.hidden = true;
    return;
  }
  const previousPhase = quizPanel.dataset.phase;
  quizPanel.dataset.phase = update.phase;
  quizPotDisplay.textContent = (update.payout ?? 0).toLocaleString();
  quizPotLabel.textContent = update.phase === "won" ? "COLLECTED" : update.phase === "lost" ? "POT LOST" : update.phase === "decision" ? "POT AT RISK" : "CURRENT POT";
  quizStakes.hidden = update.phase === "question" || update.phase === "decision";
  quizStakeHeading.textContent = update.phase === "lost" ? "TRY AGAIN" : update.phase === "won" ? "PLAY AGAIN" : "CHOOSE YOUR STAKE";
  quizQuestion.hidden = update.phase !== "question";
  quizDecision.hidden = update.phase !== "decision";
  quizDouble.disabled = false;
  quizQuit.disabled = false;
  quizChoices.replaceChildren();
  quizAnswerFeedback.hidden = !["decision", "lost", "won"].includes(update.phase);
  if (!quizAnswerFeedback.hidden) {
    const feedback = update.phase === "decision" || (update.phase === "won" && previousPhase === "question")
      ? { kind: "correct", icon: "✓", title: "CORRECT ANSWER!", detail: `The pot doubled to ${coinLabel(update.payout ?? 0)}. ${update.phase === "decision" ? "Collect it or risk another question." : "You collected the table limit!"}` }
      : update.phase === "lost"
        ? { kind: "wrong", icon: "×", title: "WRONG ANSWER", detail: update.message ?? "The pot is lost. Try another round." }
        : { kind: "collected", icon: "✦", title: "COINS COLLECTED!", detail: `${coinLabel(update.payout ?? 0)} added to your purse.` };
    quizPanel.dataset.feedback = feedback.kind;
    quizFeedbackIcon.textContent = feedback.icon;
    quizFeedbackTitle.textContent = feedback.title;
    quizFeedbackDetail.textContent = feedback.detail;
    quizAnswerFeedback.classList.remove("reveal");
    void quizAnswerFeedback.offsetWidth;
    quizAnswerFeedback.classList.add("reveal");
  } else {
    delete quizPanel.dataset.feedback;
  }
  if (update.phase === "question" && update.question) {
    quizPot.textContent = "Choose one answer · correct doubles the pot";
    quizPrompt.textContent = update.question.prompt;
    update.question.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const letter = document.createElement("span");
      letter.className = "quiz-choice-letter";
      letter.textContent = String.fromCharCode(65 + index);
      const answer = document.createElement("span");
      answer.className = "quiz-choice-text";
      answer.textContent = choice;
      button.append(letter, answer);
      button.addEventListener("click", () => {
        if (!room || quizPending) return;
        quizPending = true;
        for (const answer of quizChoices.querySelectorAll<HTMLButtonElement>("button")) answer.disabled = true;
        room.send("quiz:answer", { questionId: update.question!.id, choice: index });
      });
      quizChoices.append(button);
    });
  }
  if (update.phase === "won") animateQuizPayout(update.payout ?? 0, update.coins);
}

function openTavernQuiz(): void {
  closeTavernDialogue();
  setInventoryOpen(false);
  quizPanel.hidden = false;
  if (room) room.send("quiz:sync");
  else quizMessage.textContent = "Connecting to the quiz table...";
}
quizClose.addEventListener("click", () => { quizPanel.hidden = true; });
for (const button of quizStakes.querySelectorAll<HTMLButtonElement>("[data-quiz-stake]")) {
  button.addEventListener("click", () => {
    if (!room || quizPending) return;
    quizPending = true;
    updateTavernCoins(tavernCoinBalance);
    room.send("quiz:start", { stake: Number(button.dataset.quizStake) });
  });
}
for (const [button, decision] of [[quizDouble, "double"], [quizQuit, "quit"]] as const) {
  button.addEventListener("click", () => {
    if (!room || quizPending) return;
    quizPending = true;
    quizDouble.disabled = true;
    quizQuit.disabled = true;
    room.send("quiz:decision", { decision });
  });
}

function updatePointerPosition(event: PointerEvent): void {
  rangedPointer.active = event.pointerType === "mouse";
  rangedPointer.x = event.clientX; rangedPointer.y = event.clientY;
  const rect = canvas.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) * (canvas.width / rect.width);
  pointer.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  if (powerAimActive) updatePowerAimFromPointer();
  if (specialAimActive) updateSpecialAimFromPointer();
}

canvas.addEventListener("pointermove", updatePointerPosition);
canvas.addEventListener("pointerleave", () => { rangedFirePointer = null; rangedPointer.active = false; updateRangedReticle(); });

function visibleMarkState(mob: MobVisual, now = Date.now()): MarkVisualState | null {
  for (const [casterId, mark] of mob.marks) {
    if (now >= mark.expiresAt) mob.marks.delete(casterId);
  }
  const localMark = room?.sessionId ? mob.marks.get(room.sessionId) : undefined;
  if (localMark) return localMark;
  let strongest: MarkVisualState | null = null;
  for (const mark of mob.marks.values()) {
    if (!strongest || mark.stacks > strongest.stacks) strongest = mark;
  }
  return strongest;
}

interface ForestPortalVisual {
  root: pc.Entity;
  glow: pc.Entity;
  label: HTMLButtonElement;
  state: ForestPortal;
  materials: pc.Material[];
  ember: boolean;
  runes: pc.Entity[];
  motes: pc.Entity[];
  orbit: pc.Entity | null;
  portalLight: pc.Entity | null;
}
const forestPortalVisuals = new Map<string, ForestPortalVisual>();
interface DungeonBurstVisual { root: pc.Entity; material: pc.StandardMaterial; startedAt: number; kind: "gate" | "victory" | "crystal" }
const dungeonBurstVisuals: DungeonBurstVisual[] = [];
function createDungeonBurst(x: number, z: number, kind: "gate" | "victory" | "crystal", y = 8.08): void {
  const root = new pc.Entity(`dungeon-${kind}-burst`);
  const material = powerMaterial(kind === "victory" ? new pc.Color(1, .78, .28) : kind === "crystal" ? new pc.Color(.68, .32, 1) : new pc.Color(.42, 1, .48), .88);
  const segments = kind === "victory" ? 16 : kind === "crystal" ? 18 : 12;
  for (let i = 0; i < segments; i++) {
    const angle = i / segments * Math.PI * 2;
    const segment = addBox(root, "dungeon-burst-ray", material, [.16, .07, kind === "victory" ? .75 : .55], [Math.sin(angle) * 1.15, .08, Math.cos(angle) * 1.15]);
    segment.setLocalEulerAngles(0, angle * 180 / Math.PI, 0);
    if (segment.render) segment.render.castShadows = false;
  }
  root.setPosition(x, y, z); app.root.addChild(root);
  dungeonBurstVisuals.push({ root, material, startedAt: performance.now(), kind });
}
let nearbyForestPortal: string | null = null;
let pendingPortalDestination: { x: number; y: number; z: number } | null = null;
function useNearbyForestPortal(): void {
  if (!worldReady || !room || !nearbyForestPortal || !defeatScreen.hidden) return;
  room.send("portal:use", { id: nearbyForestPortal });
}
function updateForestPortals(): void {
  const portals = (room?.state as { portals?: Map<string, ForestPortal> } | undefined)?.portals;
  const now = performance.now() + serverClock.offset, player = localPlayer.getPosition();
  nearbyForestPortal = null; let nearest = Infinity;
  for (const [id, visual] of forestPortalVisuals) if (!portals?.has(id)) {
    visual.root.destroy(); visual.materials.forEach(material => material.destroy()); visual.label.remove(); forestPortalVisuals.delete(id);
  }
  portals?.forEach((portal, id) => {
    let visual = forestPortalVisuals.get(id);
    if (!visual) {
      const root = new pc.Entity(`portal-${id}`);
      const victory = id === "forest-victory";
      const depths = id.startsWith("depths-");
      const ember = id.startsWith("ember-");
      const frame = coloredMaterial(ember ? new pc.Color(.085, .07, .065) : new pc.Color(.2, .12, .3));
      const trim = ember ? coloredMaterial(new pc.Color(.34, .14, .07)) : frame;
      const light = powerMaterial(ember ? new pc.Color(1, .19, .025) : depths ? new pc.Color(.64, .28, 1)
        : portal.kind === "entry" ? new pc.Color(.45, 1, .65) : victory ? new pc.Color(1, .88, .42) : new pc.Color(1, .75, .25), victory || depths || ember ? .82 : .6);
      addBox(root, "left-arch", frame, [.35, 2.9, .4], [-1, 1.45, 0]);
      addBox(root, "right-arch", frame, [.35, 2.9, .4], [1, 1.45, 0]);
      addBox(root, "arch-crown", frame, [2.35, .35, .4], [0, 2.8, 0]);
      const glow = addBox(root, "portal-light", light, [1.65, 2.35, .12], [0, 1.5, 0]);
      const runes: pc.Entity[] = [];
      for (let i = 0; i < 6; i++) runes.push(addBox(root, "rune", light, [.15, .15, .46], [i % 2 ? 1 : -1, .45 + Math.floor(i / 2) * .8, 0]));
      const motes: pc.Entity[] = [];
      let orbit: pc.Entity | null = null;
      let portalLight: pc.Entity | null = null;
      if (ember) {
        addBox(root, "forge-threshold", frame, [3.4, .24, 1.75], [0, .12, 0]);
        addBox(root, "forge-threshold-inlay", trim, [2.72, .12, 1.28], [0, .27, 0]);
        addBox(root, "left-buttress", frame, [.72, 1.15, .9], [-1.35, .58, 0]);
        addBox(root, "right-buttress", frame, [.72, 1.15, .9], [1.35, .58, 0]);
        for (const side of [-1, 1]) {
          const horn = addBox(root, "forge-crown-horn", trim, [.36, 1.28, .5], [side * 1.03, 3.25, 0]);
          horn.setLocalEulerAngles(0, 0, side * -34);
          addBox(root, "forge-rune-rail", light, [.1, 2.25, .5], [side * .78, 1.5, .02]);
        }
        for (let i = 0; i < 7; i++) {
          const x = -.66 + i * .22;
          addBox(root, "molten-veil", light, [.09, 2.18 - Math.abs(i - 3) * .07, .08], [x, 1.48, .01]);
        }
        orbit = new pc.Entity("ember-rune-orbit"); root.addChild(orbit);
        for (let i = 0; i < 12; i++) {
          const angle = i / 12 * Math.PI * 2;
          const rune = addBox(orbit, "orbiting-forge-rune", light, [.12, .12, .18], [Math.cos(angle) * .72, 1.5 + Math.sin(angle) * 1.04, .16]);
          rune.setLocalEulerAngles(0, 0, -angle * 180 / Math.PI);
        }
        for (let i = 0; i < 14; i++) {
          const mote = addBox(root, "ember-mote", light, [.045, .045, .045], [0, 0, 0]);
          if (mote.render) mote.render.castShadows = false;
          motes.push(mote);
        }
        portalLight = new pc.Entity("ember-portal-light");
        portalLight.addComponent("light", { type: "omni", color: new pc.Color(1, .18, .025), intensity: 2.2, range: 10, castShadows: false });
        portalLight.setLocalPosition(0, 1.55, .5); root.addChild(portalLight);
      }
      root.setPosition(portal.x, portal.y, portal.z); app.root.addChild(root);
      const label = document.createElement("button"); label.className = "forest-portal-label";
      label.classList.toggle("ember-portal-label", ember);
      label.addEventListener("click", event => { event.stopPropagation(); room?.send("portal:use", { id }); }); document.body.append(label);
      visual = { root, glow, label, state: portal, materials: trim === frame ? [frame, light] : [frame, trim, light], ember, runes, motes, orbit, portalLight }; forestPortalVisuals.set(id, visual);
    }
    visual.state = portal;
    const distance = Math.hypot(player.x - portal.x, player.z - portal.z);
    const active = worldReady && (portal.expiresAt === 0 || now < portal.expiresAt);
    visual.root.enabled = active && distance < 45;
    const victory = id === "forest-victory";
    const animationNow = performance.now();
    const pulse = victory ? Math.sin(animationNow / 220) * .1 : Math.sin(animationNow / 600) * .04;
    const emberUnlocked = true;
    visual.glow.setLocalScale(victory ? 1.08 : visual.ember ? .94 + Math.sin(animationNow / 260) * .045 : 1,
      visual.ember ? .98 + Math.sin(animationNow / 390) * .035 : .96 + pulse, victory ? 1.08 : 1);
    if (visual.ember) {
      visual.orbit?.setLocalEulerAngles(0, 0, animationNow * .018);
      visual.portalLight?.light && (visual.portalLight.light.intensity = emberUnlocked ? 2.25 + Math.sin(animationNow / 240) * .35 : .65);
      visual.runes.forEach((rune, index) => rune.setLocalScale(1 + Math.sin(animationNow / 210 + index) * .22, 1 + Math.sin(animationNow / 210 + index) * .22, 1));
      visual.motes.forEach((mote, index) => {
        const phase = animationNow / (920 + index * 23) + index * 1.77;
        const rise = (animationNow / (1450 + index * 29) + index / visual.motes.length) % 1;
        mote.setLocalPosition(Math.sin(phase) * (.45 + index % 4 * .18), .3 + rise * 2.7, .24 + Math.cos(phase * 1.4) * .18);
        const moteScale = emberUnlocked ? .72 + (1 - rise) * .75 : .35;
        mote.setLocalScale(moteScale, moteScale, moteScale);
      });
      visual.label.classList.toggle("locked", !emberUnlocked);
    }
    const screen = camera.camera!.worldToScreen(new pc.Vec3(portal.x, portal.y + 3.3, portal.z));
    const rect = canvas.getBoundingClientRect();
    visual.label.hidden = !active || distance > 25 || screen.z <= 0 || screen.x < 0 || screen.x > rect.width || screen.y < 0 || screen.y > rect.height;
    visual.label.style.left = `${rect.left + screen.x}px`; visual.label.style.top = `${rect.top + screen.y}px`;
    const testEntry = id === "ember-entry" || id === "depths-entry";
    const reachable = testEntry
      ? defeatScreen.hidden && active && Math.abs(player.y - portal.y) <= 3 && distance <= 3.5
      : canUseForestPortal({ ...player, health: defeatScreen.hidden ? 1 : 0 }, portal, now);
    visual.label.disabled = !reachable;
    const portalName = id === "ember-entry" ? "THE EMBER VAULT" : id === "ember-return" ? "RETURN TO FRONTIER"
      : id === "depths-entry" ? "THE SILVER DEPTHS" : id === "depths-return" ? "RETURN TO TOWN"
      : portal.kind === "entry" ? "FOREST DUNGEON" : victory ? "VICTORY PORTAL" : "RETURN TO WILDERNESS";
    const testState = id === "depths-entry" ? "\nE TO ENTER / ASSEMBLE PARTY" : testEntry ? "\nTEST ACCESS · E TO ENTER" : "";
    const text = `${portalName}${testState}${portal.expiresAt ? ` · ${Math.max(0, Math.ceil((portal.expiresAt - now) / 1000))}s` : ""}${reachable && !testState ? ` · E TO ${portal.kind === "entry" ? "ENTER" : "RETURN"}` : ""}`;
    if (visual.label.textContent !== text) visual.label.textContent = text;
    if (active && reachable && distance < nearest) { nearest = distance; nearbyForestPortal = id; }
  });
}
function updateTarget(): void {
  updateForestPortals();
  updateRecoveryMarker();
  if (!camera.camera) return;
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const direction = end.clone().sub(start);
  const aimedHit = voxelRaycast(start, direction, camera.camera.farClip, readVisibleWorldBlock);
  const hit = aimedHit && undergroundKnown(aimedHit.x, localPlayer.getPosition().y, aimedHit.z) ? aimedHit : null;
  const player = localPlayer.getPosition();
  const caveSignScreen = camera.camera.worldToScreen(new pc.Vec3(32.5, 8.4, 8.5));
  caveEntranceSign.hidden = !worldReady || player.y < SURFACE_HEIGHT || Math.hypot(player.x - 32.5, player.z - 8.5) > 20 || caveSignScreen.z < 0;
  if (!caveEntranceSign.hidden) {
    const bounds = canvas.getBoundingClientRect();
    caveEntranceSign.style.left = `${bounds.left + caveSignScreen.x * bounds.width / canvas.width}px`;
    caveEntranceSign.style.top = `${bounds.top + caveSignScreen.y * bounds.height / canvas.height}px`;
  }
  const blacksmithNearby = worldReady && room !== null && canTradeAtBlacksmithStall(player, sceneDressing.blacksmithVisible);
  const expeditionBoardNearby = worldReady && room !== null && Math.abs(player.y - TOWN_EXPEDITION_BOARD_POSITION.y) <= 1.6
    && Math.hypot(player.x - TOWN_EXPEDITION_BOARD_POSITION.x, player.z - TOWN_EXPEDITION_BOARD_POSITION.z) <= 3;
  const chestNearby = worldReady && room !== null && sceneDressing.blacksmithVisible && isAtTownStorage(player);
  storagePrompt.hidden = !chestNearby || !inventoryPanel.hidden || !blacksmithPanel.hidden || !quizPanel.hidden;
  if (!storagePrompt.hidden) {
    const chest = TOWN_STORAGE_CHEST_POSITION;
    const screen = camera.camera.worldToScreen(new pc.Vec3(chest.x, chest.y + 1.6, chest.z));
    const rect = canvas.getBoundingClientRect();
    storagePrompt.style.left = `${rect.left + screen.x * rect.width / canvas.width}px`;
    storagePrompt.style.top = `${rect.top + screen.y * rect.height / canvas.height}px`;
  }
  blacksmithPrompt.hidden = !blacksmithNearby || !blacksmithPanel.hidden || chestNearby;
  if (!blacksmithPrompt.hidden) {
    const screen = camera.camera.worldToScreen(new pc.Vec3(BLACKSMITH_STALL.x, 10.35, BLACKSMITH_STALL.z));
    const rect = canvas.getBoundingClientRect();
    blacksmithPrompt.style.left = `${rect.left + screen.x * rect.width / canvas.width}px`;
    blacksmithPrompt.style.top = `${rect.top + screen.y * rect.height / canvas.height}px`;
  }
  const quizTableNearby = canPlayAtTavernTable(player, sceneDressing.keeperVisible);
  quizTablePrompt.hidden = !quizTableNearby || !quizPanel.hidden;
  if (!quizTablePrompt.hidden) {
    const screen = camera.camera.worldToScreen(new pc.Vec3(TAVERN_QUIZ_TABLE.x, 9.5, TAVERN_QUIZ_TABLE.z));
    const rect = canvas.getBoundingClientRect();
    quizTablePrompt.style.left = `${rect.left + screen.x * rect.width / canvas.width}px`;
    quizTablePrompt.style.top = `${rect.top + screen.y * rect.height / canvas.height}px`;
  }
  const keeperNearby = canTalkToTavernKeeper(player, sceneDressing.keeperVisible);
  if (!keeperNearby && !tavernDialogue.hidden) closeTavernDialogue();
  const availability = hit ? miningAvailability(player, hit) : null;
  const inRange = availability !== "far";
  currentTarget = inRange ? hit : null;
  const combatMob = nearestLivingMob(player, WEAPON_ATTACK_DEFINITIONS[localMainHandId].range);
  targetMarker.enabled = worldReady && interactionMode === "build" && Boolean(hit);
  if (hit) targetMarker.setPosition(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

  const targetKey = currentTarget ? `${currentTarget.x},${currentTarget.y},${currentTarget.z}` : "none";
  const combatMark = combatMob ? visibleMarkState(combatMob.visual) : null;
  const combatKey = combatMob ? `${combatMob.id}:${combatMob.visual.state.health}:${combatMob.visual.state.combatState}:${combatMob.visual.state.aimCommitted}:${combatMark?.stacks ?? 0}` : "none";
  const chopping = currentTarget?.block === Block.OakLog || currentTarget?.block === Block.Leaves;
  const nearbyLoot = nearestLootDrop();
  updatePlayerTradePrompt(Boolean(nearbyLoot || nearbyForestPortal || expeditionBoardNearby || blacksmithNearby || quizTableNearby || keeperNearby || chestNearby));
  const nextKey = `${interactionMode}:${targetKey}:${currentTarget?.block ?? -1}:${availability}:${combatKey}:${keeperNearby}:${quizTableNearby}:${blacksmithNearby}:${expeditionBoardNearby}:${nearbyLoot}:${nearbyForestPortal}`;
  if (nextKey === targetStateKey) return;
  targetStateKey = nextKey;
  const tint = availability === "ready" ? hit?.block === Block.SilverOre ? new pc.Color(0.55, 0.88, 1) : new pc.Color(1, 0.73, 0.25) : new pc.Color(1, 0.25, 0.2);
  targetMaterial.diffuse = tint;
  targetMaterial.emissive = tint.clone().mulScalar(0.3);
  targetMaterial.opacity = 0.2;
  targetMaterial.update();
  mineButton.textContent = nearbyLoot ? "Loot" : nearbyForestPortal ? "Portal" : expeditionBoardNearby ? "Board" : blacksmithNearby ? "Trade" : quizTableNearby ? "Play" : keeperNearby ? "Talk" : interactionMode === "build" ? chopping ? "Chop" : "Mine" : "Attack";
  if (nearbyLoot) {
    const drop = lootVisuals.get(nearbyLoot)?.state;
    const itemName = drop && isItemId(drop.itemId) ? ITEM_DEFINITIONS[drop.itemId].name : "Loot";
    const quantity = drop && drop.quantity > 1 ? `${drop.quantity}× ` : "";
    targetLabel.textContent = nearbyLoot.startsWith("forest-cache:")
      ? "Personal Rootbound Cache · press E or Loot to claim"
      : drop && isEnemyLootBag(drop)
        ? `${LOOT_BAG_TIER_LABEL[lootBagTierForItems(lootItems(drop))]} · press E to collect everything that fits`
      : drop && lootWouldOverflow(nearbyLoot, drop)
        ? `${itemName} · inventory full`
      : `${quantity}${itemName} · press E or Loot to pick up`;
  }
  else if (nearbyForestPortal) targetLabel.textContent = "Glowing portal · press E or Portal to travel";
  else if (expeditionBoardNearby) targetLabel.textContent = "Forest Dungeon Gate · press E to open a solo or party run";
  else if (blacksmithNearby) targetLabel.textContent = "Blacksmith stall · press E to trade ore or forge equipment";
  else if (quizTableNearby) targetLabel.textContent = "Double or Quit table · press E or Play";
  else if (keeperNearby) targetLabel.textContent = `${TAVERN_KEEPER.name} · Tavernkeeper — press E or Talk`;
  else if (interactionMode === "combat" && combatMob) {
    const intent = combatMob.visual.state.combatState === "windup"
      ? combatMob.visual.state.aimCommitted ? " · AIM LOCKED — DODGE OR MOVE CLEAR" : " · ATTACK WINDUP"
      : combatMob.visual.state.combatState === "strike"
        ? " · STRIKE ACTIVE — DODGE"
        : combatMob.visual.state.combatState === "recover"
          ? " · RECOVERING — COUNTER"
          : combatMob.visual.state.combatState === "stagger" ? " · STAGGERED" : "";
    const markLabel = combatMark
      ? combatMark.stacks >= combatMark.maxStacks
        ? ` · EXPOSED ${combatMark.stacks}/${combatMark.maxStacks}`
        : ` · HUNT ${combatMark.stacks}/${combatMark.maxStacks}`
      : "";
    targetLabel.textContent = `${combatMob.visual.state.name}: ${combatMob.visual.state.health}/${combatMob.visual.state.maxHealth} HP · ${combatMob.distance.toFixed(1)}m${markLabel}${intent}`;
  } else if (interactionMode === "combat") targetLabel.textContent = `${MAIN_HAND_DEFINITIONS[localMainHandId].name}: aim toward the Moss Crawler and attack`;
  else if (availability === "far") targetLabel.textContent = "Out of reach · move closer (4.5m reach)";
  else if (availability === "unbreakable") targetLabel.textContent = "Bedrock · cannot be mined";
  else if (!currentTarget) targetLabel.textContent = "Target: move near a block and point at it";
  else if (isProtectedVoxel(currentTarget.x, currentTarget.z)) targetLabel.textContent = `Target: ${targetKey} · protected`;
  else if (currentTarget.block === Block.OakLog) targetLabel.textContent = `Greenwood oak · ${targetKey} · chop for timber`;
  else if (currentTarget.block === Block.IronOre || currentTarget.block === Block.SilverOre || currentTarget.block === Block.MoonstoneOre) {
    const moonstone = currentTarget.block === Block.MoonstoneOre;
    const silver = currentTarget.block === Block.SilverOre;
    targetLabel.textContent = moonstone ? "Moonstone seal · dungeon reward mineral · click to mine"
      : `${silver ? "Silver" : "Iron"} deposit · ${silver ? SILVER_ORE_GOLD_PRICE : IRON_ORE_GOLD_PRICE} gold per ore · click to mine`;
  }
  else if (currentTarget.block === Block.Leaves) targetLabel.textContent = `Greenwood canopy · ${targetKey} · clear foliage`;
  else targetLabel.textContent = `Target: ${targetKey} · mineable`;
}

let lastChunkBuildMs = 0;
let worldPayloadBytes = 0;
let networkRttMs: number | null = null;

function renderBootstrap(payload: WorldBootstrap): void {
  caveDiscoverySampleKey = "";
  caveFogViewKey = "";
  caveDiscoveryRevision++;
  miningSwing = null;
  pendingMine = null;
  miningHud.hidden = true;
  closeTavernDialogue();
  blacksmithPanel.hidden = true;
  inventoryPanel.hidden = true;
  inventoryToggle.setAttribute("aria-expanded", "false");
  const buildStartedAt = performance.now();
  const previousSliceY = cutawaySliceY;
  worldPayloadBytes = new Blob([JSON.stringify(payload)]).size;
  for (const chunk of chunks.values()) for (const mesh of chunk.meshes) mesh.destroy();
  for (const child of [...worldRoot.children]) child.destroy();
  chunks.clear();
  payload.chunks.forEach(installChunk);
  const ownPlayer = room ? (room.state as { players?: { get(id: string): NetworkPlayer | undefined } }).players?.get(room.sessionId) : undefined;
  // The bootstrap is the authoritative arrival snapshot. The schema player can
  // still represent a different patch when a newly created room first joins.
  const initialPose = townReturnPosition ?? payload.spawn;
  const statePoseGap = ownPlayer
    ? Math.hypot(ownPlayer.x - payload.spawn.x, ownPlayer.y - payload.spawn.y, ownPlayer.z - payload.spawn.z)
    : null;
  townReturnPosition = null;
  const initialPosition = new pc.Vec3(initialPose.x, initialPose.y, initialPose.z);
  localPlayer.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
  authoritativeLocalPosition.set(initialPosition.x, initialPosition.y, initialPosition.z);
  cameraFocus.set(initialPosition.x, initialPosition.y, initialPosition.z);
  cameraFollow = { x: initialPosition.x, z: initialPosition.z };
  const cameraOffset = cameraOrbitOffset(cameraOrbit);
  camera.setPosition(initialPosition.x + cameraOffset.x, initialPosition.y - 2 + cameraOffset.y, initialPosition.z + cameraOffset.z);
  camera.lookAt(initialPosition.x, initialPosition.y - 2, initialPosition.z);
  localVerticalVelocity = 0;
  localVisualVerticalOffset = 0;
  localNetworkVisualOffset = { x: 0, z: 0 };
  localRecoveryVisualOffset = { x: 0, z: 0 };
  localDodgeVisualOffset = { x: 0, z: 0 };
  localDodgeRequestedAt = Number.NEGATIVE_INFINITY;
  pendingPredictionFrames.length = 0;
  smoothedMovement = { x: 0, z: 0 };
  lastSentMovement = { x: 0, z: 0 };
  pendingStopInputSequence = null;
  localPowerVisualOffset.set(0, 0, 0);
  localPlayerVisual.setLocalPosition(0, 0, 0);
  surfaceReferenceY = SURFACE_HEIGHT + 1;
  indoorRoofBuilding = roofCutawayBuilding(initialPosition, null, TOWN_BUILDINGS, surfaceReferenceY);
  indoorCameraBlend = indoorRoofBuilding ? 1 : 0;
  const bootstrapUnderground = indoorRoofBuilding === null && hasCeilingAbove(initialPosition);
  const bootstrapExcavating = indoorRoofBuilding === null && !bootstrapUnderground && isInOpenExcavation(initialPosition);
  cutawaySliceY = bootstrapSliceHeight(
    previousSliceY,
    initialPosition.y,
    surfaceReferenceY,
    bootstrapUnderground,
    bootstrapExcavating,
  );
  playerCutaway.active = cutawaySliceY !== null;
  playerCutaway.sliceY = cutawaySliceY ?? CHUNK_HEIGHT;
  cutawayStateKey = cutawaySliceY === null ? "surface" : `slice:${cutawaySliceY}`;
  surfaceReturnStartedAt = null;
  surfaceRestoreStartSliceY = null;
  undergroundLightingBlend = playerCutaway.active ? 1 : 0;
  exitTrail.enabled = playerCutaway.active;
  exitGuide.hidden = !playerCutaway.active;
  activeChunkViewKey = null;
  updateActiveChunkMeshes(initialPosition);
  const initialChunk = worldToChunk(initialPosition.x, initialPosition.z);
  const initialChunkKey = chunkKey(initialChunk.chunkX, initialChunk.chunkZ);
  requestedChunkRegionKey = chunks.has(initialChunkKey) ? initialChunkKey : null;
  sceneDressing.rebuild(readWorldBlock, payload.chunks, indoorRoofBuilding);
  sceneDressing.setSurfaceVisible(!playerCutaway.active);
  lastChunkBuildMs = performance.now() - buildStartedAt;
  logMovementEvent(
    `WORLD REFRESH ${previousSliceY === null ? "surface" : `slice:${previousSliceY}`} → ${cutawayStateKey} y=${initialPosition.y.toFixed(3)} surface=${surfaceReferenceY.toFixed(3)} stateGap=${statePoseGap?.toFixed(3) ?? "missing"} chunks=${payload.chunks.length} build=${lastChunkBuildMs.toFixed(1)}ms`,
  );
  worldReady = true;
  status.textContent = isInGreenwoodRegion(initialPosition.x, initialPosition.z)
    ? "Greenwood Outskirts · harvest oak timber and investigate the abandoned forester camp."
    : "Welcome to the Town of Beginnings. The mine road leaves through the east gate.";
}

const keys = new Set<string>();
let awaitingReturnState = false;
let townReturnPosition: { x: number; y: number; z: number } | null = null;
const defeatScreen = document.querySelector<HTMLElement>("#defeat-screen")!;
const defeatTitle = document.querySelector<HTMLElement>("#defeat-title")!;
const returnToTownButton = document.querySelector<HTMLButtonElement>("#return-to-town")!;
const defeatDetail = document.querySelector<HTMLElement>("#defeat-detail")!;
let latestDepthsPartyStatus: SilverDepthsPartyStatus | null = null;
function depthsStageName(stage: number): string {
  return stage >= 4 ? "Matriarch approach" : stage === 3 ? "Crystal Antechamber"
    : stage === 2 ? "chosen wing" : "Moonstone Gallery";
}
function renderDepthsPartyStatus(next: SilverDepthsPartyStatus | null): void {
  latestDepthsPartyStatus = next;
  depthsPartyPanel.hidden = !next || next.phase === "cleared";
  if (!next) return;
  depthsPartyCount.textContent = next.phase === "wiped" ? "PARTY WIPED"
    : `${next.activeCount} / ${next.partySize} FIGHTING`;
  depthsPartyPanel.dataset.alert = String(next.phase === "wiped" || next.members.some(member => member.state === "fallen"));
  depthsPartyMembers.textContent = next.members.map(member => `${member.name}: ${member.state.toUpperCase()}`).join(" · ");
  if (defeatScreen.hidden) return;
  if (next.members.find(member => member.id === room?.sessionId)?.state === "fighting") return;
  if (next.phase === "wiped") {
    defeatTitle.textContent = "Party wiped";
    defeatDetail.textContent = `The party fell at the ${depthsStageName(next.stage)}. Your permanent gear and gold are safe. Return to town beside the Silver Depths portal to regroup and try again.`;
    returnToTownButton.textContent = "Return to Town · Retry";
  } else if (next.phase === "active") {
    defeatTitle.textContent = next.activeCount > 0 ? "You fell — party still fighting" : "You fell — party reconnecting";
    defeatDetail.textContent = next.activeCount > 0
      ? `${next.activeCount} teammate${next.activeCount === 1 ? " is" : "s are"} still fighting. Returning to town will not reset their run. Your permanent gear and gold are safe.`
      : "A teammate is reconnecting; their place is held briefly. Returning to town will not reset their run. Your permanent gear and gold are safe.";
  }
}
function clearDefeatCombat(): void {
  keys.clear(); touchStrafe = 0; touchForward = 0;
  smoothedMovement = { x: 0, z: 0 };
  cancelPowerAim(); cancelSpecialAim(); cancelLocalPowerPresentation();
  setDefensePresentation(false);
  localActionStartedAt = null;
  localDodgeStartedAt = null;
  localDodgeRequestedAt = Number.NEGATIVE_INFINITY;
  localHitPauseUntil = 0;
  localComboStep = 0; localComboExpiresAt = 0;
  pendingPredictionFrames.length = 0;
  pendingStopInputSequence = null;
  cameraShakeUntil = 0; cameraShakeStrength = 0;
  localVerticalVelocity = 0;
  localVisualVerticalOffset = 0;
  localNetworkVisualOffset = { x: 0, z: 0 };
  localRecoveryVisualOffset = { x: 0, z: 0 };
  localDodgeVisualOffset = { x: 0, z: 0 };
  localPowerVisualOffset.set(0, 0, 0);
  if (room) {
    for (const mob of mobVisuals.values()) mob.marks.delete(room.sessionId);
    powerTelegraphs.get(room.sessionId)?.root.destroy();
    powerTelegraphs.delete(room.sessionId);
    brambleSnareVisuals.get(room.sessionId)?.root.destroy();
    brambleSnareVisuals.delete(room.sessionId);
  }
}
function showDefeat(attackerName: string): void {
  closeLoot();
  clearDefeatCombat();
  quizPanel.hidden = true; blacksmithPanel.hidden = true; setInventoryOpen(false); closeTavernDialogue();
  defeatDetail.textContent = `${attackerName} defeated you. Carried minerals stay in your personal recovery bag. Levels, equipment, other loot, gold, supplies and chest contents are safe. Return to town, then follow your bag marker.`;
  defeatTitle.textContent = "You were defeated";
  defeatScreen.hidden = false;
  returnToTownButton.disabled = !room;
  returnToTownButton.textContent = "Return to Town";
  if (activeRoomName === SILVER_DEPTHS_ROOM && latestDepthsPartyStatus) renderDepthsPartyStatus(latestDepthsPartyStatus);
  returnToTownButton.focus();
}
returnToTownButton.addEventListener("click", () => {
  if (!room) return;
  returnToTownButton.disabled = true;
  returnToTownButton.textContent = "Returning…";
  room.send("player:return");
});
window.addEventListener("keydown", event => {
  if (!defeatScreen.hidden || !levelUpPanel.hidden) return;
  if (tradeUI.isOpen() || playerInteractionUI.isOpen()) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.code.startsWith("Arrow")) event.preventDefault();
  keys.add(event.code);
});
window.addEventListener("keyup", event => {
  if (event.code.startsWith("Arrow")) event.preventDefault();
  keys.delete(event.code);
});

performanceToggle.addEventListener("click", () => {
  const opening = performancePanel.hidden;
  performancePanel.hidden = !opening;
  performanceToggle.setAttribute("aria-expanded", String(opening));
});

window.addEventListener("keydown", event => {
  if (event.code !== "KeyP" || event.repeat) return;
  performanceToggle.click();
});
window.addEventListener("keydown", event => {
  if (event.code !== "KeyM" || event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  event.preventDefault();
  minimapPanel.open = !minimapPanel.open;
});

let touchStrafe = 0;
let touchForward = 0;
let joystickPointerId: number | null = null;

function updateJoystick(clientX: number, clientY: number): void {
  const bounds = joystickZone.getBoundingClientRect();
  const radius = bounds.width * 0.34;
  let offsetX = clientX - (bounds.left + bounds.width / 2);
  let offsetY = clientY - (bounds.top + bounds.height / 2);
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > radius) {
    offsetX = offsetX / distance * radius;
    offsetY = offsetY / distance * radius;
  }
  touchStrafe = offsetX / radius;
  touchForward = offsetY / radius;
  joystickKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

function releaseJoystick(pointerId: number): void {
  if (pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  touchStrafe = 0;
  touchForward = 0;
  joystickKnob.style.transform = "translate(-50%, -50%)";
}

joystickZone.addEventListener("pointerdown", event => {
  joystickPointerId = event.pointerId;
  joystickZone.setPointerCapture(event.pointerId);
  updateJoystick(event.clientX, event.clientY);
});
joystickZone.addEventListener("pointermove", event => {
  if (event.pointerId === joystickPointerId) updateJoystick(event.clientX, event.clientY);
});
joystickZone.addEventListener("pointerup", event => releaseJoystick(event.pointerId));
joystickZone.addEventListener("pointercancel", event => releaseJoystick(event.pointerId));

let room: Room | null = null;
let movementShadowInput: InputHandle<{ strafe: number; forward: number; yaw: number }> | null = null;
let movementPilotRequested = false;
let movementPilotReady = false;
let movementPilotController: { tick: (now: number) => number; pose: () => { x: number; y: number; z: number; pilotVy: number } } | null = null;
let pendingPilotPoseCandidate: PilotPose | null = null;
let movementShadowAccumulator = 0;
let movementShadowDifference: number | null = null;
let movementShadowReset = false;
const movementShadowDifferences: number[] = [];
function activateMovementPilot(joinedRoom: Room): void {
  if (!movementPilotReady || movementPilotController || !movementShadowInput) return;
  const playerState = (joinedRoom.state as { players: Map<string, NetworkPlayer> }).players.get(joinedRoom.sessionId);
  if (!playerState) return;
  const predictor = Predict.get(joinedRoom);
  const controller = predictor.reconciler(playerState, {
    input: movementShadowInput,
    fields: ["x", "y", "z", "pilotVy"],
    step: (ctx, state, command) => {
      const next = stepPlayerNetcode({ x: state.x, y: state.y, z: state.z, verticalVelocity: state.pilotVy },
        command, localMovementSpeed(), ctx.dt, readCollisionWorldBlock);
      state.x = next.x; state.y = next.y; state.z = next.z; state.pilotVy = next.verticalVelocity;
    },
    smoothMs: 65,
  });
  movementPilotController = { tick: now => predictor.tick(now), pose: () => controller.state };
  pendingPilotPoseCandidate = null;
  localPlayer.setPosition(playerState.x, playerState.y, playerState.z);
  localVerticalVelocity = playerState.pilotVy;
  localNetworkVisualOffset = { x: 0, z: 0 };
  localRecoveryVisualOffset = { x: 0, z: 0 };
  localDodgeVisualOffset = { x: 0, z: 0 };
  pendingPredictionFrames.length = 0;
  logMovementEvent("COLYSEUS CONTROLLING MOVEMENT");
}
minimap.setPingHandler((x, z) => {
  if (activeRoomName === SILVER_DEPTHS_ROOM && room) room.send("depths:ping", { x, z });
});
let activeRoomName: typeof WORLD_ROOM | typeof SILVER_DEPTHS_ROOM = WORLD_ROOM;
let currentWorldObjective: WorldObjectiveUpdate | null = null;
let objectiveCompleteTimer = 0;
let worldReady = false;
let lastMoveSentAt = 0;
let moveSequence = 0;
let mineSequence = 0;
let attackSequence = 0;
let dodgeSequence = 0;
let localVerticalVelocity = 0;
let cutawayStateKey = "surface";
let cutawaySliceY: number | null = null;
let surfaceReferenceY: number | null = null;
let surfaceReturnStartedAt: number | null = null;
let surfaceRestoreStartSliceY: number | null = null;
let undergroundLightingBlend = 0;
let greenwoodLightingBlend = 0;
let forestDungeonLightingBlend = 0;
let silverDepthsLightingBlend = 0;
let emberVaultLightingBlend = 0;
let activeSilverDepthsZone: SilverDepthsZone | null = null;
let lastDepthsAtmosphereCueAt = -Infinity;
const depthsAmbient = { r: .18, g: .16, b: .18 };
const depthsFog = { r: .065, g: .055, b: .095 };
let depthsFogStart = 20;
let depthsFogEnd = 40;
const forestDungeonAmbient = { r: .2, g: .31, b: .22 };
const forestDungeonFog = { r: .075, g: .17, b: .105 };
let forestDungeonFogStart = 25;
let forestDungeonFogEnd = 47;
let undergroundClassification = false;
let excavationClassification = false;
let surfaceReturnClassification = false;
let smoothedMovement = { x: 0, z: 0 };
let lastSentMovement = { x: 0, z: 0 };
let lastMovementDebugUpdateAt = 0;
const movementEventLog: string[] = [];

function renderWorldObjective(update: WorldObjectiveUpdate): void {
  const changedObjective = currentWorldObjective?.objectiveId !== update.objectiveId;
  currentWorldObjective = update;
  const mapOnlyEncounter = update.kind === "encounter";
  worldObjective.hidden = mapOnlyEncounter;
  const mapThreat = update.kind === "encounter" || update.kind === "miniboss";
  minimap.setThreatState(mapThreat ? {
    x: update.targetX,
    y: update.targetY,
    z: update.targetZ,
    name: update.title,
  } : null);
  if (changedObjective || update.showMarker === false) objectiveMarker.hidden = update.showMarker === false;
  const recommendation = update.recommendedLevel ?? worldLevelRange(update.tier).label;
  objectiveTier.textContent = `${update.progressLabel?.startsWith("REALM THREAT") || update.progressLabel === "REALM BOSS" ? "REALM" : update.kind === "miniboss" ? "AREA MINI-BOSS" : update.kind === "hub" ? "SAFE TOWN" : update.kind === "portal" ? "PORTAL" : update.kind === "loot" ? "PERSONAL LOOT" : update.kind === "explore" ? "WILDERNESS" : update.progressLabel ? "DUNGEON" : "THREAT"} · ${recommendation}`;
  objectiveTitle.textContent = update.title;
  objectiveDetail.textContent = update.detail;
  objectiveLoot.hidden = !update.lootHint;
  objectiveLoot.textContent = update.lootHint ?? "";
  objectiveProgress.hidden = !update.progressLabel && (update.kind !== "encounter" || update.targetMobIds.length === 0);
  objectiveProgress.textContent = update.progressLabel ?? `${update.targetMobIds.length - update.completedMobIds.length} remaining`;
  objectiveDistance.hidden = update.showMarker === false;
  objectiveMarkerLabel.textContent = update.title.toUpperCase();
  objectiveMarker.dataset.kind = update.kind ?? "encounter";
  objectiveMarker.querySelector("i")!.textContent = objectiveIcon(update.kind);
  if (mapOnlyEncounter) objectiveMarker.hidden = true;
}

function showObjectiveComplete(message: WorldObjectiveCompleted): void {
  window.clearTimeout(objectiveCompleteTimer);
  objectiveCompleteTitle.textContent = message.title;
  objectiveCompleteReward.textContent = message.rewardLabel;
  objectiveComplete.hidden = false;
  objectiveComplete.animate(
    [{ opacity: 0, transform: "translate(-50%, -40%) scale(.92)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }],
    { duration: 260, easing: "ease-out" },
  );
  objectiveCompleteTimer = window.setTimeout(() => { objectiveComplete.hidden = true; }, 2700);
  showCombatFeedback(message.coinsGranted > 0 ? `+${message.coinsGranted} GOLD` : "REWARD SECURED", "dodge");
}

function updateObjectiveGuidance(): void {
  const objective = currentWorldObjective;
  if (!objective || !camera.camera) return;
  if (objective.kind === "encounter") { objectiveMarker.hidden = true; return; }
  if (objective.showMarker === false) { objectiveMarker.hidden = true; return; }
  const trackedMob = mobVisuals.get(objective.targetMobId);
  const targetPosition = trackedMob?.state.alive
    ? trackedMob.entity.getPosition()
    : new pc.Vec3(objective.targetX, objective.targetY, objective.targetZ);
  const playerPosition = localPlayer.getPosition();
  const distance = Math.hypot(targetPosition.x - playerPosition.x, targetPosition.z - playerPosition.z);
  const distanceLabel = `${Math.max(0, Math.round(distance))}m`;
  objectiveDistance.textContent = distanceLabel;
  objectiveMarkerDistance.textContent = distanceLabel;
  const screen = camera.camera.worldToScreen(targetPosition);
  const { hidden, onScreen, x, y, angle } = objectiveGuidance(screen, window.innerWidth, window.innerHeight, distance, objectiveMarker.hidden === true);
  objectiveMarker.hidden = hidden;
  objectiveMarker.style.left = `${x}px`;
  objectiveMarker.style.top = `${y}px`;
  objectiveMarker.style.setProperty("--marker-rotation", onScreen ? "0deg" : `${angle}deg`);
  objectiveMarker.dataset.onscreen = String(onScreen);
}

let visibleDepthsRoute: DepthsRouteState | null = null;
let latestDepthsGateStatus: SilverDepthsGateStatus | null = null;
let depthsBreadcrumbRouteKey = "";
let depthsBreadcrumbRoute: DungeonMapRoute | null = null;
let depthsRouteFingerprint = "";
let depthsWingRewardStatus: SilverDepthsWingRewardStatus | null = null;
let lastDepthsCachePhase: SilverDepthsCacheStatus["phase"] | null = null;
let depthsCheckpointStatus: SilverDepthsCheckpointStatus | null = null;
function renderDepthsCheckpointStatus(next: SilverDepthsCheckpointStatus | null): void {
  depthsCheckpointStatus = next;
  depthsCheckpoint.hidden = next?.phase !== "waiting";
  if (!next) return;
  depthsCheckpointCount.textContent = `${next.readyCount} / ${next.partyTotal} READY`;
}
function renderDepthsWingRewards(next: SilverDepthsWingRewardStatus | null): void {
  const previous = depthsWingRewardStatus;
  depthsWingRewardStatus = next;
  depthsWingRewards.hidden = next === null;
  if (!next) return;
  depthsRewardsTitle.textContent = next.wing === "iron" ? "YOUR IRON BASTION REWARDS" : "YOUR SILVER ECHO REWARDS";
  depthsRewardOreName.textContent = `${next.oreQuantity} ${ITEM_DEFINITIONS[next.oreItemId].name}`;
  depthsRewardOreState.textContent = next.oreCollected ? "✓ COLLECTED" : "WALK OVER TO COLLECT";
  depthsRewardGearName.textContent = ITEM_DEFINITIONS[next.gearItemId].name;
  depthsRewardGearState.textContent = next.gearCollected ? "✓ CLAIMED" : "APPROACH · PRESS E";
  depthsRewardOreState.classList.toggle("collected", next.oreCollected);
  depthsRewardGearState.classList.toggle("collected", next.gearCollected);
  depthsRewardParty.hidden = next.partyGearTotal <= 1;
  depthsRewardParty.textContent = next.partyGearClaimed === next.partyGearTotal
    ? `ALL ${next.partyGearTotal} PARTY GEAR REWARDS CLAIMED`
    : `PARTY GEAR CLAIMED ${next.partyGearClaimed} / ${next.partyGearTotal}`;
  depthsRewardParty.classList.toggle("collected", next.partyGearClaimed === next.partyGearTotal);
  if (next.gearCollected && previous && !previous.gearCollected && previous.wing === next.wing) {
    showCombatFeedback(`${ITEM_DEFINITIONS[next.gearItemId].name.toUpperCase()} SECURED`, "dodge");
  }
}
function updateSilverDepthsRoute(now: number): void {
  const player = localPlayer.getPosition();
  const inside = player.y < 6 && player.x >= SILVER_DEPTHS.minX - 1 && player.x <= SILVER_DEPTHS.maxX + 1
    && player.z >= SILVER_DEPTHS.minZ - 1 && player.z <= SILVER_DEPTHS.maxZ + 1;
  const guardAAlive = mobVisuals.get("silver-depths-spitter-a")?.state.alive ?? true;
  const guardBAlive = mobVisuals.get("silver-depths-spitter-b")?.state.alive ?? true;
  visibleDepthsRoute = inside ? silverDepthsRoute(localSilverDepthsRunStage, guardAAlive, guardBAlive, localSilverDepthsWing) : null;
  depthsWingChoice.hidden = !visibleDepthsRoute || localSilverDepthsRunStage !== 3 || localSilverDepthsWing !== null;
  depthsRouteMap.hidden = visibleDepthsRoute === null;
  if (depthsCheckpointStatus?.phase === "waiting" && visibleDepthsRoute) {
    const distanceToCheckpoint = Math.hypot(player.x - SILVER_DEPTHS_CHECKPOINT_POSITION.x,
      player.z - SILVER_DEPTHS_CHECKPOINT_POSITION.z);
    const nearby = distanceToCheckpoint <= 6 && Math.abs(player.y - SILVER_DEPTHS_CHECKPOINT_POSITION.y) <= 3;
    depthsCheckpointReady.disabled = depthsCheckpointStatus.selfReady || !nearby;
    depthsCheckpointReady.textContent = depthsCheckpointStatus.selfReady ? "READY · WAITING FOR PARTY" : "READY FOR MATRIARCH";
    depthsCheckpointHint.textContent = !nearby ? `Regroup at the checkpoint · ${Math.round(distanceToCheckpoint)}m away`
      : !depthsCheckpointStatus.rewardsCollected && !depthsCheckpointStatus.selfReady
        ? "Personal rewards remain in the wing. Collect them before Ready if you want them."
      : depthsCheckpointStatus.selfReady ? "Your party can ready up beside the checkpoint." : "Prepared? Press Ready to open the boss gate together.";
  }
  minimapPanel.hidden = false;
  depthsBreadcrumbRoot.enabled = visibleDepthsRoute !== null && latestDepthsGateStatus !== null && (localDepthsRewardFlags & 128) !== 0;
  if (!visibleDepthsRoute) { depthsRouteFingerprint = ""; depthsBreadcrumbRouteKey = ""; return; }
  const routeKey = latestDepthsGateStatus
    ? `${Math.floor(player.x)},${Math.floor(player.z)}:${Math.floor(visibleDepthsRoute.target.x)},${Math.floor(visibleDepthsRoute.target.z)}:${Object.values(latestDepthsGateStatus).join(",")}` : "";
  if (routeKey !== depthsBreadcrumbRouteKey) {
    depthsBreadcrumbRouteKey = routeKey;
    depthsBreadcrumbRoute = latestDepthsGateStatus ? silverDepthsMapRoute(player, visibleDepthsRoute.target, latestDepthsGateStatus) : null;
  }
  const distance = Math.hypot(visibleDepthsRoute.target.x - player.x, visibleDepthsRoute.target.z - player.z);
  const title = depthsCheckpointStatus?.phase === "waiting" ? "Regroup and Ready for the Matriarch" : visibleDepthsRoute.title;
  const fingerprint = `${visibleDepthsRoute.active}:${[...visibleDepthsRoute.completed].join(",")}:${title}`;
  if (fingerprint !== depthsRouteFingerprint) {
    depthsRouteFingerprint = fingerprint;
    depthsRouteTitle.textContent = title;
    depthsRouteCount.textContent = `${visibleDepthsRoute.completed.size} / 6 CLEARED`;
    for (const node of depthsRouteNodes) {
      const id = node.dataset.depthsNode!;
      node.classList.toggle("completed", visibleDepthsRoute.completed.has(id as DepthsNodeId));
      node.classList.toggle("active", visibleDepthsRoute.active === id);
      node.classList.toggle("uncharted", (localDepthsRewardFlags & 128) === 0
        && !visibleDepthsRoute.completed.has(id as DepthsNodeId) && visibleDepthsRoute.active !== id);
    }
  }
  depthsRouteDistance.textContent = distance <= 2 ? "ARRIVED" : `${Math.round(distance)}m TO NEXT`;
  const breadcrumbPositions = silverDepthsBreadcrumbPositions(player, depthsBreadcrumbRoute, depthsBreadcrumbs.length);
  for (let index = 0; index < depthsBreadcrumbs.length; index++) {
    const shard = depthsBreadcrumbs[index]!, point = breadcrumbPositions[index];
    shard.enabled = Boolean(point) && depthsBreadcrumbRoot.enabled;
    if (!point) continue;
    shard.setPosition(point.x,
      Math.max(1.16, player.y + .18) + Math.sin(now * .0035 + index * .9) * .11,
      point.z);
    const pulse = .78 + Math.sin(now * .005 + index) * .16;
    shard.setLocalScale(pulse, pulse, pulse);
    shard.rotate(0, .8, 0);
  }
}

const bossHud = document.querySelector<HTMLElement>("#boss-hud")!;
const bossEncounter = document.querySelector<HTMLElement>("#boss-encounter")!;
const bossName = document.querySelector<HTMLElement>("#boss-name")!;
const bossPhase = document.querySelector<HTMLElement>("#boss-phase")!;
const bossHealth = document.querySelector<HTMLElement>("#boss-health")!;
const bossHealthFill = document.querySelector<HTMLElement>("#boss-health-fill")!;
const bossHealthText = document.querySelector<HTMLElement>("#boss-health-text")!;
const bossNotice = document.querySelector<HTMLElement>("#boss-notice")!;
let bossHudState = initialBossHud();
let bossHudFingerprint = "";
let activeBossId = "";
function updateBossHud(now: number): void {
  const position = localPlayer.getPosition();
  const inSilverDepths = position.y < 5 && position.x >= 59 && position.x <= 78 && position.z >= 3 && position.z <= 16;
  const trackedMiniBossId = currentWorldObjective?.kind === "miniboss" ? currentWorldObjective.targetMobId : "";
  const nextBossId = inSilverDepths ? "crystal-matriarch" : isInForestDungeon(position.x, position.z) ? "forest-guardian" : activeRealmEventId || trackedMiniBossId || "greenwood-venom-matriarch";
  const boss = mobVisuals.get(nextBossId)?.state;
  if (activeBossId !== nextBossId) {
    activeBossId = nextBossId; bossHudState = initialBossHud(); bossHudFingerprint = "";
  }
  const previous = bossHudState;
  bossHudState = advanceBossHud(bossHudState, boss, { x: position.x, y: position.y, z: position.z, health: potionHealth }, now);
  const crystal = nextBossId === "crystal-matriarch";
  if (crystal && bossHudState.visible && boss?.alive && previous.alive !== true) {
    combatAudio.play("dungeonGate"); createDungeonBurst(boss.x, boss.z, "crystal", boss.y + .08);
  }
  if (crystal && bossHudState.visible && bossHudState.enraged && !previous.enraged) {
    combatAudio.play("guardianPhase"); createDungeonBurst(boss!.x, boss!.z, "crystal", boss!.y + .08);
    cameraShakeStrength = Math.max(cameraShakeStrength, .2); cameraShakeUntil = performance.now() + 360;
  }
  if (crystal && previous.alive === true && boss?.alive === false) {
    combatAudio.play("dungeonVictory"); createDungeonBurst(boss.x, boss.z, "victory", boss.y + .08);
  }
  if (nextBossId === "forest-guardian" && bossHudState.visible && bossHudState.enraged && !previous.enraged) {
    combatAudio.play("guardianPhase");
    if (boss) createDungeonBurst(boss.x, boss.z, "gate");
  }
  const fingerprint = JSON.stringify([bossHudState.visible, boss?.name, boss?.health, boss?.maxHealth, boss?.combatState, boss?.attackPattern, bossHudState.enraged, bossHudState.message]);
  if (fingerprint === bossHudFingerprint) return;
  bossHudFingerprint = fingerprint;
  bossHud.hidden = !bossHudState.visible;
  if (currentWorldObjective?.kind === "miniboss") worldObjective.hidden = bossHudState.visible;
  if (!boss || !bossHudState.visible) return;
  bossName.textContent = boss.name;
  const guardian = nextBossId === "forest-guardian";
  const realmBoss = /Realm Stone Warden/i.test(boss.name);
  const bruteEvent = /Stoneheart|Realm Stone Warden/i.test(boss.name);
  bossEncounter.textContent = boss.isMiniBoss ? "AREA MINI-BOSS" : crystal ? "SILVER DEPTHS BOSS" : guardian ? "FOREST DUNGEON BOSS" : realmBoss ? "REALM BOSS" : "SHARED WILDERNESS EVENT";
  bossPhase.textContent = !boss.alive ? "DEFEATED" : boss.isMiniBoss ? `${boss.combatState === "recover" ? "OPENING · COUNTER NOW" : `${boss.attackPattern.replaceAll("-", " ").toUpperCase()} · WATCH THE WARNING`}` : bossHudState.enraged ? `PHASE 2 · ${crystal ? "ROTATING CRYSTAL WAVES" : guardian ? "HEARTWOOD CHARGE" : bruteEvent ? "ENRAGED VOLLEYS" : "ENRAGED"}` : `PHASE 1 · ${crystal ? "AIMED SHOT / FAN" : guardian ? "ROOT VOLLEY" : bruteEvent ? "ROCK VOLLEY / SLAM" : "AIMED SHOT / FAN"}`;
  bossHud.dataset.encounter = boss.isMiniBoss ? "miniboss" : crystal ? "crystal" : guardian ? "dungeon" : realmBoss ? "realm" : "wilderness";
  bossHud.dataset.enraged = String(bossHudState.enraged);
  bossHealthFill.style.transform = `scaleX(${Math.max(0, Math.min(1, boss.health / Math.max(1, boss.maxHealth)))})`;
  bossHealthText.textContent = `${Math.max(0, boss.health)} / ${boss.maxHealth}`;
  bossHealth.setAttribute("aria-valuemax", String(boss.maxHealth));
  bossHealth.setAttribute("aria-valuenow", String(Math.max(0, boss.health)));
  bossNotice.textContent = bossHudState.message;
}

interface StopTraceFrame {
  at: number;
  dtMs: number;
  rawX: number;
  rawZ: number;
  desiredX: number;
  desiredZ: number;
  appliedX: number;
  appliedZ: number;
  localX: number;
  localY: number;
  localZ: number;
  renderedY: number;
  serverX: number;
  serverY: number;
  serverZ: number;
  screenX: number;
  screenY: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  focusX: number;
  focusY: number;
  focusZ: number;
  animationWeight: number;
  animationPhase: number;
  bodyY: number;
  rightArmPitch: number;
  leftLegPitch: number;
  reconciliationDistance: number;
  reconciliationRate: number;
  verticalVelocity: number;
  visualOffset: number;
  grounded: boolean;
  stepped: boolean;
  hitVertical: boolean;
  sentSequence: number;
  acknowledgedSequence: number;
  pendingStopSequence: number | null;
  networkAgeMs: number;
  acknowledgementAgeMs: number;
  requestedTravel: number;
  collisionTravel: number;
  netVisualX: number;
  netVisualZ: number;
}

interface StopTrace {
  id: number;
  releasedAt: number;
  captureUntil: number;
  frames: StopTraceFrame[];
}

const STOP_TRACE_HISTORY_FRAMES = 30;
const STOP_TRACE_AFTER_RELEASE_MS = 1200;
const stopTraceHistory: StopTraceFrame[] = [];
let activeStopTrace: StopTrace | null = null;
let completedStopTrace = "No completed stop trace yet.";
let stopTraceSequence = 0;
let previousAppliedMovement = false;
const snapDiagnosticEvents: string[] = [];
const snapFrameHistory: StopTraceFrame[] = [];
const completedSnapTraces: string[] = [];
let activeSnapTrace: StopTrace | null = null;
let snapSequence = 0;

function recordSnapDiagnostic(cause: string, before: pc.Vec3, after: pc.Vec3): void {
  if (!worldReady) return;
  const now = performance.now();
  const positionLabel = (value: pc.Vec3) => `${fixed(value.x)},${fixed(value.y)},${fixed(value.z)}`;
  const delta = before.distance(after);
  const line = `${fixed(now / 1000, 2)}s ${cause} delta=${fixed(delta)} before=[${positionLabel(before)}] after=[${positionLabel(after)}] server=[${positionLabel(authoritativeLocalPosition)}] sent=${moveSequence} ack=${lastProcessedInputSequence} lag=${moveSequence - lastProcessedInputSequence} age=${fixed(now - lastAuthoritativeMovementAt, 0)}ms ack_age=${fixed(now - lastAcknowledgementAdvancedAt, 0)}ms input=[${movementVectorLabel(smoothedMovement)}] dt=${fixed(frameSamples.at(-1) ?? 0, 1)}ms rtt=${networkRttMs === null ? "unknown" : fixed(networkRttMs, 0)}ms chunk_build=${fixed(lastChunkBuildMs, 1)}ms slice=${cutawayStateKey}`;
  snapDiagnosticEvents.push(line);
  if (snapDiagnosticEvents.length > 30) snapDiagnosticEvents.shift();
  if (!activeSnapTrace) {
    snapSequence += 1;
    activeSnapTrace = { id: snapSequence, releasedAt: now, captureUntil: now + 900, frames: [...snapFrameHistory] };
  }
}

function setDefensePresentation(active: boolean): void {
  localDefending = active;
  defenseSlot.setAttribute("aria-pressed", String(active));
  defenseButton.setAttribute("aria-pressed", String(active));
  defenseSlot.classList.toggle("active", active);
  defenseButton.classList.toggle("active", active);
}

function requestDefense(active: boolean): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady || active === localDefending) return;
  if (active && (powerAimActive || specialAimActive || localPowerStartedAt !== null || localActionStartedAt !== null)) {
    status.textContent = "Finish or cancel the current action before guarding.";
    return;
  }
  defenseSequence += 1;
  setDefensePresentation(active);
  room.send("defense", { requestId: `defense-${defenseSequence}`, active, yaw: localFacingYaw });
  if (active) {
    showCombatFeedback("GUARD", "dodge");
    status.textContent = "Guarding · time the opening 0.24 seconds to parry frontal attacks.";
  }
}

function fixed(value: number, digits = 3): string {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function formatStopTrace(trace: StopTrace, kind: "STOP" | "SNAP" = "STOP"): string {
  const lines = [
    `${kind} TRACE #${trace.id} frames=${trace.frames.length} pre=${kind === "SNAP" ? 60 : STOP_TRACE_HISTORY_FRAMES} post=${kind === "SNAP" ? 900 : STOP_TRACE_AFTER_RELEASE_MS}ms`,
    `viewport=${canvas.width}x${canvas.height} dpr=${window.devicePixelRatio.toFixed(2)} release_at=${trace.releasedAt.toFixed(1)}ms`,
    "t_ms dt raw_x raw_z desired_x desired_z applied_x applied_z local_x local_y local_z render_y server_x server_y server_z screen_x screen_y ds_x ds_y camera_x camera_y camera_z focus_x focus_y focus_z anim_weight anim_phase body_y arm_r leg_l reconcile rate vertical visual grounded stepped hit_y sent ack lag stop_wait net_age_ms ack_age_ms requested_travel collision_travel net_visual_x net_visual_z",
  ];
  let previous: StopTraceFrame | undefined;
  for (const frame of trace.frames) {
    const deltaScreenX = previous ? frame.screenX - previous.screenX : 0;
    const deltaScreenY = previous ? frame.screenY - previous.screenY : 0;
    lines.push([
      fixed(frame.at - trace.releasedAt, 1), fixed(frame.dtMs, 1),
      fixed(frame.rawX, 2), fixed(frame.rawZ, 2), fixed(frame.desiredX, 2), fixed(frame.desiredZ, 2),
      fixed(frame.appliedX, 2), fixed(frame.appliedZ, 2),
      fixed(frame.localX), fixed(frame.localY), fixed(frame.localZ), fixed(frame.renderedY),
      fixed(frame.serverX), fixed(frame.serverY), fixed(frame.serverZ),
      fixed(frame.screenX, 1), fixed(frame.screenY, 1), fixed(deltaScreenX, 2), fixed(deltaScreenY, 2),
      fixed(frame.cameraX), fixed(frame.cameraY), fixed(frame.cameraZ),
      fixed(frame.focusX), fixed(frame.focusY), fixed(frame.focusZ),
      fixed(frame.animationWeight), fixed(frame.animationPhase), fixed(frame.bodyY),
      fixed(frame.rightArmPitch, 1), fixed(frame.leftLegPitch, 1),
      fixed(frame.reconciliationDistance), Number.isFinite(frame.reconciliationRate) ? fixed(frame.reconciliationRate, 1) : "HARD",
      fixed(frame.verticalVelocity), fixed(frame.visualOffset),
      Number(frame.grounded), Number(frame.stepped), Number(frame.hitVertical),
      frame.sentSequence, frame.acknowledgedSequence, Math.max(0, frame.sentSequence - frame.acknowledgedSequence), frame.pendingStopSequence ?? "-",
      fixed(frame.networkAgeMs, 0), fixed(frame.acknowledgementAgeMs, 0), fixed(frame.requestedTravel), fixed(frame.collisionTravel), fixed(frame.netVisualX), fixed(frame.netVisualZ),
    ].join(" "));
    previous = frame;
  }
  return lines.join("\n");
}

function finishStopTrace(): void {
  if (!activeStopTrace) return;
  let maximumScreenDelta = 0;
  let maximumRenderedYDelta = 0;
  let maximumIdleWorldDelta = 0;
  for (let index = 1; index < activeStopTrace.frames.length; index += 1) {
    const previous = activeStopTrace.frames[index - 1]!;
    const current = activeStopTrace.frames[index]!;
    if (current.at < activeStopTrace.releasedAt) continue;
    maximumScreenDelta = Math.max(maximumScreenDelta, Math.hypot(current.screenX - previous.screenX, current.screenY - previous.screenY));
    maximumRenderedYDelta = Math.max(maximumRenderedYDelta, Math.abs(current.renderedY - previous.renderedY));
    if (Math.hypot(current.appliedX, current.appliedZ) < 0.01) {
      maximumIdleWorldDelta = Math.max(maximumIdleWorldDelta, Math.hypot(current.localX - previous.localX, current.localZ - previous.localZ));
    }
  }
  completedStopTrace = formatStopTrace(activeStopTrace);
  movementDebugTrace.textContent = `Stop trace #${activeStopTrace.id}: ${activeStopTrace.frames.length} frames · screen Δ${maximumScreenDelta.toFixed(2)}px · idle world Δ${maximumIdleWorldDelta.toFixed(3)} · renderY Δ${maximumRenderedYDelta.toFixed(4)} — COPY LOG`;
  logMovementEvent(`STOP TRACE #${activeStopTrace.id} ready (${activeStopTrace.frames.length} frames)`);
  activeStopTrace = null;
}

function movementVectorLabel(vector: { x: number; z: number }): string {
  return `${vector.x.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function logMovementEvent(message: string): void {
  const elapsed = (performance.now() / 1000).toFixed(2);
  movementEventLog.unshift(`${elapsed}s  ${message}`);
  movementEventLog.splice(64);
  movementDebugEvents.replaceChildren(...movementEventLog.slice(0, 12).map(entry => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
}

movementDebugCopy.addEventListener("click", async () => {
  const trace = activeStopTrace ? formatStopTrace(activeStopTrace) : completedStopTrace;
  const snapTrace = activeSnapTrace ? formatStopTrace(activeSnapTrace, "SNAP") : "";
  const text = `SNAP DIAGNOSTICS v1\nurl=${window.location.origin}${window.location.pathname} room=${activeRoomName}\n${movementDebugLive.textContent ?? ""}\n\nSNAP EVENTS (oldest first)\n${snapDiagnosticEvents.join("\n") || "No snap detected yet."}\n\nEVENTS\n${movementEventLog.join("\n")}\n\n${[...completedSnapTraces, snapTrace].filter(Boolean).join("\n\n")}\n\n${trace}`;
  await navigator.clipboard.writeText(text);
  movementDebugCopy.textContent = "COPIED";
  window.setTimeout(() => { movementDebugCopy.textContent = "COPY LOG"; }, 1000);
});

function resetMovementControls(): void {
  rangedFirePointer = null;
  keys.clear();
  if (joystickPointerId !== null) releaseJoystick(joystickPointerId);
  touchStrafe = 0;
  touchForward = 0;
  smoothedMovement = { x: 0, z: 0 };
  lastSentMovement = { x: 0, z: 0 };
  if (!room || !worldReady || movementPilotController) return;
  moveSequence += 1;
  room.send("move", { sequence: moveSequence, strafe: 0, forward: 0, yaw: localFacingYaw });
}

window.addEventListener("blur", resetMovementControls);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetMovementControls();
});

function hasCeilingAbove(position: pc.Vec3): boolean {
  if (!isBelowTerrainSurface(position.y, SURFACE_HEIGHT + 1)) return false;
  const x = Math.floor(position.x);
  const z = Math.floor(position.z);
  for (let y = Math.floor(position.y + 1.5); y < CHUNK_HEIGHT; y += 1) {
    if (readWorldBlock(x, y, z) !== Block.Air) return true;
  }
  return false;
}

function updateIndoorRoof(position: pc.Vec3): void {
  const next = roofCutawayBuilding(position, indoorRoofBuilding, TOWN_BUILDINGS, SURFACE_HEIGHT + 1);
  if (next === indoorRoofBuilding) return;
  indoorRoofBuilding = next;
  for (const chunk of chunks.values()) {
    chunk.renderedSliceKey = null;
    if (chunk.root.enabled) rebuildChunk(chunk);
  }
  sceneDressing.rebuild(readWorldBlock, [...chunks.values()], indoorRoofBuilding);
  sceneDressing.setSurfaceVisible(!playerCutaway.active);
}

function highestLoadedSolidY(x: number, z: number): number {
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
    if (readWorldBlock(x, y, z) !== Block.Air) return y;
  }
  return -1;
}

function isInOpenExcavation(position: pc.Vec3): boolean {
  const centerX = Math.floor(position.x);
  const centerZ = Math.floor(position.z);
  const surroundingHeights: number[] = [];
  for (const offsetX of [-3, 0, 3]) {
    for (const offsetZ of [-3, 0, 3]) {
      if (offsetX === 0 && offsetZ === 0) continue;
      surroundingHeights.push(highestLoadedSolidY(centerX + offsetX, centerZ + offsetZ));
    }
  }
  return isBelowSurroundingSurface(position.y, surroundingHeights);
}

function updateUndergroundPresentation(position: pc.Vec3, dt: number): void {
  const underground = indoorRoofBuilding === null && hasCeilingAbove(position);
  const excavating = indoorRoofBuilding === null && !underground && isInOpenExcavation(position);
  undergroundClassification = underground;
  excavationClassification = excavating;
  if (surfaceReferenceY === null) surfaceReferenceY = SURFACE_HEIGHT + 1;
  if (cutawaySliceY === null && underground && position.y >= surfaceReferenceY - 0.65) {
    surfaceReferenceY = SURFACE_HEIGHT + 1;
  }
  let visibilityCutaway = shouldUseDepthSlice(
    cutawaySliceY,
    position.y,
    surfaceReferenceY,
    underground,
    excavating,
  );
  let atSurface = false;
  let surfaceDurationMs = 0;
  if (cutawaySliceY !== null) {
    const supported = isPlayerSupported(readCollisionWorldBlock, position.x, position.y, position.z);
    atSurface = isAtSurfaceReturnHeight(position.y, surfaceReferenceY, supported);
    if (atSurface) {
      if (surfaceReturnStartedAt === null) {
        surfaceReturnStartedAt = performance.now();
        surfaceRestoreStartSliceY = cutawaySliceY;
      }
      surfaceDurationMs = performance.now() - surfaceReturnStartedAt;
    } else {
      surfaceReturnStartedAt = null;
      surfaceRestoreStartSliceY = null;
    }
  } else {
    surfaceReturnStartedAt = null;
    surfaceRestoreStartSliceY = null;
  }
  surfaceReturnClassification = atSurface;
  let nextSliceY = visibilityCutaway ? loweredSliceHeight(cutawaySliceY, position.y) : null;
  if (visibilityCutaway && atSurface && surfaceRestoreStartSliceY !== null) {
    nextSliceY = restoredSliceHeight(surfaceRestoreStartSliceY, surfaceReferenceY, surfaceDurationMs);
    if (nextSliceY === null) {
      visibilityCutaway = false;
      surfaceReturnStartedAt = null;
      surfaceRestoreStartSliceY = null;
    }
  }
  const nextKey = nextSliceY === null ? "surface" : `slice:${nextSliceY}`;
  const lightingTarget = visibilityCutaway ? 1 : 0;
  const lightingResponse = 1 - Math.exp(-Math.max(0, dt) * 5);
  undergroundLightingBlend += (lightingTarget - undergroundLightingBlend) * lightingResponse;
  if (Math.abs(lightingTarget - undergroundLightingBlend) < 0.001) undergroundLightingBlend = lightingTarget;
  const greenwoodTarget = !visibilityCutaway && isInGreenwoodRegion(position.x, position.z) ? 1 : 0;
  greenwoodLightingBlend += (greenwoodTarget - greenwoodLightingBlend) * (1 - Math.exp(-Math.max(0, dt) * 2.2));
  if (Math.abs(greenwoodTarget - greenwoodLightingBlend) < 0.001) greenwoodLightingBlend = greenwoodTarget;
  const dungeon = forestDungeonAtmosphere(position.x, position.z);
  const dungeonTarget = !visibilityCutaway && dungeon.room > 0 ? 1 : 0;
  const dungeonResponse = 1 - Math.exp(-Math.max(0, dt) * 1.8);
  forestDungeonLightingBlend += (dungeonTarget - forestDungeonLightingBlend) * dungeonResponse;
  if (Math.abs(dungeonTarget - forestDungeonLightingBlend) < 0.001) forestDungeonLightingBlend = dungeonTarget;
  if (dungeon.room > 0) {
    forestDungeonAmbient.r += (dungeon.ambient[0] - forestDungeonAmbient.r) * dungeonResponse;
    forestDungeonAmbient.g += (dungeon.ambient[1] - forestDungeonAmbient.g) * dungeonResponse;
    forestDungeonAmbient.b += (dungeon.ambient[2] - forestDungeonAmbient.b) * dungeonResponse;
    forestDungeonFog.r += (dungeon.fog[0] - forestDungeonFog.r) * dungeonResponse;
    forestDungeonFog.g += (dungeon.fog[1] - forestDungeonFog.g) * dungeonResponse;
    forestDungeonFog.b += (dungeon.fog[2] - forestDungeonFog.b) * dungeonResponse;
    forestDungeonFogStart += (dungeon.fogStart - forestDungeonFogStart) * dungeonResponse;
    forestDungeonFogEnd += (dungeon.fogEnd - forestDungeonFogEnd) * dungeonResponse;
  }
  const currentDepthsZone = visibilityCutaway ? silverDepthsZone(position) : null;
  const inSilverDepths = currentDepthsZone !== null;
  const inEmberVault = isInEmberVault(position.x, position.z);
  const depthsResponse = 1 - Math.exp(-Math.max(0, dt) * 1.45);
  silverDepthsLightingBlend += ((inSilverDepths ? 1 : 0) - silverDepthsLightingBlend) * depthsResponse;
  if (Math.abs((inSilverDepths ? 1 : 0) - silverDepthsLightingBlend) < .001) silverDepthsLightingBlend = inSilverDepths ? 1 : 0;
  silverDepthsRoot.enabled = silverDepthsLightingBlend > .015;
  for (const fixture of silverDepthsFixtures) {
    const nearby = inSilverDepths && Math.hypot(fixture.x - position.x, fixture.z - position.z) <= 21;
    fixture.entity.enabled = nearby;
    if (nearby && fixture.x >= 124 && fixture.entity.light)
      fixture.entity.light.intensity = fixture.intensity * (1 + Math.sin(performance.now() * .0016) * .08);
  }
  emberVaultLightingBlend += ((inEmberVault ? 1 : 0) - emberVaultLightingBlend) * depthsResponse;
  if (Math.abs((inEmberVault ? 1 : 0) - emberVaultLightingBlend) < .001) emberVaultLightingBlend = inEmberVault ? 1 : 0;
  emberVaultRoot.enabled = emberVaultLightingBlend > .015;
  if (currentDepthsZone !== activeSilverDepthsZone) {
    activeSilverDepthsZone = currentDepthsZone;
    if (currentDepthsZone) {
      const profile = SILVER_DEPTHS_ATMOSPHERES[currentDepthsZone];
      showCombatFeedback(profile.name, "dodge");
      const cueNow = performance.now();
      if (cueNow - lastDepthsAtmosphereCueAt >= 1800) {
        combatAudio.play(profile.cue);
        lastDepthsAtmosphereCueAt = cueNow;
      }
    }
  }
  if (currentDepthsZone) {
    const profile = SILVER_DEPTHS_ATMOSPHERES[currentDepthsZone];
    depthsAmbient.r += (profile.ambient[0] - depthsAmbient.r) * depthsResponse;
    depthsAmbient.g += (profile.ambient[1] - depthsAmbient.g) * depthsResponse;
    depthsAmbient.b += (profile.ambient[2] - depthsAmbient.b) * depthsResponse;
    depthsFog.r += (profile.fog[0] - depthsFog.r) * depthsResponse;
    depthsFog.g += (profile.fog[1] - depthsFog.g) * depthsResponse;
    depthsFog.b += (profile.fog[2] - depthsFog.b) * depthsResponse;
    depthsFogStart += (profile.fogStart - depthsFogStart) * depthsResponse;
    depthsFogEnd += (profile.fogEnd - depthsFogEnd) * depthsResponse;
  }
  updateDangerZone(localDangerTier, position);
  caveLight.enabled = undergroundLightingBlend > 0.001;
  if (localPlayerSilhouette) localPlayerSilhouette.enabled = visibilityCutaway;
  exitTrail.enabled = visibilityCutaway;
  exitGuide.hidden = !visibilityCutaway;
  caveLight.setPosition(position.x, position.y + 1.2, position.z);
  if (light.light) light.light.intensity = (1.45 + (0.45 - 1.45) * undergroundLightingBlend) * (1 - .36 * forestDungeonLightingBlend) * (1 - .58 * silverDepthsLightingBlend) * (1 - .72 * emberVaultLightingBlend);
  if (skyFill.light) skyFill.light.intensity = 0.32 * (1 - undergroundLightingBlend) * (1 - .5 * forestDungeonLightingBlend) * (1 - .75 * emberVaultLightingBlend);
  if (caveLight.light) {
    const lanternOwned = (inventoryCounts.get("miners_lantern") ?? 0) > 0;
    const crystalLantern = (localDepthsRewardFlags & 32) !== 0 && silverDepthsLightingBlend > .2;
    caveLight.light.intensity = (crystalLantern ? 3.4 : lanternOwned ? 2.65 : 1.25) * undergroundLightingBlend;
    caveLight.light.range = crystalLantern ? 27 : lanternOwned ? 19 : silverDepthsLightingBlend > .2 ? 8 : 12;
  }
  const surfaceAmbient = {
    r: 0.43 + (0.3 - 0.43) * greenwoodLightingBlend,
    g: 0.48 + (0.43 - 0.48) * greenwoodLightingBlend,
    b: 0.54 + (0.36 - 0.54) * greenwoodLightingBlend,
  };
  const ambientR = surfaceAmbient.r + (0.2 - surfaceAmbient.r) * undergroundLightingBlend;
  const ambientG = surfaceAmbient.g + (0.24 - surfaceAmbient.g) * undergroundLightingBlend;
  const ambientB = surfaceAmbient.b + (0.31 - surfaceAmbient.b) * undergroundLightingBlend;
  const mixedAmbientR = ambientR + (forestDungeonAmbient.r - ambientR) * forestDungeonLightingBlend;
  const mixedAmbientG = ambientG + (forestDungeonAmbient.g - ambientG) * forestDungeonLightingBlend;
  const mixedAmbientB = ambientB + (forestDungeonAmbient.b - ambientB) * forestDungeonLightingBlend;
  const depthsAmbientR = mixedAmbientR + (depthsAmbient.r - mixedAmbientR) * silverDepthsLightingBlend;
  const depthsAmbientG = mixedAmbientG + (depthsAmbient.g - mixedAmbientG) * silverDepthsLightingBlend;
  const depthsAmbientB = mixedAmbientB + (depthsAmbient.b - mixedAmbientB) * silverDepthsLightingBlend;
  app.scene.ambientLight.set(
    depthsAmbientR + (.19 - depthsAmbientR) * emberVaultLightingBlend,
    depthsAmbientG + (.055 - depthsAmbientG) * emberVaultLightingBlend,
    depthsAmbientB + (.025 - depthsAmbientB) * emberVaultLightingBlend,
  );
  const surfaceFogR = 0.21 + (0.11 - 0.21) * greenwoodLightingBlend;
  const surfaceFogG = 0.3 + (0.24 - 0.3) * greenwoodLightingBlend;
  const surfaceFogB = 0.32 + (0.2 - 0.32) * greenwoodLightingBlend;
  const mixedFogR = surfaceFogR + (forestDungeonFog.r - surfaceFogR) * forestDungeonLightingBlend;
  const mixedFogG = surfaceFogG + (forestDungeonFog.g - surfaceFogG) * forestDungeonLightingBlend;
  const mixedFogB = surfaceFogB + (forestDungeonFog.b - surfaceFogB) * forestDungeonLightingBlend;
  const depthsFogR = mixedFogR + (depthsFog.r - mixedFogR) * silverDepthsLightingBlend;
  const depthsFogG = mixedFogG + (depthsFog.g - mixedFogG) * silverDepthsLightingBlend;
  const depthsFogB = mixedFogB + (depthsFog.b - mixedFogB) * silverDepthsLightingBlend;
  app.scene.fog.color.set(
    depthsFogR + (.12 - depthsFogR) * emberVaultLightingBlend,
    depthsFogG + (.025 - depthsFogG) * emberVaultLightingBlend,
    depthsFogB + (.012 - depthsFogB) * emberVaultLightingBlend,
  );
  const baseFogStart = 34 + (forestDungeonFogStart - 34) * forestDungeonLightingBlend;
  const baseFogEnd = 58 + (forestDungeonFogEnd - 58) * forestDungeonLightingBlend;
  const mixedDepthsFogStart = baseFogStart + (depthsFogStart - baseFogStart) * silverDepthsLightingBlend;
  const mixedDepthsFogEnd = baseFogEnd + (depthsFogEnd - baseFogEnd) * silverDepthsLightingBlend;
  app.scene.fog.start = mixedDepthsFogStart + (19 - mixedDepthsFogStart) * emberVaultLightingBlend;
  app.scene.fog.end = mixedDepthsFogEnd + (40 - mixedDepthsFogEnd) * emberVaultLightingBlend;
  camera.camera?.clearColor.copy(app.scene.fog.color);
  if (nextKey === cutawayStateKey) return;
  logMovementEvent(
    `SLICE ${cutawayStateKey} → ${nextKey} y=${position.y.toFixed(3)} underground=${underground} return=${Math.round(surfaceDurationMs)}ms`,
  );
  cutawayStateKey = nextKey;
  cutawaySliceY = nextSliceY;
  if (!visibilityCutaway) surfaceReferenceY = SURFACE_HEIGHT + 1;
  playerCutaway.active = visibilityCutaway;
  playerCutaway.sliceY = nextSliceY ?? CHUNK_HEIGHT;
  sceneDressing.setSurfaceVisible(!visibilityCutaway);
  updateActiveChunkMeshes(position);
  status.textContent = atSurface && visibilityCutaway
    ? `Returning to surface · restoring slice ${nextSliceY}`
    : underground
    ? `Underground · slice ${nextSliceY ?? "off"} · lowers only when descending`
    : excavating
      ? `Excavation · slice ${nextSliceY ?? "off"} · lowers only when descending`
      : "Surface · cross the flat ground to the descending mine entrance east of spawn.";
}

function requestMine(): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady) return;
  if (miningSwing || pendingMine) return;
  if (powerAimActive || localPowerStartedAt !== null) {
    status.textContent = `Committed to ${POWER_DEFINITIONS[localActivePower ?? localEquippedPower].name} · dodge to cancel.`;
    return;
  }
  if (!currentTarget) {
    status.textContent = "Move within mining reach and point at a block.";
    return;
  }
  const player = localPlayer.getPosition();
  if (miningMovementRequested()) { status.textContent = miningMessage("moving"); return; }
  const availability = miningAvailability(player, currentTarget);
  if (availability !== "ready") {
    status.textContent = miningMessage(availability);
    return;
  }
  if (!miningLineClear(player, currentTarget, readCollisionWorldBlock)) {
    status.textContent = miningMessage("collision");
    return;
  }
  const mineralId = currentTarget.block === Block.IronOre ? "iron_ore" : currentTarget.block === Block.SilverOre ? "silver_ore" : currentTarget.block === Block.MoonstoneOre ? "moonstone" : null;
  if (mineralId && (inventoryCounts.get(mineralId) ?? 0) >= blacksmithIronCapacity) {
    status.textContent = "Mineral pack full · sell ore at the blacksmith.";
    return;
  }
  localActionFacingYaw = movementYaw(
    currentTarget.x + 0.5 - player.x,
    currentTarget.z + 0.5 - player.z,
    localFacingYaw,
  );
  localActionStartedAt = performance.now();
  localActionStep = 0;
  localActionMainHandId = null;
  localComboStep = 0;
  localComboExpiresAt = 0;
  const proximity = miningReach(player, currentTarget);
  logMovementEvent(`ACTION mine reach=${proximity.toFixed(2)}`);
  const address = worldToChunk(currentTarget.x, currentTarget.z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk) return;
  const startedAt = performance.now();
  const requestId = `mine-${room.sessionId}-${++mineSequence}`;
  miningSwing = { cell: Object.freeze({ ...currentTarget }), startedAt, requestId, stage: 0, origin: player.clone() };
  pendingMine = { requestId, startedAt };
  room.send("mine", { requestId, expectedRevision: chunk.revision, x: currentTarget.x, y: currentTarget.y, z: currentTarget.z });
  status.textContent = `Mining ${currentTarget.x}, ${currentTarget.y}, ${currentTarget.z}...`;
}

function requestAttack(): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady) return;
  const now = performance.now();
  if (powerAimActive || (localPowerStartedAt !== null && now - localPowerStartedAt < powerDuration(localActivePower))) {
    status.textContent = `Committed to ${POWER_DEFINITIONS[localActivePower ?? localEquippedPower].name} · dodge to cancel.`;
    return;
  }
  if (localActionStartedAt !== null && now - localActionStartedAt < actionDuration(localActionStep)) {
    status.textContent = "Recovering from the previous attack...";
    return;
  }
  const attackDefinition = WEAPON_ATTACK_DEFINITIONS[localMainHandId];
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, attackDefinition.range);
  localActionFacingYaw = attackDefinition.projectileTravelMs > 0 && rangedPointer.active ? mouseRangedYaw(localFacingYaw) : targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : currentTarget
      ? movementYaw(currentTarget.x + 0.5 - player.x, currentTarget.z + 0.5 - player.z, localFacingYaw)
      : localFacingYaw;
  const comboStep = attackDefinition.combo && now <= localComboExpiresAt ? localComboStep % 3 + 1 : 1;
  const timing = attackDefinition.attacks[comboStep - 1] ?? attackDefinition.attacks[0]!;
  localActionStartedAt = now;
  localActionStep = comboStep;
  localActionMainHandId = localMainHandId;
  localComboStep = comboStep;
  localComboExpiresAt = attackDefinition.combo ? now + timing.durationMs + attackDefinition.comboWindowMs : 0;
  attackSequence += 1;
  room.send("attack", { requestId: `attack-${attackSequence}`, yaw: localActionFacingYaw });
  logMovementEvent(`ACTION ${localMainHandId} step=${comboStep} impact=${timing.impactMs}ms yaw=${localActionFacingYaw.toFixed(1)}`);
  const attackName = attackDefinition.combo
    ? `${MAIN_HAND_DEFINITIONS[localMainHandId].attackName} ${comboStep}`
    : MAIN_HAND_DEFINITIONS[localMainHandId].attackName;
  status.textContent = attackDefinition.projectileTravelMs > 0 && rangedPointer.active ? `${attackName} · firing toward your reticle.` : targetMob
    ? attackDefinition.combo && comboStep === 3
      ? `Heavy finisher aimed at ${targetMob.visual.state.name}...`
      : `${attackName} aimed at ${targetMob.visual.state.name}...`
    : `${attackName} · no target in reach.`;
}

function requestDodge(): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady) return;
  const now = performance.now();
  if (!canRequestPredictedDodge(now, localDodgeRequestedAt)) {
    status.textContent = "Dodge recovering...";
    return;
  }
  if (localPredictedDodgeStaminaReady) {
    localPredictedDodgeStamina = advancePredictedDodgeStamina(
      localPredictedDodgeStamina,
      now - localPredictedDodgeStaminaAt,
      localPredictedDodgeStaminaMaximum,
    );
    localPredictedDodgeStaminaAt = now;
    if (!canSpendPredictedDodgeStamina(localPredictedDodgeStamina)) {
      showCombatFeedback("NO STAMINA", "hurt");
      status.textContent = "Not enough stamina to dodge.";
      return;
    }
    localPredictedDodgeStamina -= DODGE_STAMINA_COST;
  }
  localDodgeRequestedAt = now;
  if (localDefending) requestDefense(false);
  if (powerAimActive) cancelPowerAim();
  if (specialAimActive) cancelSpecialAim();
  const activePowerElapsed = localPowerStartedAt === null ? null : performance.now() - localPowerStartedAt;
  if (activePowerElapsed !== null
    && localActivePower !== null
    && activePowerElapsed < POWER_DEFINITIONS[localActivePower].windupMs) {
    cancelLocalPowerPresentation();
  }
  const movementLength = Math.hypot(smoothedMovement.x, smoothedMovement.z);
  const direction = movementLength > 0.05
    ? { x: smoothedMovement.x / movementLength, z: smoothedMovement.z / movementLength }
    : {
        x: Math.sin(localFacingYaw * Math.PI / 180),
        z: Math.cos(localFacingYaw * Math.PI / 180),
      };
  const current = localPlayer.getPosition();
  const predicted = resolvePlayerMotion(
    { x: current.x, y: current.y, z: current.z },
    { x: direction.x * 1.8, y: 0, z: direction.z * 1.8 },
    readCollisionWorldBlock,
  );
  localDodgeVisualOffset = beginDodgeVisualOffset(
    localDodgeVisualOffset,
    { x: current.x, z: current.z },
    { x: predicted.x, z: predicted.z },
  );
  if (defeatScreen.hidden) localPlayer.setPosition(predicted.x, predicted.y, predicted.z);
  updateActiveChunkMeshes(predicted);
  localDodgeStartedAt = now;
  dodgeSequence += 1;
  room.send("dodge", {
    requestId: `dodge-${dodgeSequence}`,
    strafe: direction.x,
    forward: direction.z,
    yaw: localFacingYaw,
  });
  showCombatFeedback("DODGE", "dodge");
  logMovementEvent(`DODGE ${direction.x.toFixed(2)}, ${direction.z.toFixed(2)}`);
  status.textContent = "Dodging · brief invulnerability active.";
}

function updatePowerAimFromPointer(): void {
  if (!powerAimActive || !camera.camera) return;
  const player = localPlayer.getPosition();
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const rayY = end.y - start.y;
  if (Math.abs(rayY) < 0.0001) return;
  const distanceAlongRay = (player.y - start.y) / rayY;
  if (distanceAlongRay <= 0) return;
  const worldX = start.x + (end.x - start.x) * distanceAlongRay;
  const worldZ = start.z + (end.z - start.z) * distanceAlongRay;
  const definition = POWER_DEFINITIONS[localEquippedPower];
  const shape = activePowerShape(localEquippedPower);
  const deltaX = worldX - player.x;
  const deltaZ = worldZ - player.z;
  const pointerDistance = Math.hypot(deltaX, deltaZ);
  const scale = definition.core === "ground" && pointerDistance > definition.range
    ? definition.range / pointerDistance
    : 1;
  const targetX = player.x + deltaX * scale;
  const targetZ = player.z + deltaZ * scale;
  powerAimYaw = movementYaw(targetX - player.x, targetZ - player.z, powerAimYaw);
  if (localEquippedPower === "seismic_cleave" && pointerDistance > 0.1) {
    const directionX = deltaX / pointerDistance;
    const directionZ = deltaZ / pointerDistance;
    let assistedTarget: MobVisual | null = null;
    let closestLateralDistance = 0.72;
    for (const mob of mobVisuals.values()) {
      if (!mob.state.alive) continue;
      const mobDeltaX = mob.state.x - player.x;
      const mobDeltaZ = mob.state.z - player.z;
      const forwardDistance = mobDeltaX * directionX + mobDeltaZ * directionZ;
      if (forwardDistance <= 0 || forwardDistance > shape.range) continue;
      const lateralDistance = Math.abs(mobDeltaX * directionZ - mobDeltaZ * directionX);
      if (lateralDistance >= closestLateralDistance) continue;
      closestLateralDistance = lateralDistance;
      assistedTarget = mob;
    }
    if (assistedTarget) {
      powerAimYaw = movementYaw(assistedTarget.state.x - player.x, assistedTarget.state.z - player.z, powerAimYaw);
    }
  }
  if (definition.core === "ground") powerAimTarget.set(targetX, player.y, targetZ);
  localFacingYaw = powerAimYaw;
  updatePowerAimVisual();
}

function beginPowerAim(pointerId: number | null = null): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady) return;
  if (localDefending) requestDefense(false);
  if (!powerServerReady) {
    status.textContent = "Power server is updating · Powers will unlock automatically.";
    showCombatFeedback("POWER SERVER UPDATING", "hurt");
    return;
  }
  if (powerAimActive || specialAimActive || localPowerStartedAt !== null) return;
  const definition = POWER_DEFINITIONS[localEquippedPower];
  const shape = activePowerShape(localEquippedPower);
  if (!isPowerCompatibleWithMainHand(definition, localMainHandId)) {
    status.textContent = `${definition.name} is not compatible with ${MAIN_HAND_DEFINITIONS[localMainHandId].name}.`;
    showCombatFeedback("INCOMPATIBLE POWER", "hurt");
    return;
  }
  const remaining = localPowerCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${definition.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  if (definition.castType === "tap") {
    castPower(localFacingYaw);
    return;
  }
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, definition.core === "ground" ? shape.range : shape.range + 1.2);
  powerAimYaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : localFacingYaw;
  if (definition.core === "ground") {
    const radians = powerAimYaw * Math.PI / 180;
    const preferredDistance = targetMob ? Math.min(shape.range, targetMob.distance) : Math.min(shape.range, 3.5);
    powerAimTarget.set(
      targetMob ? targetMob.visual.state.x : player.x + Math.sin(radians) * preferredDistance,
      player.y,
      targetMob ? targetMob.visual.state.z : player.z + Math.cos(radians) * preferredDistance,
    );
    powerAimTargetValid = isPlayerSupported(readCollisionWorldBlock, powerAimTarget.x, powerAimTarget.y, powerAimTarget.z);
  }
  powerAimActive = true;
  powerAimPointerId = pointerId;
  localFacingYaw = powerAimYaw;
  createPowerAimVisual();
  updatePowerAimVisual();
  combatHud.setPowerAiming(true);
  powerButton.classList.add("aiming");
  showCombatFeedback(`AIM ${definition.name.toUpperCase()}`, "dodge");
  status.textContent = definition.core === "ground"
    ? `Placing ${definition.name} · point within range, release to cast, dodge to cancel.`
    : `Aiming ${definition.name} · drag to adjust, release to cast, dodge to cancel.`;
}

function cancelPowerAim(): void {
  if (!powerAimActive) return;
  powerAimActive = false;
  powerAimPointerId = null;
  powerAimKey = null;
  destroyPowerAimVisual();
  combatHud.setPowerAiming(false);
  powerButton.classList.remove("aiming");
  showCombatFeedback("POWER CANCELLED", "dodge");
}

function cancelLocalPowerPresentation(): void {
  localPowerCooldownUntil = 0;
  localPowerStartedAt = null;
  localPowerFacingYaw = null;
  localPowerStepApplied = false;
  localActivePower = null;
  const localTelegraph = room ? powerTelegraphs.get(room.sessionId) : undefined;
  localTelegraph?.root.destroy();
  if (room) powerTelegraphs.delete(room.sessionId);
}

function castPower(yaw: number, target?: { x: number; y: number; z: number }): void {
  if (!room) return;
  const powerId = localEquippedPower;
  const definition = POWER_DEFINITIONS[powerId];
  const shape = activePowerShape(powerId);
  const player = localPlayer.getPosition();
  localActivePower = powerId;
  localPowerFacingYaw = yaw;
  localPowerStartedAt = performance.now();
  localPowerStepApplied = false;
  localPowerCooldownUntil = Date.now() + definition.cooldownMs;
  powerSequence += 1;
  const telegraphPosition = definition.core === "ground" && target ? target : player;
  startPowerTelegraph(room.sessionId, powerId, telegraphPosition.x, telegraphPosition.y, telegraphPosition.z, yaw, definition.windupMs, shape);
  room.send("power", { requestId: `power-${powerSequence}`, powerId, yaw, ...(target ? { target } : {}) });
  if (powerId === "seismic_cleave") combatAudio.play("seismicWindup");
  showCombatFeedback(definition.name.toUpperCase(), "dodge");
  logMovementEvent(`POWER ${definition.id} yaw=${yaw.toFixed(1)}`);
  status.textContent = definition.core === "burst"
    ? `${definition.name} charging · radial impact in ${(definition.windupMs / 1000).toFixed(2)}s.`
    : definition.core === "ground"
      ? `${definition.name} marked · ground impact in ${(definition.windupMs / 1000).toFixed(2)}s.`
      : definition.core === "mobility"
        ? `${definition.name} committed · lunge impact in ${(definition.windupMs / 1000).toFixed(2)}s.`
      : powerId === "seismic_cleave"
        ? `${definition.name} committed · brace for the travelling faultline.`
        : `${definition.name} winding up · line impact in ${(definition.windupMs / 1000).toFixed(2)}s.`;
}

function commitPowerAim(): void {
  if (!defeatScreen.hidden) return;
  if (!powerAimActive || !room) return;
  const yaw = powerAimYaw;
  const definition = POWER_DEFINITIONS[localEquippedPower];
  if (definition.core === "ground" && !powerAimTargetValid) {
    status.textContent = `${definition.name} needs solid ground within range.`;
    showCombatFeedback("INVALID GROUND", "hurt");
    return;
  }
  const target = definition.core === "ground"
    ? { x: powerAimTarget.x, y: powerAimTarget.y, z: powerAimTarget.z }
    : undefined;
  powerAimActive = false;
  powerAimPointerId = null;
  powerAimKey = null;
  destroyPowerAimVisual();
  combatHud.setPowerAiming(false);
  powerButton.classList.remove("aiming");
  castPower(yaw, target);
}

function requestHuntersMark(): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady) return;
  const remaining = localSpecialCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${HUNTERS_MARK.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  if (powerAimActive || localPowerStartedAt !== null || localActionStartedAt !== null) {
    status.textContent = `${HUNTERS_MARK.name} needs a clear action window.`;
    showCombatFeedback("SPECIAL BLOCKED", "hurt");
    return;
  }
  const player = localPlayer.getPosition();
  const target = nearestLivingMob(player, HUNTERS_MARK.range);
  if (!target) {
    status.textContent = `${HUNTERS_MARK.name} needs a living enemy within ${HUNTERS_MARK.range}m.`;
    showCombatFeedback("NO MARK TARGET", "hurt");
    return;
  }
  const yaw = movementYaw(
    target.visual.state.x - player.x,
    target.visual.state.z - player.z,
    localFacingYaw,
  );
  localFacingYaw = yaw;
  localSpecialCooldownUntil = Date.now() + HUNTERS_MARK.cooldownMs;
  specialSequence += 1;
  room.send("special", { requestId: `special-${specialSequence}`, specialId: "hunters_mark", yaw });
  status.textContent = `Marking ${target.visual.state.name}...`;
  logMovementEvent(`SPECIAL ${HUNTERS_MARK.id} target=${target.id} yaw=${yaw.toFixed(1)}`);
}

function updateSpecialAimFromPointer(): void {
  if (!specialAimActive || !camera.camera) return;
  const player = localPlayer.getPosition();
  const start = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.nearClip);
  const end = camera.camera.screenToWorld(pointer.x, pointer.y, camera.camera.farClip);
  const rayY = end.y - start.y;
  if (Math.abs(rayY) < 0.0001) return;
  const distanceAlongRay = (player.y - start.y) / rayY;
  if (distanceAlongRay <= 0) return;
  const worldX = start.x + (end.x - start.x) * distanceAlongRay;
  const worldZ = start.z + (end.z - start.z) * distanceAlongRay;
  const deltaX = worldX - player.x;
  const deltaZ = worldZ - player.z;
  const pointerDistance = Math.hypot(deltaX, deltaZ);
  const scale = pointerDistance > BRAMBLE_SNARE.range ? BRAMBLE_SNARE.range / pointerDistance : 1;
  specialAimTarget.set(player.x + deltaX * scale, player.y, player.z + deltaZ * scale);
  specialAimYaw = movementYaw(specialAimTarget.x - player.x, specialAimTarget.z - player.z, specialAimYaw);
  localFacingYaw = specialAimYaw;
  updateSpecialAimVisual();
}

function beginSpecialAim(pointerId: number | null = null): void {
  if (!defeatScreen.hidden) return;
  if (!room || !worldReady || specialAimActive) return;
  if (localDefending) requestDefense(false);
  const definition = SPECIAL_DEFINITIONS[localEquippedSpecial];
  const remaining = localSpecialCooldownUntil - Date.now();
  if (remaining > 0) {
    status.textContent = `${definition.name} recharging · ${(remaining / 1000).toFixed(1)}s.`;
    return;
  }
  if (powerAimActive || localPowerStartedAt !== null || localActionStartedAt !== null) {
    status.textContent = `${definition.name} needs a clear action window.`;
    showCombatFeedback("SPECIAL BLOCKED", "hurt");
    return;
  }
  if (localEquippedSpecial === "venom_fan") {
    const pose = localPlayer.getPosition();
    const target = nearestLivingMob(pose, SPECIAL_DEFINITIONS.venom_fan.range);
    const yaw = rangedPointer.active ? mouseRangedYaw(localFacingYaw) : target ? movementYaw(target.visual.state.x - pose.x, target.visual.state.z - pose.z, localFacingYaw) : localFacingYaw;
    room.send("special", { requestId: `venom-${Date.now()}`, specialId: "venom_fan", yaw });
    localSpecialCooldownUntil = Date.now() + definition.cooldownMs;
    localFacingYaw = yaw;
    showCombatFeedback("VENOM FAN", "dodge");
    return;
  }
  if (localEquippedSpecial === "hunters_mark") {
    requestHuntersMark();
    return;
  }
  const player = localPlayer.getPosition();
  const targetMob = nearestLivingMob(player, BRAMBLE_SNARE.range);
  specialAimYaw = targetMob
    ? movementYaw(targetMob.visual.state.x - player.x, targetMob.visual.state.z - player.z, localFacingYaw)
    : localFacingYaw;
  const radians = specialAimYaw * Math.PI / 180;
  const preferredDistance = targetMob ? Math.min(BRAMBLE_SNARE.range, targetMob.distance) : Math.min(BRAMBLE_SNARE.range, 3.5);
  specialAimTarget.set(
    targetMob ? targetMob.visual.state.x : player.x + Math.sin(radians) * preferredDistance,
    player.y,
    targetMob ? targetMob.visual.state.z : player.z + Math.cos(radians) * preferredDistance,
  );
  specialAimTargetValid = isPlayerSupported(readCollisionWorldBlock, specialAimTarget.x, specialAimTarget.y, specialAimTarget.z);
  specialAimActive = true;
  specialAimPointerId = pointerId;
  localFacingYaw = specialAimYaw;
  createSpecialAimVisual();
  updateSpecialAimVisual();
  combatHud.setSpecialAiming(true);
  specialButton.classList.add("aiming");
  showCombatFeedback("AIM BRAMBLE SNARE", "dodge");
  status.textContent = "Placing Bramble Snare · point within range, release to arm, dodge to cancel.";
}

function cancelSpecialAim(): void {
  if (!specialAimActive) return;
  specialAimActive = false;
  specialAimPointerId = null;
  destroySpecialAimVisual();
  combatHud.setSpecialAiming(false);
  specialButton.classList.remove("aiming");
  showCombatFeedback("SPECIAL CANCELLED", "dodge");
}

function commitSpecialAim(): void {
  if (!defeatScreen.hidden) return;
  if (!specialAimActive || !room) return;
  if (!specialAimTargetValid) {
    status.textContent = "Bramble Snare needs solid ground within range.";
    showCombatFeedback("INVALID GROUND", "hurt");
    return;
  }
  const target = { x: specialAimTarget.x, y: specialAimTarget.y, z: specialAimTarget.z };
  const yaw = specialAimYaw;
  specialAimActive = false;
  specialAimPointerId = null;
  destroySpecialAimVisual();
  combatHud.setSpecialAiming(false);
  specialButton.classList.remove("aiming");
  localSpecialCooldownUntil = Date.now() + BRAMBLE_SNARE.cooldownMs;
  specialSequence += 1;
  room.send("special", { requestId: `special-${specialSequence}`, specialId: "bramble_snare", yaw, target });
  showCombatFeedback("SNARE ARMED", "dodge");
  status.textContent = "Bramble Snare armed · the first enemy entering it will be rooted.";
  logMovementEvent(`SPECIAL ${BRAMBLE_SNARE.id} ${target.x.toFixed(1)},${target.z.toFixed(1)}`);
}

function requestPrimaryAction(): void {
  if (playerInteractionUI.isOpen()) return;
  if (!inventoryPanel.hidden) return;
  if (!lootPanel.hidden) return;
  if (!defeatScreen.hidden) return;
  if (nearbyRecoveryBag) { recoverNearbyBag(); return; }
  if (sceneDressing.blacksmithVisible && isAtTownStorage(localPlayer.getPosition())) { openPersonalStorage(); return; }
  const nearbyLoot = nearestLootDrop();
  if (nearbyLoot) { interactWithLoot(nearbyLoot); return; }
  if (nearbyForestPortal) { useNearbyForestPortal(); return; }
  const boardPosition = localPlayer.getPosition();
  if (Math.abs(boardPosition.y - TOWN_EXPEDITION_BOARD_POSITION.y) <= 1.6
    && Math.hypot(boardPosition.x - TOWN_EXPEDITION_BOARD_POSITION.x, boardPosition.z - TOWN_EXPEDITION_BOARD_POSITION.z) <= 3) {
    openDungeonBoard(); return;
  }
  if (canTradeAtBlacksmithStall(localPlayer.getPosition(), sceneDressing.blacksmithVisible)) {
    openBlacksmith();
    return;
  }
  if (canPlayAtTavernTable(localPlayer.getPosition(), sceneDressing.keeperVisible)) {
    openTavernQuiz();
    return;
  }
  if (canTalkToTavernKeeper(localPlayer.getPosition(), sceneDressing.keeperVisible)) {
    advanceTavernDialogue();
    return;
  }
  if (localDefending) requestDefense(false);
  if (primaryActionForMode(interactionMode) === "mine") requestMine();
  else requestAttack();
}

function setInteractionMode(mode: InteractionMode): void {
  rangedFirePointer = null;
  if (interactionMode === mode && targetStateKey.startsWith(`${mode}:`)) return;
  const cancelledMining = mode !== "build" && Boolean(miningSwing || pendingMine);
  interactionMode = mode;
  if (mode !== "build") cancelMining("mode");
  combatHud.setMode(mode);
  mineButton.textContent = mode === "build" ? "Mine" : "Attack";
  mineButton.dataset.mode = mode;
  touchModeLabel.textContent = mode === "build" ? "Build" : "Combat";
  touchModeButton.dataset.mode = mode;
  touchModeButton.setAttribute("aria-label", `Switch to ${alternateInteractionMode(mode)} mode`);
  combatReticle.hidden = mode !== "combat";
  targetStateKey = "";
  updateTarget();
  logMovementEvent(`MODE ${mode.toUpperCase()}`);
  status.textContent = mode === "build"
    ? "Build mode · clicks mine nearby targeted blocks."
    : cancelledMining ? miningMessage("mode") : `Combat mode · clicks use the ${MAIN_HAND_DEFINITIONS[localMainHandId].name} Attack without changing blocks.`;
}

for (const button of modeButtons) {
  button.addEventListener("click", () => setInteractionMode(button.dataset.mode as InteractionMode));
}
touchModeButton.addEventListener("click", () => {
  setInteractionMode(alternateInteractionMode(interactionMode));
});
for (const button of powerPickerButtons) {
  button.addEventListener("click", () => {
    const powerId = button.dataset.power;
    if (powerId && isPowerId(powerId)) requestPowerEquip(powerId);
  });
}
for (const button of powerLoadoutButtons) {
  button.addEventListener("click", () => activatePowerSlot(button.dataset.powerSlot as "primary" | "secondary"));
}
for (const button of seismicMasteryButtons) {
  button.addEventListener("click", () => {
    const masteryId = button.dataset.seismicMastery;
    if (masteryId && isSeismicMasteryId(masteryId)) requestSeismicMastery(masteryId);
  });
}
for (const button of specialPickerButtons) {
  button.addEventListener("click", () => {
    const specialId = button.dataset.special;
    if (specialId && isSpecialId(specialId)) requestSpecialEquip(specialId);
  });
}
for (const button of mainHandPickerButtons) {
  button.addEventListener("click", () => {
    const mainHandId = button.dataset.mainHand;
    if (mainHandId && isMainHandId(mainHandId)) requestMainHandEquip(mainHandId);
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-equip-armour]")) {
  button.addEventListener("click", () => {
    if (!room || !worldReady) return;
    room.send("armour:equip", { armourId: button.dataset.equipArmour });
  });
}
for (const button of inventoryEquipButtons) {
  button.addEventListener("click", () => {
    const mainHandId = button.dataset.equipMainHand;
    if (mainHandId && isMainHandId(mainHandId)) requestMainHandEquip(mainHandId);
  });
}
for (const button of traitPickerButtons) {
  button.addEventListener("click", () => {
    const traitId = button.dataset.trait;
    if (traitId && isTraitId(traitId)) requestTraitEquip(traitId);
  });
}

window.addEventListener("keydown", event => {
  if (event.repeat) return;
  if (!levelUpPanel.hidden) { event.preventDefault(); return; }
  if (playerInteractionUI.isOpen()) {
    if (event.code === "Escape") playerInteractionUI.close();
    event.preventDefault();
    return;
  }
  if (tradeUI.isOpen()) { if (event.code === "Escape") tradeUI.cancel(); return; }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.code === "Enter" && lootPanel.hidden && inventoryPanel.hidden && quizPanel.hidden && blacksmithPanel.hidden) { event.preventDefault(); social.open(); return; }
  if (!defeatScreen.hidden) return;
  if (!lootPanel.hidden) {
    if (event.code === "Escape") closeLoot();
    if (event.code === "Tab") {
      const buttons = [lootClose, lootEquip, lootKeep, lootDismantle].filter(button => !button.disabled && !button.hidden);
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      event.preventDefault();
    }
    if (event.code !== "Tab") event.preventDefault();
    return;
  }
  if (!inventoryPanel.hidden) {
    if (event.code === "Escape" || event.code === "KeyI") setInventoryOpen(false);
    event.preventDefault();
    return;
  }
  if (!blacksmithPanel.hidden) {
    if (event.code === "Escape") blacksmithPanel.hidden = true;
    if (["Escape", "Space", "KeyE", "KeyQ", "KeyR", "KeyF", "KeyC"].includes(event.code)) event.preventDefault();
    return;
  }
  if (!quizPanel.hidden) {
    if (event.code === "Escape") quizPanel.hidden = true;
    if (["Escape", "Space", "KeyE", "KeyQ", "KeyR", "KeyF", "KeyC"].includes(event.code)) event.preventDefault();
    return;
  }
  if (event.code === "Escape" && !tavernDialogue.hidden) {
    closeTavernDialogue();
    return;
  }
  if (event.code === "KeyI") {
    event.preventDefault();
    setInventoryOpen(true);
    return;
  }
  if (event.code === "KeyQ") setInteractionMode(alternateInteractionMode(interactionMode));
  if (event.code === "KeyH") { event.preventDefault(); requestPotion(); }
  if (event.code === "KeyE") {
    event.preventDefault();
    if (nearbyTradePlayerId) openNearbyPlayerInteraction();
    else requestPrimaryAction();
  }
  if (event.code === "KeyC") requestDefense(true);
  if (event.code === "KeyR") {
    activatePowerSlot("primary", false);
    powerAimKey = "KeyR";
    beginPowerAim();
  }
  if (event.code === "KeyT" && activatePowerSlot("secondary")) {
    powerAimKey = "KeyT";
    beginPowerAim();
  }
  if (event.code === "KeyF") beginSpecialAim();
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) requestDodge();
  }
});
window.addEventListener("keyup", event => {
  if (event.code === "KeyC") requestDefense(false);
  if (event.code === powerAimKey) commitPowerAim();
  if (event.code === "KeyF") commitSpecialAim();
});
canvas.addEventListener("pointerdown", event => {
  if (!levelUpPanel.hidden) return;
  if (event.button === 2) {
    rangedFirePointer = null;
    event.preventDefault();
    requestDefense(true);
    return;
  }
  if (event.button !== 0) return;
  updatePointerPosition(event);
  updateTarget();
  requestPrimaryAction();
  if (event.pointerType === "mouse" && rangedFireAllowed()) rangedFirePointer = event.pointerId;
});
window.addEventListener("pointerup", event => { if (event.pointerId === rangedFirePointer) rangedFirePointer = null; });
window.addEventListener("pointercancel", event => { if (event.pointerId === rangedFirePointer) rangedFirePointer = null; });
canvas.addEventListener("pointerup", event => {
  if (event.button === 2) requestDefense(false);
});
canvas.addEventListener("pointercancel", () => requestDefense(false));
canvas.addEventListener("contextmenu", event => event.preventDefault());
mineButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestPrimaryAction();
});
dodgeButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  requestDodge();
});
for (const button of [defenseButton, defenseSlot]) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    requestDefense(true);
  });
  button.addEventListener("pointerup", event => {
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    requestDefense(false);
  });
  button.addEventListener("pointercancel", () => requestDefense(false));
}
specialButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  specialButton.setPointerCapture(event.pointerId);
  beginSpecialAim(event.pointerId);
});
specialSlot.addEventListener("pointerdown", event => {
  event.preventDefault();
  specialSlot.setPointerCapture(event.pointerId);
  beginSpecialAim(event.pointerId);
});
specialButton.addEventListener("pointermove", event => {
  if (specialAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
specialButton.addEventListener("pointerup", event => {
  if (specialAimPointerId === event.pointerId) commitSpecialAim();
});
specialButton.addEventListener("pointercancel", cancelSpecialAim);
specialSlot.addEventListener("pointermove", event => {
  if (specialAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
specialSlot.addEventListener("pointerup", event => {
  if (specialAimPointerId === event.pointerId) commitSpecialAim();
});
specialSlot.addEventListener("pointercancel", cancelSpecialAim);
powerButton.addEventListener("pointerdown", event => {
  event.preventDefault();
  powerButton.setPointerCapture(event.pointerId);
  beginPowerAim(event.pointerId);
});
powerButton.addEventListener("pointermove", event => {
  if (powerAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
powerButton.addEventListener("pointerup", event => {
  if (powerAimPointerId === event.pointerId) commitPowerAim();
});
powerButton.addEventListener("pointercancel", cancelPowerAim);
powerSlot.addEventListener("pointerdown", event => {
  event.preventDefault();
  powerSlot.setPointerCapture(event.pointerId);
  beginPowerAim(event.pointerId);
});
powerSlot.addEventListener("pointermove", event => {
  if (powerAimPointerId !== event.pointerId) return;
  updatePointerPosition(event);
});
powerSlot.addEventListener("pointerup", event => {
  if (powerAimPointerId === event.pointerId) commitPowerAim();
});
powerSlot.addEventListener("pointercancel", cancelPowerAim);

const frameSamples: number[] = [];
const pendingPings = new Map<string, number>();
let serverClock = createServerClock(performance.now(), Date.now());
let pingSequence = 0;
let lastPingSentAt = 0;
let lastPerformanceUpdateAt = 0;

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

function updatePerformanceMetrics(now: number): void {
  if (now - lastPerformanceUpdateAt < 500 || frameSamples.length < 10) return;
  lastPerformanceUpdateAt = now;
  const p50 = percentile(frameSamples, 0.5);
  const p95 = percentile(frameSamples, 0.95);
  const fps = p50 > 0 ? 1000 / p50 : 0;
  const visibleVoxels = [...chunks.values()].reduce((total, chunk) => total + chunk.visibleBlocks, 0);
  const meshes = [...chunks.values()].reduce((total, chunk) => total + chunk.meshes.length, 0);
  const triangles = [...chunks.values()].reduce((total, chunk) => total + chunk.visibleFaces * 2, 0);
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  const stable = frameSamples.length >= 120;
  const withinBudget = stable && p95 <= 33.3 && (networkRttMs === null || networkRttMs <= 150) && lastChunkBuildMs <= 250;

  performanceFields.frame.textContent = `${p50.toFixed(1)} / ${p95.toFixed(1)} ms`;
  performanceFields.fps.textContent = `${Math.round(fps)}`;
  performanceFields.rtt.textContent = networkRttMs === null ? "Waiting…" : `${networkRttMs.toFixed(0)} ms`;
  performanceFields.voxels.textContent = visibleVoxels.toLocaleString();
  performanceFields.geometry.textContent = `${meshes} / ${triangles.toLocaleString()}`;
  performanceFields.chunks.textContent = `${lastChunkBuildMs.toFixed(1)} ms`;
  performanceFields.payload.textContent = formatBytes(worldPayloadBytes);
  performanceFields.memory.textContent = memory ? formatBytes(memory) : "Unavailable";
  performanceFields.budget.className = stable ? (withinBudget ? "pass" : "fail") : "";
  performanceFields.budget.textContent = !stable
    ? `Collecting sample ${frameSamples.length}/120…`
    : withinBudget
      ? "PASS · p95 ≤ 33.3 ms · RTT ≤ 150 ms"
      : "CHECK · one or more provisional budgets exceeded";

  (window as Window & { __BLOCKCRAFT_PERF__?: Record<string, number | boolean | null> }).__BLOCKCRAFT_PERF__ = {
    p50,
    p95,
    fps,
    networkRttMs,
    visibleVoxels,
    meshes,
    triangles,
    lastChunkBuildMs,
    worldPayloadBytes,
    stable,
    withinBudget,
  };
}

function reconcileLocalPlayer(
  dt: number,
  moving: boolean,
  sequenceLag: number,
  grounded: boolean,
  authoritativeInputReady: boolean,
): { distance: number; rate: number } {
  if (!worldReady || !defeatScreen.hidden || awaitingReturnState || pendingPortalDestination) return { distance: 0, rate: 0 };
  const position = localPlayer.getPosition();
  const beforeCorrection = position.clone();
  const target = authoritativeLocalPosition.clone();
  if (moving) {
    const projected = replayPendingMovement(target, lastProcessedInputSequence, pendingPredictionFrames,
      (pose, delta) => resolvePlayerMotion(pose, delta, readCollisionWorldBlock));
    target.set(projected.x, projected.y, projected.z);
  }
  target.y = reconciliationVerticalTarget(position.y, target.y, grounded);
  const distance = position.distance(target);
  const now = performance.now();
  const reconciliationRate = localReconciliationRate(distance, moving, sequenceLag, authoritativeInputReady, now - lastAuthoritativeMovementAt, now - lastAcknowledgementAdvancedAt);
  if (!Number.isFinite(reconciliationRate)) {
    const mobilityAdvance = localActivePower !== null
      && POWER_DEFINITIONS[localActivePower].core === "mobility"
      && localPowerStartedAt !== null;
    if (worldReady) logMovementEvent(`${mobilityAdvance ? "MOBILITY ADVANCE" : "HARD CORRECTION"} d=${distance.toFixed(3)} lag=${sequenceLag}`);
    if (mobilityAdvance) {
      localPowerVisualOffset.x += position.x - target.x;
      localPowerVisualOffset.z += position.z - target.z;
    } else {
      // Preserve the rendered location on receipt, then recover at a bounded
      // speed. Collision and combat remain at the authoritative location.
      localRecoveryVisualOffset.x += position.x - target.x + localNetworkVisualOffset.x;
      localRecoveryVisualOffset.z += position.z - target.z + localNetworkVisualOffset.z;
    }
    localVisualVerticalOffset += position.y - target.y;
    localPlayer.setPosition(target);
    localVerticalVelocity = 0;
  } else if (reconciliationRate > 0) {
    const previousY = position.y;
    position.lerp(position, target, Math.min(1, dt * reconciliationRate));
    localVisualVerticalOffset += previousY - position.y;
    localPlayer.setPosition(position);
  }
  const correctionDistance = beforeCorrection.distance(localPlayer.getPosition());
  if (correctionDistance >= 0.2) recordSnapDiagnostic(
    !Number.isFinite(reconciliationRate) ? "HARD_RECONCILE" : "SOFT_RECONCILE",
    beforeCorrection,
    localPlayer.getPosition().clone(),
  );
  return { distance, rate: reconciliationRate };
}

app.on("update", (dt: number) => {
  app.autoRender = Boolean(inventoryPanel.hidden);
  if (!app.autoRender && inventoryRenderDue(performance.now(), inventoryBackgroundFrameAt)) {
    inventoryBackgroundFrameAt = performance.now();
    app.renderNextFrame = true;
  }
  refreshPotionUi();
  frameSamples.push(dt * 1000);
  if (frameSamples.length > 240) frameSamples.shift();
  const keyboardStrafe = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const keyboardForward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const strafe = lootPanel.hidden && defeatScreen.hidden && quizPanel.hidden && blacksmithPanel.hidden && inventoryPanel.hidden && levelUpPanel.hidden && !playerInteractionUI.isOpen() ? Math.max(-1, Math.min(1, keyboardStrafe + touchStrafe)) : 0;
  const forward = lootPanel.hidden && defeatScreen.hidden && quizPanel.hidden && blacksmithPanel.hidden && inventoryPanel.hidden && levelUpPanel.hidden && !playerInteractionUI.isOpen() ? Math.max(-1, Math.min(1, keyboardForward - touchForward)) : 0;
  const frameTime = Math.min(dt, 0.05);
  cameraOrbit = advanceCameraOrbit(
    cameraOrbit,
    Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft")),
    Number(keys.has("ArrowUp")) - Number(keys.has("ArrowDown")),
    frameTime,
  );
  const cameraOffset = cameraOrbitOffset(cameraOrbit);
  const desiredMovement = quantizeMovementToEightDirections(
    cameraRelativeMovement(strafe, forward, cameraOffset.x, cameraOffset.z),
  );
  smoothedMovement = worldReady ? approachMovement(smoothedMovement, desiredMovement, frameTime) : { x: 0, z: 0 };
  const powerFacingActive = powerAimActive || (localPowerStartedAt !== null
    && performance.now() - localPowerStartedAt < powerDuration(localActivePower)
    && localPowerFacingYaw !== null);
  const actionFacingActive = localActionStartedAt !== null
    && performance.now() - localActionStartedAt < actionDuration(localActionStep)
    && localActionFacingYaw !== null;
  const desiredFacingYaw = specialAimActive
    ? specialAimYaw
    : powerFacingActive
    ? powerAimActive ? powerAimYaw : localPowerFacingYaw!
    : actionFacingActive
    ? localActionFacingYaw!
    : interactionMode === "combat" && rangedPointer.active && WEAPON_ATTACK_DEFINITIONS[localMainHandId].projectileTravelMs > 0
    ? mouseRangedYaw(localFacingYaw)
    : movementYaw(desiredMovement.x, desiredMovement.z, localFacingYaw);
  localFacingYaw = approachYaw(localFacingYaw, desiredFacingYaw, frameTime);
  if (movementShadowInput && room && worldReady) {
    const steps = movementPilotController ? movementPilotController.tick(performance.now()) : (() => {
      movementShadowAccumulator = Math.min(0.1, movementShadowAccumulator + frameTime);
      const due = Math.floor(movementShadowAccumulator * 30);
      movementShadowAccumulator -= due / 30;
      return due;
    })();
    for (let step = 0; step < steps; step += 1) {
      movementShadowInput.data.strafe = smoothedMovement.x;
      movementShadowInput.data.forward = smoothedMovement.z;
      movementShadowInput.data.yaw = ((localFacingYaw % 360) + 360) % 360;
      movementShadowInput.send();
    }
  }
  const current = localPlayer.getPosition();
  const grounded = isPlayerSupported(readCollisionWorldBlock, current.x, current.y, current.z);
  if (movementPilotController) localVerticalVelocity = movementPilotController.pose().pilotVy;
  else if (grounded && localVerticalVelocity < 0) localVerticalVelocity = 0;
  else localVerticalVelocity = Math.max(-TERMINAL_VELOCITY, localVerticalVelocity - GRAVITY * frameTime);
  const rawPilotPose = movementPilotController?.pose();
  const stablePilot = rawPilotPose
    ? stabilizePilotPose(
      { x: current.x, y: current.y, z: current.z, pilotVy: localVerticalVelocity },
      rawPilotPose,
      pendingPilotPoseCandidate,
    )
    : null;
  if (stablePilot) {
    const firstQuarantinedSample = stablePilot.quarantined && pendingPilotPoseCandidate === null;
    pendingPilotPoseCandidate = stablePilot.candidate;
    if (firstQuarantinedSample) logMovementEvent("PILOT PATCH QUARANTINED");
    if (stablePilot.confirmedJump) {
      localRecoveryVisualOffset.x += current.x - stablePilot.pose.x;
      localRecoveryVisualOffset.z += current.z - stablePilot.pose.z;
      localVisualVerticalOffset += current.y - stablePilot.pose.y;
      logMovementEvent("PILOT CORRECTION CONFIRMED");
    }
  } else pendingPilotPoseCandidate = null;
  const pilotPose = stablePilot?.pose;
  const predicted = pilotPose ? { x: pilotPose.x, y: pilotPose.y, z: pilotPose.z,
    grounded: isPlayerSupported(readCollisionWorldBlock, pilotPose.x, pilotPose.y, pilotPose.z),
    hitVertical: false, stepped: false } : worldReady ? resolvePlayerMotion(
    current,
    {
      x: smoothedMovement.x * localMovementSpeed() * frameTime,
      y: localVerticalVelocity * frameTime,
      z: smoothedMovement.z * localMovementSpeed() * frameTime,
    },
    readCollisionWorldBlock,
  ) : { x: current.x, y: current.y, z: current.z, grounded, hitVertical: false, stepped: false };
  const requestedTravel = Math.hypot(smoothedMovement.x, smoothedMovement.z) * localMovementSpeed() * frameTime;
  const sendMovementThisFrame = movementDirectionChanged(lastSentMovement, smoothedMovement)
    || performance.now() - lastMoveSentAt >= 50;
  if (room && worldReady && !movementPilotController) {
    pendingPredictionFrames.push({
      sequence: moveSequence + Number(sendMovementThisFrame),
      x: smoothedMovement.x * localMovementSpeed() * frameTime,
      z: smoothedMovement.z * localMovementSpeed() * frameTime,
    });
    while (pendingPredictionFrames.length > 240
      || (pendingPredictionFrames[0]?.sequence ?? Infinity) <= lastProcessedInputSequence) pendingPredictionFrames.shift();
  }
  const collisionTravel = Math.hypot(predicted.x - current.x, predicted.z - current.z);
  if (predicted.hitVertical || predicted.grounded) localVerticalVelocity = 0;
  if (predicted.stepped) {
    localVisualVerticalOffset += current.y - predicted.y;
    logMovementEvent(`STEP y ${current.y.toFixed(3)} → ${predicted.y.toFixed(3)}`);
  }
  localPlayer.setPosition(predicted.x, predicted.y, predicted.z);
  localPlayer.setEulerAngles(0, localFacingYaw, 0);
  const moving = Math.hypot(smoothedMovement.x, smoothedMovement.z) > 0.01;
  const lastSentMoving = Math.hypot(lastSentMovement.x, lastSentMovement.z) > 0.01;
  const reconciliationNow = performance.now();
  if (moving) pendingStopInputSequence = null;
  else if (lastSentMoving && pendingStopInputSequence === null) {
    pendingStopInputSequence = moveSequence + 1;
    pendingStopDeadline = reconciliationNow + 1500;
  }
  if (pendingStopInputSequence !== null
    && (lastProcessedInputSequence >= pendingStopInputSequence || reconciliationNow >= pendingStopDeadline)) {
    pendingStopInputSequence = null;
  }
  const authoritativeInputReady = pendingStopInputSequence === null;
  const sequenceLag = Math.max(0, moveSequence - lastProcessedInputSequence);
  const reconciliation = movementPilotController
    ? { distance: localPlayer.getPosition().distance(authoritativeLocalPosition), rate: 0 }
    : reconcileLocalPlayer(dt, moving, sequenceLag, predicted.grounded || grounded, authoritativeInputReady);
  if (!Number.isFinite(reconciliation.rate)) localNetworkVisualOffset = { x: 0, z: 0 };
  else {
    const reconciledPosition = localPlayer.getPosition();
    localNetworkVisualOffset = smoothNetworkVisualOffset(
      localNetworkVisualOffset,
      { x: predicted.x - reconciledPosition.x, z: predicted.z - reconciledPosition.z },
      moving,
      frameTime,
    );
  }
  updateActiveChunkMeshes(localPlayer.getPosition());
  localVisualVerticalOffset = smoothVerticalOffset(localVisualVerticalOffset, frameTime);
  localPowerVisualOffset.mulScalar(Math.max(0, 1 - frameTime * 11));
  localRecoveryVisualOffset = smoothRecoveryOffset(localRecoveryVisualOffset, frameTime);
  localDodgeVisualOffset = advanceDodgeVisualOffset(localDodgeVisualOffset, frameTime);
  localPlayerVisual.setLocalPosition(localPowerVisualOffset.x + localNetworkVisualOffset.x + localRecoveryVisualOffset.x + localDodgeVisualOffset.x, localVisualVerticalOffset, localPowerVisualOffset.z + localNetworkVisualOffset.z + localRecoveryVisualOffset.z + localDodgeVisualOffset.z);
  const animationNow = performance.now();
  sceneDressing.update(animationNow);
  const animationTime = animationNow / 1000;
  if (silverDepthsRoot.enabled) for (const mote of silverDepthsMotes) {
    mote.entity.setLocalPosition(mote.entity.getLocalPosition().x, mote.baseY + Math.sin(animationTime * 1.35 + mote.phase) * .16, mote.entity.getLocalPosition().z);
    mote.entity.rotateLocal(0, frameTime * 32, frameTime * 18);
  }
  const localActionElapsed = localActionStartedAt === null ? null : animationNow - localActionStartedAt;
  const localPowerElapsed = localPowerStartedAt === null ? null : animationNow - localPowerStartedAt;
  const activePowerDefinition = localActivePower ? POWER_DEFINITIONS[localActivePower] : null;
  const activePowerForwardStep = localActivePower ? activePowerShape(localActivePower).forwardStep : 0;
  if (localPowerElapsed !== null
    && activePowerDefinition !== null
    && activePowerForwardStep > 0
    && localPowerElapsed >= activePowerDefinition.windupMs
    && !localPowerStepApplied
    && localPowerFacingYaw !== null) {
    if (activePowerDefinition.core !== "mobility") {
      const radians = localPowerFacingYaw * Math.PI / 180;
      const powerPosition = localPlayer.getPosition();
      const horizontalPowerMovement = {
        x: Math.sin(radians) * activePowerForwardStep,
        z: Math.cos(radians) * activePowerForwardStep,
      };
      const stepped = resolvePlayerMotion(powerPosition, { ...horizontalPowerMovement, y: 0 }, readCollisionWorldBlock);
      localPlayer.setPosition(stepped.x, stepped.y, stepped.z);
    }
    localPowerStepApplied = true;
  }
  if (animationNow >= localHitPauseUntil) {
    animateVoxelCharacter(localPlayerRig, animationTime, frameTime, localVerticalVelocity, predicted.grounded || grounded, localActionElapsed, localActionStep, localActionMainHandId, localPowerElapsed, localActivePower, localActionFacingYaw, moving ? collisionTravel : 0, localFacingYaw);
    if (localDefending) applyDefensePose(localPlayerRig);
  }
  const dodgeElapsed = localDodgeStartedAt === null ? null : animationNow - localDodgeStartedAt;
  if (dodgeElapsed !== null && dodgeElapsed < 320) {
    const dodgeProgress = dodgeElapsed / 320;
    localPlayerVisual.setLocalEulerAngles(0, 0, -Math.sin(dodgeProgress * Math.PI) * 13);
  } else {
    localPlayerVisual.setLocalEulerAngles(0, 0, 0);
    if (dodgeElapsed !== null) localDodgeStartedAt = null;
  }
  if (localActionElapsed !== null && localActionElapsed >= actionDuration(localActionStep)) {
    localActionStartedAt = null;
    localActionFacingYaw = null;
    localActionStep = 0;
    localActionMainHandId = null;
  }
  if (localPowerElapsed !== null && localPowerElapsed >= powerDuration(localActivePower)) {
    localPowerStartedAt = null;
    localPowerFacingYaw = null;
    localPowerStepApplied = false;
    localActivePower = null;
  }

  const player = localPlayer.getPosition();
  const renderAt = performance.now() - REMOTE_INTERPOLATION_DELAY_MS;
  for (const remote of remotePlayers.values()) {
    const pose = sampleRemotePose(remote.snapshots, renderAt);
    if (pose) {
      remote.entity.enabled = undergroundKnown(pose.x, pose.y, pose.z);
      const previousPosition = remote.entity.getPosition();
      const remoteTravel = Math.hypot(pose.x - previousPosition.x, pose.z - previousPosition.z);
      const remoteVerticalVelocity = (pose.y - previousPosition.y) / Math.max(frameTime, 0.001);
      remote.entity.setPosition(pose.x, pose.y, pose.z);
      remote.entity.setEulerAngles(0, pose.yaw, 0);
      const remoteActionElapsed = remote.actionStartedAt === null ? null : animationNow - remote.actionStartedAt;
      const remotePowerElapsed = remote.powerStartedAt === null ? null : animationNow - remote.powerStartedAt;
      animateVoxelCharacter(remote.rig, animationTime, frameTime, remoteVerticalVelocity, true, remoteActionElapsed, remote.actionStep, remote.actionMainHandId, remotePowerElapsed, remote.powerId, remote.entity.getEulerAngles().y, remoteTravel, pose.yaw);
      if (remote.defending) applyDefensePose(remote.rig);
      if (remoteActionElapsed !== null && remoteActionElapsed >= remoteActionDuration(remote.actionMainHandId, remote.actionStep)) {
        remote.actionStartedAt = null;
        remote.actionMainHandId = null;
      }
      if (remotePowerElapsed !== null && remotePowerElapsed >= powerDuration(remote.powerId)) {
        remote.powerStartedAt = null;
        remote.powerId = null;
      }
    }
    trimRemoteSnapshots(remote.snapshots, renderAt);
  }
  const highlightedLootId = nearestLootDrop();
  for (const [lootId, loot] of lootVisuals) {
    const visible = animationNow >= loot.revealAt && undergroundKnown(loot.state.x, loot.state.y, loot.state.z)
      && !isCutawayHidden(Math.floor(loot.state.x), Math.floor(loot.state.y), Math.floor(loot.state.z));
    loot.root.enabled = visible;
    if (!visible) continue;
    const flight = Math.max(0, Math.min(1, (animationNow - loot.revealAt) / Math.max(1, loot.landedAt - loot.revealAt)));
    const bob = flight >= 1 ? Math.sin(animationTime * 3.2 + loot.phase) * 0.08 : 0;
    const targetY = loot.state.y + .36;
    if (flight < 1) {
      const eased = 1 - (1 - flight) ** 2;
      loot.root.setPosition(
        loot.tossFrom.x + (loot.state.x - loot.tossFrom.x) * eased,
        loot.tossFrom.y + (targetY - loot.tossFrom.y) * eased + Math.sin(flight * Math.PI) * .9,
        loot.tossFrom.z + (loot.state.z - loot.tossFrom.z) * eased,
      );
      loot.root.setEulerAngles(flight * 260, (flight * 520 + loot.phase * 23) % 360, flight * 180);
    } else {
      loot.root.setPosition(loot.state.x, targetY + bob, loot.state.z);
      loot.root.setEulerAngles(0, (animationTime * 58 + loot.phase * 23) % 360, 0);
    }
    const bagItems = lootItems(loot.state);
    const bagTier = isEnemyLootBag(loot.state) ? lootBagTierForItems(bagItems) : null;
    const pileScale = bagTier ? 1 : isEquipmentItem(loot.state.itemId) ? 1 : 1 + Math.min(.28, Math.log2(Math.max(1, loot.state.quantity)) * .08);
    const focusPulse = lootId === highlightedLootId ? 1.08 + Math.sin(animationTime * 7) * .025 : 1;
    loot.root.setLocalScale(pileScale * focusPulse, pileScale * focusPulse, pileScale * focusPulse);
    loot.marker.enabled = animationNow >= loot.landedAt;
    if (loot.marker.render && isItemId(loot.state.itemId)) loot.marker.render.material = lootWouldOverflow(lootId, loot.state)
      ? fullLootMarkerMaterial : bagTier ? lootBagMaterials[bagTier] : rarityLootMaterials[itemRarity(loot.state.itemId)];
    if (!loot.audioPlayed && loot.marker.enabled && (bagTier !== null || isEquipmentItem(loot.state.itemId))) {
      loot.audioPlayed = true;
      const rarity = bagTier ? LOOT_BAG_TIER_RARITY[bagTier] : itemRarity(loot.state.itemId);
      const player = localPlayer.getPosition();
      if (Math.hypot(loot.state.x - player.x, loot.state.z - player.z) <= 18) {
        if (rarity === "rare") combatAudio.play("lootRare", enemyCuePan(loot.state.x, player.x, 18));
        if (rarity === "epic") combatAudio.play("lootEpic", enemyCuePan(loot.state.x, player.x, 18));
        if (rarity === "legendary") combatAudio.play("lootLegendary", enemyCuePan(loot.state.x, player.x, 18));
      }
    }
    if (loot.marker.enabled) {
      const scale = lootMarkerScale(animationNow, loot.revealAt);
      const focusScale = lootId === highlightedLootId ? 1.25 + Math.sin(animationTime * 7) * .08 : .72;
      loot.marker.setLocalScale(focusScale * scale, .012, focusScale * scale);
      loot.marker.setLocalPosition(0, -.54 - bob, 0);
    }
  }
  updateLootWorldLabel();
  for (const [mobId, mob] of mobVisuals) {
    if (mob.frameAlive !== mob.state.alive) {
      mob.defeatAt = mob.state.alive ? -Infinity : animationNow;
      mob.frameAlive = mob.state.alive;
      if (mob.state.alive) {
        mob.art.walk = 0;
        mob.art.pursuit = 0;
        mob.locomotionSpeed = 0;
        mob.turnLean = 0;
        mob.snapshots.length = 0;
        mob.snapshots.push({ receivedAt: animationNow, x: mob.state.x, y: mob.state.y, z: mob.state.z, yaw: mob.state.yaw });
        mob.entity.setPosition(mob.state.x, mob.state.y, mob.state.z);
        mob.renderYaw = mob.state.yaw;
      }
    }
    const serverNow = animationNow + serverClock.offset;
    const materializing = !mob.state.alive && mob.state.materializeUntil > serverNow;
    const respawnIndicator = cavernRespawnIndicator(mobId, mob.state.alive, mob.state.respawnAt, serverNow);
    const deathPose = mobDefeatPose(mob.art.rootGuardian ? "root_guardian" : mob.state.archetype, mob.state.alive ? 0 : animationNow - mob.defeatAt);
    const defeat = mob.state.alive ? 0 : deathPose.collapse;
    const visible = undergroundMobVisible(mob.state.x, mob.state.y, mob.state.z) && (mob.state.alive || deathPose.visible || materializing || Boolean(respawnIndicator));
    mob.entity.enabled = visible;
    mob.combatCue.hidden = true;
    mob.levelTag.hidden = true;
    mob.respawnTag.hidden = true;
    if (!visible) continue;
    mob.statusRoot.enabled = mob.state.alive;
    mob.bodyRoot.enabled = mob.state.alive || deathPose.visible;
    mob.respawnCue.enabled = materializing || respawnIndicator?.phase === "warning";
    if (materializing) {
      const progress = Math.max(0, Math.min(1, 1 - (mob.state.materializeUntil - serverNow) / 1_500));
      const pulse = 1 + Math.sin(animationTime * 13) * .08;
      mob.respawnCue.setLocalScale((.72 + progress * .38) * pulse, 1, (.72 + progress * .38) * pulse);
      mob.respawnCue.setLocalEulerAngles(0, animationTime * 55, 0);
      mob.respawnCueMaterial.opacity = .22 + progress * .42;
      mob.respawnCueMaterial.emissive.set(.12 + progress * .22, .48 + progress * .42, .2 + progress * .3);
      mob.respawnCueMaterial.update();
    } else if (respawnIndicator?.phase === "warning") {
      const pulse = 1 + Math.sin(animationTime * 12) * .12;
      mob.respawnCue.setLocalScale(pulse, 1, pulse);
      mob.respawnCue.setLocalEulerAngles(0, animationTime * 70, 0);
      mob.respawnCueMaterial.opacity = .38 + Math.sin(animationTime * 12) * .12;
      mob.respawnCueMaterial.emissive.set(.72, .12, .025);
      mob.respawnCueMaterial.update();
    }
    const currentMobPosition = mob.entity.getPosition();
    const previousYaw = mob.renderYaw;
    const motion = advanceMobMotion({ x: currentMobPosition.x, y: currentMobPosition.y,
      z: currentMobPosition.z, yaw: mob.renderYaw }, mob.locomotionSpeed,
      mob.snapshots, animationNow, frameTime, mob.state.alive && mob.state.combatState === "idle",
      mob.state.combatState === "strike" || (mob.hitAt > 0 && animationNow - mob.hitAt < 180));
    const sampled = motion.pose;
    mob.locomotionSpeed = motion.gaitSpeed;
    const moveSpeed = visibleMobGaitSpeed(motion.gaitSpeed,
      Math.hypot(sampled.x - currentMobPosition.x, sampled.z - currentMobPosition.z), frameTime);
    mob.entity.setPosition(sampled.x, sampled.y, sampled.z);
    mob.renderYaw = sampled.yaw;
    trimMobSnapshots(mob.snapshots, animationNow);
    const hitStrength = mob.hitAt > 0 ? Math.max(0, 1 - (animationNow - mob.hitAt) / 180) : 0;
    const presentation = enemyAttackPresentation(mob.state, serverNow);
    // Committed attacks must match the authoritative strike direction. Keep
    // the scalar in sync so recovery never resumes from an aliased Euler Y.
    if (presentation.aimLocked) mob.renderYaw = mob.state.yaw;
    mob.turnLean = advanceMobTurnLean(mob.turnLean, previousYaw, mob.renderYaw, frameTime, presentation.aimLocked);
    mob.entity.setEulerAngles(0, mob.renderYaw, 0);
    const attackElapsed = presentation.elapsed;
    const attackDuration = mob.isBrute ? 760 : mob.isSpitter ? 520 : 460;
    const attackPeak = ["rocks", "falling-rocks", "warden-barrage"].includes(mob.state.attackPattern) ? 180 : mob.isSpitter ? attackDuration / 2 : mobMeleeImpactMs(mob.state.archetype);
    const attackPhase = attackElapsed < attackPeak ? attackElapsed / attackPeak * 0.5
      : 0.5 + (attackElapsed - attackPeak) / (attackDuration - attackPeak) * 0.5;
    const attackStrength = mob.art.matriarch ? mob.state.alive && mob.state.attackStartedAt > 0 && ["windup", "recover"].includes(mob.state.combatState) ? matriarchRecoil(attackElapsed, mob.state.attackPattern === "double-fan") : 0
      : mob.state.attackStartedAt > 0 && mob.state.alive && attackElapsed >= 0 && attackElapsed < attackDuration ? Math.sin(attackPhase * Math.PI) : 0;
    if (mob.isBrute && mob.state.attackPattern !== "charge" && !["rocks", "falling-rocks", "warden-barrage"].includes(mob.state.attackPattern) && presentation.impactDue && mob.lastImpactStartedAt !== mob.state.attackStartedAt) {
      mob.lastImpactStartedAt = mob.state.attackStartedAt;
      createBruteSlamImpact(mob);
    }
    const staggerElapsed = animationNow - mob.staggerAt;
    const staggerStrength = mob.staggerAt > 0 && mob.state.alive && mob.state.combatState === "stagger" && staggerElapsed >= 0
      ? 0.25 + 0.75 * Math.exp(-staggerElapsed / 600) : 0;
    const windupStrength = mob.state.alive && presentation.phase === "windup"
      ? (mob.isBrute
          ? 0.72 + Math.sin(animationTime * 12) * 0.13
          : mob.isSpitter
            ? 0.35 + Math.min(1, Math.max(0, (animationNow + serverClock.offset - mob.state.attackStartedAt)
              / Math.max(1, mob.state.attackReleaseAt - mob.state.attackStartedAt))) * 0.6
            : 0.45 + Math.min(1, Math.max(0, (animationNow + serverClock.offset - mob.state.attackStartedAt)
              / Math.max(1, mob.state.attackReleaseAt - mob.state.attackStartedAt))) * 0.5)
      : 0;
    const markState = visibleMarkState(mob);
    const exposed = Boolean(markState && markState.stacks >= markState.maxStacks);
    mob.mark.enabled = mob.state.alive && Boolean(markState);
    if (mob.mark.enabled) {
      const markPulse = 1 + Math.sin(animationTime * (exposed ? 14 : 8)) * (exposed ? 0.15 : 0.08);
      mob.mark.setLocalScale(1.55 * markPulse, 0.022, 1.55 * markPulse);
      mob.markMaterial.emissive.set(exposed ? 0.78 : 0.42, exposed ? 0.16 : 0.08, exposed ? 1 : 0.74);
      mob.markMaterial.opacity = (exposed ? 0.58 : 0.38) + Math.sin(animationTime * (exposed ? 14 : 8)) * 0.1;
      mob.markMaterial.update();
    }
    for (let index = 0; index < mob.markPips.length; index += 1) {
      const pip = mob.markPips[index]!;
      pip.enabled = Boolean(markState && index < markState.stacks);
      if (pip.enabled) {
        const pipPulse = exposed ? 1 + Math.sin(animationTime * 16 + index * 1.7) * 0.22 : 1;
        pip.setLocalScale(0.14 * pipPulse, 0.14 * pipPulse, 0.14 * pipPulse);
      }
    }
    const combatCue = enemyCombatCue(mob.state, animationNow + serverClock.offset);
    const cue = combatCue.visible ? combatCue : enemyAwarenessCue(mob.state, animationNow + serverClock.offset);
    const playerEye = localPlayer.getPosition();
    const mobDistance = Math.hypot(sampled.x - playerEye.x, sampled.y - playerEye.y, sampled.z - playerEye.z);
    if (respawnIndicator && mobDistance <= 24 && camera.camera
      && enemyCueLineClear({ x: playerEye.x, y: playerEye.y + .8, z: playerEye.z },
        { x: mob.state.x, y: mob.state.y + .35, z: mob.state.z }, readCollisionWorldBlock)) {
      const screen = camera.camera.worldToScreen(new pc.Vec3(mob.state.x, mob.state.y + .48, mob.state.z));
      const rect = canvas.getBoundingClientRect();
      const onScreen = screen.z > 0 && screen.x >= 0 && screen.x <= rect.width && screen.y >= 0 && screen.y <= rect.height;
      mob.respawnTag.hidden = !onScreen;
      if (onScreen) {
        mob.respawnTag.dataset.phase = respawnIndicator.phase;
        mob.respawnTag.textContent = respawnIndicator.phase === "warning"
          ? `DANGER · RETURNING IN ${respawnIndicator.seconds}s`
          : `AREA CLEAR · RETURNS IN ${respawnIndicator.seconds}s`;
        mob.respawnTag.style.left = `${rect.left + screen.x}px`;
        mob.respawnTag.style.top = `${rect.top + screen.y}px`;
      }
    }
    if (mob.state.alive && mobDistance <= 28 && camera.camera) {
      const screen = camera.camera.worldToScreen(new pc.Vec3(sampled.x, sampled.y + mob.healthBarY + .27, sampled.z));
      const rect = canvas.getBoundingClientRect();
      const onScreen = screen.z > 0 && screen.x >= 0 && screen.x <= rect.width && screen.y >= 0 && screen.y <= rect.height;
      mob.levelTag.hidden = !onScreen;
      if (onScreen) {
        const threat = enemyThreat(localCharacterProgression.level, mob.state.level);
        const skulls = threat === "deadly" ? "☠☠ " : threat === "dangerous" ? "☠ " : "";
        mob.levelTag.dataset.threat = threat;
        mob.levelTag.dataset.miniboss = String(mob.state.isMiniBoss);
        mob.levelTag.textContent = `${mob.state.isMiniBoss ? "★ MINI-BOSS · " : skulls}LV ${mob.state.level} · ${mob.state.name}`;
        mob.levelTag.style.left = `${rect.left + screen.x}px`;
        mob.levelTag.style.top = `${rect.top + screen.y}px`;
      }
    }
    const cueVisible = cue.visible && Math.hypot(sampled.x - playerEye.x, sampled.y - playerEye.y, sampled.z - playerEye.z) <= 14
      && enemyCueLineClear({ x: playerEye.x, y: playerEye.y + .8, z: playerEye.z },
        { x: sampled.x, y: sampled.y + .8, z: sampled.z }, readCollisionWorldBlock);
    mob.recovery.enabled = cueVisible && cue.recovery;
    if (cueVisible && camera.camera) {
      const screen = camera.camera.worldToScreen(new pc.Vec3(sampled.x, sampled.y + mob.healthBarY + .65, sampled.z));
      const rect = canvas.getBoundingClientRect();
      // PlayCanvas projects into CSS pixels, not the high-DPI backing buffer.
      mob.combatCue.hidden = screen.z <= 0 || screen.x < 0 || screen.x > rect.width || screen.y < 0 || screen.y > rect.height;
      mob.combatCue.style.left = `${rect.left + screen.x}px`;
      mob.combatCue.style.top = `${rect.top + screen.y}px`;
      mob.combatCue.dataset.kind = cue.recovery ? "recovery" : cue.kind;
      mob.combatCue.dataset.miniboss = String(mob.state.isMiniBoss);
      mob.combatCueLabel.textContent = cue.label;
      mob.combatCueFill.style.transform = `scaleX(${cue.progress})`;
    }
    mob.warning.enabled = presentation.warning && cueVisible;
    if (mob.warning.enabled) {
      if (mob.warningMesh) {
        const chargeLength = mob.isSpitter && mob.state.attackPattern !== "pool" ? spitterShotOffsets(mob.state.attackPattern).reduce((sum, offset, i) => sum + (i + 1) * enemyShotGuideLength({ x: mob.state.x, y: mob.state.y + 1.05, z: mob.state.z }, mob.state.yaw + offset, readCollisionWorldBlock, SPITTER_PATTERN.range), 0) : mob.state.attackPattern === "charge" ? Math.min(CHAMPION_CHARGE.distance, enemyShotGuideLength({ x: mob.state.attackStrikeX, y: mob.state.attackStrikeY + .8, z: mob.state.attackStrikeZ }, mob.state.yaw, readCollisionWorldBlock)) : CHAMPION_CHARGE.distance;
        const warningLength = ["rocks", "falling-rocks", "warden-barrage"].includes(mob.state.attackPattern) ? BRUTE_VOLLEY.offsets.reduce<number>((sum, offset, index) => sum + (index + 1) * enemyShotGuideLength({ x: mob.state.x, y: mob.state.y + 1.05, z: mob.state.z }, mob.state.yaw + offset, readCollisionWorldBlock, BRUTE_VOLLEY.range), 0) : chargeLength;
        if (Math.abs(mob.warningYaw - mob.state.yaw) > 0.25 || mob.warningPattern !== mob.state.attackPattern || mob.warningSequence !== mob.state.actionSequence || Math.abs(warningLength - mob.warningChargeLength) > .05) {
          updateStrikeWarningMesh(mob.warningMesh, mob.state.archetype, mob.state.yaw, mob.state.attackPattern, warningLength, mob.state);
          mob.warningYaw = mob.state.yaw;
          mob.warningPattern = mob.state.attackPattern; mob.warningChargeLength = warningLength; mob.warningSequence = mob.state.actionSequence;
        }
        mob.warning.setPosition(mob.state.attackStrikeX, mob.state.attackStrikeY + 0.04, mob.state.attackStrikeZ);
        // The marked danger area must always match the eventual damage radius.
        mob.warning.setLocalScale(1, 1, 1);
        mob.warning.setEulerAngles(0, 0, 0);
      } else {
        const length = enemyShotGuideLength({ x: mob.state.x, y: mob.state.y + .8, z: mob.state.z }, mob.state.yaw, readCollisionWorldBlock);
        mob.warning.setLocalScale(1, 1, length / 6.9);
        mob.warning.setEulerAngles(0, mob.state.yaw, 0);
      }
      const crystalWarning = mob.state.attackPattern === "crystal-burst";
      const fanWarning = mob.state.attackPattern === "fan" || mob.state.attackPattern === "double-fan";
      mob.warningMaterial.diffuse.set(crystalWarning ? .72 : mob.isSpitter ? fanWarning ? .35 : .85 : 1,
        crystalWarning ? .32 : mob.isSpitter ? fanWarning ? .62 : 1 : mob.isBrute ? .25 : .72,
        crystalWarning ? 1 : mob.isSpitter ? fanWarning ? 1 : .16 : mob.isBrute ? .08 : .18);
      mob.warningMaterial.emissive.copy(mob.warningMaterial.diffuse);
      if (mob.state.isMiniBoss) {
        mob.warningMaterial.diffuse.set(1, .56, .08);
        mob.warningMaterial.emissive.set(1, .28, .02);
      }
      mob.warningMaterial.opacity = presentation.aimLocked ? mob.state.isMiniBoss ? .78 : .65 : mob.state.isMiniBoss ? .5 : .38;
      mob.warningMaterial.update();
    }
    mob.eliteAura.enabled = mob.state.alive && (mob.state.isElite || mob.state.isMiniBoss);
    if (mob.eliteAura.enabled) {
      const elitePulse = 1 + Math.sin(animationTime * 6.5) * .09;
      mob.eliteAura.setLocalScale(elitePulse, elitePulse, elitePulse);
      mob.eliteAura.setLocalEulerAngles(0, animationTime * 42, 0);
      mob.eliteAuraMaterial.opacity = (mob.state.isMiniBoss ? .5 : .38) + Math.sin(animationTime * 6.5) * .12;
      mob.eliteAuraMaterial.update();
    }
    animateMobArt(mob.art, frameTime, animationTime, moveSpeed, mob.state.awarenessState, windupStrength, attackStrength, hitStrength, staggerStrength, defeat);
    setMobArtEnraged(mob.art, mob.state.enraged === true);
    setMobArtDefeated(mob.art, !mob.state.alive && deathPose.progress >= .3);
    const crawlerRecovery = !mob.isBrute && !mob.isSpitter && presentation.phase === "recover"
      ? Math.sin(Math.PI * Math.min(1, Math.max(0, (animationNow + serverClock.offset - mob.state.attackContactEndAt)
        / Math.max(1, mob.state.attackRecoveryEndAt - mob.state.attackContactEndAt)))) : 0;
    const gaitBob = Math.abs(Math.sin(mob.art.phase)) * mob.art.walk * (mob.isBrute ? 0.026 : 0.018);
    const bruteRecovery = bruteRecoveryPose(mob.state, animationNow + serverClock.offset);
    const bodySize = mob.art.rootGuardian ? 1.38 : mob.state.isChampion ? 1.25 : mob.state.isMiniBoss ? 1.18 : mob.state.isElite ? 1.12 : 1;
    mob.bodyRoot.setLocalScale(bodySize * (1 + defeat * 0.13), bodySize * (1 - defeat * (mob.isBrute ? 0.42 : 0.58)), bodySize * (1 + defeat * 0.1));
    mob.bodyRoot.setLocalPosition(
      0,
      gaitBob - hitStrength * 0.035 - attackStrength * (mob.isBrute ? 0.07 : 0) - crawlerRecovery * 0.06 - bruteRecovery * .1,
      attackStrength * (mob.isBrute ? 0.42 : mob.isSpitter ? -0.3 : 0.24) - windupStrength * (mob.isBrute ? 0.25 : mob.isSpitter ? -0.18 : 0.16),
    );
    mob.bodyRoot.setLocalEulerAngles(
      (mob.isBrute ? windupStrength * -11 + attackStrength * 18 + bruteRecovery * 14 : mob.isSpitter ? windupStrength * 12 - attackStrength * 20 : windupStrength * -7 + attackStrength * 9 + crawlerRecovery * 8) + defeat * (mob.isBrute ? 17 : 5) - mob.art.pursuit * mob.art.walk * (mob.isBrute ? 2 : 4),
      0,
      Math.sin(animationTime * 35) * staggerStrength * (mob.isBrute ? 7 : 12) + Math.sin(mob.art.phase) * mob.art.walk * (mob.isBrute ? 2.5 : 1.3) + mob.turnLean * 4 + defeat * (mob.isBrute ? 7 : 12),
    );
    if (mob.art.matriarch) {
      const pose = matriarchBodyPose(defeat, attackStrength);
      mob.bodyRoot.setLocalScale(pose.width, pose.height, pose.length);
      mob.bodyRoot.setLocalPosition(0, gaitBob + pose.drop - hitStrength * .035, pose.recoilZ - windupStrength * .18);
      mob.bodyRoot.setLocalEulerAngles(windupStrength * 12 - attackStrength * 20 - mob.art.pursuit * mob.art.walk * 3, 0, pose.roll + mob.turnLean * 4);
      mob.bodyMaterial.diffuse.set(mob.state.enraged ? .5 : .15, mob.state.enraged ? .16 : .34, mob.state.enraged ? .12 : .31);
    }
    if (!mob.state.alive) {
      const size = mob.art.matriarch ? [1.55, 1.45, 1.7] : [bodySize, bodySize, bodySize];
      mob.bodyRoot.setLocalScale(size[0]! * deathPose.width, size[1]! * deathPose.height, size[2]! * deathPose.length);
      mob.bodyRoot.setLocalPosition(0, deathPose.y, 0);
      mob.bodyRoot.setLocalEulerAngles(deathPose.pitch, 0, deathPose.roll);
    }
    mob.bodyMaterial.emissive.set(
      0.001 + (mob.state.isMiniBoss ? .2 : mob.state.isElite ? .12 : 0) + 0.55 * hitStrength + 0.34 * windupStrength,
      0.001 + (mob.state.isMiniBoss ? .08 : mob.state.isElite ? .025 : 0) + 0.08 * hitStrength + 0.12 * windupStrength + 0.38 * staggerStrength,
      0.001 + (mob.state.isMiniBoss ? .01 : mob.state.isElite ? .18 : 0) + 0.04 * hitStrength + 0.08 * windupStrength + 0.48 * staggerStrength,
    );
    mob.bodyMaterial.update();
  }
  for (const [casterId, telegraph] of powerTelegraphs) {
    const elapsed = animationNow - telegraph.startedAt;
    if (elapsed > telegraph.windupMs + 900) {
      telegraph.root.destroy();
      powerTelegraphs.delete(casterId);
      continue;
    }
    const progress = Math.max(0, Math.min(1, elapsed / telegraph.windupMs));
    telegraph.material.opacity = 0.18 + progress * 0.38 + Math.sin(animationTime * 28) * 0.05;
    telegraph.material.update();
  }
  updatePowerAimVisual();
  updateSpecialAimVisual();
  for (let index = dungeonBurstVisuals.length - 1; index >= 0; index -= 1) {
    const burst = dungeonBurstVisuals[index]!;
    const duration = burst.kind === "victory" ? 1450 : 900;
    const progress = (animationNow - burst.startedAt) / duration;
    if (progress >= 1) {
      burst.root.destroy(); burst.material.destroy(); dungeonBurstVisuals.splice(index, 1); continue;
    }
    const eased = 1 - (1 - Math.max(0, progress)) ** 3;
    const scale = .45 + eased * (burst.kind === "victory" ? 2.8 : 1.8);
    burst.root.setLocalScale(scale, .55 + Math.sin(progress * Math.PI) * 1.4, scale);
    burst.root.rotate(0, frameTime * (burst.kind === "victory" ? 95 : 55), 0);
    burst.material.opacity = Math.max(0, (1 - progress) * .88); burst.material.update();
  }
  for (let index = powerImpactVisuals.length - 1; index >= 0; index -= 1) {
    const impact = powerImpactVisuals[index]!;
    const elapsed = animationNow - impact.startedAt;
    const impactLifetime = impact.powerId === "eruption" ? 900 : impact.powerId === "seismic_cleave" ? 980 : 650;
    if (elapsed >= impactLifetime) {
      impact.root.destroy();
      impact.fractureRoot.destroy();
      powerImpactVisuals.splice(index, 1);
      continue;
    }
    const strength = 1 - elapsed / impactLifetime;
    if (impact.powerId === "seismic_cleave") {
      const revealDistance = POWER_DEFINITIONS.seismic_cleave.range * Math.min(1, elapsed / 360);
      for (const segment of impact.waveSegments) {
        segment.entity.enabled = segment.distance <= revealDistance;
      }
      for (const segment of impact.fractureSegments) segment.entity.enabled = segment.distance <= revealDistance + 0.25;
      impact.root.setLocalScale(1, 0.8 + Math.max(0, 1 - elapsed / 540) * 1.7, 1);
      impact.material.opacity = Math.max(0, Math.min(0.92, strength * 1.18));
      impact.material.update();
      continue;
    }
    const radialScale = impact.powerId === "shockwave" ? 1 + (1 - strength) * 1.75 : 1;
    if (impact.powerId === "eruption") {
      const eruptionRise = Math.sin(Math.min(1, elapsed / 260) * Math.PI / 2);
      impact.root.setLocalScale(0.82 + eruptionRise * 0.3, 0.15 + eruptionRise * 1.45, 0.82 + eruptionRise * 0.3);
    } else {
      impact.root.setLocalScale(
        radialScale + (impact.powerId === "shockwave" ? 0 : (1 - strength) * 0.08),
        0.65 + strength * 1.8,
        radialScale,
      );
    }
    impact.material.opacity = Math.max(0, strength * 0.82);
    impact.material.update();
  }
  for (let index = powerDebrisVisuals.length - 1; index >= 0; index -= 1) {
    const debris = powerDebrisVisuals[index]!;
    const elapsed = animationNow - debris.startedAt - (debris.delayMs ?? 0);
    if (elapsed < 0) continue;
    debris.entity.enabled = true;
    if (elapsed >= 720) {
      debris.entity.destroy();
      powerDebrisVisuals.splice(index, 1);
      continue;
    }
    debris.velocity.y -= 9.8 * frameTime;
    const position = debris.entity.getPosition();
    debris.entity.setPosition(
      position.x + debris.velocity.x * frameTime,
      position.y + debris.velocity.y * frameTime,
      position.z + debris.velocity.z * frameTime,
    );
    debris.entity.rotate(debris.spin.x * frameTime, debris.spin.y * frameTime, debris.spin.z * frameTime);
  }
  for (let index = markPayoffVisuals.length - 1; index >= 0; index -= 1) {
    const payoff = markPayoffVisuals[index]!;
    const elapsed = animationNow - payoff.startedAt;
    const duration = payoff.durationMs ?? 760;
    if (elapsed >= duration) {
      payoff.root.destroy();
      payoff.material.destroy();
      markPayoffVisuals.splice(index, 1);
      continue;
    }
    const progress = elapsed / duration;
    const strength = 1 - progress;
    payoff.root.setLocalScale(0.55 + progress * 1.25, 0.8 + Math.sin(progress * Math.PI) * 1.25, 0.55 + progress * 1.25);
    payoff.root.rotate(0, frameTime * 210, 0);
    payoff.material.opacity = Math.max(0, strength * 0.92);
    payoff.material.update();
  }
  for (const [casterId, snare] of brambleSnareVisuals) {
    const expired = Date.now() >= snare.expiresAt;
    const triggerElapsed = snare.triggeredAt === null ? null : animationNow - snare.triggeredAt;
    if (expired || (triggerElapsed !== null && triggerElapsed >= 700)) {
      snare.root.destroy();
      brambleSnareVisuals.delete(casterId);
      continue;
    }
    if (triggerElapsed !== null) {
      const progress = Math.min(1, triggerElapsed / 700);
      snare.root.setLocalScale(1 + progress * 0.75, 1 + Math.sin(progress * Math.PI) * 1.4, 1 + progress * 0.75);
      snare.material.opacity = Math.max(0, (1 - progress) * 0.86);
    } else {
      const pulse = 1 + Math.sin(animationTime * 7) * 0.055;
      snare.root.setLocalScale(pulse, 1 + Math.sin(animationTime * 9) * 0.08, pulse);
      snare.material.opacity = 0.62 + Math.sin(animationTime * 7) * 0.1;
    }
    snare.material.update();
  }
  for (let index = weaponProjectileVisuals.length - 1; index >= 0; index -= 1) {
    const projectile = weaponProjectileVisuals[index]!;
    const progress = Math.max(0, Math.min(1, (animationNow - projectile.startedAt) / projectile.durationMs));
    const next = new pc.Vec3().lerp(projectile.start, projectile.end, progress);
    const from = projectile.entity.getPosition().clone();
    const direction = next.clone().sub(from);
    const hit = direction.length() > 0.00001 ? voxelRaycast(from, direction, direction.length(), readCollisionWorldBlock) : null;
    if (hit) next.copy(from).add(direction.normalize().mulScalar(hit.distance));
    projectile.entity.setPosition(next);
    if (projectile.enemy && projectile.sampled && !projectile.nearMissPlayed && !hit && worldReady && potionHealth > 0
      && !document.hidden && wildernessTerritoryAt(localPlayer.getPosition().x, localPlayer.getPosition().z) !== null) {
      const player = localPlayer.getPosition();
      const near = projectileNearMiss(from, next, player);
      if (near) {
        projectile.nearMissPlayed = true;
        if (animationNow >= nextNearMissAt && enemyCueLineClear({ x: player.x, y: player.y + .8, z: player.z }, near, readCollisionWorldBlock)) {
          nextNearMissAt = animationNow + 350;
          combatAudio.play("nearMiss", enemyCuePan(near.x, player.x, 2));
          createRangedPopup(new pc.Vec3(near.x, near.y, near.z), "", "near-miss");
        }
      }
    }
    projectile.sampled = true;
    if (progress < 1 && !hit) continue;
    projectile.material.opacity = 0;
    projectile.material.update();
    projectile.entity.destroy();
    projectile.material.destroy();
    weaponProjectileVisuals.splice(index, 1);
  }
  for (const [hazardId, hazard] of mobHazardVisuals) {
    if (Date.now() >= hazard.expiresAt) {
      hazard.root.destroy();
      mobHazardVisuals.delete(hazardId);
      continue;
    }
    const pulse = 1 + Math.sin(animationTime * 8) * 0.07;
    hazard.root.setLocalScale(pulse, 1 + Math.sin(animationTime * 11) * 0.12, pulse);
    hazard.material.opacity = 0.5 + Math.sin(animationTime * 9) * 0.1;
    hazard.material.update();
  }
  for (const [hazardId, hazard] of depthsHazardVisuals) {
    const now = Date.now();
    if (now >= hazard.expiresAt) {
      hazard.root.destroy(); hazard.material.destroy(); depthsHazardVisuals.delete(hazardId);
      continue;
    }
    const remaining = Math.max(0, (hazard.impactAt - now) / 1_700);
    hazard.material.opacity = now < hazard.impactAt ? .34 + (1 - remaining) * .5 + Math.sin(animationTime * 14) * .08 : .9;
    hazard.material.update();
    hazard.root.setLocalScale(now < hazard.impactAt ? 1 : 1.25, 1, now < hazard.impactAt ? 1 : 1.25);
  }
  const powerRemaining = Math.max(0, localPowerCooldownUntil - Date.now());
  const powerCompatible = isPowerCompatibleWithMainHand(POWER_DEFINITIONS[localEquippedPower], localMainHandId);
  powerButton.textContent = !powerServerReady ? "Wait" : !powerCompatible ? "Locked" : powerAimActive ? "Release" : powerRemaining > 0 ? `${Math.ceil(powerRemaining / 1000)}s` : "Power";
  const specialRemaining = Math.max(0, localSpecialCooldownUntil - Date.now());
  const specialDefinition = SPECIAL_DEFINITIONS[localEquippedSpecial];
  combatHud.setCooldowns(
    cooldownState(powerRemaining, POWER_DEFINITIONS[localEquippedPower].cooldownMs, "READY · R",
      !powerServerReady ? "SERVER UPDATE" : !powerCompatible ? "INCOMPATIBLE" : powerAimActive ? "RELEASE TO CAST" : undefined),
    cooldownState(specialRemaining, specialDefinition.cooldownMs, "READY · F", specialAimActive ? "RELEASE TO ARM" : undefined),
  );
  specialButton.textContent = specialAimActive
    ? "Release"
    : specialRemaining > 0
      ? `${Math.ceil(specialRemaining / 1000)}s`
      : localEquippedSpecial === "venom_fan" ? "Fan" : localEquippedSpecial === "hunters_mark" ? "Mark" : "Snare";
  cameraTarget.set(
    player.x + localPowerVisualOffset.x + localNetworkVisualOffset.x + localRecoveryVisualOffset.x + localDodgeVisualOffset.x,
    player.y + localVisualVerticalOffset,
    player.z + localPowerVisualOffset.z + localNetworkVisualOffset.z + localRecoveryVisualOffset.z + localDodgeVisualOffset.z,
  );
  indoorCameraBlend = advanceIndoorCameraBlend(indoorCameraBlend, indoorRoofBuilding !== null && !playerCutaway.active, frameTime);
  cameraFollow = advanceCameraFollow(cameraFollow, cameraTarget, frameTime);
  cameraFocus.set(cameraFollow.x, cameraTarget.y, cameraFollow.z);
  // A small, fixed room-center bias keeps the bar and tables in view without tracking furniture as the player walks.
  cameraFocus.x += (8.5 - cameraFocus.x) * indoorCameraBlend * 0.16;
  cameraFocus.z += (15 - cameraFocus.z) * indoorCameraBlend * 0.16;
  const viewOffset = indoorCameraOffset(cameraOrbit, indoorCameraBlend);
  const desiredCamera = new pc.Vec3(cameraFocus.x + viewOffset.x, cameraFocus.y - 2 + viewOffset.y, cameraFocus.z + viewOffset.z);
  if (animationNow < cameraShakeUntil) {
    const remaining = Math.max(0, (cameraShakeUntil - animationNow) / 360);
    const amplitude = cameraShakeStrength * remaining;
    desiredCamera.x += Math.sin(animationNow * 0.095) * amplitude;
    desiredCamera.y += Math.cos(animationNow * 0.12) * amplitude * 0.55;
    desiredCamera.z += Math.sin(animationNow * 0.14 + 1.7) * amplitude;
  }
  camera.setPosition(desiredCamera);
  camera.lookAt(cameraFocus.x, cameraFocus.y - 2, cameraFocus.z);
  updateObjectiveGuidance();
  updateRangedReticle();
  updateRangedFeedback(animationNow);
  if (rangedFirePointer !== null) {
    const readyAt = localActionStartedAt === null ? 0 : localActionStartedAt + actionDuration(localActionStep);
    const fire = heldFireStep(true, rangedFireAllowed(), performance.now(), readyAt);
    if (!fire.held) rangedFirePointer = null;
    else if (fire.fire) requestAttack();
  }
  updateBossHud(animationNow);
  const bodyY = localPlayerRig.root.getLocalPosition().y;
  const renderedPlayerPosition = new pc.Vec3(player.x + localPowerVisualOffset.x + localNetworkVisualOffset.x + localRecoveryVisualOffset.x + localDodgeVisualOffset.x, player.y + localVisualVerticalOffset + bodyY, player.z + localPowerVisualOffset.z + localNetworkVisualOffset.z + localRecoveryVisualOffset.z + localDodgeVisualOffset.z);
  const playerScreen = camera.camera?.worldToScreen(renderedPlayerPosition);
  updateUndergroundPresentation(player, frameTime);
  updateIndoorRoof(player);
  updateCaveDiscovery(player, performance.now());
  updateTarget();

  const now = performance.now();
  updateMining(now);
  const cameraWorldPosition = camera.getPosition();
  const rightArmPitch = localPlayerRig.rightArm.getLocalEulerAngles().x;
  const leftLegPitch = localPlayerRig.leftLeg.getLocalEulerAngles().x;
  const traceFrame: StopTraceFrame = {
    at: now,
    dtMs: dt * 1000,
    rawX: strafe,
    rawZ: forward,
    desiredX: desiredMovement.x,
    desiredZ: desiredMovement.z,
    appliedX: smoothedMovement.x,
    appliedZ: smoothedMovement.z,
    localX: player.x,
    localY: player.y,
    localZ: player.z,
    renderedY: renderedPlayerPosition.y,
    serverX: authoritativeLocalPosition.x,
    serverY: authoritativeLocalPosition.y,
    serverZ: authoritativeLocalPosition.z,
    screenX: playerScreen?.x ?? Number.NaN,
    screenY: playerScreen?.y ?? Number.NaN,
    cameraX: cameraWorldPosition.x,
    cameraY: cameraWorldPosition.y,
    cameraZ: cameraWorldPosition.z,
    focusX: cameraFocus.x,
    focusY: cameraFocus.y,
    focusZ: cameraFocus.z,
    animationWeight: localPlayerRig.locomotionWeight,
    animationPhase: localPlayerRig.locomotionPhase,
    bodyY,
    rightArmPitch,
    leftLegPitch,
    reconciliationDistance: reconciliation.distance,
    reconciliationRate: reconciliation.rate,
    verticalVelocity: localVerticalVelocity,
    visualOffset: localVisualVerticalOffset,
    grounded: predicted.grounded || grounded,
    stepped: predicted.stepped,
    hitVertical: predicted.hitVertical,
    sentSequence: moveSequence,
    acknowledgedSequence: lastProcessedInputSequence,
    pendingStopSequence: pendingStopInputSequence,
    networkAgeMs: now - lastAuthoritativeMovementAt,
    acknowledgementAgeMs: now - lastAcknowledgementAdvancedAt,
    requestedTravel,
    collisionTravel,
    netVisualX: localNetworkVisualOffset.x,
    netVisualZ: localNetworkVisualOffset.z,
  };
  const previousSnapFrame = snapFrameHistory.at(-1);
  if (worldReady && previousSnapFrame) {
    const worldDelta = Math.hypot(player.x - previousSnapFrame.localX, player.y - previousSnapFrame.localY, player.z - previousSnapFrame.localZ);
    const cameraDelta = Math.hypot(cameraWorldPosition.x - previousSnapFrame.cameraX, cameraWorldPosition.y - previousSnapFrame.cameraY, cameraWorldPosition.z - previousSnapFrame.cameraZ);
    const jumpThreshold = Math.max(0.65, requestedTravel * 3);
    if (worldDelta > jumpThreshold || cameraDelta > jumpThreshold) recordSnapDiagnostic(
      `FRAME_JUMP world=${fixed(worldDelta)} camera=${fixed(cameraDelta)} dodge=${localDodgeStartedAt !== null} power=${localActivePower ?? "none"}`,
      new pc.Vec3(previousSnapFrame.localX, previousSnapFrame.localY, previousSnapFrame.localZ),
      player.clone(),
    );
  }
  activeSnapTrace?.frames.push(traceFrame);
  snapFrameHistory.push(traceFrame);
  if (snapFrameHistory.length > 60) snapFrameHistory.shift();
  if (activeSnapTrace && now >= activeSnapTrace.captureUntil) {
    completedSnapTraces.push(formatStopTrace(activeSnapTrace, "SNAP"));
    if (completedSnapTraces.length > 3) completedSnapTraces.shift();
    activeSnapTrace = null;
  }
  const appliedMovement = Math.hypot(smoothedMovement.x, smoothedMovement.z) > 0.01;
  if (previousAppliedMovement && !appliedMovement) {
    if (activeStopTrace) finishStopTrace();
    stopTraceSequence += 1;
    activeStopTrace = {
      id: stopTraceSequence,
      releasedAt: now,
      captureUntil: now + STOP_TRACE_AFTER_RELEASE_MS,
      frames: [...stopTraceHistory],
    };
    movementDebugTrace.textContent = `Stop trace #${stopTraceSequence}: recording ${STOP_TRACE_AFTER_RELEASE_MS}ms after release…`;
    logMovementEvent(`STOP TRACE #${stopTraceSequence} recording`);
  }
  activeStopTrace?.frames.push(traceFrame);
  stopTraceHistory.push(traceFrame);
  if (stopTraceHistory.length > STOP_TRACE_HISTORY_FRAMES) stopTraceHistory.shift();
  previousAppliedMovement = appliedMovement;
  if (activeStopTrace && now >= activeStopTrace.captureUntil) finishStopTrace();

  updatePerformanceMetrics(now);
  if (worldReady) {
    updateSilverDepthsRoute(now);
    if (!visibleDepthsRoute) updateCaveNavigation(localPlayer.getPosition(), now);
    const dungeonRoute = visibleDepthsRoute;
    if (dungeonRoute) {
      const teammates = (latestDepthsPartyStatus?.members ?? []).flatMap(member => {
        if (member.id === room?.sessionId || member.state !== "fighting" && member.state !== "fallen") return [];
        const position = remotePlayers.get(member.id)?.entity.getPosition()
          ?? (room?.state.players as Map<string, NetworkPlayer> | undefined)?.get(member.id);
        return position ? [{ id: member.id, name: member.name, x: position.x, y: position.y, z: position.z,
          state: member.state as "fighting" | "fallen" }] : [];
      });
      minimap.setDungeonState({ objective: { x: dungeonRoute.target.x, z: dungeonRoute.target.z,
        title: depthsCheckpointStatus?.phase === "waiting" ? "Party checkpoint" : dungeonRoute.title }, teammates });
    } else minimap.setDungeonState(null);
    minimap.setChampionState(mobVisuals.get("frontier-brute-west")?.state ?? null);
    minimap.setEliteStates([...mobVisuals.entries()].map(([id, visual]) => ({ id, name: visual.state.name,
      x: visual.state.x, y: visual.state.y, z: visual.state.z, alive: visual.state.alive, isElite: visual.state.isElite })));
    if (now - lastNameplateSampleAt >= 100) {
    lastNameplateSampleAt = now;
    const nameplates: { id: string; name: string; x: number; y: number; visible: boolean; local: boolean }[] = [];
    if (room && camera.camera) for (const [id, player] of room.state.players as Map<string, NetworkPlayer>) {
      const isLocal = id === room.sessionId;
      const pose = isLocal ? localPlayer.getPosition() : remotePlayers.get(id)?.entity.getPosition();
      if (!pose) continue;
      const eye = localPlayer.getPosition(); const rect = canvas.getBoundingClientRect();
      const screen = camera.camera.worldToScreen(new pc.Vec3(pose.x, pose.y + 1.95, pose.z));
      const visible = worldReady && defeatScreen.hidden && undergroundKnown(pose.x, pose.y, pose.z)
        && Math.hypot(pose.x - eye.x, pose.z - eye.z) <= 24 && screen.z > 0 && screen.x >= 0 && screen.x <= rect.width && screen.y >= 0 && screen.y <= rect.height
        && (isLocal || enemyCueLineClear({ x: eye.x, y: eye.y + .8, z: eye.z }, { x: pose.x, y: pose.y + .8, z: pose.z }, readCollisionWorldBlock));
      nameplates.push({ id, name: player.name, x: rect.left + screen.x, y: rect.top + screen.y, visible: Boolean(visible), local: isLocal });
    }
    social.update(now, nameplates);
    }
    minimap.update(localPlayer.getPosition(), localFacingYaw, now, minimapPanel.open && Boolean(performancePanel.hidden) && Boolean(defeatScreen.hidden), cameraOrbit.yaw, Boolean(defeatScreen.hidden));
  }
  if (room && worldReady && now - lastPingSentAt >= 2000) {
    lastPingSentAt = now;
    pingSequence += 1;
    const id = `ping-${pingSequence}`;
    pendingPings.set(id, now);
    room.send("ping", { id });
  }
  const directionChanged = movementDirectionChanged(lastSentMovement, smoothedMovement);
  if (room && worldReady && sendMovementThisFrame && !movementPilotController) {
    lastMoveSentAt = now;
    moveSequence += 1;
    const stopPosition = Math.hypot(smoothedMovement.x, smoothedMovement.z) <= 0.01
      ? localPlayer.getPosition()
      : null;
    room.send("move", {
      sequence: moveSequence,
      strafe: smoothedMovement.x,
      forward: smoothedMovement.z,
      yaw: localFacingYaw,
      ...(stopPosition ? { stopX: stopPosition.x, stopY: stopPosition.y, stopZ: stopPosition.z } : {}),
    });
    if (directionChanged) logMovementEvent(`DIR #${moveSequence} ${movementVectorLabel(lastSentMovement)} → ${movementVectorLabel(smoothedMovement)}`);
    lastSentMovement = { ...smoothedMovement };
  }
  if (now - lastMovementDebugUpdateAt >= 100) {
    lastMovementDebugUpdateAt = now;
    const keysDown = ["KeyW", "KeyA", "KeyS", "KeyD"].filter(code => keys.has(code)).map(code => code.at(-1)).join("") || "none";
    movementDebugLive.textContent = [
      `keys       ${keysDown}   raw ${strafe.toFixed(2)}, ${forward.toFixed(2)}`,
      `desired    ${movementVectorLabel(desiredMovement)}`,
      `applied    ${movementVectorLabel(smoothedMovement)}`,
      `yaw        ${localFacingYaw.toFixed(1)} → ${desiredFacingYaw.toFixed(1)}`,
      `local      ${player.x.toFixed(3)}, ${player.y.toFixed(3)}, ${player.z.toFixed(3)}`,
      `server     ${authoritativeLocalPosition.x.toFixed(3)}, ${authoritativeLocalPosition.y.toFixed(3)}, ${authoritativeLocalPosition.z.toFixed(3)}`,
      `A/B ${movementPilotController ? "COLYSEUS CONTROLS" : movementShadowInput ? "shadow only" : "off"} · diff=${movementShadowDifference?.toFixed(3) ?? "waiting"}m p50/p95=${percentile(movementShadowDifferences, 0.5).toFixed(3)}/${percentile(movementShadowDifferences, 0.95).toFixed(3)}m${movementShadowReset ? " reset" : ""}`,
      `pending    ${pendingPredictionFrames.length} prediction frames · raw d=${localPlayer.getPosition().distance(authoritativeLocalPosition).toFixed(3)}`,
      `loot       network=${room ? (room.state as any).lootDrops?.size ?? 0 : 0} · rendered=${lootVisuals.size}`,
      `reconcile  d=${reconciliation.distance.toFixed(3)} rate=${Number.isFinite(reconciliation.rate) ? reconciliation.rate.toFixed(1) : "HARD"}`,
      `net visual ${localNetworkVisualOffset.x.toFixed(3)}, ${localNetworkVisualOffset.z.toFixed(3)}`,
      `recovery   ${localRecoveryVisualOffset.x.toFixed(3)}, ${localRecoveryVisualOffset.z.toFixed(3)}`,
      `vertical   v=${localVerticalVelocity.toFixed(3)} visual=${localVisualVerticalOffset.toFixed(3)}`,
      `animation  weight=${localPlayerRig.locomotionWeight.toFixed(3)} phase=${localPlayerRig.locomotionPhase.toFixed(2)} bodyY=${bodyY.toFixed(3)}`,
      `camera     yaw=${(cameraOrbit.yaw * 180 / Math.PI).toFixed(1)} pitch=${(cameraOrbit.pitch * 180 / Math.PI).toFixed(1)} screen=${playerScreen ? `${playerScreen.x.toFixed(1)}, ${playerScreen.y.toFixed(1)}` : "n/a"}`,
      `mode       ${interactionMode} · click=${primaryActionForMode(interactionMode)}`,
      `trait      ${localTraitId} momentum=${localMomentumStacks}/${MOMENTUM_TRAIT.maxStacks} speed=${localMovementSpeed().toFixed(2)}`,
      `cutaway    ${cutawaySliceY === null ? "surface" : `slice=${cutawaySliceY}`} ref=${surfaceReferenceY?.toFixed(3) ?? "n/a"} underground=${undergroundClassification} excavation=${excavationClassification} return=${surfaceReturnClassification}`,
      `collision  grounded=${grounded} stepped=${predicted.stepped} hitY=${predicted.hitVertical}`,
      `sequence   sent=${moveSequence} ack=${lastProcessedInputSequence} lag=${sequenceLag}`,
      `net age    ${Math.round(performance.now() - lastAuthoritativeMovementAt)}ms`,
      `ack age    ${Math.round(performance.now() - lastAcknowledgementAdvancedAt)}ms`,
      `snap log   ${snapDiagnosticEvents.length} events · ${activeSnapTrace ? "recording" : `${completedSnapTraces.length} saved traces`} · COPY LOG`,
      `travel     collision=${collisionTravel.toFixed(3)} requested=${requestedTravel.toFixed(3)} blocked=${requestedTravel > 0.001 && collisionTravel < requestedTravel * 0.9}`,
      `stop ack   ${pendingStopInputSequence === null ? "ready" : `waiting for #${pendingStopInputSequence}`}`,
    ].join("\n");
  }
});

function applyBlockChange(message: BlockChanged): void {
  caveDiscoveryRevision++;
  const address = worldToChunk(message.x, message.z);
  const chunk = chunks.get(chunkKey(address.chunkX, address.chunkZ));
  if (!chunk || message.revision <= chunk.revision) return;
  if (message.revision !== chunk.revision + 1) {
    status.textContent = "World changed too quickly; refreshing the chunk state...";
    worldReady = false;
    room?.send("world:ready");
    return;
  }
  const previousBlock = chunk.blocks[chunkIndex(address.localX, message.y, address.localZ)]!;
  if (message.block === Block.Air && previousBlock !== Block.Air && message.requestId.startsWith("mine-")) miningBurst({ ...message, block: previousBlock }, 8);
  if (message.requestId === pendingMine?.requestId) {
    pendingMine = null;
    miningSwing = null;
    miningCracks.enabled = false;
    combatAudio.play("miningBreak");
  }
  chunk.blocks[chunkIndex(address.localX, message.y, address.localZ)] = message.block;
  chunk.revision = message.revision;
  const buildStartedAt = performance.now();
  rebuildChunkAndNeighbors(chunk, message.x, message.z);
  if (message.y >= SURFACE_HEIGHT) sceneDressing.rebuild(readWorldBlock, [...chunks.values()], indoorRoofBuilding);
  lastChunkBuildMs = performance.now() - buildStartedAt;
  if (message.block === Block.Air) status.textContent = "Block broken.";
}

async function connect(initialCharacter?: { name: string; appearance: Appearance }): Promise<void> {
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
  const endpoint = import.meta.env.VITE_GAME_SERVER_URL
    || (localHost ? "ws://localhost:2567" : `${window.location.origin}/game`);
  const query = new URLSearchParams(window.location.search);
  // Live latency can expose the SDK reconciler's intermediate patch rewinds.
  // Use the acknowledged movement path by default and retain the pilot as an
  // explicit diagnostics opt-in while it is hardened further.
  movementPilotRequested = useColyseusMovementPilot(query);
  const qaSpawn = import.meta.env.DEV ? query.get("qa") : null;
  activeRoomName = query.get("room") === "silver-depths" ? SILVER_DEPTHS_ROOM : WORLD_ROOM;
  const instanceKey = query.get("instanceKey");
  const partyTicket = query.get("partyTicket");
  const worldRoomId = query.get("worldRoomId");
  const reconnectStorageKey = activeRoomName === SILVER_DEPTHS_ROOM && instanceKey
    ? `blockcraft:silver-depths:reconnect:${instanceKey}` : null;
  const storedReconnectToken = (() => {
    if (!reconnectStorageKey) return null;
    try { return window.sessionStorage.getItem(reconnectStorageKey); } catch { return null; }
  })();
  const saveReconnectToken = () => {
    if (!reconnectStorageKey || !room?.reconnectionToken) return;
    try { window.sessionStorage.setItem(reconnectStorageKey, room.reconnectionToken); } catch { /* Storage may be disabled. */ }
  };
  const clearReconnectToken = () => {
    if (!reconnectStorageKey) return;
    try { window.sessionStorage.removeItem(reconnectStorageKey); } catch { /* Storage may be disabled. */ }
  };
  const requestedPartySize = Number(query.get("partySize"));
  const returnFrom = query.get("returnFrom") === "silver-depths" ? "silver-depths" : null;
  const retryFromDepths = activeRoomName === WORLD_ROOM && returnFrom === "silver-depths" && query.get("retry") === "1";
  const joinOptions = { name: initialCharacter?.name ?? "Explorer", profileToken,
    ...(initialCharacter ? { appearance: initialCharacter.appearance } : {}),
    ...(adminInvitation ? { adminPass: adminInvitation } : {}), ...(qaSpawn ? { qaSpawn } : {}),
    ...(activeRoomName === SILVER_DEPTHS_ROOM && instanceKey ? { instanceKey, partySize: Number.isFinite(requestedPartySize) ? requestedPartySize : 1 } : {}),
    ...(activeRoomName === WORLD_ROOM && returnFrom ? { returnFrom } : {}),
    ...(partyTicket ? { partyTicket } : {}) };
  room = await retryConnection(
    (signal, attempt) => {
      const client = new Client(endpoint, {
        fetchFn: (input, init) => fetch(input, { ...init, signal }),
      });
      if (storedReconnectToken) return client.reconnect(storedReconnectToken);
      if (activeRoomName === WORLD_ROOM && returnFrom && worldRoomId) {
        return client.joinById(worldRoomId, joinOptions).catch(() => client.joinOrCreate(activeRoomName, joinOptions));
      }
      return attempt === 1 || activeRoomName === SILVER_DEPTHS_ROOM
        ? client.joinOrCreate(activeRoomName, joinOptions)
        : client.create(activeRoomName, joinOptions);
    },
    (attempt, delay) => {
      status.textContent = attempt === 2
        ? `Shared world is delayed. Starting a recovery world in ${Math.round(delay / 1000)}s…`
        : `Game server is restarting. Reconnecting in ${Math.round(delay / 1000)}s… (attempt ${attempt}/5)`;
    },
  ).catch(error => {
    if (storedReconnectToken) {
      clearReconnectToken();
      throw new Error("Could not resume this dungeon run. Return to town and enter the portal again.", { cause: error });
    }
    throw error;
  });
  saveReconnectToken();
  room.onReconnect(() => {
    saveReconnectToken();
    room?.send("world:ready");
    room?.send("objective:sync");
    if (movementShadowInput) room?.send("movement:shadow:hello", { control: movementPilotRequested });
    status.textContent = "Reconnected to your dungeon run.";
  });
  room.onDrop(() => { status.textContent = activeRoomName === SILVER_DEPTHS_ROOM
    ? "Connection interrupted. Holding your place in the dungeon…" : "Connection interrupted. Reconnecting…"; });
  if (movementPilotRequested || (import.meta.env.DEV && query.get("movementShadow") === "1")) {
    room.onMessage("movement:shadow:ready", (message: { tickRate: number; control?: boolean }) => {
      // The SDK resets an existing input handle on reconnect. Preserve it so
      // the reconciler keeps observing the stream that is actually sent.
      movementShadowInput ??= room!.input<{ strafe: number; forward: number; yaw: number }>({ mode: "reliable" });
      movementShadowAccumulator = 0;
      movementShadowDifferences.length = 0;
      movementPilotReady = movementPilotRequested && message.control === true;
      if (movementPilotReady) activateMovementPilot(room!);
      if (movementPilotReady) movementDebug.open = true;
      logMovementEvent(movementPilotReady ? "COLYSEUS PILOT READY" : "A/B SHADOW READY — legacy still controls movement");
    });
    room.onMessage("movement:shadow:sample", (sample: {
      x: number; y: number; z: number; authorityX: number; authorityY: number; authorityZ: number; reset: boolean;
    }) => {
      movementShadowDifference = movementPilotController
        ? localPlayer.getPosition().distance(new pc.Vec3(sample.authorityX, sample.authorityY, sample.authorityZ))
        : Math.hypot(sample.x - sample.authorityX, sample.y - sample.authorityY, sample.z - sample.authorityZ);
      movementShadowReset = sample.reset;
      if (!sample.reset) {
        movementShadowDifferences.push(movementShadowDifference);
        if (movementShadowDifferences.length > 300) movementShadowDifferences.shift();
      }
    });
  }
  bindPlayers(room);
  bindMobs(room);
  bindLootDrops(room);
  updatePlayerCount();
  status.textContent = "Connected. Loading the authoritative world...";
  room.onMessage("world:bootstrap", (payload: WorldBootstrap) => {
    renderBootstrap(payload);
    if (retryFromDepths) depthsRetryPrompt.hidden = false;
    if (retryFromDepths && partyTicket) depthsRetryPrompt.querySelector("span")!.textContent = "Your party will regroup here as members return. Enter together when ready.";
  });
  room.onMessage("room:transfer", (transfer: RoomTransfer) => {
    const url = new URL(window.location.href);
    if (transfer.room === SILVER_DEPTHS_ROOM) {
      url.searchParams.set("room", "silver-depths");
      url.searchParams.set("instanceKey", transfer.instanceKey ?? "solo");
      url.searchParams.set("partySize", String(transfer.partySize ?? 1));
      if (transfer.partyTicket) url.searchParams.set("partyTicket", transfer.partyTicket);
      else url.searchParams.delete("partyTicket");
      url.searchParams.delete("worldRoomId");
      url.searchParams.delete("returnFrom");
      status.textContent = `Opening a private Silver Depths instance for ${transfer.partySize ?? 1} player${transfer.partySize === 1 ? "" : "s"}...`;
    } else {
      clearReconnectToken();
      url.searchParams.delete("room");
      url.searchParams.delete("instanceKey");
      url.searchParams.delete("partySize");
      if (transfer.partyTicket) url.searchParams.set("partyTicket", transfer.partyTicket);
      else url.searchParams.delete("partyTicket");
      if (transfer.worldRoomId) url.searchParams.set("worldRoomId", transfer.worldRoomId);
      else url.searchParams.delete("worldRoomId");
      if (transfer.returnFrom) url.searchParams.set("returnFrom", transfer.returnFrom);
      if (transfer.retry) url.searchParams.set("retry", "1");
      else url.searchParams.delete("retry");
      status.textContent = "Returning to the shared Town of Beginnings...";
    }
    window.setTimeout(() => window.location.replace(url), 180);
  });
  room.onMessage("player:portal", (spawn: { x: number; y: number; z: number; entering: boolean }) => {
    clearDefeatCombat(); closeLoot();
    const own = (room?.state as { players?: Map<string, NetworkPlayer> } | undefined)?.players?.get(room!.sessionId);
    pendingPortalDestination = own && portalArrivalSnapshot(spawn, own) ? null : spawn;
    worldReady = false; awaitingReturnState = false; townReturnPosition = spawn; cutawaySliceY = null;
    status.textContent = spawn.entering
      ? isInEmberVault(spawn.x, spawn.z) ? "Ember Vault entered · breach the forge chambers and defeat the Colossus."
        : spawn.y < 5 ? "Silver Depths entered · the dungeon clock is running." : "Forest Dungeon lobby · assemble, ready up, then begin the run."
      : isInEmberVault(spawn.x, spawn.z) ? "Returned to the Ember Vault."
        : spawn.x > 40 ? "Returned to the Deep Frontier with your forge rewards." : "Returned to the Town of Beginnings with your loot.";
  });
  room.onMessage("portal:notice", (message: string) => {
    status.textContent = message;
    const notice = forestDungeonNotice(message);
    if (!notice) {
      const feedback = portalNoticeFeedback(message);
      if (feedback) showCombatFeedback(feedback.title, feedback.cue);
      return;
    }
    createDungeonBurst(notice.x, notice.z, notice.kind);
    combatAudio.play(notice.kind === "victory" ? "dungeonVictory" : "dungeonGate");
    showCombatFeedback(notice.title, notice.kind === "victory" ? "dodge" : "hit");
  });
  room.onMessage("dungeon:run", (update: DungeonRunUpdate) => {
    if (update.phase === "started" && update.dungeon === "silver-depths") {
      renderDepthsWingRewards(null); renderDepthsCheckpointStatus(null);
    }
    if (update.phase === "started") status.textContent = update.dungeon === "ember-vault"
      ? "Ember Vault run started · clear the sentinels, break the brute, then face the Forge Colossus."
      : update.dungeon === "silver-depths" ? "Silver Depths run started · break the seal, clear both gallery waves, light the checkpoint, and overcome the Matriarch."
        : `Forest Dungeon run started · ${update.partySize > 1 ? `${update.partySize}-player party` : "solo"}.`;
    showDungeonRunResult(update);
  });
  room.onMessage("dungeon:reward", (reward: DungeonRewardClaimed) => {
    updateTavernCoins(reward.totalGold);
    showCombatFeedback(`CACHE CLAIMED · +${reward.goldGranted} GOLD`, "dodge");
    status.textContent = reward.message;
  });
  room.onMessage("dungeon:board", (update: DungeonBoardUpdate) => renderDungeonBoard(update));
  room.onMessage("dungeon:lobby", (update: DungeonLobbyUpdate) => renderDungeonLobby(update));
  room.onMessage("depths:lobby", (update: SilverDepthsLobbyUpdate) => renderSilverDepthsLobby(update));
  room.onMessage("mineral:status", (payload: MineralDepositStatus[]) => minimap.setMineralStatus(payload));
  room.onMessage("chat:message", message => social.message(message));
  room.onMessage("chat:notice", message => { social.notice(String(message)); partyUI.notice(String(message)); tradeUI.notice(String(message)); });
  room.onMessage("party:update", update => partyUI.update(update));
  room.onMessage("realm:event", (update: RealmEventUpdate) => {
    activeRealmEventId = update.phase === "active" ? update.eventId ?? "" : "";
  });
  room.onMessage("trade:update", update => {
    if (update) playerInteractionUI.close();
    tradeUI.update(update);
  });
  room.onMessage("world:chunks", (payload: ChunkRegion) => applyChunkRegion(payload));
  room.onMessage("objective:update", (update: WorldObjectiveUpdate) => renderWorldObjective(update));
  room.onMessage("depths:wing-rewards", (update: SilverDepthsWingRewardStatus) => renderDepthsWingRewards(update));
  room.onMessage("depths:cache", (update: SilverDepthsCacheStatus) => {
    minimap.setDungeonCacheStatus(update);
    if (update.phase !== lastDepthsCachePhase) {
      lastDepthsCachePhase = update.phase;
      if (update.phase === "warning") showCombatFeedback("CACHE AMBUSH INCOMING", "hurt");
      else if (update.phase === "fighting") showCombatFeedback("CACHE GUARDS ARRIVED", "hurt");
      else if (update.phase === "cleared") showCombatFeedback("CACHE SECURED", "dodge");
    }
  });
  room.onMessage("depths:checkpoint", (update: SilverDepthsCheckpointStatus) => renderDepthsCheckpointStatus(update));
  room.onMessage("depths:party-status", (update: SilverDepthsPartyStatus) => renderDepthsPartyStatus(update));
  room.onMessage("depths:gates", (status: SilverDepthsGateStatus) => {
    latestDepthsGateStatus = status;
    depthsBreadcrumbRouteKey = "";
    minimap.setDungeonGateStatus(status);
  });
  room.onMessage("depths:ping", (ping: SilverDepthsPing) => minimap.setDungeonPing(ping));
  room.onMessage("objective:completed", (message: WorldObjectiveCompleted) => showObjectiveComplete(message));
  room.onMessage("progression:update", (update: ProgressionUpdate) => {
    renderCharacterProgression(update);
    if (update.reason === "level_up") {
      const milestone = CHARACTER_MILESTONES.find(entry => entry.level === update.level);
      showCombatFeedback(milestone ? `LEVEL ${update.level} · ${milestone.name.toUpperCase()}` : `LEVEL ${update.level} · CHOOSE A STAT`, "dodge");
      status.textContent = milestone ? `Level ${update.level}! ${milestone.name} unlocked. Choose a permanent character improvement.` : `Level ${update.level}! Choose a permanent character improvement.`;
    } else if (update.reason === "experience" && update.experienceGranted) {
      status.textContent = `+${update.experienceGranted} XP · ${update.source ?? "adventuring"}`;
    } else if (update.reason === "choice") {
      showCombatFeedback(`${String(update.source ?? "STAT").toUpperCase()} IMPROVED`, "dodge");
    }
  });
  room.onMessage("quiz:update", (update: TavernQuizUpdate) => renderTavernQuiz(update));
  room.onMessage("blacksmith:update", (update: BlacksmithUpdate) => {
    renderBlacksmith(update);
    if (update.phase === "traded") status.textContent = update.message;
  });
  room.onMessage("storage:update", (message: StorageUpdate) => {
    storageUI.receive(message);
    for (const id of Object.keys(ITEM_DEFINITIONS) as ItemId[]) updateInventoryItem(id, message.carried[id] ?? 0);
  });
  room.onMessage("recovery:result", (message: string) => {
    recoveryPendingUntil = 0;
    status.textContent = message;
    showCombatFeedback(message.startsWith("Recovered") ? "BAG RECOVERED" : "RECOVERY", "dodge");
  });
  room.onMessage("block:changed", applyBlockChange);
  room.onMessage("combat:projectile", (message: WeaponAttackReleased) => {
    createWeaponProjectile(message);
    logMovementEvent(`${message.mainHandId === "bow" ? "ARROW" : "ARCANE"} RELEASED`);
  });
  room.onMessage("combat:projectile-resolved", (message: ProjectileResolved) => {
    const cue = projectileImpactCue(message.projectileId, message.reason);
    const point = new pc.Vec3(message.x, message.y, message.z);
    const index = weaponProjectileVisuals.findIndex(projectile => projectile.projectileId === message.projectileId);
    const weapon = projectileWeapons.get(message.projectileId);
    const style = rangedStyle(weapon ?? "magic_focus");
    projectileWeapons.delete(message.projectileId);
    if (cue && localPlayer.getPosition().distance(point) <= 18)
      createRangedPopup(point, cue === "enemy" ? style.glyph : "•", cue, false, cue === "enemy" ? style.color : undefined);
    if (index >= 0) {
      weaponProjectileVisuals[index]!.entity.destroy();
      weaponProjectileVisuals[index]!.material.destroy();
      weaponProjectileVisuals.splice(index, 1);
    }
    logMovementEvent(`PROJECTILE ${message.reason.toUpperCase()} ${message.projectileId}`);
  });
  room.onMessage("combat:mob-projectile", (message: MobProjectileReleased) => {
    createMobProjectile(message);
    logMovementEvent(`${(message.kind ?? "acid").toUpperCase()} SHOT ${message.mobId}`);
  });
  room.onMessage("combat:mob-hazard", (message: MobHazardPlaced) => {
    createMobHazard(message);
    logMovementEvent(`ACID POOL ${message.hazardId}`);
  });
  room.onMessage("depths:hazard", (message: DepthsRouteHazard) => createDepthsHazard(message));
  room.onMessage("depths:hazard-impact", (message: DepthsRouteHazard) => {
    const visual = depthsHazardVisuals.get(message.hazardId);
    if (visual) { visual.impactAt = 0; visual.expiresAt = Math.min(visual.expiresAt, Date.now() + 450); }
    const player = localPlayer.getPosition();
    const distance = Math.hypot(player.x - message.x, player.z - message.z);
    if (distance <= 12) {
      cameraShakeStrength = Math.max(cameraShakeStrength, Math.max(.1, .34 - distance * .02));
      cameraShakeUntil = performance.now() + 360;
      combatAudio.play("seismicImpact", enemyCuePan(message.x, player.x, 12));
    }
  });
  room.onMessage("power:cast", (message: PowerCast) => {
    if (message.casterId !== room?.sessionId) {
      const telegraphPosition = message.target ?? message;
      startPowerTelegraph(message.casterId, message.powerId, telegraphPosition.x, telegraphPosition.y, telegraphPosition.z, message.yaw, message.windupMs, message);
      const remote = remotePlayers.get(message.casterId);
      if (remote) {
        remote.powerId = message.powerId;
        remote.powerStartedAt = performance.now();
      }
    }
    logMovementEvent(`POWER CAST ${message.casterId} ${message.powerId}`);
  });
  room.onMessage("power:resolved", (message: PowerResolved) => {
    createPowerImpact(message);
    for (const mobId of message.defeatedMobIds) {
      const defeatedMob = mobVisuals.get(mobId);
      defeatedMob?.marks.clear();
    }
    const isLocal = message.casterId === room?.sessionId;
    if (isLocal) {
      const definition = POWER_DEFINITIONS[message.powerId];
      const powerLabel = definition.name.toUpperCase();
      localHitPauseUntil = performance.now() + (message.hitCount > 0 ? 85 : 40);
      showCombatFeedback(
        message.defeatedMobIds.length > 0
          ? `${powerLabel} DEFEAT`
          : (message.traitBonusHitCount ?? 0) > 0
            ? `EXECUTION! ×${message.traitBonusHitCount}`
          : message.hitCount > 0
            ? `${powerLabel} HIT ×${message.hitCount}`
            : powerLabel,
      );
      status.textContent = message.hitCount > 0
        ? `${definition.name} struck ${message.hitCount} target${message.hitCount === 1 ? "" : "s"} for ${message.damage} damage${message.rootbound ? ` · ROOTBOUND ${message.rootDurationMs}ms` : ""}${(message.aftershockHitCount ?? 0) > 0 ? ` · AFTERSHOCK ×${message.aftershockHitCount}` : ""}${(message.traitBonusHitCount ?? 0) > 0 ? ` · EXECUTIONER ×${message.traitBonusHitCount}` : ""}.`
        : definition.fracturesTerrain
          ? `${definition.name} fractured ${message.fractures.length} terrain block${message.fractures.length === 1 ? "" : "s"}.`
          : `${definition.name} released with no targets in range.`;
    }
    logMovementEvent(`POWER RESOLVE hits=${message.hitCount} fractures=${message.fractures.length}`);
  });
  room.onMessage("special:applied", (message: SpecialApplied) => {
    const mob = mobVisuals.get(message.mobId);
    mob?.marks.set(message.casterId, {
      expiresAt: message.expiresAt,
      stacks: message.stacks,
      maxStacks: message.maxStacks,
    });
    if (message.casterId === room?.sessionId) {
      localSpecialCooldownUntil = message.cooldownUntil;
      const name = mob?.state.name ?? "Enemy";
      showCombatFeedback("HUNTER'S MARK", "dodge");
      status.textContent = `${name} marked ${message.stacks}/${message.maxStacks} · land two Attacks, then cash in with Power.`;
    }
    logMovementEvent(`SPECIAL APPLIED ${message.mobId} ${message.stacks}/${message.maxStacks} +${message.bonusDamage}`);
  });
  room.onMessage("special:snare-placed", (message: BrambleSnarePlaced) => {
    createBrambleSnareVisual(message);
    if (message.casterId === room?.sessionId) {
      localSpecialCooldownUntil = message.cooldownUntil;
      showCombatFeedback("SNARE ARMED", "dodge");
      status.textContent = `Bramble Snare armed for ${(BRAMBLE_SNARE.lifetimeMs / 1000).toFixed(0)}s · lure an enemy into the ring.`;
    }
    logMovementEvent(`SNARE PLACED ${message.casterId} ${message.x.toFixed(1)},${message.z.toFixed(1)}`);
  });
  room.onMessage("special:snare-triggered", (message: BrambleSnareTriggered) => {
    triggerBrambleSnareVisual(message);
    if (message.casterId === room?.sessionId) {
      const name = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
      showCombatFeedback(`SNARED · ${(message.rootMs / 1000).toFixed(1)}S`, "dodge");
      status.textContent = `${name} rooted by Bramble Snare for ${(message.rootMs / 1000).toFixed(1)}s.`;
    }
    logMovementEvent(`SNARE TRIGGERED ${message.mobId} ${message.rootMs}ms`);
  });
  room.onMessage("special:progressed", (message: SpecialProgressed) => {
    const mob = mobVisuals.get(message.mobId);
    mob?.marks.set(message.casterId, {
      expiresAt: message.expiresAt,
      stacks: message.stacks,
      maxStacks: message.maxStacks,
    });
    if (message.casterId === room?.sessionId) {
      const name = mob?.state.name ?? "Enemy";
      showCombatFeedback(message.exposed ? "EXPOSED · USE POWER" : `HUNT ${message.stacks}/${message.maxStacks}`, "dodge");
      status.textContent = message.exposed
        ? `${name} is Exposed · Power will consume the mark for bonus damage and heavy stagger.`
        : `${name} Hunt stack ${message.stacks}/${message.maxStacks} · keep attacking.`;
    }
    logMovementEvent(`SPECIAL STACK ${message.mobId} ${message.stacks}/${message.maxStacks}`);
  });
  room.onMessage("special:consumed", (message: SpecialConsumed) => {
    const mob = mobVisuals.get(message.mobId);
    mob?.marks.delete(message.casterId);
    if (mob) createHuntersMarkPayoff(mob);
    if (message.casterId === room?.sessionId) {
      const name = mob?.state.name ?? "Enemy";
      showCombatFeedback(`MARK CASHED IN  +${message.bonusDamage}`, "dodge");
      status.textContent = `${name} Exposed payoff · +${message.bonusDamage} Power damage and ${(message.staggerMs / 1000).toFixed(1)}s stagger.`;
    }
    logMovementEvent(`SPECIAL CONSUMED ${message.mobId} +${message.bonusDamage}`);
  });
  room.onMessage("power:cancelled", (message: PowerCancelled) => {
    const telegraph = powerTelegraphs.get(message.casterId);
    telegraph?.root.destroy();
    powerTelegraphs.delete(message.casterId);
    if (message.casterId !== room?.sessionId) return;
    const powerName = POWER_DEFINITIONS[message.powerId].name;
    cancelLocalPowerPresentation();
    showCombatFeedback(message.reason === "dodge" ? "DODGE CANCEL" : "POWER CANCELLED", "dodge");
    status.textContent = message.reason === "dodge"
      ? `${powerName} cancelled into a dodge · cooldown refunded.`
      : `${powerName} cancelled · cooldown refunded.`;
    logMovementEvent(`POWER CANCEL ${message.reason}`);
  });
  room.onMessage("combat:hit", (message: CombatHit) => {
    const mob = mobVisuals.get(message.mobId);
    const rangedHit = confirmedRangedHit(message.mainHandId, message.damage, message.attackerId === room?.sessionId);
    if (rangedHit) {
      rangedReticleHitUntil = performance.now() + 110;
      combatAudio.play(rangedStyle(message.mainHandId).hitSound);
      if (mob) {
        const position = mob.entity.getPosition().clone(); position.y += mob.healthBarY + .35;
        createRangedPopup(position, `−${message.damage}`, "damage", message.defeated);
      }
    }
    if ((message.mainHandId === "stone_core_hammer" || message.mainHandId === "rootbound_hammer") && message.damage > 0 && mob
      && localPlayer.getPosition().distance(mob.entity.getPosition()) <= 9) createHammerHitImpact(mob);
    if (message.rootShockwave && mob) createRootboundShockwave(mob);
    if (message.defeated) mob?.marks.clear();
    if (message.secondary) {
      if (message.attackerId === room?.sessionId && !rangedHit && mob) {
        const position = mob.entity.getPosition().clone(); position.y += mob.healthBarY + .35;
        createRangedPopup(position, `−${message.damage}`, "damage", message.defeated);
      }
      const perkName = message.perk === "core_quake" ? "CORE QUAKE" : message.perk === "moon_arc" ? "MOON ARC"
        : message.perk === "echo_chain" ? "ECHO CHAIN" : "ROOTFALL";
      if (message.attackerId === room?.sessionId) showCombatFeedback(`${perkName}  −${message.damage}`, "dodge");
      logMovementEvent(`${perkName} ${message.mobId} hp=${message.health} defeated=${message.defeated}`);
      return;
    }
    const name = mob?.state.name ?? "Mob";
    const respawnSeconds = mob?.state.archetype === "stone_brute" ? 8.5 : 5;
    status.textContent = message.defeated
      ? `${name} defeated · respawning in ${respawnSeconds} seconds.`
      : `${name} hit for ${message.damage} · ${message.health} HP remaining.`;
    logMovementEvent(`HIT ${message.mobId} hp=${message.health} defeated=${message.defeated}`);
    if (message.attackerId === room?.sessionId) {
      updateMomentum(message.momentumStacks);
      const comboStep = message.comboStep >= 1 && message.comboStep <= 3 ? message.comboStep : localActionStep || 1;
      if (!rangedHit && mob && message.damage > 0) {
        const position = mob.entity.getPosition().clone(); position.y += mob.healthBarY + .35;
        createRangedPopup(position, `−${message.damage}`, "melee", message.defeated);
      }
      if (!rangedHit) localHitPauseUntil = performance.now() + ((message.mainHandId === "stone_core_hammer" || message.mainHandId === "rootbound_hammer") ? 80 : comboStep === 3 ? 75 : 48);
      const hitLabel = WEAPON_ATTACK_DEFINITIONS[message.mainHandId].combo && comboStep === 3
        ? `FINISHER  −${message.damage}`
        : `${MAIN_HAND_DEFINITIONS[message.mainHandId].attackName.toUpperCase()}  −${message.damage}`;
      showCombatFeedback(
        message.defeated
          ? "DEFEATED"
          : message.perk === "venom_bloom"
            ? `VENOM BLOOM!  −${message.damage}`
          : (message.traitBonusDamage ?? 0) > 0
            ? `EXECUTION!  −${message.damage}`
          : hitLabel,
      );
      if (localTraitId === "momentum") status.textContent += ` · Momentum ${message.momentumStacks}/${MOMENTUM_TRAIT.maxStacks}.`;
      else if ((message.traitBonusDamage ?? 0) > 0) status.textContent += ` · Executioner +${message.traitBonusDamage} damage.`;
      if (message.mainHandId === "venom_focus" && message.perk !== "venom_bloom") status.textContent += ` · Venom ${message.perkStacks ?? 0}/3.`;
      else if (message.perk === "venom_bloom") status.textContent += " · Venom Bloom detonated.";
    }
  });
  room.onMessage("combat:miss", (message: CombatMiss) => {
    if (message.attackerId !== room?.sessionId) return;
    if (WEAPON_ATTACK_DEFINITIONS[message.mainHandId].projectileTravelMs > 0) {
      // Empty fan lanes are normal: do not overwrite a confirmed hit with MISS.
      logMovementEvent(`MISS ${message.mainHandId} step=${message.comboStep}`);
      return;
    }
    showCombatFeedback("MISS", "miss");
    const attackName = WEAPON_ATTACK_DEFINITIONS[message.mainHandId].combo
      ? `${MAIN_HAND_DEFINITIONS[message.mainHandId].attackName} ${message.comboStep}`
      : MAIN_HAND_DEFINITIONS[message.mainHandId].attackName;
    status.textContent = `${attackName} missed · recovery leaves you open.`;
    logMovementEvent(`MISS ${message.mainHandId} step=${message.comboStep}`);
  });
  room.onMessage("combat:stagger", (message: CombatStagger) => {
    if (message.attackerId !== room?.sessionId) return;
    const staggeredMob = mobVisuals.get(message.mobId);
    if (staggeredMob) {
      const position = staggeredMob.entity.getPosition().clone(); position.y += staggeredMob.healthBarY + .7;
      createRangedPopup(position, "STAGGER", "stagger");
    }
    showCombatFeedback("STAGGER!", "stagger");
    status.textContent = `Heavy interrupt · enemy staggered for ${(message.durationMs / 1000).toFixed(1)}s.`;
    logMovementEvent(`STAGGER ${message.mobId} ${message.durationMs}ms`);
  });
  room.onMessage("player:returned", (spawn: { x: number; y: number; z: number }) => {
    awaitingReturnState = true;
    townReturnPosition = spawn;
    clearDefeatCombat();
    localPlayer.setPosition(spawn.x, spawn.y, spawn.z);
    authoritativeLocalPosition.set(spawn.x, spawn.y, spawn.z);
    cameraFocus.set(spawn.x, spawn.y, spawn.z);
    cameraFollow = { x: spawn.x, z: spawn.z };
    localPowerCooldownUntil = 0; localSpecialCooldownUntil = 0;
    cutawaySliceY = null;
    defeatScreen.hidden = true;
    worldReady = false;
    room?.send("world:ready");
    status.textContent = "Back in the Town of Beginnings · follow your recovery marker to reclaim dropped items.";
  });
  room.onMessage("combat:player-hit", (message: PlayerHit) => {
    if (message.playerId !== room?.sessionId) return;
    if (message.momentumStacks !== undefined) updateMomentum(message.momentumStacks);
    if (message.defeated) showDefeat(mobVisuals.get(message.mobId)?.state.name ?? "An enemy");
    if (message.absorbed) {
      showCombatFeedback("BASTION WARD", "block");
      status.textContent = "Bastion Ward absorbed the heavy hit · the ward is recharging.";
      logMovementEvent(`BASTION WARD ${message.mobId}`);
      return;
    }
    if (message.guarded) return;
    const attackerName = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
    showCombatFeedback(message.defeated ? "DEFEATED" : `HURT  −${message.damage}`, "hurt");
    status.textContent = message.defeated
      ? "You were defeated. Return to the Town of Beginnings when ready."
      : `${attackerName} hit you for ${message.damage} · ${message.health} HP remaining.`;
    logMovementEvent(`HURT hp=${message.health} defeated=${message.defeated}`);
  });
  room.onMessage("potion:update", (message: PotionUpdate) => {
    potionPendingUntil = 0;
    potionCooldownUntil = message.cooldownUntil;
    updateInventoryItem("healing_potion", message.quantity);
    updateTavernCoins(message.gold);
    updatePlayerHealth(message.health, message.maxHealth);
    status.textContent = message.message;
    showCombatFeedback(message.phase === "healed" ? `+${message.healed} HP` : message.phase === "bought" ? "+1 POTION" : message.message, message.phase === "error" ? "hurt" : "dodge");
    refreshPotionUi();
  });
  room.onMessage("combat:defense", (message: DefenseResolved) => {
    if (message.playerId !== room?.sessionId) return;
    updateMomentum(message.momentumStacks);
    const attackerName = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
    showCombatFeedback(message.parried ? "PARRY!" : message.damage > 0 ? `GUARD  −${message.damage}` : "BLOCK", "block");
    if ((message.perkStaminaRestored ?? 0) > 0) showCombatFeedback(`LIVING GUARD  +${message.perkStaminaRestored} ST`, "block");
    status.textContent = message.parried
      ? localTraitId === "bulwark"
        ? `${attackerName} parried and staggered · Bulwark restored stamina · counter now.`
        : `${attackerName} parried and staggered · counter now.`
      : `${attackerName} guarded · ${message.damage} damage taken · ${message.stamina} stamina remaining.${(message.perkStaminaRestored ?? 0) > 0 ? ` Living Guard restored ${message.perkStaminaRestored}.` : ""}`;
    logMovementEvent(`${message.parried ? "PARRY" : "GUARD"} ${message.mobId} damage=${message.damage} stamina=${message.stamina}`);
  });
  room.onMessage("combat:reward", (message: CombatReward) => {
    if (message.playerId !== room?.sessionId) return;
    const defeatedName = mobVisuals.get(message.mobId)?.state.name ?? "Enemy";
    const rewards = [
      message.coinsGranted > 0 ? `+${message.coinsGranted} coins` : "",
      message.healthRestored > 0 ? `+${message.healthRestored} HP` : "",
      message.staminaRestored > 0 ? `+${message.staminaRestored} stamina` : "",
    ].filter(Boolean).join(" · ");
    showCombatFeedback(rewards || "VICTORY", "dodge");
    status.textContent = `${defeatedName} reward${rewards ? ` · ${rewards}` : " claimed"}.`;
    logMovementEvent(`REWARD ${message.mobId} hp=${message.healthRestored} stamina=${message.staminaRestored}`);
  });
  room.onMessage("loot:result", (message: LootCollectResult) => {
    if (message.dropId !== inspectedDropId) {
      if (!pendingFloorLoot.delete(message.dropId)) return;
      if (!message.ok) {
        status.textContent = message.message;
        showCombatFeedback(message.message.toUpperCase(), "hurt");
      } else if (message.remainingItems?.length) {
        updateRemainingLootBag(message.dropId, message.remainingItems);
        status.textContent = message.message;
        showCombatFeedback("BAG PARTIALLY COLLECTED", "dodge");
      } else {
        removeLootVisual(message.dropId, true);
        status.textContent = message.message;
      }
      return;
    }
    lootPending = false; lootEquip.disabled = lootKeep.disabled = lootDismantle.disabled = !lootVisuals.has(message.dropId);
    lootMessage.textContent = message.message;
    if (message.ok) {
      if (message.action === "dismantle" && message.itemId && isItemId(message.itemId)) {
        const toast = document.createElement("div"); toast.className = "resource-toast equipment-pickup"; toast.dataset.rarity = itemRarity(message.itemId);
        toast.innerHTML = `<small>DISMANTLED · ${ITEM_RARITIES[itemRarity(message.itemId)].label.toUpperCase()}</small><strong>${ITEM_DEFINITIONS[message.itemId].name}</strong><span>+${message.goldGranted ?? 0} gold${message.materialGranted ? ` · +${message.materialQuantity ?? 0} ${ITEM_DEFINITIONS[message.materialGranted].name}` : ""}</span>`;
        queueLootToast(toast, LOOT_FEED_EQUIPMENT_MS);
      }
      closeLoot(); status.textContent = message.message;
    }
  });
  room.onMessage("loot:picked-up", (message: LootPickedUp) => {
    if (message.playerId !== room?.sessionId || !isItemId(message.itemId)) return;
    updateInventoryItem(message.itemId, message.total);
    const item = ITEM_DEFINITIONS[message.itemId];
    if (isEquipmentItem(message.itemId)) showEquipmentPickup(message.itemId, message.quantity, message.total);
    else showResourcePickup(item.name, message.quantity, message.itemId);
    status.textContent = `Picked up ${item.name} · ${message.total} total.`;
    logMovementEvent(`LOOT ${message.itemId} +${message.quantity} total=${message.total}`);
  });
  room.onMessage("resource:gathered", (message: ResourceGathered) => {
    pendingMine = null;
    miningSwing = null;
    miningCracks.enabled = false;
    if (message.quantity > 0) showResourcePickup(message.itemId === "iron_ore" ? "Iron" : message.itemId === "silver_ore" ? "Silver" : ITEM_DEFINITIONS[message.itemId].name, message.quantity, message.itemId);
    updateInventoryItem(message.itemId, message.total);
    if (message.itemId === "timber") {
      showCombatFeedback(`+${message.quantity} GREENWOOD TIMBER`, "dodge");
      status.textContent = `Chopped Greenwood oak · ${message.total} timber carried.`;
      return;
    }
    if (message.itemId === "moonstone" && message.quantity > 0) {
      showCombatFeedback(`+${message.quantity} MOONSTONE · OBJECTIVE SECURED`, "dodge");
      status.textContent = `Moonstone secured · ${message.total} carried. Clear the gallery and continue to the Crystal Matriarch.`;
      return;
    }
    if (message.quantity > 0) {
      const reinforced = (inventoryCounts.get("reinforced_pickaxe") ?? 0) > 0;
      const name = ITEM_DEFINITIONS[message.itemId].name;
      const price = message.itemId === "silver_ore" ? SILVER_ORE_GOLD_PRICE : IRON_ORE_GOLD_PRICE;
      showCombatFeedback(`+${message.quantity} ${name.toUpperCase()} · ${message.quantity * price} GOLD VALUE`, "dodge");
      status.textContent = `${reinforced ? "Reinforced Pickaxe · " : ""}${name}: ${message.total}/${blacksmithIronCapacity} carried · worth ${message.total * price} gold at the town blacksmith.`;
    } else {
      showCombatFeedback(`${ITEM_DEFINITIONS[message.itemId].name.toUpperCase()} PACK FULL`, "hurt");
      status.textContent = `Your ${ITEM_DEFINITIONS[message.itemId].name} capacity is full. Sell minerals at the blacksmith. The block was not removed.`;
    }
  });
  room.onMessage("pong", (message: { id?: unknown; serverTime?: unknown }) => {
    if (typeof message.id !== "string") return;
    const sentAt = pendingPings.get(message.id);
    if (sentAt === undefined) return;
    const receivedAt = performance.now();
    networkRttMs = receivedAt - sentAt;
    if (typeof message.serverTime === "number") serverClock = sampleServerClock(serverClock, sentAt, receivedAt, message.serverTime);
    pendingPings.delete(message.id);
  });
  room.onMessage("action:rejected", (message: ActionRejected) => {
    if (message.action === "mine" && message.requestId === pendingMine?.requestId) cancelMining();
    status.textContent = message.action === "mine" ? miningMessage(message.reason) : `Server rejected ${message.action}: ${message.reason}`;
    logMovementEvent(`REJECT ${message.action} reason=${message.reason}`);
    if (message.action === "move" || message.action === "dodge") recordSnapDiagnostic(
      `ACTION_REJECT action=${message.action} reason=${message.reason}`,
      localPlayer.getPosition().clone(),
      authoritativeLocalPosition.clone(),
    );
    if (message.action === "move") localPlayer.setPosition(authoritativeLocalPosition);
    if (message.action === "dodge") {
      const ownPlayer = room
        ? (room.state as { players?: { get(id: string): NetworkPlayer | undefined } }).players?.get(room.sessionId)
        : undefined;
      if (ownPlayer) syncPredictedDodgeStamina(ownPlayer.stamina, ownPlayer.maxStamina);
      const rejectedPosition = localPlayer.getPosition();
      localRecoveryVisualOffset = {
        x: localRecoveryVisualOffset.x + rejectedPosition.x - authoritativeLocalPosition.x + localNetworkVisualOffset.x,
        z: localRecoveryVisualOffset.z + rejectedPosition.z - authoritativeLocalPosition.z + localNetworkVisualOffset.z,
      };
      localNetworkVisualOffset = { x: 0, z: 0 };
      localPlayer.setPosition(authoritativeLocalPosition);
      localDodgeStartedAt = null;
      localPlayerVisual.setLocalEulerAngles(0, 0, 0);
      showCombatFeedback(message.reason === "stamina" ? "NO STAMINA" : "DODGE BLOCKED", "hurt");
    }
    if (message.action === "defense") {
      setDefensePresentation(false);
      showCombatFeedback(message.reason === "stamina" ? "NO STAMINA" : "GUARD BLOCKED", "hurt");
    }
    if (message.action === "power") {
      const isEquipRejection = message.requestId?.startsWith("power-equip-") ?? false;
      if (!isEquipRejection) {
        cancelPowerAim();
        cancelLocalPowerPresentation();
      }
      showCombatFeedback(message.reason === "cooldown" ? "POWER RECHARGING" : "POWER BLOCKED", "hurt");
    }
    if (message.action === "special") {
      const isEquipRejection = message.requestId?.startsWith("special-equip-") ?? false;
      if (!isEquipRejection) {
        cancelSpecialAim();
        if (message.reason !== "cooldown") localSpecialCooldownUntil = 0;
        showCombatFeedback(message.reason === "cooldown" ? "SPECIAL RECHARGING" : "SPECIAL BLOCKED", "hurt");
      } else {
        showCombatFeedback("LOADOUT BLOCKED", "hurt");
      }
    }
    if (message.action === "loadout") {
      showCombatFeedback(message.reason === "missing" ? "ITEM REQUIRED" : "LOADOUT BLOCKED", "hurt");
      if (message.reason === "missing") status.textContent = "Collect that weapon from its enemy before equipping it.";
    }
    if (message.reason === "stale") {
      worldReady = false;
      room?.send("world:ready");
    }
  });
  room.onLeave(() => {
    movementShadowInput = null;
    movementPilotReady = false;
    movementPilotController = null;
    movementShadowDifference = null;
    movementShadowAccumulator = 0;
    movementShadowDifferences.length = 0;
    clearReconnectToken();
    document.querySelector<HTMLElement>("#waypoint-guide")!.hidden = true;
    awaitingReturnState = false; townReturnPosition = null;
    if (!defeatScreen.hidden) {
      returnToTownButton.disabled = true;
      defeatDetail.textContent = "Disconnected. Reload to reconnect to the Town of Beginnings.";
    }
    quizPanel.hidden = true;
    blacksmithPanel.hidden = true;
    inventoryPanel.hidden = true;
    inventoryToggle.setAttribute("aria-expanded", "false");
    worldReady = false;
    currentWorldObjective = null;
    worldObjective.hidden = true;
    objectiveMarker.hidden = true;
    objectiveComplete.hidden = true;
    powerServerReady = false;
    localSpecialCooldownUntil = 0;
    localSilverDepthsRunStage = 0;
    localSilverDepthsWing = null;
    lastDepthsCachePhase = null;
    renderDepthsWingRewards(null);
    renderDepthsCheckpointStatus(null);
    renderDepthsPartyStatus(null);
    depthsRetryPrompt.hidden = true;
    setDefensePresentation(false);
    cancelPowerAim();
    cancelSpecialAim();
    cancelLocalPowerPresentation();
    room = null;
    for (const visual of forestPortalVisuals.values()) { visual.root.destroy(); visual.materials.forEach(material => material.destroy()); visual.label.remove(); }
    forestPortalVisuals.clear(); nearbyForestPortal = null;
    for (const burst of dungeonBurstVisuals) { burst.root.destroy(); burst.material.destroy(); }
    dungeonBurstVisuals.length = 0;
    pendingPortalDestination = null;
    social.clearNames();
    partyUI.reset();
    activeRealmEventId = "";
    playerInteractionUI.close();
    tradeUI.update(null);
    pendingPings.clear();
    serverClock = createServerClock(performance.now(), Date.now());
    status.textContent = "Disconnected from the world.";
    for (const remote of remotePlayers.values()) remote.entity.destroy();
    remotePlayers.clear();
    for (const mob of mobVisuals.values()) { mob.combatCue.remove(); mob.levelTag.remove(); mob.respawnTag.remove(); mob.entity.destroy(); mob.warningMesh?.destroy(); }
    mobVisuals.clear();
    for (const popup of rangedPopups) popup.element.remove(); rangedPopups.length = 0; rangedReticleHitUntil = 0;
    bossHudState = initialBossHud(); bossHudFingerprint = ""; activeBossId = ""; bossHud.hidden = true;
    for (const loot of lootVisuals.values()) loot.root.destroy();
    lootVisuals.clear();
    for (const visual of recoveryVisuals.values()) visual.destroy();
    recoveryVisuals.clear(); nearbyRecoveryBag = null; recoveryMarker.hidden = true; recoveryPendingUntil = 0;
    closeLoot();
    for (const itemId of inventoryCounts.keys()) updateInventoryItem(itemId, 0);
    for (const telegraph of powerTelegraphs.values()) telegraph.root.destroy();
    powerTelegraphs.clear();
    for (const impact of powerImpactVisuals) {
      impact.root.destroy();
      impact.fractureRoot.destroy();
    }
    powerImpactVisuals.length = 0;
    for (const debris of powerDebrisVisuals) debris.entity.destroy();
    powerDebrisVisuals.length = 0;
    for (const payoff of markPayoffVisuals) {
      payoff.root.destroy();
      payoff.material.destroy();
    }
    markPayoffVisuals.length = 0;
    for (const snare of brambleSnareVisuals.values()) snare.root.destroy();
    brambleSnareVisuals.clear();
    for (const projectile of weaponProjectileVisuals) { projectile.entity.destroy(); projectile.material.destroy(); }
    weaponProjectileVisuals.length = 0;
    nextNearMissAt = 0;
    projectileWeapons.clear();
    for (const hazard of mobHazardVisuals.values()) hazard.root.destroy();
    mobHazardVisuals.clear();
    for (const hazard of depthsHazardVisuals.values()) { hazard.root.destroy(); hazard.material.destroy(); }
    depthsHazardVisuals.clear();
    updatePlayerCount();
  });
  room.send("world:ready");
  if (movementPilotRequested || (import.meta.env.DEV && query.get("movementShadow") === "1"))
    room.send("movement:shadow:hello", { control: movementPilotRequested });
  room.send("objective:sync");
  const clockPingId = `ping-${++pingSequence}`;
  pendingPings.set(clockPingId, performance.now());
  room.send("ping", { id: clockPingId });
  if (activeRoomName === WORLD_ROOM && returnFrom) {
    const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete("returnFrom"); cleanUrl.searchParams.delete("retry");
    cleanUrl.searchParams.delete("partyTicket"); cleanUrl.searchParams.delete("worldRoomId");
    window.history.replaceState(null, "", cleanUrl);
  }
}

function showCharacterCreator(): void {
  const panel = document.querySelector<HTMLElement>("#character-creator")!;
  const form = document.querySelector<HTMLFormElement>("#creator-form")!;
  const nameInput = document.querySelector<HTMLInputElement>("#creator-name")!;
  const errorLabel = document.querySelector<HTMLElement>("#creator-error")!;
  const enterButton = document.querySelector<HTMLButtonElement>("#creator-enter")!;
  const options = document.querySelector<HTMLElement>("#creator-appearance-options")!;
  const portrait = createCharacterPortrait(document.querySelector<HTMLCanvasElement>("#creator-portrait")!, localPlayerRig.root,
    () => () => {});
  let appearance: Appearance = { ...DEFAULT_APPEARANCE };
  const refresh = () => {
    updateLocalAppearance(appearance);
    portrait.refresh("longsword", "none", Object.values(appearance).join(":"));
    for (const button of options.querySelectorAll<HTMLButtonElement>("button[data-appearance-group]")) {
      const group = button.dataset.appearanceGroup as keyof Appearance;
      button.setAttribute("aria-pressed", String(appearance[group] === button.dataset.appearanceId));
    }
  };
  for (const group of ["skin", "hair", "coat", "hairStyle", "coatStyle"] as const) {
    const row = document.createElement("div");
    row.className = `appearance-choice${group.endsWith("Style") ? " appearance-style-choice" : ""}`;
    const label = document.createElement("span");
    label.textContent = ({ skin: "Skin", hair: "Hair", coat: "Coat", hairStyle: "Hair shape", coatStyle: "Outfit shape" })[group];
    row.append(label);
    const choices = group === "skin" || group === "hair" || group === "coat"
      ? APPEARANCE_PALETTE[group] : APPEARANCE_STYLES[group];
    for (const choice of choices) {
      const button = document.createElement("button"); button.type = "button";
      button.dataset.appearanceGroup = group; button.dataset.appearanceId = choice.id;
      button.setAttribute("aria-label", `${label.textContent}: ${choice.name}`);
      button.title = `${label.textContent}: ${choice.name}`;
      if ("color" in choice) button.style.setProperty("--swatch", choice.color);
      else button.textContent = choice.name;
      button.addEventListener("click", () => { appearance = resolveAppearance({ ...appearance, [group]: choice.id }); refresh(); });
      row.append(button);
    }
    options.append(row);
  }
  document.querySelector<HTMLButtonElement>("#creator-turn-left")!.addEventListener("click", () => portrait.turn(-30));
  document.querySelector<HTMLButtonElement>("#creator-turn-right")!.addEventListener("click", () => portrait.turn(30));
  panel.hidden = false;
  status.textContent = "Create your explorer to enter the world.";
  refresh();
  nameInput.focus();
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const name = PlayerNameSchema.safeParse(nameInput.value);
    if (!name.success) { errorLabel.textContent = "Use 2–20 letters, numbers, spaces, hyphens or underscores."; nameInput.focus(); return; }
    errorLabel.textContent = "";
    enterButton.disabled = true;
    enterButton.textContent = "ENTERING THE WORLD…";
    try {
      await connect({ name: name.data, appearance });
      try { finishCharacterCreation(window.localStorage); } catch { /* Private browsing may prevent storage. */ }
      portrait.destroy();
      panel.hidden = true;
    } catch (error) {
      errorLabel.textContent = `Could not enter the world: ${error instanceof Error ? error.message : String(error)}`;
      enterButton.disabled = false;
      enterButton.textContent = "TRY AGAIN →";
    }
  });
}

if (characterCreationRequired) showCharacterCreator();
else connect().catch(error => {
  status.textContent = `Connection failed: ${error instanceof Error ? error.message : String(error)}`;
});
