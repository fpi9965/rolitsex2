import { createHash, randomBytes, randomInt } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { masterStages, type Gender } from "@contracts/cards";
import {
  ANSWER_HEAT,
  CARD_HEAT,
  SECRET_COUNTDOWN_MS,
  SKIP_HEAT,
  type RoomState,
} from "@contracts/game";
import { secretPrompts } from "@contracts/secret";
import { players, rooms, type Player, type Room } from "@db/schema";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";

const STAGE_IDS = [1, 2, 3, 4] as const;
const STAGE_LIMITS: Record<number, number> = { 1: 8, 2: 8, 3: 8, 4: 1 };
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const genderSchema = z.enum(["مذكر", "مؤنث"]);
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/, "رمز الغرفة غير صحيح");
const nameSchema = z.string().trim().min(1, "اكتب اسمك").max(20, "الاسم طويل");
const sessionSchema = z.object({ code: codeSchema, token: z.string().length(64) });
// الإصدار اختياري للتوافق مع النسخ السابقة، لكنه لا يُستخدم لرفض عملية صحيحة بسبب تأخر الشبكة.
const actionSchema = sessionSchema.extend({ version: z.number().int().nonnegative().optional() });
const answerSchema = actionSchema.extend({
  answer: z.string().trim().min(1, "اكتب إجابتك أولاً").max(300, "الإجابة طويلة؛ اختصرها إلى 300 حرف"),
});

type IndexMap = Record<string, number[]>;
type SecretAnswers = Record<string, string>;
type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function emptyIndexMap(): IndexMap {
  return { "1": [], "2": [], "3": [], "4": [] };
}

function parseIndexMap(value: string): IndexMap {
  const result = emptyIndexMap();
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return result;
    for (const stage of STAGE_IDS) {
      const entries = (parsed as Record<string, unknown>)[String(stage)];
      if (Array.isArray(entries)) {
        result[String(stage)] = [...new Set(entries.filter((item): item is number => Number.isInteger(item) && item >= 0))];
      }
    }
    return result;
  } catch {
    return result;
  }
}

