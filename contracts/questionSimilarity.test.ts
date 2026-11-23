import { describe, expect, it } from "vitest";
import { similar, tokens, overlapsUsedCard, overlapsUsedSecret } from "./questionSimilarity";
import { masterStages } from "./cards";
import { secretPrompts } from "./secret";
describe("question similarity guard", () => {
  it("normalizes Arabic diacritics and letter variants", () => {
    expect([...tokens("إلى أَماكن آخرى")]).toEqual([...tokens("الي اماكن اخري")]);
  });
  it("detects near-identical prompts while ignoring filler words", () => {
    expect(similar("هل تحب الكلام الجريء المباشر اثناء العلاقة", "الكلام الجريء المباشر اثناء العلاقة")).toBe(true);
  });
  it("does not block unrelated prompts", () => {
    expect(similar("تحب الموسيقى الهادية والاضاءة الدافئة", "تفضل تجربة وضعية مختلفة في السرير")).toBe(false);
  });
  it("does not reoffer an identical used card", () => {
    expect(overlapsUsedCard(1, 0, {"1":[0]})).toBe(true);
  });
  it("does not reoffer an identical used secret", () => {
    expect(overlapsUsedSecret(1, 0, {"1":[0]})).toBe(true);
  });
  it("keeps original content untouched", () => {
    expect(masterStages[1][0]["مذكر"].length).toBeGreaterThan(0);
    expect(secretPrompts[1][0]["مؤنث"].length).toBeGreaterThan(0);
  });
});