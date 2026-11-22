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
    expect(Object.values(masterStages).map((cards) => cards.length)).toEqual([49, 50, 45, 8]);
  });

  it("تحتوي كل بطاقة على صياغتين واضحتين", () => {
    for (const cards of Object.values(masterStages)) {
      for (const card of cards) {
        expect(card.مذكر.trim().length).toBeGreaterThan(0);
        expect(card.مؤنث.trim().length).toBeGreaterThan(0);
      }
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
