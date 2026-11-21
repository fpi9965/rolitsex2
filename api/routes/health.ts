import { Hono } from "hono";
import { rooms } from "@db/schema";
import { getDb } from "../queries/connection";
import { log } from "../lib/logger";

export const healthRoutes = new Hono();

healthRoutes.get("/", async c => {
  c.header("Cache-Control", "no-store");

  try {
    // A real read verifies both the server bundle and the platform database.
    await getDb().select({ id: rooms.id }).from(rooms).limit(1);

    return c.json({
      ok: true,
      service: "rolit",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error("health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json({ ok: false, error: "Service Unavailable" }, 503);
  }
});
