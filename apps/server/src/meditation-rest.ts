import { MeditationRestRequestSchema, meditationSite, meditationSiteInRange,
  type MeditationRestUpdate } from "@blockcraft/protocol";

export type MeditationPlayer = {
  x: number; y: number; z: number;
  health: number; maxHealth: number;
  stamina: number; maxStamina: number;
  potionCooldownUntil: number;
  powerCooldownUntil: number;
  specialCooldownUntil: number;
  defending: boolean;
  powerCastStartedAt: number;
  invulnerableUntil: number;
};

export function restAtMeditationSite(player: MeditationPlayer, payload: unknown, now = Date.now()): MeditationRestUpdate | null {
  const request = MeditationRestRequestSchema.safeParse(payload);
  if (!request.success) return null;
  const site = meditationSite(request.data.siteId);
  if (player.health <= 0) return { ok: false, siteId: site.id, name: site.name, message: "The Waystone cannot answer while you are defeated." };
  if (!meditationSiteInRange(player, site.id)) return { ok: false, siteId: site.id, name: site.name, message: "Move beside the Waystone before meditating." };

  player.health = player.maxHealth;
  player.stamina = player.maxStamina;
  player.potionCooldownUntil = 0;
  player.powerCooldownUntil = 0;
  player.specialCooldownUntil = 0;
  player.defending = false;
  player.powerCastStartedAt = 0;
  player.invulnerableUntil = Math.max(player.invulnerableUntil, now + 1_200);
  return { ok: true, siteId: site.id, name: site.name,
    message: `${site.name} attuned · health, stamina and abilities restored.`,
    health: player.health, maxHealth: player.maxHealth, stamina: player.stamina, maxStamina: player.maxStamina };
}
