export interface CanvasClientBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** PlayCanvas camera screen coordinates use CSS canvas pixels, not backing-buffer pixels. */
export function canvasScreenPoint(clientX: number, clientY: number, bounds: CanvasClientBounds): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(bounds.width, clientX - bounds.left)),
    y: Math.max(0, Math.min(bounds.height, clientY - bounds.top)),
  };
}
