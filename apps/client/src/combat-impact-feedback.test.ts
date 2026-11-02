import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("combat impact feedback", () => {
  it("layers a directional damage vignette with a prominent HUD reaction", () => {
    expect(html).toContain('id="damage-overlay"');
    expect(css).toContain("#damage-overlay.active");
    expect(css).toContain("--damage-direction");
    expect(css).toContain("#player-hud-root.taking-damage");
    expect(main).toContain("showPlayerDamageImpact(message.mobId, message.damage, message.health)");
    expect(main).toContain('combatAudio.play("playerHit")');
  });

  it("confirms dealt damage through the reticle, enemy body, bar and number", () => {
    expect(css).toContain("#combat-reticle.hit-confirmed::before");
    expect(css).toContain(".ranged-popup-melee { color: #ffe2a0; font-size: 30px");
    expect(main).toContain("confirmEnemyDamage(message.damage, message.defeated, message.contactKind)");
    expect(main).toContain(".065 + hitStrength * .085");
    expect(main).toContain("1.25 * hitStrength");
    expect(css).toContain("#combat-reticle.hit-confirmed.direct-contact");
    expect(main).toContain("mob.localImpactStrength = impulse.mobReaction");
  });

  it("honours reduced-motion preferences for every new screen-space reaction", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("#damage-overlay.active");
  });

  it("shows Assassin openings and the five-segment Edge resource", () => {
    expect(html).toContain('id="assassin-edge"');
    expect(css).toContain("#assassin-edge i.active");
    expect(main).toContain('message.assassinPayoff === "final_judgement"');
    expect(main).toContain("Assassin Edge, ${localAssassinEdge} of five");
  });

  it("shows Healer Grace and Perfect Intercession feedback", () => {
    expect(html).toContain('id="healer-grace"');
    expect(css).toContain("#healer-grace i.active");
    expect(main).toContain('room.onMessage("healer:intercession-impact"');
    expect(main).toContain("Healer Grace, ${localHealerGrace} of three");
  });
});
