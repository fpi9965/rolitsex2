import { describe, expect, it } from "vitest";
import { masterStages } from "@contracts/cards";
import { secretPrompts } from "@contracts/secret";

const forbiddenReverseWording = [
  /مؤخرة\s+زوجك/,
  /مؤخرته/,
  /شرج\s+زوجك/,
  /شرجه/,
  /ردف(?:ي|يِ)?\s+زوجك/,
];

describe("مكتبة البطاقات", () => {
  it("تحافظ على المراحل والأعداد المعتمدة", () => {
    expect(Object.values(masterStages).map((cards) => cards.length)).toEqual([58, 59, 54, 17]);
  });

  it("تحتوي كل بطاقة على صياغتين واضحتين", () => {
    for (const cards of Object.values(masterStages)) {
      for (const card of cards) {
        expect(card.مذكر.trim().length).toBeGreaterThan(0);
        expect(card.مؤنث.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("تمنح الإضافات الجديدة كل جهاز نصاً مختلفاً وغير مكرر", () => {
    for (const cards of Object.values(masterStages)) {
      const additions = cards.slice(-8);
      expect(additions).toHaveLength(8);
      expect(new Set(additions.map((card) => card.مذكر)).size).toBe(8);
      expect(new Set(additions.map((card) => card.مؤنث)).size).toBe(8);
      for (const card of additions) expect(card.مذكر).not.toEqual(card.مؤنث);
    }
  });

  it("لا تطلب من الزوجة مداعبة مؤخرة الزوج أو شرجه", () => {
    const allCards = Object.values(masterStages).flat();
    for (const card of allCards) {
      for (const pattern of forbiddenReverseWording) {
        expect(card.مؤنث).not.toMatch(pattern);
      }
    }
    for (const prompts of Object.values(secretPrompts)) {
      for (const prompt of prompts) {
        expect(prompt.مؤنث).not.toMatch(/مؤخر|شرج|ردف/);
        expect(prompt.مذكر).not.toMatch(/مؤخر|شرج|ردف/);
      }
    }
  });
});
