import { MAIN_HAND_DEFINITIONS, WEAPON_ATTACK_DEFINITIONS, reforgeArmourReduction, reforgeWeaponDamageBonus, type MainHandId } from "@blockcraft/protocol";
import { armourStats, type ArmourId } from "@blockcraft/protocol";
import { effectiveWeaponRange, fastWorldWeaponProfile, fastWorldAttackTiming } from "@blockcraft/protocol";

export type ComparisonTrend = "better" | "worse" | "same";
export function comparisonTrend(selected: number, worn: number, lowerIsBetter = false): ComparisonTrend {
  if (selected === worn) return "same";
  return (lowerIsBetter ? selected < worn : selected > worn) ? "better" : "worse";
}

export function armourComparison(id: ArmourId, rank = 0) {
  const stats = armourStats(id);
  const reductionValue = stats.reduction + reforgeArmourReduction(rank);
  return { name: stats.name, reduction: `${reductionValue} damage`, reductionValue, speed: `${Math.round(stats.speed * 100)}%`, speedValue: stats.speed,
    minimum: "1 damage per hit",
    ranged: stats.projectileReduction > 0 ? `Extra −${stats.projectileReduction}` : "No extra protection",
    rangedValue: stats.projectileReduction,
    hazards: stats.hazardReduction > 0 ? `Extra −${stats.hazardReduction}` : "No extra protection",
    hazardValue: stats.hazardReduction,
    note: "One armour slot · fixed item identity · no rarity tiers" };
}
export function weaponComparison(id: MainHandId, ironSwordOwned = false, rank = 0, fastWorld = false, haste = 0) {
  const weapon = WEAPON_ATTACK_DEFINITIONS[id];
  const forgedSword = id === "longsword" && ironSwordOwned;
  const profile = fastWorldWeaponProfile(id, fastWorld);
  const damageBonus = reforgeWeaponDamageBonus(rank) + (profile?.bonusDamage ?? 0);
  const range = effectiveWeaponRange(id, fastWorld);
  const timing = fastWorldAttackTiming(weapon.attacks[0], fastWorld, haste);
  const damages = weapon.attacks.map(step => step.damage + (forgedSword ? 1 : 0) + damageBonus);
  return {
    name: forgedSword ? "Iron Sword" : MAIN_HAND_DEFINITIONS[id].name,
    damage: damages.join(" / "),
    damageValue: damages.reduce((total, damage) => total + damage, 0) / damages.length,
    range: `${range.toFixed(2)} ${fastWorld ? "m" : "blocks"}`,
    rangeValue: range,
    speed: `${timing.durationMs} ms`,
    speedValue: timing.durationMs,
    style: profile?.style === "crescent" ? `${MAIN_HAND_DEFINITIONS[id].attackName} · Crescent reaches ${range.toFixed(1)} m, pierces ${profile.pierce} enemies` : MAIN_HAND_DEFINITIONS[id].attackName,
    benefit: id === "fang_dagger" ? "Faster attacks, shorter reach"
      : id === "rootbound_hammer" ? "Heavy 2 / 2 / 4 combo · finisher roots nearby enemies"
      : id === "matriarch_edge" ? "Moonstone 3 / 3 / 5 combo · swift boss weapon"
      : id === "stone_core_hammer" ? "Heavy knockback · can stagger windups"
        : id === "venom_focus" ? "F: three-shot Venom Fan · 8s cooldown"
        : id === "echo_prism" ? "Quick crystal bolts · Silver Echo route reward"
        : id === "acid_gland_focus" ? "Ranged corrosive bolts" : "Your current weapon",
  };
}
