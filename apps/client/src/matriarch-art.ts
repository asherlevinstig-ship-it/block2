import { MATRIARCH_PHASE } from "@blockcraft/protocol";
/** Two short, clock-driven recoil pulses; late snapshots never replay old firing. */
export function matriarchRecoil(elapsed: number, doubleFan: boolean): number {
  const pulse = (at: number) => at >= 0 && at < 260 ? Math.sin(at / 260 * Math.PI) : 0;
  return Math.max(pulse(elapsed), doubleFan ? pulse(elapsed - MATRIARCH_PHASE.volleyGapMs) : 0);
}
export function matriarchBodyPose(defeat: number, recoil: number) {
  const collapse = Math.max(0, Math.min(1, defeat));
  return { width: 1.55 * (1 + collapse * .15), height: 1.45 * (1 - collapse * .72), length: 1.7 * (1 + collapse * .12),
    drop: -collapse * .12, recoilZ: -recoil * .34, roll: collapse * 24 };
}
