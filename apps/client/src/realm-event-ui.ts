import type { RealmEventUpdate } from "@blockcraft/protocol";

export function realmEventLabel(update: RealmEventUpdate, now = Date.now()): { eyebrow: string; title: string; detail: string } {
  if (update.realmBoss && update.phase === "warning") return {
    eyebrow: "REALM BOSS AWAKENING",
    title: update.eventName ?? "Realm Boss",
    detail: `Arrives in ${Math.max(0, Math.ceil((update.warningUntil - now) / 1000))}s · rally at the marker`,
  };
  if (update.realmBoss && update.phase === "active") return { eyebrow: "REALM BOSS ACTIVE", title: update.eventName ?? "Realm Boss", detail: "Contribute damage for personal rewards" };
  if (update.phase === "warning") return {
    eyebrow: "PUBLIC EVENT INCOMING",
    title: update.eventName ?? "Regional threat",
    detail: `Arrives in ${Math.max(0, Math.ceil((update.warningUntil - now) / 1000))}s · follow the marker`,
  };
  if (update.phase === "active") return { eyebrow: "PUBLIC EVENT ACTIVE", title: update.eventName ?? "Regional threat", detail: "Contribute damage for personal rewards" };
  const eliteKills = update.eliteKills ?? 0;
  const eliteDetail = eliteKills > 0 ? ` · elite hunt ${eliteKills}/${update.eliteRequired ?? 2}` : "";
  if (update.phase === "cooldown") return { eyebrow: "REALM STABILISING", title: `${update.completed} / ${update.required} threats defeated`, detail: `Another regional event can awaken shortly${eliteDetail}` };
  return { eyebrow: "REALM THREAT", title: `${update.completed} / ${update.required} threats defeated`, detail: `Clear marked encounters or hunt elites${eliteDetail}` };
}

export function createRealmEventUI() {
  const root = document.createElement("section");
  root.id = "realm-event-meter";
  root.setAttribute("aria-label", "Realm event progress");
  root.innerHTML = '<div><span class="realm-event-eyebrow">REALM THREAT</span><strong class="realm-event-title">0 / 3 threats defeated</strong><small class="realm-event-detail">Clear regional encounters to awaken public bosses</small><small class="realm-event-loot" hidden></small></div><i class="realm-event-pips" aria-hidden="true"></i>';
  document.body.append(root);
  const eyebrow = root.querySelector<HTMLElement>(".realm-event-eyebrow")!;
  const title = root.querySelector<HTMLElement>(".realm-event-title")!;
  const detail = root.querySelector<HTMLElement>(".realm-event-detail")!;
  const loot = root.querySelector<HTMLElement>(".realm-event-loot")!;
  const pips = root.querySelector<HTMLElement>(".realm-event-pips")!;
  let current: RealmEventUpdate | null = null;
  let timer = 0;
  const render = () => {
    if (!current) return;
    const label = realmEventLabel(current);
    eyebrow.textContent = label.eyebrow;
    title.textContent = label.title;
    detail.textContent = label.detail;
    loot.textContent = current.lootHint ?? "";
    loot.hidden = !current.lootHint;
    root.dataset.phase = current.phase;
    root.dataset.boss = String(current.realmBoss);
    pips.replaceChildren(...Array.from({ length: current.required }, (_, index) => {
      const pip = document.createElement("b");
      pip.dataset.filled = String(index < current!.completed || current!.realmBoss);
      return pip;
    }));
  };
  return {
    update(value: RealmEventUpdate) {
      current = value;
      window.clearInterval(timer);
      render();
      if (value.phase === "warning") timer = window.setInterval(render, 250);
    },
    reset() {
      window.clearInterval(timer);
      current = null;
      root.dataset.phase = "idle";
      eyebrow.textContent = "REALM THREAT";
      title.textContent = "Waiting for realm status…";
      detail.textContent = "";
      loot.textContent = "";
      loot.hidden = true;
      pips.replaceChildren();
    },
  };
}
