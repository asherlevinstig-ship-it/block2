export interface WorldPromptScreenPoint {
  x: number;
  y: number;
  z: number;
}

export interface WorldPromptCanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** PlayCanvas CameraComponent.worldToScreen returns CSS pixels using the
 * graphics device client rect, not pixels from the canvas backing buffer. */
export function worldPromptProjectionVisible(screen: WorldPromptScreenPoint, rect: WorldPromptCanvasRect): boolean {
  return screen.z > 0 && screen.x >= 0 && screen.x <= rect.width && screen.y >= 0 && screen.y <= rect.height;
}

export function worldPromptCssPoint(
  screen: Pick<WorldPromptScreenPoint, "x" | "y">,
  rect: Pick<WorldPromptCanvasRect, "left" | "top">,
  verticalGap: number,
): { x: number; y: number } {
  return { x: rect.left + screen.x, y: rect.top + screen.y - verticalGap };
}
