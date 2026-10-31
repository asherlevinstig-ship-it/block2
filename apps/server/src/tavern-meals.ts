import { TAVERN_MEALS, type TavernMealId } from "@blockcraft/protocol";

export type TavernMealState = "prepared" | "active" | "";

export interface TavernMealPlayer {
  health: number;
  maxHealth: number;
  coins: number;
  huntLoadoutsJson: string;
}

export interface TavernMealSelection {
  id: TavernMealId;
  state: "prepared" | "active";
}

export function isTavernMealId(value: unknown): value is TavernMealId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(TAVERN_MEALS, value);
}

export function parseTavernMeal(json: string): TavernMealSelection | null {
  try {
    const raw = (JSON.parse(json) as { tavernMeal?: { id?: unknown; state?: unknown } }).tavernMeal;
    return raw && isTavernMealId(raw.id) && (raw.state === "prepared" || raw.state === "active")
      ? { id: raw.id, state: raw.state } : null;
  } catch { return null; }
}

export function withTavernMeal(json: string, meal: TavernMealSelection | null): string {
  let value: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed as Record<string, unknown>;
  } catch { /* repair malformed legacy profile */ }
  if (meal) return JSON.stringify({ ...value, tavernMeal: meal });
  const { tavernMeal: _removed, ...rest } = value;
  return JSON.stringify(rest);
}

export function prepareTavernMeal(player: TavernMealPlayer, mealId: TavernMealId): string | null {
  const meal = TAVERN_MEALS[mealId];
  if (player.coins < meal.price) return `You need ${meal.price - player.coins} more gold for ${meal.name}.`;
  endTavernMeal(player);
  player.coins -= meal.price;
  player.huntLoadoutsJson = withTavernMeal(player.huntLoadoutsJson, { id: mealId, state: "prepared" });
  return null;
}

export function activateTavernMeal(player: TavernMealPlayer): TavernMealId | null {
  const prepared = parseTavernMeal(player.huntLoadoutsJson);
  if (prepared?.state !== "prepared") return null;
  const mealId = prepared.id;
  player.huntLoadoutsJson = withTavernMeal(player.huntLoadoutsJson, { id: mealId, state: "active" });
  if (mealId === "hearty_stew") {
    player.maxHealth += 2;
    player.health = Math.min(player.maxHealth, player.health + 2);
  }
  return mealId;
}

export function endTavernMeal(player: TavernMealPlayer): TavernMealId | null {
  const meal = parseTavernMeal(player.huntLoadoutsJson);
  if (meal?.id === "hearty_stew" && meal.state === "active") {
    player.maxHealth = Math.max(1, player.maxHealth - 2);
    player.health = Math.min(player.health, player.maxHealth);
  }
  player.huntLoadoutsJson = withTavernMeal(player.huntLoadoutsJson, null);
  return meal?.id ?? null;
}

export function tavernMealStaminaRecoveryBonus(player: Pick<TavernMealPlayer, "huntLoadoutsJson">): number {
  // This is evaluated in the simulation loop, so avoid a JSON parse for the
  // overwhelmingly common case where no runner's tea is present.
  if (!player.huntLoadoutsJson.includes('"runners_tea"')) return 0;
  const meal = parseTavernMeal(player.huntLoadoutsJson);
  return meal?.state === "active" && meal.id === "runners_tea" ? 6 : 0;
}

export function tavernMealEquipmentRoll(player: Pick<TavernMealPlayer, "huntLoadoutsJson"> | undefined,
  roll: number): number {
  if (!player?.huntLoadoutsJson.includes('"fortune_pie"')) return roll;
  const meal = parseTavernMeal(player.huntLoadoutsJson);
  return meal?.state === "active" && meal.id === "fortune_pie" ? Math.max(0, Math.min(1, roll * .8)) : roll;
}
