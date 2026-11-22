import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

function sameSecret(actual: string, expected: string): boolean {
  const left = createHash("sha256").update(actual).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function validPrivateAccess(header: string | undefined, username: string, password: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  try {
    const raw = Buffer.from(header.slice(6), "base64").toString("utf8");
    const colon = raw.indexOf(":");
    if (colon < 0) return false;
    return sameSecret(raw.slice(0, colon), username) && sameSecret(raw.slice(colon + 1), password);
  } catch {
    return false;
  }
}

export function privateAccess(): MiddlewareHandler {
  const username = process.env.ACCESS_USERNAME || "player";
  const password = process.env.ACCESS_PASSWORD;
  if (process.env.NODE_ENV === "production" && (!password || password.length < 16)) {
    throw new Error("ACCESS_PASSWORD must be set to at least 16 characters in production");
  }
  return async (c, next) => {
    // Hosting health probes must work without browser credentials.
    if (c.req.path === "/api/health" || c.req.path === "/api/health/") return next();
    if (!password || validPrivateAccess(c.req.header("authorization"), username, password)) {
      await next();
      return;
    }
    c.header("WWW-Authenticate", 'Basic realm="Private Couples Game", charset="UTF-8"');
    c.header("Cache-Control", "no-store");
    return c.text("Authentication required", 401);
  };
}
