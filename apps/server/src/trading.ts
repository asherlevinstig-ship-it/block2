import { ITEM_DEFINITIONS, MAIN_HAND_DEFINITIONS, HEALING_POTION, type ItemId, type MainHandId, type TradeOffer, type TradeRequest, type TradeUpdate } from "@blockcraft/protocol";
import { ironCapacity, MAX_GOLD } from "./blacksmith.js";
type Player = { x: number; y: number; z: number; health: number; name: string; coins: number; mainHandId: string; blacksmithUpgrades: number;
  inventory: { get(id: string): { quantity: number } | undefined } };
type Players = { get(id: string): Player | undefined };
type Session = { id: string; members: [string, string]; accepted: boolean; offers: [TradeOffer, TradeOffer]; confirmed: [boolean, boolean]; revision: number; expiresAt: number };
export type TradeBalance = { coins: number; items: { itemId: ItemId; quantity: number }[] };
const empty = (): TradeOffer => ({ gold: 0, items: [] });
export const tradeNear = (a: Player, b: Player) => a.health > 0 && b.health > 0 && Math.abs(a.y - b.y) <= 1.5 && Math.hypot(a.x - b.x, a.z - b.z) <= 4;
export function tradeBalance(player: Player, outgoing: TradeOffer, incoming: TradeOffer): TradeBalance | string {
  if (new Set(outgoing.items.map(item => item.itemId)).size !== outgoing.items.length) return "An item can only appear once in an offer.";
  if (outgoing.gold > player.coins) return "You no longer have enough gold.";
  const definition = MAIN_HAND_DEFINITIONS[player.mainHandId as MainHandId];
  const required = definition && "requiredItemId" in definition ? definition.requiredItemId : undefined;
  for (const item of outgoing.items) {
    const owned = player.inventory.get(item.itemId)?.quantity ?? 0;
    if (item.itemId === "reinforced_pickaxe") return "Account-bound upgrades cannot be traded.";
    if (owned < item.quantity) return "An offered item is no longer available.";
    if (item.itemId === required && owned - item.quantity < 1) return "Keep one copy of your equipped weapon. Equip another weapon first.";
  }
  const coins = player.coins - outgoing.gold + incoming.gold;
  if (coins > MAX_GOLD) return "The trade exceeds a player's gold limit.";
  const items = (Object.keys(ITEM_DEFINITIONS) as ItemId[]).map(itemId => ({ itemId, quantity: (player.inventory.get(itemId)?.quantity ?? 0)
    - (outgoing.items.find(item => item.itemId === itemId)?.quantity ?? 0) + (incoming.items.find(item => item.itemId === itemId)?.quantity ?? 0) }));
  if (items.some(item => item.quantity > (item.itemId === "healing_potion" ? HEALING_POTION.capacity : item.itemId === "iron_ore" || item.itemId === "silver_ore" ? ironCapacity(player.blacksmithUpgrades) : 65535))) return "A player's pack cannot hold the offered items.";
  return { coins, items };
}
export class Trading {
  constructor(private readonly allowed: (a: Player, b: Player) => boolean = () => true) {}
  private readonly sessions = new Map<string, Session>();
  private readonly membership = new Map<string, string>();
  private readonly lastInvite = new Map<string, number>(); private sequence = 0;
  busy(id: string) { return this.membership.has(id); }
  private close(session: Session) { this.sessions.delete(session.id); for (const id of session.members) this.membership.delete(id); }
  disconnect(id: string) { const session = this.sessions.get(this.membership.get(id) ?? ""); if (session) this.close(session); this.lastInvite.delete(id); }
  refresh(players: Players, now: number) {
    for (const session of this.sessions.values()) {
      const a = players.get(session.members[0]), b = players.get(session.members[1]);
      if (!a || !b || !tradeNear(a, b) || !this.allowed(a, b) || now >= session.expiresAt) this.close(session);
    }
  }
  handle(id: string, request: TradeRequest, players: Players, now: number, commit: (ids: [string, string], balances: [TradeBalance, TradeBalance]) => void): string {
    this.refresh(players, now); const player = players.get(id); if (!player) return "Connect first.";
    if (request.action === "invite") {
      const other = players.get(request.targetId);
      if (request.targetId === id || !other || !tradeNear(player, other) || !this.allowed(player, other)) return "Trade with a visible, living player within 4m on your level.";
      if (this.busy(id) || this.busy(request.targetId)) return "One player is already trading.";
      if (now - (this.lastInvite.get(id) ?? -Infinity) < 2000) return "Wait before inviting again.";
      this.lastInvite.set(id, now); const tradeId = `trade-${now}-${++this.sequence}`;
      const session: Session = { id: tradeId, members: [id, request.targetId], accepted: false, offers: [empty(), empty()], confirmed: [false, false], revision: 0, expiresAt: now + 30000 };
      this.sessions.set(tradeId, session); for (const member of session.members) this.membership.set(member, tradeId);
      return `Trade invitation sent to ${other.name}.`;
    }
    const session = this.sessions.get(request.tradeId);
    if (!session || !session.members.includes(id)) return "That trade is no longer available.";
    const index = session.members[0] === id ? 0 : 1;
    if (request.action === "cancel") { this.close(session); return "Trade cancelled. Nothing exchanged."; }
    if (request.action === "accept") {
      if (index !== 1 || session.accepted) return "That invitation is no longer available.";
      session.accepted = true; session.expiresAt = now + 120000; return "Trade opened. Offer items or gold, then both confirm.";
    }
    if (!session.accepted || request.revision !== session.revision) return "The offer changed. Review the latest trade before confirming.";
    if (request.action === "offer") {
      const offer = { gold: request.gold, items: request.items };
      const result = tradeBalance(player, offer, empty()); if (typeof result === "string") return result;
      session.offers[index] = offer; session.revision++; session.confirmed = [false, false]; session.expiresAt = now + 120000;
      return "Offer updated. Both players must confirm again.";
    }
    session.confirmed[index] = true;
    if (!session.confirmed.every(Boolean)) return "Confirmed. Waiting for your partner.";
    const a = players.get(session.members[0])!, b = players.get(session.members[1])!;
    const balanceA = tradeBalance(a, session.offers[0], session.offers[1]), balanceB = tradeBalance(b, session.offers[1], session.offers[0]);
    if (typeof balanceA === "string" || typeof balanceB === "string") { session.confirmed = [false, false]; session.revision++; return typeof balanceA === "string" ? balanceA : balanceB as string; }
    // No awaits: validate both sides, apply both balances, and retire the session once.
    commit(session.members, [balanceA, balanceB]); this.close(session); return "Trade completed.";
  }
  snapshot(id: string, players: Players): TradeUpdate {
    const session = this.sessions.get(this.membership.get(id) ?? ""), player = players.get(id); if (!session || !player) return null;
    const index = session.members[0] === id ? 0 : 1; const partner = players.get(session.members[1 - index]!);
    return { id: session.id, phase: session.accepted ? "offer" : "invite", incoming: index === 1, partner: partner?.name ?? "Player", revision: session.revision,
      mine: session.offers[index]!, theirs: session.offers[1 - index]!, mineConfirmed: session.confirmed[index]!, theirsConfirmed: session.confirmed[1 - index]!, expiresAt: session.expiresAt,
      inventory: (Object.keys(ITEM_DEFINITIONS) as ItemId[]).filter(itemId => itemId !== "reinforced_pickaxe").map(itemId => ({ itemId, quantity: player.inventory.get(itemId)?.quantity ?? 0 })).filter(item => item.quantity > 0), gold: player.coins };
  }
}
