import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, Flame, Link2, RefreshCw, Share2, Users } from "lucide-react";
import type { Gender } from "@contracts/cards";
import { trpc } from "@/providers/trpc";
import { Dial } from "@/game/Dial";
import { SecretRound } from "@/game/SecretRound";
import "./Home.css";

type Session = { code: string; token: string };
const STAGE_NAMES: Record<number, string> = { 1: "صريح", 2: "مثير", 3: "مداعبة", 4: "وضعيات" };
const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = (urlParams.get("join") || urlParams.get("room") || "").toUpperCase();
// Kimi's in-app preview runs on statics.kimi.ai, which is private to the owner:
// an invite built from that origin opens "403 Access Denied" on the partner's
// phone, so the partner never joins and the game never starts. Invites always
// point at the public deployment instead (override with VITE_PUBLIC_URL).
const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_URL || "https://u5walep5vxzzu.kimi.place").replace(/\/+$/, "");
const isPrivatePreview = /(^|\.)kimi\.ai$/.test(window.location.hostname);
const invitationUrl = (code: string) =>
  isPrivatePreview
    ? `${PUBLIC_APP_URL}/?join=${code}`
    : `${window.location.origin}${window.location.pathname}?join=${code}`;
const CODE_PATTERN = /^[A-Z2-9]{6}$/;
const initialRoomCode = CODE_PATTERN.test(roomFromUrl)
  ? roomFromUrl
  : localStorage.getItem("rolit-last-room") || "";

function savedSession(): Session | null {
  if (!initialRoomCode) return null;
  const token = localStorage.getItem(`rolit-token-${initialRoomCode}`);
  return token ? { code: initialRoomCode, token } : null;
}

