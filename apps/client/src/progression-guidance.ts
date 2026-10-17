export function statChoiceDisabled(available: number, invested: number, pending: boolean, cap: number): boolean {
  return pending || available <= 0 || invested >= cap;
}

export function callingLevelGuide(
  level: number,
  calling: { name: string; power: string; special: string } | null,
  inTown: boolean,
): string {
  if (!calling) {
    const availability = level >= 4 ? "Your G power and F special are ready"
      : level >= 2 ? "Your G power is ready; the F special unlocks at level 4"
      : "Your G power unlocks at level 2; the F special at level 4";
    return `${availability}. ${inTown ? "Choose a Calling below to use them." : "Choose a Calling in Town to use them."}`;
  }
  return `${calling.name} Calling · G: ${level >= 2 ? calling.power : "unlocks at level 2"} · F: ${level >= 4 ? calling.special : "unlocks at level 4"}. More G choices unlock through Path Mastery in KIT.`;
}
