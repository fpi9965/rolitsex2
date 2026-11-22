import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    const ca = process.env.MYSQL_CA_CERT?.replace(/\\n/g, "\n");
    if (ca) {
      // Aiven TLS certificate: verify the server instead of disabling verification.
      const pool = mysql.createPool({
        uri: env.databaseUrl,
        ssl: { ca, rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
      });
      instance = drizzle(pool, { mode: "planetscale", schema: fullSchema });
    } else {
      instance = drizzle(env.databaseUrl, { mode: "planetscale", schema: fullSchema });
    }
  }
  return instance;
}
