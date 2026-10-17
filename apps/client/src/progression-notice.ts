export type ProgressionNotice = {
  kind: "stat" | "calling" | "equip" | "use";
  title: string;
  detail: string;
  action: string;
};

export function progressionNotice(input: {
  level: number;
  unspentPoints: number;
  statDismissed: boolean;
  hasCalling: boolean;
  inTown: boolean;
  callingDismissed: boolean;
  newAbilityNames: string[];
  equipDismissed: boolean;
  equippedAbilityName: string | null;
  equippedAbilityUsed: boolean;
  useDismissed: boolean;
}): ProgressionNotice | null {
  if (input.level >= 2 && !input.hasCalling && !input.callingDismissed) return {
    kind: "calling", title: "Choose your Calling", detail: "Your first Power is waiting for a playstyle.",
    action: input.inTown ? "CHOOSE CALLING" : "RETURN TO TOWN",
  };
  if (input.newAbilityNames.length && !input.equipDismissed) return {
    kind: "equip", title: `${input.newAbilityNames.join(" + ")} unlocked`,
    detail: "New Calling choice available for your G slot.", action: "OPEN KIT TO EQUIP",
  };
  if (input.equippedAbilityName && !input.equippedAbilityUsed && !input.useDismissed) return {
    kind: "use", title: `${input.equippedAbilityName} equipped`,
    detail: "Your Calling Power is ready in the hotbar.", action: "PRESS G TO USE",
  };
  if (input.unspentPoints > 0 && !input.statDismissed) return {
    kind: "stat", title: `${input.unspentPoints} stat point${input.unspentPoints === 1 ? "" : "s"} ready`,
    detail: "Choose a permanent improvement.", action: "SPEND POINT",
  };
  return null;
}
