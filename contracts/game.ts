import type { Gender } from "./cards";

export const STAGES = [
  { id: 1, name: "صريح", hint: "أسئلة تفتح الشهية" },
  { id: 2, name: "مثير", hint: "قبلات ولمسات" },
  { id: 3, name: "مداعبة", hint: "تقارب بلا استعجال" },
  { id: 4, name: "وضعيات", hint: "الخاتمة المشتركة" },
] as const;

export const SECRET_COUNTDOWN_MS = 4000;
export const CARD_HEAT = 12;
export const ANSWER_HEAT = 6;
export const SKIP_HEAT = 12;

export type Session = { code: string; token: string };

export type RoomPreview = {
  code: string;
  status: "waiting" | "active";
  playerCount: number;
  takenGenders: Gender[];
};

export type SecretState = {
  id: number;
  status: "writing" | "countdown" | "revealed";
  title: string;
  question: string;
  partnerQuestion: string | null;
  myAnswer: string | null;
  partnerAnswer: string | null;
  mySubmitted: boolean;
  partnerSubmitted: boolean;
  revealAt: number | null;
};

export type RoomState = {
  code: string;
  status: "waiting" | "active";
  stage: number;
  version: number;
  serverTime: number;
  heat: number;
  streak: number;
  secretIn: number;
  remaining: number;
  slots: { used: boolean }[];
  me: { id: number; name: string; gender: Gender; isTurn: boolean };
  partner: { name: string; gender: Gender } | null;
  card: { text: string; forName: string; slot: number } | null;
  secret: SecretState | null;
};
