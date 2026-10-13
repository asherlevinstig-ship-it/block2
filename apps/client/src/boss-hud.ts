type Pose = { x: number; y: number; z: number };
export type BossHudMob = Pose & { name: string; alive: boolean; health: number; maxHealth: number; enraged?: boolean; isMiniBoss?: boolean; leaderRematchTier?: number; leaderModifier?: string };
export type CombatHudMob = Pose & { alive: boolean; combatState: string; targetId: string };
export interface BossHudState { visible: boolean; alive?: boolean; enraged: boolean; message: string; messageUntil: number }
export const initialBossHud = (): BossHudState => ({ visible: false, enraged: false, message: "", messageUntil: 0 });
export interface BossHudCopy { arrival: string; enrage: string; defeat: string }
export function bossHudCopy(name: string, isMiniBoss = false): BossHudCopy {
  if (/Razorhide Pack Sovereign/i.test(name)) return {
    arrival: "FANG PATH CHAMPION · RAZORHIDE CLAIMS THE HUNT",
    enrage: "FINAL PHASE · ALPHA RUSH",
    defeat: "RAZORHIDE DEFEATED · FANG CACHE DROPPED",
  };
  if (/Viridian Brood Oracle/i.test(name)) return {
    arrival: "VENOM PATH CHAMPION · WATCH THE GROUND",
    enrage: "FINAL PHASE · VENOM RING",
    defeat: "VIRIDIAN ORACLE DEFEATED · VENOM CACHE DROPPED",
  };
  if (/Worldsplitter Colossus/i.test(name)) return {
    arrival: "CRUSHER PATH CHAMPION · WORLDSPLITTER AWAKENS",
    enrage: "FINAL PHASE · ROCK BARRAGE",
    defeat: "WORLDSPLITTER DEFEATED · CRUSHER CACHE DROPPED",
  };
  if (isMiniBoss) return {
    arrival: `${name.toUpperCase()} DISCOVERED · AREA MINI-BOSS`,
    enrage: `${name.toUpperCase()} IS ENRAGED`,
    defeat: `${name.toUpperCase()} DEFEATED · PREMIUM LOOT DROPPED`,
  };
  if (/Crystal Matriarch/i.test(name)) return {
    arrival: "CRYSTAL MATRIARCH AWAKENS · FIND THE GAPS",
    enrage: "PHASE 2 · ROTATING CRYSTAL WAVES",
    defeat: "CRYSTAL MATRIARCH DEFEATED · CLAIM MATRIARCH'S EDGE",
  };
  if (/Root Guardian/i.test(name)) return {
    arrival: "ANCIENT ROOT GUARDIAN AWAKENS",
    enrage: "THE HEARTWOOD BREAKS · CHARGE INCOMING",
    defeat: "ROOT GUARDIAN DEFEATED · CLAIM YOUR REWARD",
  };
  if (/Realm Stone Warden/i.test(name)) return {
    arrival: "THE REALM STONE WARDEN HAS AWAKENED",
    enrage: "REALM PRESSURE SURGES · KEEP MOVING",
    defeat: "REALM CLEARED · PERSONAL VICTORY CACHES DROPPED",
  };
  if (/Stoneheart/i.test(name)) return {
    arrival: "STONEHEART SIEGE LORD HAS ARRIVED",
    enrage: "STONEHEART ENRAGED · VOLLEY INCOMING",
    defeat: "STONEHEART BROKEN · COLLECT YOUR CACHE",
  };
  if (/Ashglass/i.test(name)) return {
    arrival: "ASHGLASS ORACLE HAS MATERIALISED",
    enrage: "ASHGLASS OVERLOAD · FIND THE FIRING GAPS",
    defeat: "ASHGLASS ORACLE SHATTERED · COLLECT YOUR CACHE",
  };
  return {
    arrival: "VENOM MATRIARCH HAS ARRIVED",
    enrage: "ENRAGED · WATCH FOR THE DOUBLE VOLLEY",
    defeat: "MATRIARCH DEFEATED · COLLECT YOUR LOOT",
  };
}
/** Track transitions, not frames, so notices never replay every update or re-entry. */
export function advanceBossHud(previous: BossHudState, boss: BossHudMob | undefined, player: Pose & { health: number }, now: number): BossHudState {
  if (!boss || player.health <= 0) return initialBossHud();
  const nearby = Math.abs(player.y - boss.y) <= 2.5 && Math.hypot(player.x - boss.x, player.z - boss.z) <= (previous.visible ? 28 : 24);
  const copy = bossHudCopy(boss.name, boss.isMiniBoss);
  let message = previous.message, messageUntil = previous.messageUntil;
  if (!nearby) { message = ""; messageUntil = 0; }
  else if (boss.alive && previous.alive !== true) { message = copy.arrival; messageUntil = now + 3000; }
  else if (boss.alive && boss.enraged && !previous.enraged) { message = copy.enrage; messageUntil = now + 3000; }
  else if (!boss.alive && previous.alive === true && previous.visible) { message = copy.defeat; messageUntil = now + 3500; }
  if (now >= messageUntil) message = "";
  return { visible: nearby && (boss.alive || message !== ""), alive: boss.alive, enraged: boss.enraged === true, message, messageUntil };
}

