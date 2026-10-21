export interface JoystickSample {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

export function tabletJoystickSample(
  clientX: number,
  clientY: number,
  originX: number,
  originY: number,
  radius = 46,
  deadZone = 0.14,
): JoystickSample {
  const rawX = clientX - originX;
  const rawY = clientY - originY;
  const distance = Math.hypot(rawX, rawY);
  const visualScale = distance > radius ? radius / distance : 1;
  const offsetX = rawX * visualScale;
  const offsetY = rawY * visualScale;
  const magnitude = Math.min(1, distance / radius);
  if (magnitude <= deadZone || distance < 0.001) return { x: 0, y: 0, offsetX, offsetY };
  const response = (magnitude - deadZone) / (1 - deadZone);
  return { x: rawX / distance * response, y: rawY / distance * response, offsetX, offsetY };
}

export function touchDragStarted(startX: number, startY: number, currentX: number, currentY: number, threshold = 10): boolean {
  return Math.hypot(currentX - startX, currentY - startY) >= threshold;
}
