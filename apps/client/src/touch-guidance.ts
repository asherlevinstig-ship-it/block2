const TOUCH_GUIDANCE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bPress I or (?:ESC|Escape) to close\b/gi, "Tap BACK to close"],
  [/\bPress G or F\b/gi, "Tap POWER or SPECIAL"],
  [/\bClick or press J\b/gi, "Tap ATTACK"],
  [/\bPress J \(or click\)/gi, "Tap ATTACK"],
  [/\bHold J or left-click\b/gi, "Hold ATTACK"],
  [/\bMouse aim optional\b/gi, "Drag ATTACK to aim"],
  [/\bPress I\b/gi, "Tap PACK"],
  [/\bHold E\b/gi, "Hold INTERACT"],
  [/\bPress E\b/gi, "Tap INTERACT"],
  [/\bHold C(?:\s*\/\s*right-click)?\b/gi, "Hold GUARD"],
  [/\bPress C\b/gi, "Tap GUARD"],
  [/\bPress G\b/gi, "Tap POWER"],
  [/\bPress F\b/gi, "Tap SPECIAL"],
  [/\bPress J or attack\b/gi, "Tap ATTACK"],
  [/\bPress J\b/gi, "Tap ATTACK"],
  [/\bTap J\b/gi, "Tap ATTACK"],
  [/\bHold J\b/gi, "Hold ATTACK"],
  [/\bHold R\b/gi, "Hold POWER"],
  [/\bPress H\b/gi, "Tap POTION"],
  [/\bPress V\b/gi, "Tap CAMERA"],
  [/\bSpace dodges\b/gi, "Tap DODGE"],
  [/\bSpace to dodge\b/gi, "Tap DODGE"],
  [/\bwith Space\b/gi, "with DODGE"],
  [/\bEsc(?:ape)? to close\b/gi, "Tap BACK to close"],
  [/\bG slot\b/gi, "POWER slot"],
  [/\bon G\b/gi, "on POWER"],
  [/\bto G\b/gi, "to POWER"],
  [/\bG to use\b/gi, "POWER to use"],
  [/\bF to use\b/gi, "SPECIAL to use"],
  [/\bF uses\b/gi, "SPECIAL uses"],
];

const TOUCH_KEY_LABELS: Readonly<Record<string, string>> = {
  I: "PACK", ESC: "BACK", ESCAPE: "BACK", E: "INTERACT", J: "ATTACK",
  C: "GUARD", G: "POWER", F: "SPECIAL", H: "POTION", V: "CAMERA", SPACE: "DODGE",
};

export function touchGuidanceText(value: string): string {
  return TOUCH_GUIDANCE_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function localizeTextNode(node: Text): void {
  const parent = node.parentElement;
  if (!parent || parent.closest("script, style, [data-keep-keyboard-copy]")) return;
  const current = node.data;
  const key = current.trim().length <= 6 ? TOUCH_KEY_LABELS[current.trim().toUpperCase()] : undefined;
  const translated = key ?? touchGuidanceText(current);
  if (translated !== current) node.data = translated;
}

function localizeElementAttributes(element: Element): void {
  for (const attribute of ["title", "aria-label"]) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const translated = touchGuidanceText(current);
    if (translated !== current) element.setAttribute(attribute, translated);
  }
}

/** Converts keyboard guidance into the equivalent visible touch controls, including later DOM updates. */
export function localizeTouchGuidance(root: Node): void {
  if (root instanceof Text) { localizeTextNode(root); return; }
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
  if (root instanceof Element) localizeElementAttributes(root);
  const elements = root instanceof Element ? root.querySelectorAll("[title], [aria-label]")
    : root.querySelectorAll?.("[title], [aria-label]") ?? [];
  for (const element of elements) localizeElementAttributes(element);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) { localizeTextNode(node as Text); node = walker.nextNode(); }
}

