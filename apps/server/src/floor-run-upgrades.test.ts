import { describe, expect, it } from "vitest";
import { FLOOR_RUN_UPGRADES, floorUpgradeChoices, type BuildPathId, type CallingAbilityId } from "@blockcraft/protocol";
import { FloorRunUpgrades } from "./floor-run-upgrades.js";

describe("Floor 1 class upgrade offers", () => {
  it.each(["tank", "mage", "assassin", "thief", "ranger", "healer"] as BuildPathId[])("%s has six upgrades across three directions and no locked-ability offers", path => {
    const definitions = FLOOR_RUN_UPGRADES.filter(upgrade => upgrade.path === path);
    expect(definitions).toHaveLength(6);
    const branches = [...new Set(definitions.map(upgrade => upgrade.branch))];
    expect(branches).toHaveLength(3);
    for (const branch of branches) expect(definitions.filter(upgrade => upgrade.branch === branch)).toHaveLength(2);
    const choices = floorUpgradeChoices(path, [], [], 51);
    expect(choices).toHaveLength(3);
    expect(choices.every(id => !definitions.find(upgrade => upgrade.id === id)?.ability)).toBe(true);
  });
  it("gives both Wardens independent rewards once, with two picks and no duplicates per attempt", () => {
    const runs = new FloorRunUpgrades(); runs.start("hero");
    expect(runs.earn("hero", "north")).toBe(true); expect(runs.earn("hero", "north")).toBe(false);
    expect(runs.earn("hero", "south")).toBe(true); expect(runs.earn("hero", "extra")).toBe(false);
    const abilities: CallingAbilityId[] = ["assassin_vanish", "assassin_death_mark"];
    const first = runs.state("hero", "assassin", abilities);
    expect(first.pending).toBe(2);
    expect(runs.choose("hero", first.offerId!, first.choices[0]!, "assassin", abilities)).toBe(true);
    expect(runs.choose("hero", first.offerId!, first.choices[0]!, "assassin", abilities)).toBe(false);
    const second = runs.state("hero", "assassin", abilities);
    expect(second.choices).not.toContain(first.choices[0]); expect(second.pending).toBe(1);
    expect(runs.choose("hero", second.offerId!, second.choices[0]!, "assassin", abilities)).toBe(true);
    expect(runs.state("hero", "assassin", abilities)).toMatchObject({ earned: 2, pending: 0, choices: [] });
    expect(runs.state("hero", "assassin", abilities).picked).toHaveLength(2);
  });
  it("retains an offer when reopened, rejects forged choices and isolates players", () => {
    const runs = new FloorRunUpgrades(); runs.start("a"); runs.start("b"); runs.earn("a", "north");
    const first = runs.state("a", "mage", []);
    expect(runs.state("a", "mage", [])).toEqual(first);
    expect(runs.choose("a", first.offerId!, "tank_guard", "mage", [])).toBe(false);
    expect(runs.choose("b", first.offerId!, first.choices[0]!, "mage", [])).toBe(false);
    expect(runs.state("b", "mage", []).pending).toBe(0);
  });
  it("invalidates a stale Calling or ability offer without spending its reward", () => {
    const runs = new FloorRunUpgrades(); runs.start("hero"); runs.earn("hero", "north");
    const mage = runs.state("hero", "mage", ["mage_arcane_surge"]);
    expect(runs.choose("hero", mage.offerId!, mage.choices[0]!, "tank", [])).toBe(false);
    expect(runs.state("hero", "tank", []).pending).toBe(1);
  });
  it("clears choices on attempt end and does not accept requests from the old attempt", () => {
    const runs = new FloorRunUpgrades(); runs.start("hero"); runs.earn("hero", "north");
    const old = runs.state("hero", "thief", []); runs.clear("hero");
    expect(runs.state("hero", "thief", []).active).toBe(false);
    expect(runs.earn("hero", "south")).toBe(false);
    runs.start("hero"); runs.earn("hero", "north");
    expect(runs.choose("hero", old.offerId!, old.choices[0]!, "thief", [])).toBe(false);
    expect(runs.state("hero", "thief", []).pending).toBe(1);
  });
});
