import type { ServiceNpcId } from "./town-npc-interaction-presentation.js";

export interface TownNpcProgression {
  highestFloorCleared: number;
  clearedFloors: readonly number[];
}

export interface TownNpcProgressionCopy {
  line: string;
  progress: string;
  lore: string;
}

const returningPrefix = (returning: boolean, fresh: string, familiar: string): string => returning ? familiar : fresh;

export function townNpcProgressionCopy(
  npcId: ServiceNpcId,
  tower: TownNpcProgression,
  returning: boolean,
): TownNpcProgressionCopy {
  const highest = tower.highestFloorCleared;
  if (npcId === "smith-brom") {
    if (highest >= 2) return {
      line: returningPrefix(returning,
        "The Forgeheart is ash and your steel came home singing. Put it on my anvil—we can make something the lower floors have never seen.",
        "Back again, floor-breaker? Good. Your gear remembers my hammer, and I remember what survived the Forgeheart."),
      progress: `TOWER RECORD · FLOOR ${highest} · Forgeheart-tier forging recognised`,
      lore: "Crown Fragments and floor materials unlock signature recipes. Higher clears expand Brom's masterwork forge without changing your Calling.",
    };
    if (highest >= 1) return {
      line: returningPrefix(returning,
        "I heard the Chronicle bell. The Crownkeeper fell, and now its fragments belong on an adventurer's blade—not in a trophy case.",
        "The Crownkeeper's mark is still on your steel. Bring me its fragments and we'll make that victory useful."),
      progress: "FLOOR 1 CLEARED · Crownkeeper signature forging unlocked",
      lore: "Each Crownkeeper clear banks a fragment. Gather enough and Brom can forge its signature weapon for your Calling.",
    };
    return {
      line: returningPrefix(returning,
        "Steel remembers every climb. Bring me what the tower gave you, and we'll make it worthy of the next one.",
        "Back already? Good. Let me see what the tower did to that edge."),
      progress: "Clear Floor 1 to awaken the legacy forge",
      lore: "Ore becomes gold. Duplicate gear becomes materials. Reforging strengthens equipment you already own; attunement gives it a specialised purpose.",
    };
  }
  if (npcId === "healer-lyra") {
    if (highest >= 2) return {
      line: returningPrefix(returning,
        "Even here I felt the Forgeheart go quiet. Victory does not make you invincible—sit, breathe, and let me mend the cost of it.",
        "I remember this strain. The higher floors are changing how you carry pain; let the sanctuary answer it."),
      progress: `TOWER RECORD · FLOOR ${highest} · veteran restoration available`,
      lore: "The practice ward remains safe after every clear. Test new powers there before trusting them on the next floor.",
    };
    if (highest >= 1) return {
      line: returningPrefix(returning,
        "The Crownkeeper's shadow lifted when you won. The Town is celebrating; I would rather make certain you live to hear the next bell.",
        "You came back. Good. I remember the wounds that first floor left—be still and let me check them."),
      progress: "FLOOR 1 CLEARED · sanctuary honours the victor",
      lore: "New abilities become safer to learn at the practice dummy and in Lyra's private arena, where failure costs no progress.",
    };
    return {
      line: returningPrefix(returning,
        "The tower takes more than health. Be still—I can restore your strength before your first ascent.",
        "Back for another check? Sensible. Surviving begins before you enter the tower."),
      progress: "No floor cleared · prepare for the first ascent",
      lore: "Use the practice dummy near the sanctuary to identify each ability, or enter the private arena for a complete trial.",
    };
  }
  if (highest >= 2) return {
    line: returningPrefix(returning,
      "Two floors now bear your name in the Chronicle. Guilds are already arguing over who will stand beside you on the third.",
      "The register changed after your last visit. Your victories are attracting people who once refused to climb."),
    progress: `TOWN CHRONICLE · HIGHEST FLOOR ${highest} · two victory banners raised`,
    lore: "Guild identity persists across floors. As the Chronicle grows, Elin records shared victories beside the names of those who earned them.",
  };
  if (highest >= 1) return {
    line: returningPrefix(returning,
      "Your name is beneath Floor One in the Chronicle. A victory becomes history only when someone is there to remember it.",
      "Welcome back, conqueror. The Crownkeeper entry is permanent; now decide whose names should appear beside yours."),
    progress: "TOWN CHRONICLE · FLOOR 1 RECORDED · guild recruitment recognised",
    lore: "Guilds persist with your character. Found one here and invite nearby explorers before your next ascent.",
  };
  return {
    line: returningPrefix(returning,
      "A guild is more than a name. It is who answers when the tower calls—and who remembers those who do not return.",
      "The blank page is still waiting. You do not need a victory before forming the company that earns it."),
    progress: "No Chronicle victory recorded",
    lore: "Guilds persist with your character. Found one here, then invite a nearby guild-free explorer.",
  };
}

export function townVictoryAnimation(actorRole: string, floor: number): string {
  void floor;
  if (actorRole === "guard") return "Cheer";
  if (actorRole === "smith") return "1H_Melee_Attack_Chop";
  if (actorRole === "healer") return "Spellcasting";
  return "Cheer";
}
