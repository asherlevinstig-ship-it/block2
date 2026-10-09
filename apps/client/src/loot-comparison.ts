import { MAIN_HAND_DEFINITIONS, WEAPON_ATTACK_DEFINITIONS, type MainHandId } from "@blockcraft/protocol";
export function weaponComparison(id: MainHandId, ironSwordOwned = false) {
  const weapon = WEAPON_ATTACK_DEFINITIONS[id];
  const forgedSword = id === "longsword" && ironSwordOwned;
  return {
    name: forgedSword ? "Iron Sword" : MAIN_HAND_DEFINITIONS[id].name,
    damage: weapon.attacks.map(step => step.damage + (forgedSword ? 1 : 0)).join(" / "),
    range: `${weapon.range.toFixed(2)} blocks`,
    speed: `${weapon.attacks[0].durationMs} ms`,
    style: MAIN_HAND_DEFINITIONS[id].attackName,
    benefit: id === "fang_dagger" ? "Faster attacks, shorter reach"
      : id === "stone_core_hammer" ? "Heavy knockback · can stagger windups"
        : id === "acid_gland_focus" ? "Ranged corrosive bolts" : "Your current weapon",
  };
}
