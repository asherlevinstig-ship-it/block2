import {
  ITEM_DEFINITIONS,
  ITEM_RARITIES,
  itemRarity,
  type ItemId,
  type TradeOffer,
  type TradeRequest,
  type TradeUpdate,
} from "@blockcraft/protocol";

const itemGlyph = (itemId: ItemId): string => {
  if (itemId.includes("sword") || itemId.includes("dagger") || itemId.includes("edge")) return "⚔";
  if (itemId.includes("bow")) return "➶";
  if (itemId.includes("focus") || itemId.includes("prism")) return "✦";
  if (itemId.includes("armour") || itemId.includes("plate")) return "◈";
  if (itemId.includes("hammer")) return "◆";
  if (itemId.includes("potion")) return "+";
  if (itemId.includes("ore") || itemId === "moonstone" || itemId === "ember_core") return "⬡";
  if (itemId === "timber") return "▥";
  return "◇";
};

const offerCount = (offer: TradeOffer): number => offer.items.reduce((total, item) => total + item.quantity, 0);

export function createTradeUI(send: (request: TradeRequest) => boolean, stop: () => void) {
  const root = document.createElement("section");
  root.id = "trade-modal";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Player trade");
  root.innerHTML = [
    '<div class="trade-card">',
    '<header class="trade-header"><i aria-hidden="true">⇄</i><div><span>SECURE PLAYER EXCHANGE</span><h2>Trade</h2><p class="trade-partner"></p></div><button type="button" class="trade-cancel trade-close" aria-label="Cancel trade">×</button></header>',
    '<p class="trade-invite"></p>',
    '<p class="trade-change-alert" hidden><b>OFFERS CHANGED</b><span>Both confirmations were cleared. Review before locking in again.</span></p>',
    '<div class="trade-workspace" hidden>',
    '<form class="trade-editor"><header><div><span>YOUR PACK</span><strong>Choose what to offer</strong></div><em class="trade-wallet-total"></em></header>',
    '<label class="trade-gold-row"><i>●</i><span><strong>Gold</strong><small>Coins from your purse</small></span><input class="trade-gold" aria-label="Gold offered" type="number" min="0" max="1000000" step="1" value="0"></label>',
    '<div class="trade-items"></div><button type="submit" class="trade-apply">APPLY OFFER</button></form>',
    '<div class="trade-review">',
    '<section class="trade-offer-panel trade-offer-mine"><header><div><span>YOUR OFFER</span><strong class="trade-mine-count">Nothing offered</strong></div><b class="trade-ready trade-ready-mine">REVIEWING</b></header><div class="trade-mine"></div></section>',
    '<div class="trade-exchange-arrow" aria-hidden="true">⇄</div>',
    '<section class="trade-offer-panel trade-offer-theirs"><header><div><span>THEIR OFFER</span><strong class="trade-theirs-count">Nothing offered</strong></div><b class="trade-ready trade-ready-theirs">REVIEWING</b></header><div class="trade-theirs"></div></section>',
    '</div></div>',
    '<p class="trade-confirmation"></p><p class="trade-status" role="status" aria-live="polite"></p>',
    '<div class="trade-actions"><button type="button" class="trade-accept">ACCEPT TRADE</button><button type="button" class="trade-confirm">LOCK IN OFFER</button><button type="button" class="trade-cancel trade-leave">CANCEL</button></div>',
    '<footer><b>SERVER VERIFIED</b><span>Stay within 4m · balances are checked again before the exchange · changing either offer clears both confirmations</span></footer>',
    '</div>',
  ].join("");
  document.body.append(root);

  const completion = document.createElement("aside");
  completion.className = "trade-complete-toast";
  completion.hidden = true;
  completion.setAttribute("role", "status");
  completion.innerHTML = '<div class="trade-complete-coins" aria-hidden="true"><i>●</i><i>●</i><i>●</i></div><span>EXCHANGE COMPLETE</span><strong class="trade-complete-title"></strong><small class="trade-complete-detail"></small>';
  document.body.append(completion);

  const title = root.querySelector<HTMLElement>(".trade-partner")!;
  const prompt = root.querySelector<HTMLElement>(".trade-invite")!;
  const workspace = root.querySelector<HTMLElement>(".trade-workspace")!;
  const review = root.querySelector<HTMLElement>(".trade-review")!;
  const mine = root.querySelector<HTMLElement>(".trade-mine")!;
  const theirs = root.querySelector<HTMLElement>(".trade-theirs")!;
  const minePanel = root.querySelector<HTMLElement>(".trade-offer-mine")!;
  const theirsPanel = root.querySelector<HTMLElement>(".trade-offer-theirs")!;
  const mineCount = root.querySelector<HTMLElement>(".trade-mine-count")!;
  const theirsCount = root.querySelector<HTMLElement>(".trade-theirs-count")!;
  const mineReady = root.querySelector<HTMLElement>(".trade-ready-mine")!;
  const theirsReady = root.querySelector<HTMLElement>(".trade-ready-theirs")!;
  const changed = root.querySelector<HTMLElement>(".trade-change-alert")!;
  const form = root.querySelector<HTMLFormElement>("form")!;
  const gold = root.querySelector<HTMLInputElement>(".trade-gold")!;
  const items = root.querySelector<HTMLElement>(".trade-items")!;
  const wallet = root.querySelector<HTMLElement>(".trade-wallet-total")!;
  const apply = root.querySelector<HTMLButtonElement>(".trade-apply")!;
  const accepted = root.querySelector<HTMLButtonElement>(".trade-accept")!;
  const confirm = root.querySelector<HTMLButtonElement>(".trade-confirm")!;
  const cancels = [...root.querySelectorAll<HTMLButtonElement>(".trade-cancel")];
  const status = root.querySelector<HTMLElement>(".trade-status")!;
  const confirmation = root.querySelector<HTMLElement>(".trade-confirmation")!;

  let current: TradeUpdate = null;
  let dirty = false;
  let lastEditorKey = "";
  let confirmTimer: number | null = null;
  let completionTimer: number | null = null;
  let completedTradeId = "";

  const clearConfirmCountdown = (restore = true) => {
    if (confirmTimer !== null) window.clearInterval(confirmTimer);
    confirmTimer = null;
    root.dataset.countdown = "false";
    if (restore) confirm.textContent = "LOCK IN OFFER";
  };
  const request = (value: TradeRequest) => {
    status.textContent = send(value) ? "Waiting for the server…" : "Connect to the world first.";
  };
  const cancelTrade = () => {
    clearConfirmCountdown();
    if (current) request({ action: "cancel", tradeId: current.id });
  };
  const offerCards = (container: HTMLElement, offer: TradeOffer) => {
    const cards: HTMLElement[] = [];
    if (offer.gold > 0) {
      const card = document.createElement("article");
      card.className = "trade-offer-item trade-offer-gold";
      const icon = document.createElement("i"); icon.textContent = "●";
      const text = document.createElement("span"); text.innerHTML = "<strong>" + offer.gold + " Gold</strong><small>Currency</small>";
      card.append(icon, text); cards.push(card);
    }
    for (const item of offer.items) {
      const rarity = itemRarity(item.itemId);
      const card = document.createElement("article");
      card.className = "trade-offer-item";
      card.dataset.rarity = rarity;
      const icon = document.createElement("i"); icon.textContent = itemGlyph(item.itemId);
      const text = document.createElement("span");
      const name = document.createElement("strong"); name.textContent = ITEM_DEFINITIONS[item.itemId].name;
      const detail = document.createElement("small"); detail.textContent = ITEM_RARITIES[rarity].label;
      const quantity = document.createElement("em"); quantity.textContent = "×" + item.quantity;
      text.append(name, detail); card.append(icon, text, quantity); cards.push(card);
    }
    if (cards.length === 0) {
      const empty = document.createElement("p");
      empty.className = "trade-empty";
      empty.textContent = "No items or gold offered yet";
      cards.push(empty);
    }
    container.replaceChildren(...cards);
  };
  const setReady = (panel: HTMLElement, badge: HTMLElement, ready: boolean) => {
    panel.dataset.ready = String(ready);
    badge.textContent = ready ? "LOCKED" : "REVIEWING";
  };
  const showCompletion = (trade: Exclude<TradeUpdate, null>) => {
    if (completionTimer !== null) window.clearTimeout(completionTimer);
    completion.querySelector<HTMLElement>(".trade-complete-title")!.textContent = "Trade with " + trade.partner + " complete";
    const received = [trade.theirs.gold ? trade.theirs.gold + " gold" : "", ...trade.theirs.items.map(item => item.quantity + "× " + ITEM_DEFINITIONS[item.itemId].name)].filter(Boolean);
    completion.querySelector<HTMLElement>(".trade-complete-detail")!.textContent = received.length ? "Received " + received.join(" · ") : "Exchange completed safely";
    completion.hidden = false;
    completion.classList.remove("show");
    requestAnimationFrame(() => completion.classList.add("show"));
    completionTimer = window.setTimeout(() => { completion.classList.remove("show"); completion.hidden = true; }, 4200);
  };
  const beginConfirmCountdown = () => {
    if (!current || current.phase !== "offer" || dirty || current.mineConfirmed || confirmTimer !== null) return;
    const tradeId = current.id;
    const revision = current.revision;
    const endsAt = performance.now() + 2400;
    root.dataset.countdown = "true";
    confirm.disabled = true;
    status.textContent = "Final review · cancel now if anything looks wrong.";
    const tick = () => {
      const remaining = Math.max(0, endsAt - performance.now());
      confirm.textContent = remaining > 0 ? "LOCKING IN · " + Math.max(1, Math.ceil(remaining / 800)) : "SENDING…";
      if (remaining > 0) return;
      clearConfirmCountdown(false);
      if (current?.id === tradeId && current.revision === revision && !dirty) request({ action: "confirm", tradeId, revision });
    };
    tick();
    confirmTimer = window.setInterval(tick, 80);
  };

  accepted.addEventListener("click", () => { if (current) request({ action: "accept", tradeId: current.id }); });
  for (const cancel of cancels) cancel.addEventListener("click", cancelTrade);
  confirm.addEventListener("click", beginConfirmCountdown);
  form.addEventListener("input", () => {
    clearConfirmCountdown();
    dirty = true;
    apply.dataset.dirty = "true";
    confirm.disabled = true;
    status.textContent = "Offer edited · apply it before locking in.";
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!current) return;
    const offered = [...items.querySelectorAll<HTMLInputElement>("input")]
      .filter(input => Number(input.value) > 0)
      .map(input => ({ itemId: input.dataset.item as ItemId, quantity: Number(input.value) }));
    if (offered.length > 8) { status.textContent = "Offer at most eight item types."; return; }
    dirty = false;
    apply.dataset.dirty = "false";
    lastEditorKey = "";
    request({ action: "offer", tradeId: current.id, revision: current.revision, gold: Math.max(0, Math.floor(Number(gold.value))), items: offered });
  });
  root.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.code === "Escape") { event.preventDefault(); cancelTrade(); }
    if (event.code === "Tab") {
      const controls = [...root.querySelectorAll<HTMLElement>("input, button")].filter(control => !control.closest("[hidden]") && !(control as HTMLButtonElement).disabled);
      const index = controls.indexOf(document.activeElement as HTMLElement);
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
      event.preventDefault();
    }
  });
  root.addEventListener("keyup", event => event.stopPropagation());

  return {
    isOpen() { return !root.hidden; },
    invite(targetId: string) { request({ action: "invite", targetId }); },
    cancel: cancelTrade,
    notice(text: string) {
      status.textContent = text;
      if (current && current.id !== completedTradeId && text.toLowerCase().includes("trade completed")) {
        completedTradeId = current.id;
        showCompletion(current);
      }
    },
    update(value: TradeUpdate) {
      const previous = current;
      const changedTrade = value?.id !== previous?.id;
      const revisionChanged = Boolean(value && previous && value.id === previous.id && value.revision !== previous.revision);
      current = value;
      root.hidden = !value;
      if (!value) {
        clearConfirmCountdown();
        dirty = false;
        lastEditorKey = "";
        if (root.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur();
        return;
      }
      if (changedTrade) {
        clearConfirmCountdown();
        dirty = false;
        lastEditorKey = "";
        changed.hidden = true;
        stop();
        cancels.at(-1)?.focus();
      } else if (revisionChanged) {
        clearConfirmCountdown();
        dirty = false;
        lastEditorKey = "";
        changed.hidden = false;
        changed.classList.remove("pulse");
        requestAnimationFrame(() => changed.classList.add("pulse"));
      }
      title.textContent = "Trading with " + value.partner;
      prompt.textContent = value.phase === "invite"
        ? value.incoming ? value.partner + " wants to exchange items and gold with you." : "Waiting for " + value.partner + " to accept your invitation…"
        : "Build your offer, inspect both sides, then lock it in.";
      workspace.hidden = value.phase !== "offer";
      review.hidden = value.phase !== "offer";
      accepted.hidden = value.phase !== "invite" || !value.incoming;
      confirm.hidden = value.phase !== "offer";
      confirm.disabled = dirty || value.mineConfirmed || confirmTimer !== null;
      if (confirmTimer === null) confirm.textContent = value.mineConfirmed ? "OFFER LOCKED" : "LOCK IN OFFER";
      offerCards(mine, value.mine);
      offerCards(theirs, value.theirs);
      const mineItems = offerCount(value.mine), theirItems = offerCount(value.theirs);
      mineCount.textContent = value.mine.gold || mineItems ? mineItems + " item" + (mineItems === 1 ? "" : "s") + " · " + value.mine.gold + " gold" : "Nothing offered";
      theirsCount.textContent = value.theirs.gold || theirItems ? theirItems + " item" + (theirItems === 1 ? "" : "s") + " · " + value.theirs.gold + " gold" : "Nothing offered";
      setReady(minePanel, mineReady, value.mineConfirmed);
      setReady(theirsPanel, theirsReady, value.theirsConfirmed);
      confirmation.textContent = value.phase === "offer"
        ? value.mineConfirmed && value.theirsConfirmed ? "Both offers locked · completing exchange…"
          : value.mineConfirmed ? "Your offer is locked · waiting for " + value.partner
            : value.theirsConfirmed ? value.partner + " is locked in · review and confirm your side" : "Both players must lock the same offer revision"
        : "";
      const editorKey = JSON.stringify([value.mine, value.inventory, value.gold]);
      if (!dirty && editorKey !== lastEditorKey) {
        lastEditorKey = editorKey;
        gold.value = String(value.mine.gold);
        gold.max = String(value.gold);
        wallet.textContent = value.gold + " GOLD AVAILABLE";
        apply.dataset.dirty = "false";
        const itemCards: HTMLElement[] = value.inventory.map(item => {
          const rarity = itemRarity(item.itemId);
          const card = document.createElement("article");
          card.className = "trade-pack-item";
          card.dataset.rarity = rarity;
          const glyph = document.createElement("i"); glyph.textContent = itemGlyph(item.itemId);
          const text = document.createElement("span");
          const name = document.createElement("strong"); name.textContent = ITEM_DEFINITIONS[item.itemId].name;
          const detail = document.createElement("small"); detail.textContent = ITEM_RARITIES[rarity].label + " · " + item.quantity + " owned";
          text.append(name, detail);
          const controls = document.createElement("div");
          const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", "Offer one fewer " + ITEM_DEFINITIONS[item.itemId].name);
          const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = String(item.quantity); input.step = "1"; input.dataset.item = item.itemId; input.setAttribute("aria-label", ITEM_DEFINITIONS[item.itemId].name + " offered");
          input.value = String(value.mine.items.find(offer => offer.itemId === item.itemId)?.quantity ?? 0);
          const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", "Offer one more " + ITEM_DEFINITIONS[item.itemId].name);
          const change = (amount: number) => { amount > 0 ? input.stepUp() : input.stepDown(); input.dispatchEvent(new Event("input", { bubbles: true })); };
          minus.addEventListener("click", () => change(-1)); plus.addEventListener("click", () => change(1));
          card.addEventListener("click", event => { if (!(event.target as HTMLElement).closest("button, input")) change(1); });
          controls.append(minus, input, plus); card.append(glyph, text, controls); return card;
        });
        if (itemCards.length === 0) {
          const empty = document.createElement("p"); empty.className = "trade-pack-empty"; empty.textContent = "Your pack has no tradeable items."; itemCards.push(empty);
        }
        items.replaceChildren(...itemCards);
      }
    },
  };
}