const ATTACK_NAMES: Readonly<Record<string, string>> = {
  aimed: "AIMED VOLLEY",
  fan: "FAN VOLLEY",
  "double-fan": "DOUBLE FAN",
  pool: "VENOM POOL",
  "venom-ring": "CIRCLE BREAKER · VENOM RING",
  rush: "PACK RUSH",
  "pack-rush": "PACK RUSH",
  "alpha-rush": "CIRCLE BREAKER · ALPHA RUSH",
  rocks: "ROCK VOLLEY",
  "falling-rocks": "FALLING ROCKS",
  "warden-barrage": "CIRCLE BREAKER · ROCK BARRAGE",
  slam: "GROUND SLAM",
  smash: "FORWARD SMASH",
  charge: "CHARGE",
  "crystal-burst": "CRYSTAL BURST",
  "teleport-burst": "TELEPORT BURST",
};

export function leaderAttackName(pattern: string): string {
  return ATTACK_NAMES[pattern] ?? pattern.replaceAll("-", " ").toUpperCase();
}

export function leaderAttackLabel(pattern: string, combatState: string): string {
  const name = leaderAttackName(pattern);
  if (combatState === "windup") return `${name} · INCOMING`;
  if (combatState === "strike") return `${name} · ACTIVE`;
  if (combatState === "recover") return `${name} · RECOVERING`;
  return `${name} · READY`;
}

export function leaderExposureLabel(expiresAt: number, now: number): string {
  const remaining = Math.max(0, expiresAt - now);
  return remaining > 0 ? `LEADER EXPOSED · ${(Math.ceil(remaining / 100) / 10).toFixed(1)}s` : "";
}

export function leaderRematchLabel(tier = 0, modifier = ""): string {
  if (tier <= 0 || !modifier) return "";
  const relics = tier >= 4 ? "2 RELICS" : "RELIC";
  return `${modifier.toUpperCase()} · R${tier} · ${relics} +${Math.min(3, Math.ceil(tier / 2))} MAT`;
}

export function leaderHealthPhase(health: number, maxHealth: number): 1 | 2 | 3 {
  if (maxHealth <= 0 || health * 4 <= maxHealth) return 3;
  if (health * 5 <= maxHealth * 3) return 2;
  return 1;
}

export function pathChampionPhaseLabel(name: string, phase: 1 | 2 | 3, recovering = false): string {
  if (recovering) return `PHASE ${phase} · COUNTER WINDOW`;
  if (/Razorhide Pack Sovereign/i.test(name))
    return `PHASE ${phase} · ${phase === 1 ? "HUNTING RUSH" : phase === 2 ? "PACK RUSH" : "ALPHA RUSH"}`;
  if (/Viridian Brood Oracle/i.test(name))
    return `PHASE ${phase} · ${phase === 1 ? "VENOM SHOTS" : phase === 2 ? "SPREADING POOLS" : "VENOM RING"}`;
  if (/Worldsplitter Colossus/i.test(name))
    return `PHASE ${phase} · ${phase === 1 ? "ROCK VOLLEY" : phase === 2 ? "FALLING ROCKS" : "ROCK BARRAGE"}`;
  return "";
}

export function realmBossHealthPhase(health: number, maxHealth: number): 1 | 2 | 3 {
  if (maxHealth <= 0 || health * 3 <= maxHealth) return 3;
  if (health * 3 <= maxHealth * 2) return 2;
  return 1;
}

export function activeCombatNearby(playerId: string, player: Pose, mobs: Iterable<CombatHudMob>, radius = 18): boolean {
  for (const mob of mobs) {
    if (!mob.alive || Math.abs(player.y - mob.y) > 2.5
      || Math.hypot(player.x - mob.x, player.z - mob.z) > radius) continue;
    if (mob.targetId === playerId || mob.combatState !== "idle") return true;
  }
  return false;
}
