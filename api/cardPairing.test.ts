import { describe, expect, it } from "vitest";
import { masterStages, type Gender } from "@contracts/cards";
import { choosePartnerCardIndex } from "./cardPairing";

const genders: Gender[] = ["مذكر", "مؤنث"];

describe("اقتران بطاقتين مستقلتين للجهازين", () => {
  it("يمنح كل جهاز مصدراً ونصاً مختلفين في جميع المراحل والسحوبات", () => {
    for (const [stageKey, cards] of Object.entries(masterStages)) {
      const stage = Number(stageKey);
      const pool = cards.map((_, index) => index);
      for (const primaryIndex of pool) {
        for (const turnGender of genders) {
          const partnerGender: Gender = turnGender === "مذكر" ? "مؤنث" : "مذكر";
          const partnerIndex = choosePartnerCardIndex(stage, primaryIndex, pool, [], turnGender, partnerGender);
          expect(partnerIndex).not.toBeNull();
          expect(partnerIndex).not.toBe(primaryIndex);
          expect(cards[partnerIndex!][partnerGender]).not.toBe(cards[primaryIndex][turnGender]);
        }
      }
    }
  });

  it("يثبت البطاقة الثانية طوال عرض التحدي ويفضّل غير المستخدم", () => {
    const first = choosePartnerCardIndex(1, 0, [0, 1, 2], [1], "مذكر", "مؤنث");
    const second = choosePartnerCardIndex(1, 0, [0, 1, 2], [1], "مذكر", "مؤنث");
    expect(first).toBe(2);
    expect(second).toBe(first);
  });

  it("يجد بطاقة مستقلة حتى عندما لا يبقى في المجموعة سوى البطاقة الأساسية", () => {
    const partnerIndex = choosePartnerCardIndex(4, 0, [0], [0], "مؤنث", "مذكر");
    expect(partnerIndex).not.toBeNull();
    expect(partnerIndex).not.toBe(0);
  });
});
