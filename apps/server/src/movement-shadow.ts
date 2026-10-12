import { schema, t } from "@colyseus/schema";
import { stepPlayerNetcode, type NetcodePlayerPose, type NetcodeMoveDirection } from "@blockcraft/voxel-world";

// The same input schema supports authoritative movement and local shadow A/B.
export const ShadowMoveInput = schema({ strafe: t.float32(), forward: t.float32(), yaw: t.float32() }, "ShadowMoveInput");
export type ShadowPose = NetcodePlayerPose;
export type ShadowDirection = NetcodeMoveDirection;
export const stepShadowMovement = stepPlayerNetcode;
