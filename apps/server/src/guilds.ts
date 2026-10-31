import { parseGuildMembership, withGuildMembership,
  type GuildRequest, type GuildUpdate } from "@blockcraft/protocol";

type Player = { x: number; y: number; z: number; name: string; huntLoadoutsJson: string };
type Players = Pick<Map<string, Player>, "get" | "entries">;
type Invite = { id: string; from: string; guildId: string; guildName: string; expiresAt: number };
export type GuildResult = { message: string; changed: string[] };

/** Persistent membership with room-local, consent-based invitations. */
export class Guilds {
  private readonly invites = new Map<string, Invite>();
  private readonly lastInviteAt = new Map<string, number>();
  private sequence = 0;

  private expire(now: number): void {
    for (const [recipient, invite] of this.invites) if (now >= invite.expiresAt) this.invites.delete(recipient);
  }

  disconnect(id: string): void {
    this.lastInviteAt.delete(id);
    for (const [recipient, invite] of this.invites)
      if (recipient === id || invite.from === id) this.invites.delete(recipient);
  }

  handle(id: string, request: GuildRequest, players: Players, now: number, createId: () => string): GuildResult {
    this.expire(now);
    const player = players.get(id);
    if (!player) return { message: "Connect to the world first.", changed: [] };
    const membership = parseGuildMembership(player.huntLoadoutsJson);
    if (request.action === "create") {
      if (membership) return { message: `You already belong to ${membership.name}.`, changed: [] };
      const guild = { id: `guild-${createId()}`, name: request.name };
      player.huntLoadoutsJson = withGuildMembership(player.huntLoadoutsJson, guild);
      return { message: `${guild.name} founded. Invite nearby explorers from their character card.`, changed: [id] };
    }
    if (request.action === "leave") {
      if (!membership) return { message: "You are not in a guild.", changed: [] };
      player.huntLoadoutsJson = withGuildMembership(player.huntLoadoutsJson, null);
      for (const [recipient, invite] of this.invites)
        if (recipient === id || invite.from === id) this.invites.delete(recipient);
      return { message: `You left ${membership.name}.`, changed: [id] };
    }
    if (request.action === "invite") {
      if (!membership) return { message: "Form a guild before inviting explorers.", changed: [] };
      const target = players.get(request.targetId);
      if (!target || request.targetId === id || Math.abs(target.y - player.y) > 2.5
        || Math.hypot(target.x - player.x, target.z - player.z) > 4)
        return { message: "Move within 4m of that explorer before inviting them.", changed: [] };
      const targetGuild = parseGuildMembership(target.huntLoadoutsJson);
      if (targetGuild?.id === membership.id) return { message: `${target.name} is already in your guild.`, changed: [] };
      if (targetGuild) return { message: `${target.name} already belongs to another guild.`, changed: [] };
      if (now - (this.lastInviteAt.get(id) ?? -Infinity) < 2000)
        return { message: "Wait a moment before sending another guild invitation.", changed: [] };
      if (this.invites.has(request.targetId)) return { message: "That explorer already has a pending guild invitation.", changed: [] };
      this.lastInviteAt.set(id, now);
      for (const [recipient, invite] of this.invites) if (invite.from === id) this.invites.delete(recipient);
      this.invites.set(request.targetId, { id: `guild-invite-${now}-${++this.sequence}`, from: id,
        guildId: membership.id, guildName: membership.name, expiresAt: now + 30_000 });
      return { message: `Invitation to ${membership.name} sent to ${target.name}.`, changed: [] };
    }
    const invite = this.invites.get(id);
    if (!invite || invite.id !== request.inviteId) return { message: "That guild invitation has expired or changed.", changed: [] };
    this.invites.delete(id);
    if (!request.accept) return { message: "Guild invitation declined.", changed: [] };
    if (membership) return { message: "Leave your current guild before joining another.", changed: [] };
    const inviter = players.get(invite.from);
    const inviterGuild = inviter ? parseGuildMembership(inviter.huntLoadoutsJson) : null;
    if (!inviterGuild || inviterGuild.id !== invite.guildId)
      return { message: "That guild is no longer available from this invitation.", changed: [] };
    player.huntLoadoutsJson = withGuildMembership(player.huntLoadoutsJson,
      { id: invite.guildId, name: invite.guildName });
    return { message: `Joined ${invite.guildName}. Your guild name now appears beneath your character name.`, changed: [id] };
  }

  snapshot(id: string, players: Players, now: number): GuildUpdate {
    this.expire(now);
    const player = players.get(id);
    const membership = player ? parseGuildMembership(player.huntLoadoutsJson) : null;
    const invite = this.invites.get(id);
    const inviter = invite ? players.get(invite.from) : null;
    return {
      membership,
      members: !player || !membership ? [] : [...players.entries()].flatMap(([memberId, member]) => {
        const otherGuild = parseGuildMembership(member.huntLoadoutsJson);
        return otherGuild?.id === membership.id ? [{ id: memberId, name: member.name, online: true,
          distance: Math.round(Math.hypot(member.x - player.x, member.y - player.y, member.z - player.z)) }] : [];
      }).sort((a, b) => a.distance - b.distance),
      nearby: !player || !membership ? [] : [...players.entries()].filter(([otherId, other]) => otherId !== id
        && !parseGuildMembership(other.huntLoadoutsJson) && Math.abs(other.y - player.y) <= 2.5
        && Math.hypot(other.x - player.x, other.z - player.z) <= 4)
        .map(([otherId, other]) => ({ id: otherId, name: other.name })),
      invite: invite && inviter ? { id: invite.id, guildId: invite.guildId, guildName: invite.guildName,
        inviterName: inviter.name, expiresAt: invite.expiresAt } : null,
    };
  }
}