export default function Home() {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("مذكر");
  const [session, setSession] = useState<Session | null>(savedSession);
  const [entryCode, setEntryCode] = useState(initialRoomCode);
  const [typedCode, setTypedCode] = useState("");
  const [copyLabel, setCopyLabel] = useState("نسخ الرابط");
  const utils = trpc.useUtils();
  const stateQuery = trpc.room.state.useQuery(
    session ?? { code: "AAAAAA", token: "0".repeat(64) },
    {
      enabled: Boolean(session),
      refetchInterval: (query) =>
        query.state.data?.secret?.status === "countdown" ? 400 : 1800,
      refetchIntervalInBackground: true,
      retry: 1,
    },
  );
  const cardRef = useRef<HTMLElement>(null);
  const visibleCardVersion = stateQuery.data?.card ? stateQuery.data.version : null;

  useEffect(() => {
    if (visibleCardVersion === null) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleCardVersion]);

  function acceptSession(next: Session) {
    localStorage.setItem(`rolit-token-${next.code}`, next.token);
    localStorage.setItem("rolit-last-room", next.code);
    window.history.replaceState(null, "", `${window.location.pathname}?join=${next.code}`);
    setSession(next);
  }

  const createRoom = trpc.room.create.useMutation({ onSuccess: acceptSession });
  const joinRoom = trpc.room.join.useMutation({ onSuccess: acceptSession });
  const spin = trpc.room.spin.useMutation({
    onSuccess: (data) => { if (session) utils.room.state.setData(session, data); },
    onError: () => { void utils.room.state.invalidate(); },
  });
  const done = trpc.room.done.useMutation({
    onSuccess: (data) => { if (session) utils.room.state.setData(session, data); },
    onError: () => { void utils.room.state.invalidate(); },
  });
  const skip = trpc.room.skip.useMutation({
    onSuccess: (data) => { if (session) utils.room.state.setData(session, data); },
    onError: () => { void utils.room.state.invalidate(); },
  });
  const nextStage = trpc.room.nextStage.useMutation({
    onSuccess: (data) => { if (session) utils.room.state.setData(session, data); },
    onError: () => { void utils.room.state.invalidate(); },
  });
  const submitAnswer = trpc.room.submitAnswer.useMutation({
    onSuccess: (data) => { if (session) utils.room.state.setData(session, data); },
    onError: () => { void utils.room.state.invalidate(); },
  });
  const finishSecret = trpc.room.finishSecret.useMutation({
    onSuccess: (data) => { if (session) utils.room.state.setData(session, data); },
    onError: () => { void utils.room.state.invalidate(); },
  });

  const inviteUrl = session ? invitationUrl(session.code) : "";

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyLabel("تم النسخ");
      window.setTimeout(() => setCopyLabel("نسخ الرابط"), 1800);
    } catch {
      setCopyLabel("حدّد الرابط وانسخه");
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "روليت الإثارة", text: "ادخل إلى غرفتنا الخاصة", url: inviteUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyInvite();
  }

  function submitEntry(event: FormEvent) {
    event.preventDefault();
    if (entryCode) joinRoom.mutate({ code: entryCode, name, gender });
    else createRoom.mutate({ name, gender });
  }

  // Leaving a room must also forget it as the "last room" and drop ?room= from
  // the URL; otherwise the entry form stays stuck on joining that (full or
  // deleted) room and a new room can never be created.
  function resetEntry() {
    if (session) localStorage.removeItem(`rolit-token-${session.code}`);
    startNewRoom();
  }

  function startNewRoom() {
    localStorage.removeItem("rolit-last-room");
    window.history.replaceState(null, "", window.location.pathname);
    createRoom.reset();
    joinRoom.reset();
    setEntryCode("");
    setSession(null);
  }

  const entryError = createRoom.error?.message || joinRoom.error?.message;
  if (!session) {
    return (
      <main className="app-shell">
        <div className="ambient" aria-hidden="true" />
        <section className="entry-layout">
          <header className="brand-header">
            <span className="brand-mark" aria-hidden="true"><Flame /></span>
            <p className="eyebrow">غرفة خاصة لكما</p>
            <h1>روليت الإثارة</h1>
            <p className="lede">العبا من جوالين، وتظهر لكل واحد منكما الصياغة المناسبة له.</p>
          </header>
          <form className="entry-panel" onSubmit={submitEntry}>
            <div className="room-heading">
              {entryCode ? <Link2 aria-hidden="true" /> : <Users aria-hidden="true" />}
              <div>
                <h2>{entryCode ? "الانضمام إلى الغرفة" : "إنشاء غرفة جديدة"}</h2>
                {entryCode && <p>رمز الغرفة: <bdi>{entryCode}</bdi></p>}
              </div>
            </div>
            <label htmlFor="player-name">اسمك</label>
            <input
              id="player-name"
              className="text-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="الاسم الذي يظهر للطرف الآخر"
              maxLength={20}
              required
              autoComplete="nickname"
            />
            <fieldset className="gender-field">
              <legend>الجنس</legend>
              <div className="gender-options">
                {(["مذكر", "مؤنث"] as Gender[]).map((option) => (
                  <label key={option} className={gender === option ? "gender-option selected" : "gender-option"}>
                    <input
                      type="radio"
                      name="gender"
                      value={option}
                      checked={gender === option}
                      onChange={() => setGender(option)}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
            {entryError && <p className="error-message" role="alert">{entryError}</p>}
            <button className="primary-button" type="submit" disabled={createRoom.isPending || joinRoom.isPending}>
              {createRoom.isPending || joinRoom.isPending
                ? "جارٍ الدخول…"
                : entryCode ? "دخول الغرفة" : "إنشاء الغرفة وإظهار رابط الدعوة"}
            </button>
            {entryCode && (
              <button className="text-button" type="button" onClick={startNewRoom}>إنشاء غرفة جديدة بدلاً من ذلك</button>
            )}
            {!entryCode && (
              <div className="join-by-code">
                <label htmlFor="room-code">عندك رمز غرفة من الطرف الآخر؟</label>
                <div className="invite-actions">
                  <input
                    id="room-code"
                    className="text-input"
                    value={typedCode}
                    onChange={(event) => setTypedCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    placeholder="مثال: ABC234"
                    dir="ltr"
                    autoCapitalize="characters"
                    autoComplete="off"
                    inputMode="text"
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!CODE_PATTERN.test(typedCode)}
                    onClick={() => { createRoom.reset(); setEntryCode(typedCode); }}
                  >
                    انضمام بالرمز
                  </button>
                </div>
              </div>
            )}
            <p className="privacy-note">لا تحتاجان إلى تسجيل حساب. احتفظا بالرابط ورمز الغرفة للعودة من الجهاز نفسه.</p>
          </form>
        </section>
      </main>
    );
  }

  if (stateQuery.isLoading) {
    return (
      <main className="app-shell centered-state">
        <Flame className="loading-flame" aria-hidden="true" />
        <p>جارٍ فتح الغرفة…</p>
      </main>
    );
  }

  if (stateQuery.error || !stateQuery.data) {
    return (
      <main className="app-shell centered-state">
        <p className="error-message" role="alert">{stateQuery.error?.message || "تعذّر تحميل الغرفة"}</p>
        <button className="secondary-button" onClick={() => void stateQuery.refetch()}>
          <RefreshCw aria-hidden="true" /> إعادة المحاولة
        </button>
        <button className="text-button" onClick={resetEntry}>العودة إلى شاشة الدخول</button>
      </main>
    );
  }

  const state = stateQuery.data;
  const isBusy = spin.isPending || done.isPending || skip.isPending || nextStage.isPending || submitAnswer.isPending || finishSecret.isPending;
  const actionError = spin.error?.message || done.error?.message || skip.error?.message || nextStage.error?.message;
  const secretError = submitAnswer.error?.message || finishSecret.error?.message;
  const actionInput = () => ({ ...session, version: state.version });

  return (
    <main className="app-shell">
      <div className="ambient" aria-hidden="true" />
      <div className="game-wrap">
        <header className="game-topbar">
          <div className="room-chip"><span className="online-dot" /> غرفة <bdi>{state.code}</bdi></div>
          <button className="icon-button" onClick={() => void shareInvite()} aria-label="مشاركة رابط الغرفة" title="مشاركة رابط الغرفة">
            <Share2 aria-hidden="true" />
          </button>
        </header>

        {state.status === "waiting" ? (
          <section className="waiting-view">
            <p className="eyebrow">أهلاً {state.me.name}</p>
            <h1>الغرفة جاهزة</h1>
            <p className="lede">أرسل هذا الرابط إلى زوجتك. عندما تدخل اسمها وجنسها، تبدأ اللعبة على الجهازين تلقائياً.</p>
            <div className="invite-box">
              <label htmlFor="invite-link">رابط الدعوة</label>
              <input id="invite-link" className="text-input invite-link" value={inviteUrl} readOnly onFocus={(event) => event.target.select()} dir="ltr" />
              <div className="invite-actions">
                <button className="primary-button" onClick={() => void copyInvite()}><Copy aria-hidden="true" /> {copyLabel}</button>
                <button className="secondary-button" onClick={() => void shareInvite()}><Share2 aria-hidden="true" /> مشاركة</button>
              </div>
            </div>
            <p className="privacy-note">أو يفتح الطرف الآخر رابط اللعبة ويكتب رمز الغرفة: <bdi dir="ltr"><strong>{state.code}</strong></bdi></p>
            <div className="waiting-indicator" role="status"><span className="pulse-dot" /> بانتظار دخول الطرف الآخر…</div>
            <p className="privacy-note">الرابط خاص بكما؛ لا ترسلاه إلى أي شخص آخر.</p>
          </section>
        ) : (
          <section className="play-view">
            <div className="players-line">
              <span>{state.me.name}</span>
              <span className="stage-chip">{STAGE_NAMES[state.stage]}</span>
              <span>{state.partner?.name}</span>
            </div>

            <div className="heat-panel">
              <div className="heat-heading">
                <span><Flame aria-hidden="true" /> اللهيب</span>
                <strong>{state.heat}%</strong>
                <span className={state.streak > 1 ? "streak-chip hot" : "streak-chip"}>
                  {state.streak > 0 ? `سلسلة ×${state.streak}` : "ابدآ سلسلة"}
                </span>
              </div>
              <div className="heat-track" role="progressbar" aria-label="مؤشر اللهيب" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.heat}>
                <span style={{ width: `${state.heat}%` }} />
              </div>
              <p className="secret-progress">
                {state.secret
                  ? "توقف القرص مؤقتاً؛ حان وقت الإجابات السرية"
                  : state.secretIn === 1
                    ? "بطاقة واحدة تفصلكما عن همسة سرية"
                    : "بطاقتان حتى جولة الهمسة السرية"}
              </p>
            </div>

            {state.secret ? (
              <SecretRound
                key={`${state.stage}-${state.secret.title}`}
                secret={state.secret}
                meName={state.me.name}
                partnerName={state.partner?.name ?? "الطرف الآخر"}
                isPending={submitAnswer.isPending || finishSecret.isPending}
                error={secretError}
                onSubmit={(answer) => submitAnswer.mutate({ ...actionInput(), answer })}
                onFinish={() => finishSecret.mutate(actionInput())}
              />
            ) : (
              <>
                <div className={state.me.isTurn ? "turn-banner my-turn" : "turn-banner"} role="status">
                  <span>{state.me.isTurn ? "دورك الآن" : `الدور على ${state.partner?.name}`}</span>
                  <small>{state.me.isTurn ? "أدر القرص عندما تكونان مستعدين" : "ستظهر لك البطاقة هنا فور اختيارها"}</small>
                </div>

                <div className="dial-box">
                  <Dial slots={state.slots} cardSlot={state.card?.slot ?? null} version={state.version} />
                  <button
                    className="spin-button"
                    onClick={() => spin.mutate(actionInput())}
                    disabled={!state.me.isTurn || Boolean(state.card) || isBusy || state.remaining === 0}
                  >
                    {spin.isPending ? "جارٍ الاختيار…" : state.card ? "البطاقة ظاهرة" : "أدر القرص"}
                  </button>
                </div>

                {state.card && (
                  <article ref={cardRef} className="question-card" aria-live="polite">
                    <p className="card-owner">{state.me.isTurn ? "بطاقتك" : `بطاقة ${state.card.forName}`} · بصياغة صاحب الدور</p>
                    <p className="question-text">{state.card.text}</p>
                    <p className="card-tease">نفّذا بما يريحكما… ثم اضغط «تمّ» لرفع اللهيب.</p>
                  </article>
                )}
                {!state.card && state.remaining === 0 && (
                  <p className="empty-stage" role="status">انتهت بطاقات المرحلة. انتقلا إلى المرحلة التالية.</p>
                )}

                {actionError && <p className="error-message" role="alert">{actionError}</p>}
                <div className="game-actions">
                  <button className="done-button" onClick={() => done.mutate(actionInput())} disabled={!state.me.isTurn || !state.card || isBusy}>تمّ +١٢</button>
                  <button className="skip-button" onClick={() => skip.mutate(actionInput())} disabled={!state.me.isTurn || !state.card || isBusy}>تخطّي −١٢</button>
                  <button className="next-button" onClick={() => nextStage.mutate(actionInput())} disabled={!state.me.isTurn || isBusy}>المرحلة التالية</button>
                </div>
                {!state.me.isTurn && <p className="turn-hint">الأزرار تعمل على جهاز صاحب الدور، والتحديث يصل إلى جهازك تلقائياً.</p>}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
