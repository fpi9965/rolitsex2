import { createHash, randomBytes, randomInt } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { masterStages, type Gender } from "@contracts/cards";
import { players, rooms, type Player, type Room } from "@db/schema";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";

const STAGE_LIMITS: Record<number, number> = { 1: 8, 2: 8, 3: 8, 4: 1 };
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genderSchema = z.enum(["مذكر", "مؤنث"]);
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/, "رمز الغرفة غير صحيح");
const nameSchema = z.string().trim().min(1, "اكتب اسمك").max(20, "الاسم طويل");
const sessionSchema = z.object({ code: codeSchema, token: z.string().length(64) });
const actionSchema = sessionSchema.extend({ version: z.number().int().nonnegative() });

type NumberMap = Record<string, number[]>;
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function emptyMap(): NumberMap {
  return { "1": [], "2": [], "3": [], "4": [] };
}

function parseMap(value: string): NumberMap {
  try {
    const parsed = JSON.parse(value) as NumberMap;
    for (const stage of [1, 2, 3, 4]) {
      if (!Array.isArray(parsed[String(stage)])) return emptyMap();
    }
    return parsed;
  } catch {
    return emptyMap();
  }
}

function shuffle(values: number[]): number[] {
  for (let i = values.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

function buildPools(history: NumberMap): NumberMap {
  const pools = emptyMap();
  for (const stage of [1, 2, 3, 4]) {
    const count = masterStages[stage].length;
    const limit = Math.min(STAGE_LIMITS[stage], count);
    let candidates = Array.from({ length: count }, (_, i) => i).filter(
      (i) => !history[String(stage)].includes(i),
    );
    if (candidates.length < limit) {
      history[String(stage)] = [];
      candidates = Array.from({ length: count }, (_, i) => i);
    }
    pools[String(stage)] = shuffle(candidates).slice(0, limit);
  }
  return pools;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

async function findRoom(code: string, db: Db | Tx = getDb(), lock = false): Promise<Room> {
  let query = db.select().from(rooms).where(eq(rooms.code, code)).limit(1).$dynamic();
  if (lock) query = query.for("update");
  const [room] = await query;
  if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "الغرفة غير موجودة" });
  return room;
}

async function findPlayers(roomId: number, db: Db | Tx = getDb()): Promise<Player[]> {
  return db.select().from(players).where(eq(players.roomId, roomId));
}

function authenticatedPlayer(roomPlayers: Player[], token: string): Player {
  const me = roomPlayers.find((player) => player.tokenHash === hashToken(token));
  if (!me) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "تعذّر التعرّف على هذا الجهاز" });
  }
  return me;
}

async function getSession(input: z.infer<typeof sessionSchema>, db: Db | Tx = getDb(), lock = false) {
  const room = await findRoom(input.code, db, lock);
  const roomPlayers = await findPlayers(room.id, db);
  const me = authenticatedPlayer(roomPlayers, input.token);
  return { room, roomPlayers, me };
}

function roomState(room: Room, roomPlayers: Player[], me: Player) {
  const used = parseMap(room.used);
  const pools = parseMap(room.pools);
  const partner = roomPlayers.find((player) => player.id !== me.id) ?? null;
  const turnPlayer = roomPlayers.find((player) => player.id === room.turnPlayerId) ?? null;
  const card = room.currentCard === null ? null : masterStages[room.stage]?.[room.currentCard];
  return {
    code: room.code,
    status: room.status,
    stage: room.stage,
    version: room.version,
    remaining: Math.max(0, pools[String(room.stage)].length - used[String(room.stage)].length),
    slots: pools[String(room.stage)].map((index) => ({ used: used[String(room.stage)].includes(index) })),
    me: { id: me.id, name: me.name, gender: me.gender, isTurn: turnPlayer?.id === me.id },
    partner: partner ? { name: partner.name, gender: partner.gender } : null,
    card: card && turnPlayer ? {
      text: card[me.gender as Gender],
      forName: turnPlayer.name,
      slot: pools[String(room.stage)].indexOf(room.currentCard ?? -1),
    } : null,
  };
}

function assertTurn(room: Room, me: Player, version: number) {
  if (room.status !== "active") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "بانتظار انضمام الطرف الآخر" });
  }
  if (room.turnPlayerId !== me.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "الدور على الطرف الآخر" });
  }
  if (room.version !== version) {
    throw new TRPCError({ code: "CONFLICT", message: "تغيّرت الغرفة؛ انتظر لحظة وحاول مجدداً" });
  }
}

