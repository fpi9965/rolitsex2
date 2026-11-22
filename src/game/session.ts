import type { Session } from "@contracts/game";

const SESSION_PREFIX = "rolit-v2-session-";
const LEGACY_TOKEN_PREFIX = "rolit-token-";
const LAST_ROOM_KEY = "rolit-last-room";
const CODE_PATTERN = /^[A-Z2-9]{6}$/;

export function normalizeCode(value: string | null): string {
  const code = (value ?? "").trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : "";
}

export function invitationCode(): string {
  const params = new URLSearchParams(window.location.search);
  return normalizeCode(params.get("join") || params.get("room"));
}

export function loadSession(): Session | null {
  const code = invitationCode() || normalizeCode(localStorage.getItem(LAST_ROOM_KEY));
  if (!code) return null;
  try {
    const saved = localStorage.getItem(`${SESSION_PREFIX}${code}`);
    if (saved) {
      const parsed = JSON.parse(saved) as Session;
      if (normalizeCode(parsed.code) === code && /^[a-f0-9]{64}$/.test(parsed.token)) return parsed;
    }
  } catch {
    localStorage.removeItem(`${SESSION_PREFIX}${code}`);
  }
  const legacyToken = localStorage.getItem(`${LEGACY_TOKEN_PREFIX}${code}`);
  return legacyToken && /^[a-f0-9]{64}$/.test(legacyToken) ? { code, token: legacyToken } : null;
}

export function saveSession(session: Session) {
  localStorage.setItem(`${SESSION_PREFIX}${session.code}`, JSON.stringify(session));
  localStorage.setItem(`${LEGACY_TOKEN_PREFIX}${session.code}`, session.token);
  localStorage.setItem(LAST_ROOM_KEY, session.code);
  window.history.replaceState(null, "", `${window.location.pathname}?join=${session.code}`);
}

export function clearSession(session: Session) {
  localStorage.removeItem(`${SESSION_PREFIX}${session.code}`);
  localStorage.removeItem(`${LEGACY_TOKEN_PREFIX}${session.code}`);
  if (localStorage.getItem(LAST_ROOM_KEY) === session.code) localStorage.removeItem(LAST_ROOM_KEY);
  window.history.replaceState(null, "", window.location.pathname);
}

export function invitationUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?join=${code}`;
}

export function draftKey(code: string, roundId: number, playerId: number): string {
  return `rolit-v2-draft-${code}-${roundId}-${playerId}`;
}
