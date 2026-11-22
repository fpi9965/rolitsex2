import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const rooms = mysqlTable("rooms", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  status: mysqlEnum("status", ["waiting", "active"]).notNull().default("waiting"),
  stage: int("stage").notNull().default(1),
  turnPlayerId: bigint("turn_player_id", { mode: "number", unsigned: true }),
  currentCard: int("current_card"),
  pools: text("pools").notNull(),
  used: text("used").notNull(),
  history: text("history").notNull(),
  heat: int("heat").notNull().default(12),
  streak: int("streak").notNull().default(0),
  completedCards: int("completed_cards").notNull().default(0),
  secretStatus: mysqlEnum("secret_status", ["none", "writing", "countdown"])
    .notNull()
    .default("none"),
  secretPrompt: int("secret_prompt"),
  secretAnswers: text("secret_answers").notNull(),
  secretHistory: text("secret_history").notNull(),
  secretRevealAt: timestamp("secret_reveal_at"),
  version: int("version").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const players = mysqlTable(
  "players",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    roomId: bigint("room_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 20 }).notNull(),
    gender: mysqlEnum("gender", ["مذكر", "مؤنث"]).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    roomGenderUnique: uniqueIndex("players_room_gender_unique").on(table.roomId, table.gender),
  }),
);

export type Room = typeof rooms.$inferSelect;
export type Player = typeof players.$inferSelect;
