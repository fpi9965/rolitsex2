import { describe, expect, it } from "vitest";
import { buildInvitationUrl, isPrivatePreviewHost } from "@contracts/invitation";

const previewLocation = {
  hostname: "statics.kimi.ai",
  origin: "https://statics.kimi.ai",
  pathname: "/private-preview/",
};

describe("روابط الدعوة", () => {
  it("لا ترسل رابط معاينة Kimi الخاص إلى الجهاز الآخر", () => {
    const invite = buildInvitationUrl("ABC234", previewLocation);
    expect(invite).toBe("https://u5walep5vxzzu.kimi.place/?join=ABC234");
    expect(invite).not.toContain("statics.kimi.ai");
    expect(invite).not.toContain("token");
  });

  it("يتعرف على نطاقات المعاينة دون اعتبار النشر العام خاصاً", () => {
    expect(isPrivatePreviewHost("statics.kimi.ai")).toBe(true);
    expect(isPrivatePreviewHost("kimi.ai")).toBe(true);
    expect(isPrivatePreviewHost("u5walep5vxzzu.kimi.place")).toBe(false);
    expect(isPrivatePreviewHost("example.ok.kimi.link")).toBe(false);
  });

  it("يستخدم الدومين العام الحالي عند فتح النسخة المنشورة", () => {
    expect(buildInvitationUrl("ABC234", {
      hostname: "game.ok.kimi.link",
      origin: "https://game.ok.kimi.link",
      pathname: "/",
    })).toBe("https://game.ok.kimi.link/?join=ABC234");
  });

  it("يدعم تغيير الرابط العام من الإعدادات ويزيل الشرطات الزائدة", () => {
    expect(buildInvitationUrl("ABC234", previewLocation, "https://example.com///")).toBe(
      "https://example.com/?join=ABC234",
    );
  });

  it("يحافظ على معاملات رابط النشر ويستبدل رمز الدعوة القديم", () => {
    expect(buildInvitationUrl("ABC234", previewLocation, "https://example.com/play?lang=ar&join=OLD234#top"))
      .toBe("https://example.com/play/?lang=ar&join=ABC234");
  });

  it("يحافظ على روابط الاختبار المحلية", () => {
    expect(buildInvitationUrl("ABC234", {
      hostname: "localhost",
      origin: "http://localhost:3100",
      pathname: "/",
    })).toBe("http://localhost:3100/?join=ABC234");
  });
});
