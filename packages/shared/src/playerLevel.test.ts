import { describe, expect, it } from "vitest";
import { getPlayerLevel } from "./playerLevel";

describe("getPlayerLevel", () => {
  it("starts at level 1 with zero points", () => {
    const info = getPlayerLevel(0);
    expect(info.level).toBe(1);
    expect(info.pointsIntoLevel).toBe(0);
    expect(info.pointsForNextLevel).toBe(100);
    expect(info.progress).toBe(0);
  });

  it("stays level 1 just below the level-2 threshold", () => {
    expect(getPlayerLevel(99).level).toBe(1);
  });

  it("reaches level 2 exactly at 100 points", () => {
    const info = getPlayerLevel(100);
    expect(info.level).toBe(2);
    expect(info.pointsIntoLevel).toBe(0);
  });

  it("reaches level 3 at 300 points (level thresholds grow by 100 each level)", () => {
    expect(getPlayerLevel(299).level).toBe(2);
    expect(getPlayerLevel(300).level).toBe(3);
  });

  it("reaches level 5 at 1000 points", () => {
    expect(getPlayerLevel(1000).level).toBe(5);
  });

  it("computes progress fraction toward the next level", () => {
    // level 2 starts at 100, level 3 at 300 -> span of 200
    const info = getPlayerLevel(200);
    expect(info.level).toBe(2);
    expect(info.pointsIntoLevel).toBe(100);
    expect(info.pointsForNextLevel).toBe(200);
    expect(info.progress).toBeCloseTo(0.5);
  });

  it("never returns a level below 1 for negative input", () => {
    expect(getPlayerLevel(-50).level).toBe(1);
  });
});
