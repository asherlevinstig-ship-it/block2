import { BUILD_PATHS, FLOOR_RUN_UPGRADES, experienceToNextLevel, type FloorAttemptSummary } from "@blockcraft/protocol";

export function floorAttemptSummaryCopy(summary: FloorAttemptSummary) {
  const upgrades = summary.picked.map(id => FLOOR_RUN_UPGRADES.find(upgrade => upgrade.id === id)?.name).filter(Boolean) as string[];
  const boss = !summary.boss ? "Crownkeeper · not reached"
    : summary.boss.health <= 0 ? "Crownkeeper · defeated"
      : `Crownkeeper · ${summary.boss.health}/${summary.boss.maxHealth} HP ${summary.boss.lastSeen ? "last seen" : "remaining"}`;
  const nextLevel = experienceToNextLevel(summary.kept.level);
  return {
    progress: `Warden victories · ${summary.wardensDefeated}/2`,
    boss,
    build: `${summary.calling ? BUILD_PATHS[summary.calling].name : "Calling"} build`,
    upgrades: upgrades.length ? upgrades.join(" + ") : "No Warden upgrades chosen",
    unused: summary.unusedChoices > 0 ? `${summary.unusedChoices} unused choice${summary.unusedChoices === 1 ? "" : "s"}` : "",
    kept: `Level ${summary.kept.level} · ${nextLevel > 0 ? summary.kept.experience + "/" + nextLevel + " XP" : "MAX LEVEL"} · ${summary.kept.gold} gold · ${summary.kept.crownFragments} Crown Fragment${summary.kept.crownFragments === 1 ? "" : "s"}`,
    log: `Floor 1 attempt ended · ${summary.wardensDefeated}/2 Warden victories · ${boss}. XP, gear, gold and Crown Fragments kept.`,
  };
}

export function renderFloorAttemptSummary(element: HTMLElement, summary: FloorAttemptSummary | null): void {
  element.replaceChildren(); element.hidden = !summary;
  if (!summary) return;
  const copy = floorAttemptSummaryCopy(summary);
  const add = (label: string, value: string) => {
    const row = document.createElement("div"), heading = document.createElement("strong"), detail = document.createElement("p");
    heading.textContent = label; detail.textContent = value; row.append(heading, detail); element.append(row);
  };
  add("THIS ATTEMPT", copy.progress + " · " + copy.boss);
  add(copy.build.toUpperCase(), copy.upgrades + (copy.unused ? " · " + copy.unused : "") + ". Temporary upgrades reset.");
  add("YOU KEPT", copy.kept + ". All gear kept. Any carried minerals go to a recovery bag.");
  add("TRY NEXT TIME", summary.tip);
}
