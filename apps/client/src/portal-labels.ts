export type PortalLabel = {
  title: string;
  subtitle: string;
  action: "ENTER" | "RETURN" | "CHALLENGE" | "SEALED";
  locked: boolean;
  tone: "forest" | "depths" | "ember" | "warden" | "tower" | "tavern";
};

/** One naming source for floating labels and the contextual E prompt. */
export function portalLabel(id: string, kind: string, wardenGateUnlocked = false): PortalLabel {
  if (id === "tavern-entry") return {
    title: "THE HEARTH & HAMMER", subtitle: "WAYFARER INN · MARA'S TAVERN", action: "ENTER", locked: false, tone: "tavern",
  };
  if (id === "tavern-exit") return {
    title: "RETURN TO TOWN", subtitle: "LEAVE THE HEARTH & HAMMER", action: "RETURN", locked: false, tone: "tavern",
  };
  if (id === "tower-floor-1-entry") return {
    title: "ENTER FLOOR 1", subtitle: "THE OVERGROWN RAMPART · LV 1–4", action: "ENTER", locked: false, tone: "tower",
  };
  if (id === "tower-floor-1-return") return {
    title: "RETURN TO TOWN", subtitle: "TOWN OF BEGINNINGS · SAFE", action: "RETURN", locked: false, tone: "tower",
  };
  if (id === "tower-floor-2-locked") return {
    title: "FLOOR 2", subtitle: "ASCENT GATE · SEALED", action: "SEALED", locked: true, tone: "tower",
  };
  if (id === "warden-gate") return wardenGateUnlocked ? {
    title: "WARDEN GATE", subtitle: "ASCENDANT CHALLENGE", action: "CHALLENGE", locked: false, tone: "warden",
  } : {
    title: "WARDEN GATE", subtitle: "DEFEAT THE REALM STONE WARDEN", action: "SEALED", locked: true, tone: "warden",
  };
  if (id === "depths-entry") return {
    title: "ENTER THE SILVER DEPTHS", subtitle: "PARTY EXPEDITION", action: "ENTER", locked: false, tone: "depths",
  };
  if (id === "depths-return") return {
    title: "RETURN TO TOWN", subtitle: "LEAVE THE SILVER DEPTHS", action: "RETURN", locked: false, tone: "depths",
  };
  if (id === "ember-entry") return {
    title: "ENTER THE EMBER VAULT", subtitle: "FORGE EXPEDITION", action: "ENTER", locked: false, tone: "ember",
  };
  if (id === "ember-return") return {
    title: "RETURN TO THE FRONTIER", subtitle: "LEAVE THE EMBER VAULT", action: "RETURN", locked: false, tone: "ember",
  };
  if (id === "forest-victory") return {
    title: "VICTORY PORTAL", subtitle: "EXPEDITION COMPLETE", action: "RETURN", locked: false, tone: "forest",
  };
  if (id === "forest-entry") return {
    title: "ENTER THE FOREST DUNGEON", subtitle: "ROOTBOUND EXPEDITION", action: "ENTER", locked: false, tone: "forest",
  };
  return kind === "entry" ? {
    title: "ENTER PORTAL", subtitle: "EXPEDITION ENTRANCE", action: "ENTER", locked: false, tone: "forest",
  } : {
    title: "RETURN PORTAL", subtitle: "RETURN TO THE SURFACE", action: "RETURN", locked: false, tone: "forest",
  };
}

export function portalWorldLabel(label: PortalLabel, seconds = 0): string {
  const timer = seconds > 0 ? ` · ${seconds}s` : "";
  return `${label.title}\n${label.subtitle}${timer}\n${label.locked ? "SEALED" : `HOLD E · ${label.action}`}`;
}

export function portalInteractionPrompt(label: PortalLabel): string {
  return label.locked ? `${label.title} · ${label.subtitle}`
    : `${label.title} · hold E to ${label.action.toLowerCase()}`;
}
