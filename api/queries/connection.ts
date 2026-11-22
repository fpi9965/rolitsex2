import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { mysqlOptions } from "../lib/dbConfig";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    instance = drizzle({
      client: mysql.createPool(mysqlOptions(env.databaseUrl)),
      mode: "planetscale",
      schema: fullSchema,
    });
  }
  return instance;
}