export const roomRouter = createRouter({
  create: publicQuery
    .input(z.object({ name: nameSchema, gender: genderSchema }))
    .mutation(async ({ input }) => {
      const db = getDb();
      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = makeCode();
        const existing = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, candidate)).limit(1);
        if (!existing.length) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر إنشاء الغرفة" });

      const token = randomBytes(32).toString("hex");
      const history = emptyMap();
      const pools = buildPools(history);
      await db.transaction(async (tx) => {
        const [{ id: roomId }] = await tx
          .insert(rooms)
          .values({ code, pools: JSON.stringify(pools), used: JSON.stringify(emptyMap()), history: JSON.stringify(history) })
          .$returningId();
        const [{ id: playerId }] = await tx
          .insert(players)
          .values({ roomId, name: input.name, gender: input.gender, tokenHash: hashToken(token) })
          .$returningId();
        await tx.update(rooms).set({ turnPlayerId: playerId }).where(eq(rooms.id, roomId));
      });
      return { code, token };
    }),

  join: publicQuery
    .input(z.object({ code: codeSchema, name: nameSchema, gender: genderSchema }))
    .mutation(async ({ input }) => {
      const token = randomBytes(32).toString("hex");
      await getDb().transaction(async (tx) => {
        const room = await findRoom(input.code, tx, true);
        const roomPlayers = await findPlayers(room.id, tx);
        if (roomPlayers.length >= 2) {
          throw new TRPCError({ code: "CONFLICT", message: "هذه الغرفة مكتملة بلاعبين" });
        }
        if (roomPlayers.some((player) => player.gender === input.gender)) {
          throw new TRPCError({ code: "CONFLICT", message: "اختاري الجنس الآخر؛ هذا الجنس مسجّل في الغرفة" });
        }
        await tx.insert(players).values({
          roomId: room.id,
          name: input.name,
          gender: input.gender,
          tokenHash: hashToken(token),
        });
        await tx.update(rooms).set({ status: "active", version: room.version + 1 }).where(eq(rooms.id, room.id));
      });
      return { code: input.code, token };
    }),

  state: publicQuery.input(sessionSchema).query(async ({ input }) => {
    const { room, roomPlayers, me } = await getSession(input);
    return roomState(room, roomPlayers, me);
  }),

  spin: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me, input.version);
      if (room.currentCard !== null) {
        throw new TRPCError({ code: "CONFLICT", message: "هناك بطاقة ظاهرة بالفعل" });
      }
      const pools = parseMap(room.pools);
      const used = parseMap(room.used);
      const stageKey = String(room.stage);
      const candidates = pools[stageKey].filter((index) => !used[stageKey].includes(index));
      if (!candidates.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "انتهت بطاقات هذه المرحلة" });
      }
      const chosen = candidates[randomInt(candidates.length)];
      await tx
        .update(rooms)
        .set({ currentCard: chosen, version: room.version + 1 })
        .where(eq(rooms.id, room.id));
      return roomState({ ...room, currentCard: chosen, version: room.version + 1 }, roomPlayers, me);
    });
  }),

  done: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me, input.version);
      if (room.currentCard === null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد بطاقة لإتمامها" });
      }
      const used = parseMap(room.used);
      const history = parseMap(room.history);
      const stageKey = String(room.stage);
      if (!used[stageKey].includes(room.currentCard)) used[stageKey].push(room.currentCard);
      if (!history[stageKey].includes(room.currentCard)) history[stageKey].push(room.currentCard);
      const partner = roomPlayers.find((player) => player.id !== me.id);
      if (!partner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الطرف الآخر غير موجود" });
      await tx
        .update(rooms)
        .set({
          currentCard: null,
          used: JSON.stringify(used),
          history: JSON.stringify(history),
          turnPlayerId: partner.id,
          version: room.version + 1,
        })
        .where(eq(rooms.id, room.id));
      return roomState(
        { ...room, currentCard: null, used: JSON.stringify(used), history: JSON.stringify(history), turnPlayerId: partner.id, version: room.version + 1 },
        roomPlayers,
        me,
      );
    });
  }),

  skip: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me, input.version);
      if (room.currentCard === null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد بطاقة لتخطّيها" });
      }
      const pools = parseMap(room.pools);
      const used = parseMap(room.used);
      const history = parseMap(room.history);
      const stageKey = String(room.stage);
      if (!used[stageKey].includes(room.currentCard)) used[stageKey].push(room.currentCard);
      const replacements = masterStages[room.stage]
        .map((_, index) => index)
        .filter((index) => !pools[stageKey].includes(index) && !history[stageKey].includes(index));
      if (replacements.length) pools[stageKey].push(replacements[randomInt(replacements.length)]);
      await tx
        .update(rooms)
        .set({
          currentCard: null,
          pools: JSON.stringify(pools),
          used: JSON.stringify(used),
          version: room.version + 1,
        })
        .where(eq(rooms.id, room.id));
      return roomState(
        { ...room, currentCard: null, pools: JSON.stringify(pools), used: JSON.stringify(used), version: room.version + 1 },
        roomPlayers,
        me,
      );
    });
  }),

  nextStage: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me, input.version);
      const stage = room.stage === 4 ? 1 : room.stage + 1;
      await tx
        .update(rooms)
        .set({ stage, currentCard: null, version: room.version + 1 })
        .where(and(eq(rooms.id, room.id), eq(rooms.version, input.version)));
      return roomState({ ...room, stage, currentCard: null, version: room.version + 1 }, roomPlayers, me);
    });
  }),
});
