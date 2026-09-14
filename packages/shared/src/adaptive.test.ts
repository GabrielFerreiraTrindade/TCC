import { describe, expect, it } from "vitest";
import { suggestNextLevel, suggestStartingLevel } from "./adaptive";

describe("suggestStartingLevel", () => {
  it("recommends avançado when diagnostic accuracy on hard questions is high", () => {
    expect(suggestStartingLevel({ iniciante: 1, intermediario: 0.9, avancado: 0.75 })).toBe("avancado");
  });

  it("recommends intermediário when only mid-level accuracy is strong", () => {
    expect(suggestStartingLevel({ iniciante: 1, intermediario: 0.66, avancado: 0.2 })).toBe("intermediario");
  });

  it("recommends iniciante when accuracy is low across the board", () => {
    expect(suggestStartingLevel({ iniciante: 0.4, intermediario: 0.2, avancado: 0 })).toBe("iniciante");
  });
});

describe("suggestNextLevel", () => {
  it("promotes after a strong session", () => {
    expect(suggestNextLevel("iniciante", 0.9)).toBe("intermediario");
  });

  it("does not promote past avançado", () => {
    expect(suggestNextLevel("avancado", 1)).toBe("avancado");
  });

  it("demotes after a weak session", () => {
    expect(suggestNextLevel("intermediario", 0.2)).toBe("iniciante");
  });

  it("does not demote below iniciante", () => {
    expect(suggestNextLevel("iniciante", 0)).toBe("iniciante");
  });

  it("keeps the current level in the middle range", () => {
    expect(suggestNextLevel("intermediario", 0.6)).toBe("intermediario");
  });
});
