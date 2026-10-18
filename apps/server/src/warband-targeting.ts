export type WarbandTargetCandidate = {
  id: string;
  x: number;
  z: number;
  mainHandId?: string;
  retreating?: boolean;
  forced?: boolean;
};

export type WarbandTargetPlan = {
  brute: WarbandTargetCandidate;
  crawler: WarbandTargetCandidate;
  spitter: WarbandTargetCandidate;
};

export type WarbandChallengeCandidate = { id: string; leaderId?: string | null; isLeader?: boolean };

/** Challenge keeps ordinary enemies, but a formed warband's escorts retain their specialist assignments. */
export function warbandChallengeTargets<T extends WarbandChallengeCandidate>(candidates: readonly T[]): T[] {
  const nearbyLeaders = new Set(candidates.filter(candidate => candidate.isLeader).map(candidate => candidate.id));
  return candidates.filter(candidate => !candidate.leaderId || !nearbyLeaders.has(candidate.leaderId));
}

function nearestAllyDistance(candidate: WarbandTargetCandidate, candidates: readonly WarbandTargetCandidate[]): number {
  const distances = candidates.filter(peer => peer.id !== candidate.id)
    .map(peer => Math.hypot(peer.x - candidate.x, peer.z - candidate.z));
  return distances.length ? Math.min(...distances) : 0;
}

function nearbyAllyCount(candidate: WarbandTargetCandidate, candidates: readonly WarbandTargetCandidate[]): number {
  return candidates.filter(peer => peer.id !== candidate.id
    && Math.hypot(peer.x - candidate.x, peer.z - candidate.z) <= 4.5).length;
}

const rangedHand = (mainHandId?: string): boolean => mainHandId === "bow" || mainHandId === "forged_bow"
  || mainHandId === "magic_focus" || mainHandId === "forged_focus" || mainHandId === "acid_gland_focus"
  || mainHandId === "venom_focus" || mainHandId === "echo_prism";

/** Selects authored combat roles only; it never changes encounter stats or timings. */
export function selectWarbandTargets(candidates: readonly WarbandTargetCandidate[], bruteTargetId: string,
  crawlerForcedTargetId?: string): WarbandTargetPlan | null {
  if (!candidates.length) return null;
  const brute = candidates.find(candidate => candidate.id === bruteTargetId) ?? candidates[0]!;
  if (candidates.length === 1) return { brute, crawler: brute, spitter: brute };

  const forcedCrawler = crawlerForcedTargetId
    ? candidates.find(candidate => candidate.id === crawlerForcedTargetId) : undefined;
  const crawlerPool = candidates.filter(candidate => candidate.id !== brute.id);
  const crawler = forcedCrawler ?? [...(crawlerPool.length ? crawlerPool : candidates)].sort((a, b) => {
    const score = (candidate: WarbandTargetCandidate) => nearestAllyDistance(candidate, candidates)
      + (rangedHand(candidate.mainHandId) ? 4 : 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  })[0]!;

  const distinct = candidates.filter(candidate => candidate.id !== brute.id && candidate.id !== crawler.id);
  const spitterPool = distinct.length ? distinct : candidates.filter(candidate => candidate.id !== crawler.id);
  const spitter = [...(spitterPool.length ? spitterPool : candidates)].sort((a, b) => {
    const score = (candidate: WarbandTargetCandidate) => nearbyAllyCount(candidate, candidates) * 5
      + (candidate.retreating ? 3 : 0);
    return score(b) - score(a) || a.id.localeCompare(b.id);
  })[0]!;
  return { brute, crawler, spitter };
}
