import { useEffect, useRef, useState } from "react";
import { Flame, RefreshCw, Share2, Volume2, VolumeX } from "lucide-react";
import type { Gender } from "@contracts/cards";
import type { Session } from "@contracts/game";
import { trpc } from "@/providers/trpc";
import { EntryScreen } from "@/game/EntryScreen";
import { GameScreen } from "@/game/GameScreen";
import { InvitePanel } from "@/game/InvitePanel";
import { isSoundMuted, playSound, playSoundFromGesture, setSoundMuted, unlockAudio } from "@/game/audio";
import { clearSession, invitationCode, invitationUrl, loadSession, saveSession } from "@/game/session";
import "./Home.css";

export default function Home() {
  const [entryCode, setEntryCode] = useState(invitationCode);
  const [session, setSession] = useState<Session | null>(loadSession);
  const [notice, setNotice] = useState("");
  const [soundMuted, setMuted] = useState(isSoundMuted);
  const previousCardVersion = useRef<number | null>(null);
  const previousRevealedSecret = useRef<number | null>(null);
  const utils = trpc.useUtils();

  const stateQuery = trpc.room.state.useQuery(
    session ?? { code: "AAAAAA", token: "0".repeat(64) },
    {
      enabled: Boolean(session),
      refetchInterval: (query) => query.state.data?.secret?.status === "countdown" ? 350 : 1200,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  );

  const activeCardVersion = stateQuery.data?.card ? stateQuery.data.version : null;
  const currentSecret = stateQuery.data?.secret;
  const revealedSecretId = currentSecret?.status === "revealed" ? currentSecret.id : null;

  useEffect(() => {
    const unlock = () => {
      if (!isSoundMuted()) void unlockAudio();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (activeCardVersion !== null && activeCardVersion !== previousCardVersion.current) {
      playSound("card");
    }
    previousCardVersion.current = activeCardVersion;
  }, [activeCardVersion]);

  useEffect(() => {
    if (revealedSecretId !== null && revealedSecretId !== previousRevealedSecret.current) {
      playSound("reveal");
    }
    previousRevealedSecret.current = revealedSecretId;
  }, [revealedSecretId]);

  function acceptSession(next: Session) {
    saveSession(next);
    setSession(next);
    setNotice("");
  }

  function updateRoom(data: NonNullable<typeof stateQuery.data>) {
    if (session) utils.room.state.setData(session, data);
  }

  const createRoom = trpc.room.create.useMutation({ onSuccess: acceptSession });
  const joinRoom = trpc.room.join.useMutation({ onSuccess: acceptSession });
  const spin = trpc.room.spin.useMutation({ onSuccess: updateRoom });
  const done = trpc.room.done.useMutation({
    onSuccess: (data) => {
      updateRoom(data);
      playSound("done");
    },
  });
  const skip = trpc.room.skip.useMutation({
    onSuccess: (data) => {
      updateRoom(data);
      playSound("skip");
    },
  });
  const nextStage = trpc.room.nextStage.useMutation({ onSuccess: updateRoom });
  const submitAnswer = trpc.room.submitAnswer.useMutation({ onSuccess: updateRoom });
  const finishSecret = trpc.room.finishSecret.useMutation({ onSuccess: updateRoom });

  function leaveRoom() {
    if (session) clearSession(session);
    setSession(null);
    setEntryCode("");
    setNotice("");
    createRoom.reset();
    joinRoom.reset();
  }

  function startNewRoom() {
    window.history.replaceState(null, "", window.location.pathname);
    setEntryCode("");
    joinRoom.reset();
  }

  function toggleSound() {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    setMuted(nextMuted);
    if (!nextMuted) void unlockAudio();
  }

  async function shareRoom() {
    if (!session) return;
    const invite = invitationUrl(session.code);
    if (navigator.share) {
      try {
        await navigator.share({ title: "روليت الإثارة", text: "ادخل إلى غرفتنا الخاصة", url: invite });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(invite);
      setNotice("تم نسخ رابط الدعوة");
      window.setTimeout(() => setNotice(""), 1800);
    } catch {
      setNotice("انسخ الرابط من شاشة الدعوة");
    }
  }

  if (!session) {
    return (
      <EntryScreen
        roomCode={entryCode}
        pending={createRoom.isPending || joinRoom.isPending}
        error={createRoom.error?.message || joinRoom.error?.message}
        onCreate={(name: string, gender: Gender) => createRoom.mutate({ name, gender })}
        onJoin={(code: string, name: string, gender: Gender) => joinRoom.mutate({ code, name, gender })}
        onNewRoom={startNewRoom}
      />
    );
  }

  if (stateQuery.isLoading) {
    return (
      <main className="app-shell centered-state">
        <div className="ambient" aria-hidden="true" />
        <Flame className="loading-flame" aria-hidden="true" />
        <p>جارٍ فتح الغرفة واستعادة جلستك…</p>
      </main>
    );
  }

  if (stateQuery.error || !stateQuery.data) {
    return (
      <main className="app-shell centered-state">
        <div className="ambient" aria-hidden="true" />
        <p className="error-title">لم نتمكن من فتح الغرفة</p>
        <p className="error-message" role="alert">{stateQuery.error?.message || "تعذّر تحميل الغرفة"}</p>
        <button className="secondary-button" type="button" onClick={() => void stateQuery.refetch()}><RefreshCw aria-hidden="true" /> إعادة المحاولة</button>
        <button className="text-button" type="button" onClick={leaveRoom}>الخروج واختيار غرفة أخرى</button>
      </main>
    );
  }

  const state = stateQuery.data;
  const busy = spin.isPending || done.isPending || skip.isPending || nextStage.isPending || submitAnswer.isPending || finishSecret.isPending;
  const actionError = spin.error?.message || done.error?.message || skip.error?.message || nextStage.error?.message;
  const secretError = submitAnswer.error?.message || finishSecret.error?.message;

  if (state.status === "waiting") {
    return (
      <main className="app-shell">
        <div className="ambient" aria-hidden="true" />
        <div className="game-wrap">
          <header className="game-topbar">
            <div className="room-chip"><span className="online-dot" /> غرفة <bdi>{state.code}</bdi></div>
            <div className="topbar-actions">
              <button
                className="icon-button"
                type="button"
                onClick={toggleSound}
                aria-label={soundMuted ? "تشغيل المؤثرات الصوتية" : "كتم المؤثرات الصوتية"}
                aria-pressed={soundMuted}
                title={soundMuted ? "تشغيل المؤثرات الصوتية" : "كتم المؤثرات الصوتية"}
              >
                {soundMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
              </button>
              <button className="icon-button" type="button" onClick={() => void shareRoom()} aria-label="مشاركة رابط الغرفة"><Share2 aria-hidden="true" /></button>
              <button className="text-button leave-waiting" type="button" onClick={leaveRoom}>خروج</button>
            </div>
          </header>
          {notice && <div className="toast" role="status">{notice}</div>}
          <InvitePanel code={state.code} meName={state.me.name} />
        </div>
      </main>
    );
  }

  return (
    <GameScreen
      state={state}
      busy={busy}
      spinning={spin.isPending}
      actionError={actionError}
      secretError={secretError}
      connected={!stateQuery.isError}
      refreshing={stateQuery.isRefetching}
      notice={notice}
      soundMuted={soundMuted}
      onToggleSound={toggleSound}
      onSpin={() => {
        void playSoundFromGesture("spin");
        spin.mutate(session);
      }}
      onDone={() => done.mutate(session)}
      onSkip={() => skip.mutate(session)}
      onNextStage={() => nextStage.mutate(session)}
      onSubmitAnswer={(answer) => submitAnswer.mutate({ ...session, answer })}
      onFinishSecret={() => finishSecret.mutate(session)}
      onTimerTick={(second) => playSound(second <= 3 ? "tickFinal" : "tick")}
      onTimerExpire={() => playSound("expire")}
      onShare={() => void shareRoom()}
      onLeave={leaveRoom}
    />
  );
}
