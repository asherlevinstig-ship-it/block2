import { describe, expect, it, vi } from "vitest";
import { TradeRequestSchema, type TradeRequest } from "@blockcraft/protocol";
import { Trading, tradeBalance, type TradeBalance } from "../src/trading.js";
function fixture() {
  const trades = new Trading(); const players = new Map(["a", "b", "c"].map(id => [id, { x: id === "a" ? 0 : 2, y: 8, z: 0, health: 5, name: id, coins: 100, mainHandId: "longsword", blacksmithUpgrades: 0,
    inventory: new Map<string, { quantity: number }>([["iron_ore", { quantity: 5 }], ["fang_dagger", { quantity: 1 }]]) }]));
  let now = 10000;
  const commit = vi.fn((ids: [string, string], balances: [TradeBalance, TradeBalance]) => { ids.forEach((id, index) => { const p = players.get(id)!; p.coins = balances[index]!.coins; for (const item of balances[index]!.items) p.inventory.set(item.itemId, { quantity: item.quantity }); }); });
  const handle = (id: string, request: TradeRequest) => trades.handle(id, request, players, now, commit);
  const open = () => { handle("a", { action: "invite", targetId: "b" }); const id = trades.snapshot("b", players)!.id; handle("b", { action: "accept", tradeId: id }); return id; };
  const offer = (id: string, gold: number, quantity = 0) => handle(id, { action: "offer", tradeId: trades.snapshot(id, players)!.id, revision: trades.snapshot(id, players)!.revision, gold, items: quantity ? [{ itemId: "iron_ore", quantity }] : [] });
  const confirm = (id: string) => handle(id, { action: "confirm", tradeId: trades.snapshot(id, players)!.id, revision: trades.snapshot(id, players)!.revision });
  return { trades, players, commit, handle, open, offer, confirm, advance: (ms: number) => { now += ms; trades.refresh(players, now); } };
}
describe("two-sided atomic live trades", () => {
  it("does not invite through obstructing terrain", () => {
    const f = fixture(), blocked = new Trading(() => false);
    expect(blocked.handle("a", { action: "invite", targetId: "b" }, f.players, 10000, f.commit)).toContain("visible");
    expect(blocked.snapshot("a", f.players)).toBeNull();
  });
  it("exchanges items and gold only after both confirm, exactly once", () => {
    const f = fixture(), id = f.open(); f.offer("a", 0, 3); f.offer("b", 20);
    f.confirm("a"); expect(f.commit).not.toHaveBeenCalled(); f.confirm("b");
    expect(f.players.get("a")!.coins).toBe(120); expect(f.players.get("b")!.coins).toBe(80);
    expect(f.players.get("a")!.inventory.get("iron_ore")!.quantity).toBe(2); expect(f.players.get("b")!.inventory.get("iron_ore")!.quantity).toBe(8);
    expect(f.trades.snapshot("a", f.players)).toBeNull();
    f.handle("b", { action: "confirm", tradeId: id, revision: 2 }); expect(f.commit).toHaveBeenCalledTimes(1);
  });
  it("resets both confirmations when either offer changes and rejects stale revisions", () => {
    const f = fixture(), id = f.open(); f.offer("a", 10); f.confirm("a"); f.offer("b", 5);
    expect(f.trades.snapshot("a", f.players)!.mineConfirmed).toBe(false);
    expect(f.handle("a", { action: "confirm", tradeId: id, revision: 1 })).toContain("changed"); expect(f.commit).not.toHaveBeenCalled();
  });
  it("revalidates item ownership and gold at settlement without partial writes", () => {
    const f = fixture(); f.open(); f.offer("a", 50, 4); f.confirm("a"); f.players.get("a")!.coins = 10;
    expect(f.confirm("b")).toContain("gold"); expect(f.commit).not.toHaveBeenCalled(); expect(f.players.get("b")!.coins).toBe(100);
    const g = fixture(); g.open(); g.offer("a", 0, 5); g.players.get("a")!.inventory.get("iron_ore")!.quantity = 1; g.confirm("a"); expect(g.confirm("b")).toContain("available"); expect(g.commit).not.toHaveBeenCalled();
  });
  it("rejects capacity overflow and excessive gold instead of truncating items", () => {
    const f = fixture(); f.open(); f.offer("a", 0, 5); f.players.get("b")!.inventory.get("iron_ore")!.quantity = 12;
    f.confirm("a"); expect(f.confirm("b")).toContain("pack"); expect(f.commit).not.toHaveBeenCalled();
    const p = f.players.get("b")!; p.coins = 1000000;
    expect(tradeBalance(p, { gold: 0, items: [] }, { gold: 1, items: [] })).toContain("gold limit");
  });
  it("protects account-bound tools and the equipped weapon's last copy", () => {
    const f = fixture(); const p = f.players.get("a")!; p.mainHandId = "fang_dagger";
    expect(tradeBalance(p, { gold: 0, items: [{ itemId: "fang_dagger", quantity: 1 }] }, { gold: 0, items: [] })).toContain("equipped");
    expect(tradeBalance(p, { gold: 0, items: [{ itemId: "reinforced_pickaxe", quantity: 1 }] }, { gold: 0, items: [] })).toContain("Account-bound");
  });
  it("cancels on distance, death, disconnect, or expiry without moving inventory", () => {
    for (const cause of ["distance", "death", "disconnect", "expiry"]) {
      const f = fixture(); f.open(); f.offer("a", 10);
      if (cause === "distance") f.players.get("b")!.x = 5;
      if (cause === "death") f.players.get("b")!.health = 0;
      if (cause === "disconnect") f.trades.disconnect("b");
      f.advance(cause === "expiry" ? 120000 : 1);
      expect(f.trades.snapshot("a", f.players)).toBeNull(); expect(f.commit).not.toHaveBeenCalled();
      expect(f.players.get("a")!.coins).toBe(100);
    }
  });
  it("requires recipient consent and prevents third-party access", () => {
    const f = fixture(); f.handle("a", { action: "invite", targetId: "b" }); const id = f.trades.snapshot("a", f.players)!.id;
    expect(f.handle("a", { action: "accept", tradeId: id })).toContain("no longer");
    expect(f.handle("c", { action: "cancel", tradeId: id })).toContain("no longer");
    expect(f.handle("b", { action: "confirm", tradeId: id, revision: 0 })).toContain("changed");
    expect(f.commit).not.toHaveBeenCalled();
  });
  it("rejects duplicate item lines, fractions, negatives and oversized offers", () => {
    const p = fixture().players.get("a")!;
    expect(tradeBalance(p, { gold: 0, items: [{ itemId: "iron_ore", quantity: 1 }, { itemId: "iron_ore", quantity: 1 }] }, { gold: 0, items: [] })).toContain("once");
    for (const gold of [-1, 1.5, 1000001]) expect(TradeRequestSchema.safeParse({ action: "offer", tradeId: "x", revision: 0, gold, items: [] }).success).toBe(false);
    expect(TradeRequestSchema.safeParse({ action: "offer", tradeId: "x", revision: 0, gold: 0, items: [{ itemId: "fake", quantity: 1 }] }).success).toBe(false);
  });
});
