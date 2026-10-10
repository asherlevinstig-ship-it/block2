import type { ArmourId, MainHandId } from "@blockcraft/protocol";

/** Static paper doll: no engine entities, render targets, readbacks or animation loop. */
export function createInventoryPortrait(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  let cachedKey = "";
  let destroyed = false;
  const box = (colour: string, x: number, y: number, w: number, h: number) => {
    context!.fillStyle = colour; context!.fillRect(x, y, w, h);
  };
  return {
    refresh(hand: MainHandId, armour: ArmourId) {
      const key = hand + ":" + armour;
      if (!context || destroyed || key === cachedKey) return;
      cachedKey = key;
      context.save(); context.scale(canvas.width / 240, canvas.height / 280);
      box("#0e1713", 0, 0, 240, 280); box("#213329", 52, 248, 136, 8);
      box("#182c2c", 92, 182, 24, 57); box("#223a3a", 124, 182, 24, 57);
      box("#34291f", 88, 227, 29, 18); box("#34291f", 123, 227, 29, 18);
      const coat = armour === "iron_armour" ? "#a7bac5" : armour === "leather_armour" ? "#95633c" : "#267d7c";
      box(coat, 86, 103, 68, 82);
      box(armour === "iron_armour" ? "#738b9c" : "#225453", 86, 103, 12, 82);
      box(coat, 62, 106, 22, 61); box(coat, 156, 106, 22, 61);
      box("#d8a775", 64, 167, 18, 18); box("#d8a775", 158, 167, 18, 18);
      box("#442d22", 86, 165, 68, 12); box("#dbb466", 114, 165, 13, 12);
      box("#e9bd8b", 96, 53, 48, 48); box("#c59161", 132, 53, 12, 48);
      box("#563729", 92, 45, 56, 16); box("#563729", 92, 58, 10, 13);
      box("#282520", 107, 76, 5, 5); box("#282520", 127, 76, 5, 5);
      box("#e4b84f", 92, 98, 56, 11); box("#bf9037", 96, 109, 12, 31);
      if (armour === "iron_armour") {
        box("#dbe5ea", 57, 101, 30, 16); box("#dbe5ea", 153, 101, 30, 16); box("#dbe5ea", 117, 113, 7, 47);
      } else if (armour === "leather_armour") {
        for (let i = 0; i < 5; i++) box("#4d3627", 100 + i * 7, 113 + i * 8, 10, 12);
      }
      if (hand.includes("bow")) {
        box("#a27742", 191, 107, 8, 99); box("#a27742", 179, 99, 16, 8); box("#a27742", 179, 206, 16, 8); box("#d5d6bc", 179, 108, 2, 98);
      } else if (hand.includes("focus")) {
        box("#795735", 180, 125, 7, 82);
        box(hand === "acid_gland_focus" ? "#b1db54" : "#79c4e5", 172, 105, 23, 24); box("#ddf4f0", 179, 109, 7, 10);
      } else if (hand === "stone_core_hammer") {
        box("#8b623b", 183, 118, 8, 91); box("#819baa", 167, 97, 39, 27); box("#c6d5dc", 169, 97, 35, 7);
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
