import type { PartyRequest, PartyUpdate } from "@blockcraft/protocol";
export function createPartyUI(send: (request: PartyRequest) => boolean, stopMovement: () => void) {
  const root = document.createElement("section"); root.id = "party-panel"; root.setAttribute("aria-label", "Party controls");
  root.innerHTML = '<details><summary>PARTY <span class="party-count">Solo</span></summary><p class="party-help">Up to 4 players · loot unchanged · groups last for this session</p><ul class="party-members" aria-label="Party members"></ul><div class="party-invitation" hidden><p></p><button type="button" class="party-accept">Accept</button><button type="button" class="party-decline">Decline</button></div><div class="party-picker"><select aria-label="Nearby player to invite"><option value="">No nearby players</option></select><button type="button" class="party-invite">Invite</button></div><button type="button" class="party-leave" hidden>Leave party</button><p class="party-status" role="status">Invite a nearby player on your level.</p></details>';
  document.body.append(root);
  const details = root.querySelector("details")!, count = root.querySelector(".party-count")!, members = root.querySelector("ul")!;
  const select = root.querySelector("select")!, inviteButton = root.querySelector<HTMLButtonElement>(".party-invite")!;
  const invitation = root.querySelector<HTMLElement>(".party-invitation")!, invitationText = invitation.querySelector("p")!;
  const accept = root.querySelector<HTMLButtonElement>(".party-accept")!, decline = root.querySelector<HTMLButtonElement>(".party-decline")!;
  const leave = root.querySelector<HTMLButtonElement>(".party-leave")!, status = root.querySelector(".party-status")!;
  let current: PartyUpdate = { partyId: null, members: [], nearby: [], invite: null }, choicesKey = "", previousParty: string | null = null, previousInvite: string | null = null;
  const request = (value: PartyRequest) => { status.textContent = send(value) ? "Waiting for the server…" : "Connect to the world first."; };
  inviteButton.addEventListener("click", () => { if (select.value) request({ action: "invite", targetId: select.value }); inviteButton.blur(); });
  accept.addEventListener("click", () => { if (current.invite) request({ action: "respond", inviteId: current.invite.id, accept: true }); accept.blur(); });
  decline.addEventListener("click", () => { if (current.invite) request({ action: "respond", inviteId: current.invite.id, accept: false }); decline.blur(); });
  leave.addEventListener("click", () => { request({ action: "leave" }); leave.blur(); });
  root.addEventListener("focusin", stopMovement);
  root.addEventListener("keydown", event => { event.stopPropagation(); if (event.code === "Escape") { (document.activeElement as HTMLElement)?.blur(); details.open = false; event.preventDefault(); } });
  root.addEventListener("keyup", event => event.stopPropagation());
  function update(value: PartyUpdate) {
    current = value;
    if (value.partyId && value.partyId !== previousParty || value.invite && value.invite.id !== previousInvite) details.open = true;
    if (previousInvite && !value.invite) status.textContent = value.partyId ? "Party ready. Loot rules are unchanged." : "Invitation closed or expired.";
    previousParty = value.partyId; previousInvite = value.invite?.id ?? null;
    count.textContent = value.partyId ? `${value.members.length} / 4` : "Solo";
    members.replaceChildren(...value.members.map(member => {
      const row = document.createElement("li"), name = document.createElement("strong"), info = document.createElement("small"), meter = document.createElement("meter");
      name.textContent = `${member.leader ? "★ " : ""}${member.name}`;
      info.textContent = `${member.health <= 0 ? "Defeated" : `${member.health}/${member.maxHealth} HP`} · ${member.distance === 0 ? "Here" : `${member.distance}m`}`;
      meter.min = 0; meter.max = Math.max(1, member.maxHealth); meter.value = member.health; meter.setAttribute("aria-label", `${member.name} health`);
      row.append(name, info, meter); return row;
    }));
    invitation.hidden = !value.invite;
    invitationText.textContent = value.invite ? `${value.invite.name} invites you to a party. Accept within 30 seconds.` : "";
    const nextKey = JSON.stringify(value.nearby);
    if (nextKey !== choicesKey && document.activeElement !== select) {
      choicesKey = nextKey; const selected = select.value;
      select.replaceChildren(new Option(value.nearby.length ? "Choose nearby player…" : "No nearby players", ""), ...value.nearby.map(player => new Option(`${player.name} · ${player.id.slice(-4)}`, player.id)));
      if (value.nearby.some(player => player.id === selected)) select.value = selected;
    }
    select.disabled = value.members.length >= 4; inviteButton.disabled = !select.value || select.disabled;
    leave.hidden = !value.partyId;
  }
  select.addEventListener("change", () => { inviteButton.disabled = !select.value || select.disabled; });
  return { update, notice(text: string) { status.textContent = text; }, reset() { update({ partyId: null, members: [], nearby: [], invite: null }); status.textContent = "Disconnected. Parties are session-only."; } };
}