function parseAnswers(value: string): SecretAnswers {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function shuffle(values: number[]): number[] {
  for (let index = values.length - 1; index > 0; index--) {
    const target = randomInt(index + 1);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function makeStagePool(stage: number, history: IndexMap): number[] {
  const key = String(stage);
  const count = masterStages[stage].length;
  const limit = Math.min(STAGE_LIMITS[stage], count);
  let candidates = Array.from({ length: count }, (_, index) => index).filter(
    (index) => !history[key].includes(index),
  );
  if (candidates.length < limit) {
    history[key] = [];
    candidates = Array.from({ length: count }, (_, index) => index);
  }
  return shuffle(candidates).slice(0, limit);
}

function buildPools(history: IndexMap): IndexMap {
  const pools = emptyIndexMap();
  for (const stage of STAGE_IDS) pools[String(stage)] = makeStagePool(stage, history);
  return pools;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

function isDuplicateEntry(error: unknown): boolean {
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate?.code === "ER_DUP_ENTRY" || candidate?.cause?.code === "ER_DUP_ENTRY";
}

async function findRoom(code: string, db: Db | Tx = getDb(), lock = false): Promise<Room> {
  let query = db.select().from(rooms).where(eq(rooms.code, code)).limit(1).$dynamic();
  if (lock) query = query.for("update");
  const [room] = await query;
  if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "الغرفة غير موجودة أو الرابط غير صحيح" });
  return room;
}

async function findPlayers(roomId: number, db: Db | Tx = getDb()): Promise<Player[]> {
  return db.select().from(players).where(eq(players.roomId, roomId)).orderBy(players.id);
}

function authenticatedPlayer(roomPlayers: Player[], token: string): Player {
  const tokenHash = hashToken(token);
  const me = roomPlayers.find((player) => player.tokenHash === tokenHash);
  if (!me) throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت صلاحية هذا الجهاز للغرفة" });
  return me;
}

async function getSession(input: z.infer<typeof sessionSchema>, db: Db | Tx = getDb(), lock = false) {
  const room = await findRoom(input.code, db, lock);
  const roomPlayers = await findPlayers(room.id, db);
  const me = authenticatedPlayer(roomPlayers, input.token);
  return { room, roomPlayers, me };
}

function prepareSecretRound(room: Room, completedCards: number) {
  if (completedCards % 2 !== 0) return {};
  const stageKey = String(room.stage);
  const history = parseIndexMap(room.secretHistory);
  const prompts = secretPrompts[room.stage];
  let used = history[stageKey];
  let candidates = prompts.map((_, index) => index).filter((index) => !used.includes(index));
  if (!candidates.length) {
    used = [];
    candidates = prompts.map((_, index) => index);
  }
  const prompt = candidates[randomInt(candidates.length)];
  history[stageKey] = [...used, prompt];
  return {
    secretStatus: "writing" as const,
    secretPrompt: prompt,
    secretAnswers: "{}",
    secretHistory: JSON.stringify(history),
    secretRevealAt: null,
  };
}

function toRoomState(room: Room, roomPlayers: Player[], me: Player): RoomState {
  const used = parseIndexMap(room.used);
  const pools = parseIndexMap(room.pools);
  const stageKey = String(room.stage);
  const partner = roomPlayers.find((player) => player.id !== me.id) ?? null;
  const turnPlayer = roomPlayers.find((player) => player.id === room.turnPlayerId) ?? null;
  const card = room.currentCard === null ? null : masterStages[room.stage]?.[room.currentCard];
  const answers = parseAnswers(room.secretAnswers);
  const prompt = room.secretPrompt === null ? null : secretPrompts[room.stage]?.[room.secretPrompt];
  const revealAt = room.secretRevealAt?.getTime() ?? null;
  const serverTime = Date.now();
  const revealed = room.secretStatus === "countdown" && revealAt !== null && serverTime >= revealAt;
  const secret = room.secretStatus !== "none" && prompt && partner ? {
    id: Math.floor(room.completedCards / 2),
    status: revealed ? "revealed" as const : room.secretStatus === "countdown" ? "countdown" as const : "writing" as const,
    title: prompt.title,
    question: prompt[me.gender as Gender],
    partnerQuestion: revealed ? prompt[partner.gender as Gender] : null,
    myAnswer: answers[String(me.id)] ?? null,
    partnerAnswer: revealed ? answers[String(partner.id)] ?? null : null,
    mySubmitted: Boolean(answers[String(me.id)]),
    partnerSubmitted: Boolean(answers[String(partner.id)]),
    revealAt,
  } : null;
  const usedInPool = pools[stageKey].filter((index) => used[stageKey].includes(index)).length;

  return {
    code: room.code,
    status: room.status,
    stage: room.stage,
    version: room.version,
    serverTime,
    heat: room.heat,
    streak: room.streak,
    secretIn: 2 - (room.completedCards % 2),
    remaining: Math.max(0, pools[stageKey].length - usedInPool),
    slots: pools[stageKey].map((index) => ({ used: used[stageKey].includes(index) })),
    me: { id: me.id, name: me.name, gender: me.gender, isTurn: turnPlayer?.id === me.id },
    partner: partner ? { name: partner.name, gender: partner.gender } : null,
    card: card && turnPlayer ? {
      text: card[turnPlayer.gender as Gender],
      forName: turnPlayer.name,
      slot: pools[stageKey].indexOf(room.currentCard ?? -1),
    } : null,
    secret,
  };
}

function assertActive(room: Room) {
  if (room.status !== "active") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "بانتظار انضمام الطرف الآخر" });
  }
}

function assertTurn(room: Room, me: Player) {
  assertActive(room);
  if (room.secretStatus !== "none") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أكملا جولة الإجابات السرية أولاً" });
  }
  if (room.turnPlayerId !== me.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "الدور على الطرف الآخر" });
  }
}

