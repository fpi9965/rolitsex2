import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { log } from "./logger";

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

// Off by default: the game is opened straight from the invite link, and rooms
// are already protected by their code and per-player session tokens. Setting
// ACCESS_PASSWORD adds a shared browser login on top. A missing or short
// password never stops the server from starting (that made the game unreachable).
export function privateAccess(): MiddlewareHandler {
  const username = process.env.ACCESS_USERNAME || "player";
  const password = process.env.ACCESS_PASSWORD || "";
  if (password && password.length < 16) {
    log.warn("ACCESS_PASSWORD is shorter than 16 characters; use a longer one");
  }
  return async (c, next) => {
    // Railway health probes must work without browser credentials.
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
