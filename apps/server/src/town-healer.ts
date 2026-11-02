import type { BuildPathId, TownNpcInteractionUpdate } from "@blockcraft/protocol";

export interface TownHealerPatient {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
}

export function receiveTownHealerCare(
  player: TownHealerPatient,
  pathId: BuildPathId | null,
): TownNpcInteractionUpdate {
  const healthRestored = Math.max(0, player.maxHealth - player.health);
  const staminaRestored = Math.max(0, player.maxStamina - player.stamina);
  player.health = player.maxHealth;
  player.stamina = player.maxStamina;
  const recovery = healthRestored || staminaRestored
    ? `Recovered ${healthRestored} HP and ${staminaRestored} stamina.`
    : "You are already fully recovered.";
  const guidance = pathId === "healer"
    ? "Field Mend rescues one injured ally; Renewal rewards allies who hold its sanctuary; Resurrection requires a 2.5 second protected channel beside a fallen party member. Use Try Abilities to practise them safely."
    : "Lyra restores travellers in Town. Choose the Healer Calling if you want Field Mend, Renewal and Resurrection.";
  return {
    npcId: "healer-lyra",
    action: "care",
    ok: true,
    message: `${recovery} ${guidance}`,
    health: player.health,
    maxHealth: player.maxHealth,
    stamina: player.stamina,
    maxStamina: player.maxStamina,
    ...(pathId === "healer" ? { practiceCalling: "healer" as const } : {}),
  };
}