function nextStageData(room: Room) {
  const stage = room.stage === 4 ? 1 : room.stage + 1;
  const key = String(stage);
  const pools = parseIndexMap(room.pools);
  const used = parseIndexMap(room.used);
  const history = parseIndexMap(room.history);
  const hasRemaining = pools[key].some((index) => !used[key].includes(index));
  if (!hasRemaining) {
    pools[key] = makeStagePool(stage, history);
    used[key] = [];
  }
  return { stage, currentCard: null, pools: JSON.stringify(pools), used: JSON.stringify(used), history: JSON.stringify(history) };
}

export const roomRouter = createRouter({
  preview: publicQuery.input(z.object({ code: codeSchema })).query(async ({ input }) => {
    const room = await findRoom(input.code);
    const roomPlayers = await findPlayers(room.id);
    return {
      code: room.code,
      status: room.status,
      playerCount: roomPlayers.length,
      takenGenders: roomPlayers.map((player) => player.gender as Gender),
    };
  }),

  create: publicQuery
    .input(z.object({ name: nameSchema, gender: genderSchema }))
    .mutation(async ({ input }) => {
      const db = getDb();
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = makeCode();
        const token = randomBytes(32).toString("hex");
        const history = emptyIndexMap();
        const pools = buildPools(history);
        try {
          await db.transaction(async (tx) => {
            const [{ id: roomId }] = await tx.insert(rooms).values({
              code,
              pools: JSON.stringify(pools),
              used: JSON.stringify(emptyIndexMap()),
              history: JSON.stringify(history),
              secretAnswers: "{}",
              secretHistory: "{}",
            }).$returningId();
            const [{ id: playerId }] = await tx.insert(players).values({
              roomId,
              name: input.name,
              gender: input.gender,
              tokenHash: hashToken(token),
            }).$returningId();
            await tx.update(rooms).set({ turnPlayerId: playerId }).where(eq(rooms.id, roomId));
          });
          return { code, token };
        } catch (error) {
          if (!isDuplicateEntry(error)) throw error;
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذّر إنشاء رمز فريد؛ حاول مرة أخرى" });
    }),

  join: publicQuery
    .input(z.object({ code: codeSchema, name: nameSchema, gender: genderSchema }))
    .mutation(async ({ input }) => {
      const token = randomBytes(32).toString("hex");
      await getDb().transaction(async (tx) => {
        const room = await findRoom(input.code, tx, true);
        const roomPlayers = await findPlayers(room.id, tx);
        if (roomPlayers.length >= 2) {
          throw new TRPCError({ code: "CONFLICT", message: "هذه الغرفة مكتملة. استعن بالجهاز الذي دخل منه سابقاً" });
        }
        if (roomPlayers.some((player) => player.gender === input.gender)) {
          throw new TRPCError({ code: "CONFLICT", message: "هذا الجنس مسجّل في الغرفة؛ اختر الجنس الآخر" });
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
    return toRoomState(room, roomPlayers, me);
  }),

  spin: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me);
      if (room.currentCard !== null) {
        return toRoomState(room, roomPlayers, me);
      }
      const pools = parseIndexMap(room.pools);
      const used = parseIndexMap(room.used);
      const stageKey = String(room.stage);
      const candidates = pools[stageKey].filter((index) => !used[stageKey].includes(index));
      if (!candidates.length) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "انتهت بطاقات هذه المرحلة" });
      }
      const chosen = candidates[randomInt(candidates.length)];
      const patch = { currentCard: chosen, version: room.version + 1 };
      await tx.update(rooms).set(patch).where(eq(rooms.id, room.id));
      return toRoomState({ ...room, ...patch }, roomPlayers, me);
    });
  }),

  done: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me);
      if (room.currentCard === null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد بطاقة لإتمامها" });
      }
      const used = parseIndexMap(room.used);
      const history = parseIndexMap(room.history);
      const stageKey = String(room.stage);
      if (!used[stageKey].includes(room.currentCard)) used[stageKey].push(room.currentCard);
      if (!history[stageKey].includes(room.currentCard)) history[stageKey].push(room.currentCard);
      const partner = roomPlayers.find((player) => player.id !== me.id);
      if (!partner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الطرف الآخر غير موجود" });
      const completedCards = room.completedCards + 1;
      const patch = {
        currentCard: null,
        used: JSON.stringify(used),
        history: JSON.stringify(history),
        turnPlayerId: partner.id,
        completedCards,
        heat: Math.min(100, room.heat + CARD_HEAT),
        streak: room.streak + 1,
        ...prepareSecretRound(room, completedCards),
        version: room.version + 1,
      };
      await tx.update(rooms).set(patch).where(eq(rooms.id, room.id));
      return toRoomState({ ...room, ...patch }, roomPlayers, me);
    });
  }),

  skip: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me);
      if (room.currentCard === null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا توجد بطاقة لتخطّيها" });
      }
      const pools = parseIndexMap(room.pools);
      const used = parseIndexMap(room.used);
      const history = parseIndexMap(room.history);
      const stageKey = String(room.stage);
      if (!used[stageKey].includes(room.currentCard)) used[stageKey].push(room.currentCard);
      const replacements = masterStages[room.stage]
        .map((_, index) => index)
        .filter((index) => !pools[stageKey].includes(index) && !history[stageKey].includes(index));
      if (replacements.length) pools[stageKey].push(replacements[randomInt(replacements.length)]);
      const patch = {
        currentCard: null,
        pools: JSON.stringify(pools),
        used: JSON.stringify(used),
        heat: Math.max(0, room.heat - SKIP_HEAT),
        streak: 0,
        version: room.version + 1,
      };
      await tx.update(rooms).set(patch).where(eq(rooms.id, room.id));
      return toRoomState({ ...room, ...patch }, roomPlayers, me);
    });
  }),

  submitAnswer: publicQuery.input(answerSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertActive(room);
      if (room.secretStatus !== "writing") {
        throw new TRPCError({ code: "CONFLICT", message: "انتهى وقت إدخال الإجابات" });
      }
      const answers = parseAnswers(room.secretAnswers);
      if (answers[String(me.id)]) return toRoomState(room, roomPlayers, me);
      const partner = roomPlayers.find((player) => player.id !== me.id);
      if (!partner) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الطرف الآخر غير موجود" });
      answers[String(me.id)] = input.answer;
      const bothSubmitted = Boolean(answers[String(partner.id)]);
      const patch = {
        secretAnswers: JSON.stringify(answers),
        secretStatus: bothSubmitted ? "countdown" as const : "writing" as const,
        secretRevealAt: bothSubmitted ? new Date(Date.now() + SECRET_COUNTDOWN_MS) : null,
        heat: Math.min(100, room.heat + ANSWER_HEAT),
        version: room.version + 1,
      };
      await tx.update(rooms).set(patch).where(eq(rooms.id, room.id));
      return toRoomState({ ...room, ...patch }, roomPlayers, me);
    });
  }),

  finishSecret: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertActive(room);
      if (room.secretStatus === "none") return toRoomState(room, roomPlayers, me);
      if (room.secretStatus !== "countdown" || !room.secretRevealAt || Date.now() < room.secretRevealAt.getTime()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "انتظرا لحظة الكشف أولاً" });
      }
      const patch = {
        secretStatus: "none" as const,
        secretPrompt: null,
        secretAnswers: "{}",
        secretRevealAt: null,
        version: room.version + 1,
      };
      await tx.update(rooms).set(patch).where(eq(rooms.id, room.id));
      return toRoomState({ ...room, ...patch }, roomPlayers, me);
    });
  }),

  nextStage: publicQuery.input(actionSchema).mutation(async ({ input }) => {
    return getDb().transaction(async (tx) => {
      const { room, roomPlayers, me } = await getSession(input, tx, true);
      assertTurn(room, me);
      if (room.currentCard !== null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "أتمّ البطاقة أو تخطَّها قبل تغيير المرحلة" });
      }
      const patch = { ...nextStageData(room), version: room.version + 1 };
      await tx.update(rooms).set(patch).where(eq(rooms.id, room.id));
      return toRoomState({ ...room, ...patch }, roomPlayers, me);
    });
  }),
});
