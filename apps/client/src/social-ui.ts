import { PlayerNameSchema, type NearbyChatMessage } from "@blockcraft/protocol";
export function createSocialUI(send: (type: string, payload: unknown) => boolean, stopMovement: () => void) {
  const root = document.createElement("section"); root.id = "nearby-chat"; root.setAttribute("aria-label", "Nearby chat");
  root.innerHTML = '<details><summary>NEARBY CHAT <kbd>Enter</kbd></summary><p>Players within 24m on your level · no global chat</p><ol aria-live="polite" aria-label="Recent nearby messages"></ol><form><input aria-label="Chat message" maxlength="160" placeholder="Say something nearby…" autocomplete="off"><button>Send</button></form><form class="player-name-form"><input aria-label="Your player name" maxlength="20" minlength="2" placeholder="Your name" pattern="[A-Za-z0-9 _\\-]+" autocomplete="off"><button>Set name</button></form><small>Names: 2–20 letters, numbers, spaces, _ or -</small></details>';
  document.body.append(root);
  const details = root.querySelector("details")!, list = root.querySelector("ol")!;
  const forms = root.querySelectorAll("form"), input = forms[0]!.querySelector("input")!, nameInput = forms[1]!.querySelector("input")!;
  const add = (name: string, text: string) => {
    const row = document.createElement("li"), label = document.createElement("strong"); label.textContent = name;
    row.append(label, document.createTextNode(` ${text}`)); list.append(row);
    while (list.children.length > 40) list.firstElementChild?.remove(); list.scrollTop = list.scrollHeight;
  };
  root.addEventListener("focusin", stopMovement);
  root.addEventListener("keydown", event => { event.stopPropagation(); if (event.code === "Escape") { input.blur(); nameInput.blur(); details.open = false; event.preventDefault(); } });
  root.addEventListener("keyup", event => event.stopPropagation());
  forms[0]!.addEventListener("submit", event => {
    event.preventDefault(); const text = input.value.trim(); if (!text) return;
    if (send("chat:send", { text })) { input.value = ""; input.blur(); } else add("Notice", "Connect to the world before chatting.");
  });
  forms[1]!.addEventListener("submit", event => {
    event.preventDefault(); const result = PlayerNameSchema.safeParse(nameInput.value);
    if (!result.success) { add("Notice", "Use 2–20 letters, numbers, spaces, _ or -."); return; }
    if (!send("player:name", result.data)) add("Notice", "Connect to the world before changing your name.");
    nameInput.blur();
  });
  const tags = new Map<string, HTMLElement>(); let lastUpdate = -Infinity;
  return {
    clearNames() { for (const tag of tags.values()) tag.remove(); tags.clear(); },
    open() { details.open = true; input.focus(); },
    notice(text: string) { add("Notice", text); },
    message(message: NearbyChatMessage) { add(message.name + ":", message.text); },
    update(now: number, players: { id: string; name: string; x: number; y: number; visible: boolean; local: boolean }[]) {
      if (now - lastUpdate < 100) return; lastUpdate = now;
      const ids = new Set(players.map(player => player.id));
      for (const [id, tag] of tags) if (!ids.has(id)) { tag.remove(); tags.delete(id); }
      for (const player of players) {
        let tag = tags.get(player.id);
        if (!tag) { tag = document.createElement("div"); tag.className = "player-nameplate"; document.body.append(tag); tags.set(player.id, tag); }
        tag.textContent = player.name; tag.hidden = !player.visible; tag.dataset.local = String(player.local);
        tag.style.left = `${player.x}px`; tag.style.top = `${player.y}px`;
        if (player.local && !root.contains(document.activeElement)) nameInput.value = player.name;
      }
    },
  };
}
