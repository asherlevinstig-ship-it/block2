import { describe, expect, it } from "vitest";
import { canStartTavernQuiz, doubledPayout, drawQuizQuestion } from "./tavern-quiz.js";

describe("tavern quiz", () => {
  it("requires a funded stake and proximity to the quiz table", () => {
    const player = { x: 10.8, y: 8, z: 16.5 };
    expect(canStartTavernQuiz(player, 20, 5)).toBe(true);
    expect(canStartTavernQuiz(player, 2, 5)).toBe(false);
    expect(canStartTavernQuiz(player, 20, 0)).toBe(false);
    expect(canStartTavernQuiz(player, 20, 11)).toBe(false);
    expect(canStartTavernQuiz({ x: 5.1, y: 8, z: 16.5 }, 20, 5)).toBe(false);
    expect(canStartTavernQuiz({ x: 12.5, y: 5, z: 16.5 }, 20, 5)).toBe(false);
  });

  it("never repeats a question or exposes an invalid answer index", () => {
    const asked: string[] = [];
    for (let index = 0; index < 16; index += 1) {
      const question = drawQuizQuestion(asked, () => 0);
      expect(question).not.toBeNull();
      expect(question!.correctChoice).toBeGreaterThanOrEqual(0);
      expect(question!.correctChoice).toBeLessThan(4);
      asked.push(question!.id);
    }
    expect(drawQuizQuestion(asked)).toBeNull();
  });

  it("doubles winnings but caps the payout", () => {
    expect(doubledPayout(5)).toBe(10);
    expect(doubledPayout(1000)).toBe(1024);
  });
});
