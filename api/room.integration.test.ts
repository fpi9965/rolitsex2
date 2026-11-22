import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import type { Gender } from "@contracts/cards";
import { SECRET_COUNTDOWN_MS } from "@contracts/game";
import { buildInvitationUrl } from "@contracts/invitation";

const databaseUrl = process.env.ROLIT_TEST_DATABASE_URL;
const couples = [
  { host: "سارة", guest: "عمر", hostGender: "مؤنث", guestGender: "مذكر" },
  { host: "ليان", guest: "زيد", hostGender: "مؤنث", guestGender: "مذكر" },
] satisfies { host: string; guest: string; hostGender: Gender; guestGender: Gender }[];

describe.skipIf(!databaseUrl)("لعب زوجين من جلستين مستقلتين في كل غرفة", () => {
  let roomRouter: typeof import("./roomRouter").roomRouter;
  const roomCodes: string[] = [];

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    ({ roomRouter } = await import("./roomRouter"));
  });

  afterAll(async () => {
    try {
      if (!databaseUrl || !roomCodes.length) return;
      const connection = await mysql.createConnection(databaseUrl);
      try {
        for (const code of roomCodes) {
          await connection.execute("DELETE FROM rooms WHERE code = ?", [code]);
        }
      } finally {
        await connection.end();
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ينشئ غرفتين ويزامن البطاقات والدور وكشف الإجابات", async () => {
    const device = () => roomRouter.createCaller({
      req: new Request("http://localhost/api/trpc"),
      resHeaders: new Headers(),
    });

    await Promise.all(couples.map(async ({ host, guest, hostGender, guestGender }) => {
      const hostDevice = device();
      const guestDevice = device();
      const hostSession = await hostDevice.create({ name: host, gender: hostGender });
      roomCodes.push(hostSession.code);
      const invite = buildInvitationUrl(hostSession.code, {
        hostname: "localhost",
        origin: "http://localhost:3000",
        pathname: "/",
      });
      const code = new URL(invite).searchParams.get("join")!;
      expect(await guestDevice.preview({ code })).toMatchObject({ playerCount: 1, status: "waiting" });
      await expect(guestDevice.join({ code, name: guest, gender: hostGender })).rejects.toMatchObject({ code: "CONFLICT" });
      const guestSession = await guestDevice.join({ code, name: guest, gender: guestGender });
      const first = await hostDevice.spin(hostSession);
      const partnerView = await guestDevice.state(guestSession);
      expect(partnerView).toMatchObject({ status: "active", partner: { name: host } });
      expect(partnerView.card?.text).toBeTruthy();
      expect(partnerView.card?.text).not.toBe(first.card?.text);
      await hostDevice.skip({ ...hostSession, version: first.version });
      const second = await hostDevice.spin(hostSession);
      await expect(hostDevice.done({ ...hostSession, version: first.version })).rejects.toMatchObject({ code: "CONFLICT" });
      await hostDevice.done({ ...hostSession, version: second.version });
      const guestCard = await guestDevice.spin(guestSession);
      await guestDevice.done({ ...guestSession, version: guestCard.version });

      await Promise.all([
        hostDevice.submitAnswer({ ...hostSession, answer: "إجابة المضيف" }),
        guestDevice.submitAnswer({ ...guestSession, answer: "إجابة الضيف" }),
      ]);
      expect((await hostDevice.state(hostSession)).secret).toMatchObject({
        status: "countdown",
        partnerAnswer: null,
      });
      await new Promise((resolve) => setTimeout(resolve, SECRET_COUNTDOWN_MS + 100));
      const revealed = await guestDevice.state(guestSession);
      expect(revealed.secret).toMatchObject({ status: "revealed", partnerAnswer: "إجابة المضيف" });
      expect((await guestDevice.finishSecret({ ...guestSession, version: revealed.version })).secret).toBeNull();
    }));
    expect(new Set(roomCodes).size).toBe(2);
  }, 15_000);
});
