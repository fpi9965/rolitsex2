import mysql from "mysql2/promise";
import { log } from "./logger";
import { mysqlOptions } from "./dbConfig";

// The server creates its own tables at startup, so a fresh hosted MySQL works
// without anyone running `drizzle-kit push` from a terminal. Every statement is
// idempotent: safe on an empty database, on an existing one, and on every boot.
// Keep in step with db/schema.ts.

const CREATE_ROOMS = `CREATE TABLE IF NOT EXISTS \`rooms\` (
  \`id\` bigint unsigned AUTO_INCREMENT NOT NULL,
  \`code\` varchar(8) NOT NULL,
  \`status\` enum('waiting','active') NOT NULL DEFAULT 'waiting',
  \`stage\` int NOT NULL DEFAULT 1,
  \`turn_player_id\` bigint unsigned NULL,
  \`current_card\` int NULL,
  \`pools\` text NOT NULL,
  \`used\` text NOT NULL,
  \`history\` text NOT NULL,
  \`heat\` int NOT NULL DEFAULT 12,
  \`streak\` int NOT NULL DEFAULT 0,
  \`completed_cards\` int NOT NULL DEFAULT 0,
  \`secret_status\` enum('none','writing','countdown') NOT NULL DEFAULT 'none',
  \`secret_prompt\` int NULL,
  \`secret_answers\` text NOT NULL,
  \`secret_history\` text NOT NULL,
  \`secret_reveal_at\` timestamp NULL,
  \`version\` int NOT NULL DEFAULT 0,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`rooms_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`rooms_code_unique\` UNIQUE(\`code\`)
) DEFAULT CHARSET=utf8mb4`;

const CREATE_PLAYERS = `CREATE TABLE IF NOT EXISTS \`players\` (
  \`id\` bigint unsigned AUTO_INCREMENT NOT NULL,
  \`room_id\` bigint unsigned NOT NULL,
  \`name\` varchar(20) NOT NULL,
  \`gender\` enum('مذكر','مؤنث') NOT NULL,
  \`token_hash\` varchar(64) NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT \`players_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`players_token_hash_unique\` UNIQUE(\`token_hash\`),
  CONSTRAINT \`players_room_gender_unique\` UNIQUE(\`room_id\`,\`gender\`),
  CONSTRAINT \`players_room_id_rooms_id_fk\` FOREIGN KEY (\`room_id\`)
    REFERENCES \`rooms\`(\`id\`) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4`;

// Columns added after the first release (migration 0000_secret_rounds). An older
// database that predates them is upgraded in place, without losing rooms.
const LATER_ROOM_COLUMNS: [string, string][] = [
  ["heat", "int NOT NULL DEFAULT 12"],
  ["streak", "int NOT NULL DEFAULT 0"],
  ["completed_cards", "int NOT NULL DEFAULT 0"],
  ["secret_status", "enum('none','writing','countdown') NOT NULL DEFAULT 'none'"],
  ["secret_prompt", "int NULL"],
  ["secret_answers", "text NOT NULL"],
  ["secret_history", "text NOT NULL"],
  ["secret_reveal_at", "timestamp NULL"],
];

export async function ensureSchema(databaseUrl: string): Promise<void> {
  const connection = await mysql.createConnection(mysqlOptions(databaseUrl));
  try {
    await connection.query(CREATE_ROOMS);
    await connection.query(CREATE_PLAYERS);
    const [rows] = await connection.query(
      "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'",
    );
    const existing = new Set((rows as { name: string }[]).map(r => r.name));
    for (const [name, definition] of LATER_ROOM_COLUMNS) {
      if (existing.has(name)) continue;
      await connection.query(`ALTER TABLE \`rooms\` ADD COLUMN \`${name}\` ${definition}`);
      log.info("schema: added column", { table: "rooms", column: name });
    }
  } finally {
    await connection.end();
  }
}

// A hosted database can come up a few seconds after the app; retry instead of
// failing the first boot.
export async function ensureSchemaWithRetry(databaseUrl: string, attempts = 10): Promise<boolean> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await ensureSchema(databaseUrl);
      log.info("schema ready");
      return true;
    } catch (error) {
      log.error("schema setup failed", {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt < attempts) await new Promise(r => setTimeout(r, 3000));
    }
  }
  return false;
}
