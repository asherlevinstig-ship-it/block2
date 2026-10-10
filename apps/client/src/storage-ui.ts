import { ITEM_DEFINITIONS, type ItemId } from "@blockcraft/protocol";
export type StorageUpdate = { carried: Partial<Record<ItemId, number>>; stored: Partial<Record<ItemId, number>>; message: string };
export function createStorageUI(root: HTMLElement, send: (type: string, payload?: unknown) => void) {
  const message = document.createElement("p"); message.className = "storage-message"; message.setAttribute("role", "status");
  const columns = document.createElement("div"); columns.className = "storage-columns"; root.append(message, columns);
  let pending = false;
  let awaitingSync = false;
  let update: StorageUpdate = { carried: {}, stored: {}, message: "Loading your chest…" };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function render() {
    message.textContent = pending ? "Transferring…" : update.message; columns.replaceChildren();
    for (const side of ["carried", "stored"] as const) {
      const section = document.createElement("section");
      const title = document.createElement("h3"); title.textContent = side === "carried" ? "Carried · deposit" : "Stored · withdraw"; section.append(title);
      let count = 0;
      for (const id of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
        const quantity = update[side][id] ?? 0; if (quantity <= 0) continue; count++;
        const row = document.createElement("article");
        const name = document.createElement("strong"); name.textContent = `${ITEM_DEFINITIONS[id].name} ×${quantity}`; row.append(name);
        const actions = document.createElement("div"); actions.className = "storage-item-actions";
        for (const amount of [1, "all"] as const) {
          const button = document.createElement("button"); button.type = "button";
          button.textContent = `${side === "carried" ? "Deposit" : "Withdraw"} ${amount}`;
          button.disabled = pending || awaitingSync || id === "reinforced_pickaxe";
          button.addEventListener("click", () => {
            if (pending || awaitingSync) return; pending = true; render();
            send("storage:transfer", { itemId: id, direction: side === "carried" ? "deposit" : "withdraw", quantity: amount });
            timeout = setTimeout(() => { pending = false; awaitingSync = true; update.message = "Checking your items… Reopen the chest if the connection is lost."; render(); send("storage:sync"); }, 6000);
          }); actions.append(button);
        }
        row.append(actions); section.append(row);
      }
      if (!count) { const empty = document.createElement("p"); empty.className = "inventory-empty"; empty.textContent = side === "carried" ? "Your pack is empty." : "Your chest is empty."; section.append(empty); }
      columns.append(section);
    }
  }
  return {
    open() { if (timeout) clearTimeout(timeout); pending = false; update = { carried: {}, stored: {}, message: "Loading your chest…" }; render(); send("storage:sync"); },
    receive(next: StorageUpdate) { if (timeout) clearTimeout(timeout); pending = false; awaitingSync = false; update = next; render(); },
  };
}
