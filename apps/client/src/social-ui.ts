import { QUICK_CHAT_PHRASES, type NearbyChatMessage, type QuickChatId } from "@blockcraft/protocol";
export function createSocialUI(send: (type: string, payload: unknown) => boolean, stopMovement: () => void) {
  const root = document.createElement("section"); root.id = "event-log"; root.setAttribute("aria-label", "World event log and quick chat");
  root.innerHTML = '<header><strong>EVENT LOG</strong><small>NEARBY · 24m</small></header><ol role="log" aria-live="polite" aria-label="Recent world events and nearby calls"></ol><nav aria-label="Quick chat calls"></nav>';
  document.body.append(root);
  const list = root.querySelector("ol")!, actions = root.querySelector("nav")!;
  for (const [id, phrase] of Object.entries(QUICK_CHAT_PHRASES) as [QuickChatId, string][]) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = phrase;
    button.setAttribute("aria-label", `Say nearby: ${phrase}`);
    button.addEventListener("click", () => {
      if (!send("chat:send", { phraseId: id })) add("System", "Connect to the world before using a callout.", "notice");
      button.blur();
    });
    actions.append(button);
  }
  const add = (name: string, text: string, kind: "chat" | "event" | "notice") => {
    const row = document.createElement("li"), label = document.createElement("strong"), time = document.createElement("time");
    row.dataset.kind = kind;
    time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    label.textContent = name;
    row.append(time, label, document.createTextNode(` ${text}`)); list.append(row);
    while (list.children.length > 40) list.firstElementChild?.remove(); list.scrollTop = list.scrollHeight;
  };
  root.addEventListener("focusin", stopMovement);
  root.addEventListener("keydown", event => { event.stopPropagation(); if (event.code === "Escape") { (document.activeElement as HTMLElement)?.blur(); event.preventDefault(); } });
  root.addEventListener("keyup", event => event.stopPropagation());
  add("World", "Your journey begins. Nearby calls and milestones appear here.", "event");
  const tags = new Map<string, HTMLElement>(); let lastUpdate = -Infinity;
  return {
    clearNames() { for (const tag of tags.values()) tag.remove(); tags.clear(); },
    open() { actions.querySelector<HTMLButtonElement>("button")?.focus(); },
    notice(text: string) { add("System", text, "notice"); },
    event(text: string) { add("World", text, "event"); },
    message(message: NearbyChatMessage) { add(message.name + ":", message.text, "chat"); },
    update(now: number, players: { id: string; name: string; x: number; y: number; visible: boolean; local: boolean;
      healHealth?: number; healMaxHealth?: number; healTarget?: boolean }[]) {
      if (now - lastUpdate < 100) return; lastUpdate = now;
      const ids = new Set(players.map(player => player.id));
      for (const [id, tag] of tags) if (!ids.has(id)) { tag.remove(); tags.delete(id); }
      for (const player of players) {
        let tag = tags.get(player.id);
        if (!tag) { tag = document.createElement("div"); tag.className = "player-nameplate"; document.body.append(tag); tags.set(player.id, tag); }
        tag.replaceChildren(document.createTextNode(player.name));
        if (player.healHealth !== undefined && player.healMaxHealth !== undefined) {
          const meter = document.createElement("span"); meter.className = "player-heal-meter";
          const fill = document.createElement("i");
          fill.style.width = `${Math.max(0, Math.min(100, player.healHealth / Math.max(1, player.healMaxHealth) * 100))}%`;
          meter.append(fill); tag.append(meter);
        }
        if (player.healTarget) {
          const cue = document.createElement("span"); cue.className = "player-heal-cue"; cue.textContent = "G · HEAL"; tag.append(cue);
        }
        tag.hidden = !player.visible; tag.dataset.local = String(player.local);
        tag.dataset.healTarget = String(Boolean(player.healTarget));
        tag.style.left = `${player.x}px`; tag.style.top = `${player.y}px`;
      }
    },
  };
}
