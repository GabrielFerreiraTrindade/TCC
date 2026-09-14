import { describe, expect, it } from "vitest";
import { calculatePoints, speedMultiplier, BASE_POINTS } from "./scoring";

describe("speedMultiplier", () => {
  it("gives the maximum multiplier for an instant answer", () => {
    expect(speedMultiplier(0, 30)).toBeCloseTo(2.0);
  });

  it("gives the minimum multiplier when the full time limit is used", () => {
    expect(speedMultiplier(30_000, 30)).toBeCloseTo(0.5);
  });

  it("clamps the multiplier when the answer takes longer than the limit", () => {
    expect(speedMultiplier(90_000, 30)).toBeCloseTo(0.5);
  });

  it("is linear at the midpoint", () => {
    expect(speedMultiplier(15_000, 30)).toBeCloseTo(1.25);
  });
});

describe("calculatePoints", () => {
  it("awards zero points for a wrong answer regardless of speed", () => {
    expect(calculatePoints({ difficulty: "avancado", isCorrect: false, timeTakenMs: 0, timeLimitSeconds: 30 })).toBe(0);
  });

  it("awards more points for harder questions answered correctly", () => {
    const iniciante = calculatePoints({ difficulty: "iniciante", isCorrect: true, timeTakenMs: 15_000, timeLimitSeconds: 30 });
    const avancado = calculatePoints({ difficulty: "avancado", isCorrect: true, timeTakenMs: 15_000, timeLimitSeconds: 30 });
    expect(avancado).toBeGreaterThan(iniciante);
  });

  it("awards more points for a faster correct answer than a slower one at the same difficulty", () => {
    const fast = calculatePoints({ difficulty: "intermediario", isCorrect: true, timeTakenMs: 1_000, timeLimitSeconds: 40 });
    const slow = calculatePoints({ difficulty: "intermediario", isCorrect: true, timeTakenMs: 39_000, timeLimitSeconds: 40 });
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThan(0);
  });

  it("caps the fastest correct answer at base points * 2", () => {
    expect(calculatePoints({ difficulty: "iniciante", isCorrect: true, timeTakenMs: 0, timeLimitSeconds: 30 })).toBe(
      BASE_POINTS.iniciante * 2,
    );
  });
});
