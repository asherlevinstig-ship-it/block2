import { GuildNameSchema, PlayerNameSchema, type GuildRequest, type GuildUpdate, type PartyRequest, type PartyUpdate } from "@blockcraft/protocol";
export function createPartyUI(send: (request: PartyRequest) => boolean, stopMovement: () => void, trade: (targetId: string) => void = () => {}, localId: () => string = () => "", rename: (name: string) => boolean = () => false,
  sendGuild: (request: GuildRequest) => boolean = () => false) {
  const root = document.createElement("section"); root.id = "party-panel"; root.setAttribute("aria-label", "Party controls");
  root.innerHTML = '<details><summary>SOCIAL <span class="party-count">Solo</span></summary><section class="party-group"><h3>PARTY</h3><p class="party-help">Up to 4 players · loot unchanged · groups last for this session</p><ul class="party-members" aria-label="Party members"></ul><div class="party-invitation" hidden><p></p><button type="button" class="party-accept">Accept</button><button type="button" class="party-decline">Decline</button></div><div class="party-picker"><select aria-label="Nearby player to invite"><option value="">No nearby players</option></select><button type="button" class="party-invite">Invite</button></div><button type="button" class="party-leave" hidden>Leave party</button></section><section class="guild-group"><h3>GUILD <span class="guild-name">Not joined</span></h3><p class="guild-help">Persistent community · guild name appears beneath members</p><form class="guild-create"><input maxlength="24" minlength="3" placeholder="Guild name" autocomplete="off" aria-label="New guild name"><button type="submit">Found guild</button></form><div class="guild-invitation" hidden><p></p><button type="button" class="guild-accept">Join</button><button type="button" class="guild-decline">Decline</button></div><ul class="guild-members" aria-label="Online guild members"></ul><div class="guild-picker" hidden><select aria-label="Nearby player to invite to guild"><option value="">No nearby explorers</option></select><button type="button" class="guild-invite">Invite</button></div><button type="button" class="guild-leave" hidden>Leave guild</button></section><form class="party-rename"><label for="party-player-name">Change character name</label><div><input id="party-player-name" maxlength="20" minlength="2" placeholder="New name" autocomplete="off"><button type="submit">Rename</button></div></form><p class="party-status" role="status">Invite a nearby player on your level.</p></details>';
  document.body.append(root);
  const details = root.querySelector("details")!, count = root.querySelector(".party-count")!, members = root.querySelector("ul")!;
  const select = root.querySelector("select")!, inviteButton = root.querySelector<HTMLButtonElement>(".party-invite")!;
  const tradeButton = document.createElement("button"); tradeButton.type = "button"; tradeButton.textContent = "Trade"; tradeButton.disabled = true;
  root.querySelector(".party-picker")!.append(tradeButton);
  tradeButton.addEventListener("click", () => { if (select.value) trade(select.value); tradeButton.blur(); });
  const invitation = root.querySelector<HTMLElement>(".party-invitation")!, invitationText = invitation.querySelector("p")!;
  const accept = root.querySelector<HTMLButtonElement>(".party-accept")!, decline = root.querySelector<HTMLButtonElement>(".party-decline")!;
  const leave = root.querySelector<HTMLButtonElement>(".party-leave")!, status = root.querySelector(".party-status")!;
  const nameForm = root.querySelector<HTMLFormElement>(".party-rename")!, nameInput = root.querySelector<HTMLInputElement>("#party-player-name")!;
  const guildName = root.querySelector<HTMLElement>(".guild-name")!, guildCreate = root.querySelector<HTMLFormElement>(".guild-create")!;
  const guildNameInput = guildCreate.querySelector<HTMLInputElement>("input")!, guildMembers = root.querySelector<HTMLElement>(".guild-members")!;
  const guildInvitation = root.querySelector<HTMLElement>(".guild-invitation")!, guildInvitationText = guildInvitation.querySelector("p")!;
  const guildAccept = root.querySelector<HTMLButtonElement>(".guild-accept")!, guildDecline = root.querySelector<HTMLButtonElement>(".guild-decline")!;
  const guildPicker = root.querySelector<HTMLElement>(".guild-picker")!, guildSelect = guildPicker.querySelector<HTMLSelectElement>("select")!;
  const guildInvite = root.querySelector<HTMLButtonElement>(".guild-invite")!, guildLeave = root.querySelector<HTMLButtonElement>(".guild-leave")!;
  let current: PartyUpdate = { partyId: null, members: [], nearby: [], invite: null }, choicesKey = "", previousParty: string | null = null, previousInvite: string | null = null;
  let currentGuild: GuildUpdate = { membership: null, members: [], nearby: [], invite: null }, guildChoicesKey = "", previousGuild = "", previousGuildInvite = "";
  const request = (value: PartyRequest) => { status.textContent = send(value) ? "Waiting for the server…" : "Connect to the world first."; };
  const requestGuild = (value: GuildRequest) => { status.textContent = sendGuild(value) ? "Waiting for the server…" : "Connect to the world first."; };
  inviteButton.addEventListener("click", () => { if (select.value) request({ action: "invite", targetId: select.value }); inviteButton.blur(); });
  accept.addEventListener("click", () => { if (current.invite) request({ action: "respond", inviteId: current.invite.id, accept: true }); accept.blur(); });
  decline.addEventListener("click", () => { if (current.invite) request({ action: "respond", inviteId: current.invite.id, accept: false }); decline.blur(); });
  leave.addEventListener("click", () => { request({ action: "leave" }); leave.blur(); });
  guildCreate.addEventListener("submit", event => {
    event.preventDefault();
    const parsed = GuildNameSchema.safeParse(guildNameInput.value);
    if (!parsed.success) { status.textContent = "Guild names need 3–24 letters or numbers; spaces, apostrophes and hyphens are allowed."; return; }
    requestGuild({ action: "create", name: parsed.data }); guildNameInput.blur();
  });
  guildAccept.addEventListener("click", () => { if (currentGuild.invite) requestGuild({ action: "respond", inviteId: currentGuild.invite.id, accept: true }); });
  guildDecline.addEventListener("click", () => { if (currentGuild.invite) requestGuild({ action: "respond", inviteId: currentGuild.invite.id, accept: false }); });
  guildInvite.addEventListener("click", () => { if (guildSelect.value) requestGuild({ action: "invite", targetId: guildSelect.value }); });
  guildLeave.addEventListener("click", () => requestGuild({ action: "leave" }));
  nameForm.addEventListener("submit", event => {
    event.preventDefault();
    const parsed = PlayerNameSchema.safeParse(nameInput.value);
    if (!parsed.success) { status.textContent = "Use 2–20 letters, numbers, spaces, _ or -."; return; }
    status.textContent = rename(parsed.data) ? "Changing your name…" : "Connect to the world first.";
    nameInput.blur();
  });
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
      row.append(name, info, meter);
      if (member.id !== localId() && member.distance <= 4) { const button = document.createElement("button"); button.type = "button"; button.textContent = "Trade"; button.addEventListener("click", () => trade(member.id)); row.append(button); }
      return row;
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
    select.disabled = false; tradeButton.disabled = !select.value;
    leave.hidden = !value.partyId;
  }
  function updateGuild(value: GuildUpdate) {
    currentGuild = value;
    const membershipId = value.membership?.id ?? ""; const inviteId = value.invite?.id ?? "";
    if (membershipId && membershipId !== previousGuild || inviteId && inviteId !== previousGuildInvite) details.open = true;
    previousGuild = membershipId; previousGuildInvite = inviteId;
    guildName.textContent = value.membership?.name ?? "Not joined";
    guildCreate.hidden = Boolean(value.membership);
    guildInvitation.hidden = !value.invite;
    guildInvitationText.textContent = value.invite ? `${value.invite.inviterName} invites you to ${value.invite.guildName}. Accept within 30 seconds.` : "";
    guildMembers.replaceChildren(...value.members.map(member => {
      const row = document.createElement("li"), name = document.createElement("strong"), info = document.createElement("small");
      name.textContent = member.id === localId() ? `${member.name} · YOU` : member.name;
      info.textContent = member.distance === 0 ? "Here" : `${member.distance}m away`;
      row.append(name, info); return row;
    }));
    guildPicker.hidden = !value.membership;
    guildLeave.hidden = !value.membership;
    const key = JSON.stringify(value.nearby);
    if (key !== guildChoicesKey && document.activeElement !== guildSelect) {
      guildChoicesKey = key; const selected = guildSelect.value;
      guildSelect.replaceChildren(new Option(value.nearby.length ? "Choose nearby explorer…" : "No guild-free explorers within 4m", ""),
        ...value.nearby.map(player => new Option(player.name, player.id)));
      if (value.nearby.some(player => player.id === selected)) guildSelect.value = selected;
    }
    guildInvite.disabled = !guildSelect.value;
  }
  select.addEventListener("change", () => { inviteButton.disabled = !select.value || current.members.length >= 4; tradeButton.disabled = !select.value; });
  guildSelect.addEventListener("change", () => { guildInvite.disabled = !guildSelect.value; });
  return {
    update,
    updateGuild,
    invite(targetId: string) {
      if (current.members.some(member => member.id === targetId)) { status.textContent = "That explorer is already in your party."; return false; }
      if (current.members.length >= 4) { status.textContent = "Your party is full."; return false; }
      if (!current.nearby.some(player => player.id === targetId)) { status.textContent = "Move closer before inviting that explorer."; return false; }
      request({ action: "invite", targetId });
      return true;
    },
    isMember(targetId: string) { return current.members.some(member => member.id === targetId); },
    isFull() { return current.members.length >= 4; },
    guildInvite(targetId: string) {
      if (!currentGuild.membership) { details.open = true; guildNameInput.focus(); status.textContent = "Choose a guild name first."; return false; }
      if (currentGuild.members.some(member => member.id === targetId)) { status.textContent = "That explorer is already in your guild."; return false; }
      if (!currentGuild.nearby.some(player => player.id === targetId)) { status.textContent = "Move within 4m of that explorer before inviting them."; return false; }
      requestGuild({ action: "invite", targetId }); return true;
    },
    guildMembership() { return currentGuild.membership; },
    openGuild() { details.open = true; guildNameInput.focus(); },
    notice(text: string) { status.textContent = text; },
    reset() { update({ partyId: null, members: [], nearby: [], invite: null }); updateGuild({ membership: null, members: [], nearby: [], invite: null }); status.textContent = "Disconnected. Parties are session-only; guild membership is saved to your character."; },
  };
}
