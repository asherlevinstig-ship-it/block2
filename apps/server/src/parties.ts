import type { PartyRequest, PartyUpdate } from "@blockcraft/protocol";
import { hearsNearbyChat } from "./nearby-chat.js";
type Player = { x: number; y: number; z: number; name: string; health: number; maxHealth: number };
type Players = Pick<Map<string, Player>, "get" | "has" | "entries">;
type Invite = { id: string; from: string; partyId: string | null; expiresAt: number };
/** Room-local, consent-based groups. No inventory, damage or reward authority. */
export class Parties {
  private readonly groups = new Map<string, string[]>();
  private readonly membership = new Map<string, string>();
  private readonly invites = new Map<string, Invite>();
  private readonly lastInviteAt = new Map<string, number>();
  private sequence = 0;
  private partyId(id: string) { return this.membership.get(id) ?? null; }
  expire(now: number): void { for (const [id, invite] of this.invites) if (now >= invite.expiresAt) this.invites.delete(id); }
  leave(id: string): void {
    const groupId = this.partyId(id); this.membership.delete(id);
    if (groupId) {
      const members = (this.groups.get(groupId) ?? []).filter(member => member !== id);
      if (members.length < 2) { for (const member of members) this.membership.delete(member); this.groups.delete(groupId); }
      else this.groups.set(groupId, members);
    }
    for (const [recipient, invite] of this.invites) if (recipient === id || invite.from === id || invite.partyId === groupId && groupId !== null) this.invites.delete(recipient);
  }
  disconnect(id: string): void { this.leave(id); this.lastInviteAt.delete(id); }
  handle(id: string, request: PartyRequest, players: Players, now: number): string {
    this.expire(now);
    const player = players.get(id); if (!player) return "Connect to the world first.";
    if (request.action === "leave") { this.leave(id); return "You left the party."; }
    if (request.action === "invite") {
      const target = players.get(request.targetId);
      if (!target || request.targetId === id || !hearsNearbyChat(player, target)) return "Choose a nearby player on your level.";
      if (this.partyId(request.targetId)) return "That player is already in a party.";
      const groupId = this.partyId(id);
      if (groupId && (this.groups.get(groupId)?.length ?? 0) >= 4) return "Your party is full (4 players).";
      if (now - (this.lastInviteAt.get(id) ?? -Infinity) < 2000) return "Wait a moment before inviting again.";
      if (this.invites.has(request.targetId)) return "That player already has a pending invitation.";
      this.lastInviteAt.set(id, now);
      // One pending outgoing invitation per player, bounded by room population.
      for (const [recipient, invite] of this.invites) if (invite.from === id) this.invites.delete(recipient);
      this.invites.set(request.targetId, { id: `invite-${now}-${++this.sequence}`, from: id, partyId: groupId, expiresAt: now + 30000 });
      return `Invitation sent to ${target.name} (30 seconds).`;
    }
    const invite = this.invites.get(id);
    if (!invite || invite.id !== request.inviteId) return "That invitation has expired or changed.";
    this.invites.delete(id);
    if (!request.accept) return "Invitation declined.";
    if (this.partyId(id)) return "Leave your current party before joining another.";
    const inviter = players.get(invite.from);
    if (!inviter || this.partyId(invite.from) !== invite.partyId) return "That party is no longer available.";
    let groupId = invite.partyId;
    if (!groupId) { groupId = `party-${++this.sequence}`; this.groups.set(groupId, [invite.from]); this.membership.set(invite.from, groupId); }
    const members = this.groups.get(groupId)!;
    if (members.length >= 4) return "That party is now full (4 players).";
    members.push(id); this.membership.set(id, groupId);
    return "Joined the party. Loot rules are unchanged.";
  }
  snapshot(id: string, players: Players, now: number): PartyUpdate {
    this.expire(now); const player = players.get(id), partyId = this.partyId(id);
    const invite = this.invites.get(id), inviter = invite ? players.get(invite.from) : null;
    return { partyId,
      members: (partyId ? this.groups.get(partyId) ?? [] : []).flatMap((memberId, index) => {
        const member = players.get(memberId); return !member || !player ? [] : [{ id: memberId, name: member.name, health: member.health, maxHealth: member.maxHealth,
          distance: Math.round(Math.hypot(member.x - player.x, member.y - player.y, member.z - player.z)), leader: index === 0 }];
      }),
      nearby: !player ? [] : [...players.entries()].filter(([otherId, other]) => otherId !== id && !this.partyId(otherId) && hearsNearbyChat(player, other))
        .sort(([, a], [, b]) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z)).slice(0, 16).map(([otherId, other]) => ({ id: otherId, name: other.name })),
      invite: invite && inviter ? { id: invite.id, name: inviter.name, expiresAt: invite.expiresAt } : null,
    };
  }
}
