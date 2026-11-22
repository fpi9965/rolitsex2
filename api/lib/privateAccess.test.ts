import { describe, expect, it } from "vitest";
import { validPrivateAccess } from "./privateAccess";

const auth = (value: string) => "Basic " + Buffer.from(value).toString("base64");
describe("private deployment access", () => {
  it("accepts correct credentials", () => {
    expect(validPrivateAccess(auth("player:very-long-secret-password"), "player", "very-long-secret-password")).toBe(true);
  });
  it("rejects missing, malformed, and wrong credentials", () => {
    expect(validPrivateAccess(undefined, "player", "password")).toBe(false);
    expect(validPrivateAccess("Bearer token", "player", "password")).toBe(false);
    expect(validPrivateAccess(auth("player:wrong"), "player", "password")).toBe(false);
    expect(validPrivateAccess(auth("wrong:password"), "player", "password")).toBe(false);
    expect(validPrivateAccess(auth("invalid"), "player", "password")).toBe(false);
  });
  it("allows colons inside passwords", () => {
    expect(validPrivateAccess(auth("player:long:secret"), "player", "long:secret")).toBe(true);
  });
});
