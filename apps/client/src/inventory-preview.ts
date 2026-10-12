import { APPEARANCE_PALETTE, DEFAULT_APPEARANCE, type Appearance, type ArmourId, type MainHandId } from "@blockcraft/protocol";

function appearanceHex(group: keyof typeof APPEARANCE_PALETTE, id: string): string {
  const options = APPEARANCE_PALETTE[group] as readonly { id: string; color: string }[];
  return (options.find(option => option.id === id) ?? options[0]!).color;
}

function shade(hex: string, factor: number): string {
  return `#${[1, 3, 5].map(index => Math.round(parseInt(hex.slice(index, index + 2), 16) * factor).toString(16).padStart(2, "0")).join("")}`;
}

/** Static paper doll: no engine entities, render targets, readbacks or animation loop. */
export function createInventoryPortrait(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  let cachedKey = "";
  let destroyed = false;
  const box = (colour: string, x: number, y: number, w: number, h: number) => {
    context!.fillStyle = colour; context!.fillRect(x, y, w, h);
  };
  return {
    refresh(hand: MainHandId, armour: ArmourId, appearance: Appearance = DEFAULT_APPEARANCE) {
      const key = `${hand}:${armour}:${appearance.skin}:${appearance.hair}:${appearance.coat}:${appearance.hairStyle}:${appearance.coatStyle}`;
      if (!context || destroyed || key === cachedKey) return;
      cachedKey = key;
      context.save(); context.scale(canvas.width / 240, canvas.height / 280);
      box("#0e1713", 0, 0, 240, 280); box("#213329", 52, 248, 136, 8);
      box("#182c2c", 92, 182, 24, 57); box("#223a3a", 124, 182, 24, 57);
      box("#34291f", 88, 227, 29, 18); box("#34291f", 123, 227, 29, 18);
      const coat = armour === "bastion_plate" ? "#8192a5" : armour === "iron_armour" ? "#a7bac5" : armour === "rootguard_armour" ? "#315d39" : armour === "leather_armour" ? "#95633c" : appearanceHex("coat", appearance.coat);
      box(coat, 86, 103, 68, 82);
      if (appearance.coatStyle === "short") {
        box(shade(coat, 1.18), 76, 103, 16, 18); box(shade(coat, 1.18), 148, 103, 16, 18);
        box("#ddbd70", 118, 111, 4, 63); box(shade(coat, .68), 86, 174, 68, 11);
      } else if (appearance.coatStyle === "long") {
        box(coat, 86, 183, 29, 35); box(coat, 125, 183, 29, 35);
        box(shade(coat, .7), 86, 183, 29, 5); box(shade(coat, .7), 125, 183, 29, 5);
      }
      box(armour === "iron_armour" ? "#738b9c" : shade(coat, .78), 86, 103, 12, 82);
      box(coat, 62, 106, 22, 61); box(coat, 156, 106, 22, 61);
      const skin = appearanceHex("skin", appearance.skin);
      const hair = appearanceHex("hair", appearance.hair);
      box(skin, 64, 167, 18, 18); box(skin, 158, 167, 18, 18);
      box("#442d22", 86, 165, 68, 12); box("#dbb466", 114, 165, 13, 12);
      box(skin, 96, 53, 48, 48); box(shade(skin, .82), 132, 53, 12, 48);
      box(hair, 92, 45, 56, 16);
      if (appearance.hairStyle === "spiked") {
        box(hair, 96, 30, 11, 17); box(hair, 114, 23, 12, 24); box(hair, 133, 30, 11, 17);
      } else if (appearance.hairStyle === "long") {
        box(hair, 88, 48, 9, 58); box(hair, 144, 48, 9, 58); box(shade(hair, .8), 96, 94, 48, 12);
      } else box(hair, 92, 58, 10, 13);
      box("#282520", 107, 76, 5, 5); box("#282520", 127, 76, 5, 5);
      box("#e4b84f", 92, 98, 56, 11); box("#bf9037", 96, 109, 12, 31);
      if (armour === "iron_armour" || armour === "bastion_plate") {
        box("#dbe5ea", 57, 101, 30, 16); box("#dbe5ea", 153, 101, 30, 16); box("#dbe5ea", 117, 113, 7, 47);
        if (armour === "bastion_plate") { box("#d4b574", 109, 122, 22, 22); box("#d4b574", 57, 101, 30, 5); box("#d4b574", 153, 101, 30, 5); }
      } else if (armour === "rootguard_armour") {
        box("#60401f", 57, 101, 30, 16); box("#60401f", 153, 101, 30, 16);
        box("#79dd68", 113, 116, 14, 14); box("#60401f", 101, 112, 6, 51); box("#60401f", 133, 112, 6, 51);
      } else if (armour === "leather_armour") {
        for (let i = 0; i < 5; i++) box("#4d3627", 100 + i * 7, 113 + i * 8, 10, 12);
      }
      if (hand.includes("bow")) {
        box("#a27742", 191, 107, 8, 99); box("#a27742", 179, 99, 16, 8); box("#a27742", 179, 206, 16, 8); box("#d5d6bc", 179, 108, 2, 98);
      } else if (hand.includes("focus")) {
        box("#795735", 180, 125, 7, 82);
        box(hand === "venom_focus" ? "#36d7a2" : hand === "acid_gland_focus" ? "#b1db54" : hand === "echo_prism" ? "#9defff" : "#79c4e5", 172, 105, 23, 24); box("#ddf4f0", 179, 109, 7, 10);
      } else if (hand === "stone_core_hammer" || hand === "rootbound_hammer") {
        box("#8b623b", 183, 118, 8, 91); box("#819baa", 167, 97, 39, 27); box("#c6d5dc", 169, 97, 35, 7);
        if (hand === "rootbound_hammer") { box("#3c7b43", 164, 98, 45, 8); box("#72d76f", 180, 103, 12, 15); }
      } else {
        const dagger = hand === "fang_dagger";
        box("#6f4b2d", 182, 173, 8, 29); box("#cba65c", 174, 169, 24, 7);
        box(dagger ? "#e7ddbb" : "#b5cbd4", 181, dagger ? 132 : 91, 10, dagger ? 37 : 78);
        box("#eef2e7", 181, dagger ? 132 : 91, 3, dagger ? 37 : 78);
      }
      context.restore();
    },
    hide() { /* A cached drawing has no ongoing work to stop. */ },
    destroy() { destroyed = true; },
  };
}
