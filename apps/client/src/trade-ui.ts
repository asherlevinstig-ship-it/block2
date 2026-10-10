import { ITEM_DEFINITIONS, type TradeRequest, type TradeUpdate, type ItemId } from "@blockcraft/protocol";
export function createTradeUI(send: (request: TradeRequest) => boolean, stop: () => void) {
  const root = document.createElement("section"); root.id = "trade-modal"; root.hidden = true; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Player trade");
  root.innerHTML = '<div class="trade-card"><h2>Player trade</h2><p class="trade-partner"></p><p class="trade-invite"></p><div class="trade-review"><section><h3>Your offer</h3><p class="trade-mine"></p></section><section><h3>Their offer</h3><p class="trade-theirs"></p></section></div><form class="trade-editor"><label>Gold <input class="trade-gold" type="number" min="0" max="1000000" step="1" value="0"></label><div class="trade-items"></div><button type="submit">Update offer</button></form><p class="trade-confirmation"></p><p class="trade-status" role="status"></p><div class="trade-actions"><button type="button" class="trade-accept">Accept invitation</button><button type="button" class="trade-confirm">Confirm this offer</button><button type="button" class="trade-cancel">Cancel</button></div><small>Stay within 4m · changing an offer resets both confirmations<br>No item reservations · balances checked again before exchange</small></div>';
  document.body.append(root);
  const title = root.querySelector(".trade-partner")!, prompt = root.querySelector(".trade-invite")!, mine = root.querySelector(".trade-mine")!, theirs = root.querySelector(".trade-theirs")!;
  const form = root.querySelector("form")!, gold = root.querySelector<HTMLInputElement>(".trade-gold")!, items = root.querySelector(".trade-items")!;
  const accepted = root.querySelector<HTMLButtonElement>(".trade-accept")!, confirm = root.querySelector<HTMLButtonElement>(".trade-confirm")!, cancel = root.querySelector<HTMLButtonElement>(".trade-cancel")!;
  const status = root.querySelector(".trade-status")!, confirmation = root.querySelector(".trade-confirmation")!;
  let current: TradeUpdate = null, dirty = false, lastOffer = "";
  const request = (value: TradeRequest) => { status.textContent = send(value) ? "Waiting for the server…" : "Connect to the world first."; };
  const cancelTrade = () => { if (current) request({ action: "cancel", tradeId: current.id }); };
  accepted.addEventListener("click", () => { if (current) request({ action: "accept", tradeId: current.id }); });
  cancel.addEventListener("click", cancelTrade);
  confirm.addEventListener("click", () => { if (current && !dirty) request({ action: "confirm", tradeId: current.id, revision: current.revision }); });
  form.addEventListener("input", () => { dirty = true; confirm.disabled = true; status.textContent = "Apply your edited offer before confirming."; });
  form.addEventListener("submit", event => {
    event.preventDefault(); if (!current) return;
    const offered = [...items.querySelectorAll<HTMLInputElement>("input")].filter(input => Number(input.value) > 0).map(input => ({ itemId: input.dataset.item as ItemId, quantity: Number(input.value) }));
    if (offered.length > 8) { status.textContent = "Offer at most eight item types."; return; }
    dirty = false; lastOffer = ""; request({ action: "offer", tradeId: current.id, revision: current.revision, gold: Number(gold.value), items: offered });
  });
  root.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.code === "Escape") { event.preventDefault(); cancelTrade(); }
    if (event.code === "Tab") {
      const controls = [...root.querySelectorAll<HTMLElement>("input, button")].filter(control => !control.closest("[hidden]") && !(control as HTMLButtonElement).disabled);
      const index = controls.indexOf(document.activeElement as HTMLElement); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus(); event.preventDefault();
    }
  });
  root.addEventListener("keyup", event => event.stopPropagation());
  const describe = (offer: { gold: number; items: { itemId: ItemId; quantity: number }[] }) => [`${offer.gold} gold`, ...offer.items.map(item => `${item.quantity} × ${ITEM_DEFINITIONS[item.itemId].name}`)].join("\n");
  return {
    isOpen() { return !root.hidden; },
    invite(targetId: string) { request({ action: "invite", targetId }); },
    cancel: cancelTrade,
    notice(text: string) { status.textContent = text; },
    update(value: TradeUpdate) {
      const changedTrade = value?.id !== current?.id;
      current = value; root.hidden = !value;
      if (!value) { dirty = false; lastOffer = ""; if (root.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur(); return; }
      if (changedTrade) { dirty = false; lastOffer = ""; stop(); cancel.focus(); }
      title.textContent = `Trading with ${value.partner}`;
      prompt.textContent = value.phase === "invite" ? value.incoming ? "A nearby player wants to trade. Accept or cancel." : "Waiting for your partner to accept…" : "Review both offers carefully. Both must confirm the same revision.";
      form.hidden = value.phase !== "offer"; root.querySelector<HTMLElement>(".trade-review")!.hidden = value.phase !== "offer";
      accepted.hidden = value.phase !== "invite" || !value.incoming; confirm.hidden = value.phase !== "offer";
      confirm.disabled = dirty || value.mineConfirmed;
      mine.textContent = describe(value.mine); theirs.textContent = describe(value.theirs);
      confirmation.textContent = value.phase === "offer" ? `You: ${value.mineConfirmed ? "confirmed" : "reviewing"} · Partner: ${value.theirsConfirmed ? "confirmed" : "reviewing"}` : "";
      const offerKey = JSON.stringify(value.mine);
      if (!dirty && offerKey !== lastOffer) {
        lastOffer = offerKey; gold.value = String(value.mine.gold); gold.max = String(value.gold);
        items.replaceChildren(...value.inventory.map(item => {
          const label = document.createElement("label"), input = document.createElement("input");
          label.textContent = `${ITEM_DEFINITIONS[item.itemId].name} (${item.quantity})`;
          input.type = "number"; input.min = "0"; input.max = String(item.quantity); input.step = "1"; input.dataset.item = item.itemId;
          input.value = String(value.mine.items.find(offer => offer.itemId === item.itemId)?.quantity ?? 0); label.append(input); return label;
        }));
      }
    },
  };
}
