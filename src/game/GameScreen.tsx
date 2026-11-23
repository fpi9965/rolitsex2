import { useEffect, useRef, useState } from "react";
import { isAmbientEnabled, playSound, playSoundFromGesture, setAudioAtmosphere, toggleAmbient } from "./audio";
import { Flame, LogOut, RefreshCw, Share2, Volume2, VolumeX, WifiOff } from "lucide-react";
import type { RoomState } from "@contracts/game";
import { CARD_HEAT, SKIP_HEAT, STAGES } from "@contracts/game";
import { Dial } from "./Dial";
import { CardTimer } from "./CardTimer";
import { SecretRound } from "./SecretRound";

type GameScreenProps = {
  state: RoomState;
  busy: boolean;
  spinning: boolean;
  actionError?: string;
  secretError?: string;
  connected: boolean;
  refreshing: boolean;
  notice?: string;
  soundMuted: boolean;
  onToggleSound: () => void;
  onSpin: () => void;
  onDone: () => void;
  onSkip: () => void;
  onNextStage: () => void;
  onSubmitAnswer: (answer: string) => void;
  onFinishSecret: () => void;
  onTimerTick: (second: number) => void;
  onTimerExpire: () => void;
  onShare: () => void;
  onLeave: () => void;
};

function heatLabel(heat: number) {
  if (heat >= 100) return "ذروة اللهيب";
  if (heat >= 75) return "لا تُطفئاها";
  if (heat >= 50) return "الحرارة تصعد";
  if (heat >= 25) return "الشرارة تكبر";
  return "بداية هادئة";
}

export function GameScreen(props: GameScreenProps) {
  const { state, busy, actionError, secretError, connected, refreshing } = props;
  const cardRef = useRef<HTMLElement>(null);
  const [atmosphere, setAtmosphere] = useState<"soft" | "romantic" | "bold">(() => {
    try {
      const saved = localStorage.getItem("rolit-atmosphere");
      return saved === "soft" || saved === "romantic" || saved === "bold" ? saved : "bold";
    } catch {
      return "bold";
    }
  });
  const [ambientOn, setAmbientOn] = useState(isAmbientEnabled);
  function chooseAtmosphere(value: "soft" | "romantic" | "bold") {
    setAtmosphere(value);
    setAudioAtmosphere(value);
    void playSoundFromGesture("reveal");
  }
  useEffect(() => { setAudioAtmosphere(atmosphere); }, [atmosphere]);
  const stage = STAGES.find((item) => item.id === state.stage) ?? STAGES[0];
  const cardVersion = state.card ? state.version : null;
  const [revealedVersion, setRevealedVersion] = useState<number | null>(null);
  const [earlyRevealVersion, setEarlyRevealVersion] = useState<number | null>(null);
  const cardVisible = cardVersion !== null && (revealedVersion === cardVersion || earlyRevealVersion === cardVersion);
  const revealDelay = state.me.isTurn ? 2500 : 6000;

  useEffect(() => {
    if (cardVersion === null) return;
    const timeout = window.setTimeout(() => {
      setRevealedVersion(cardVersion);
      playSound("reveal");
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : revealDelay);
    return () => window.clearTimeout(timeout);
  }, [cardVersion, revealDelay]);

  useEffect(() => {
    if (cardVersion === null) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [cardVersion]);

  return (
    <main className={`app-shell game-screen atmosphere-${atmosphere}`}>
      <div className="ambient" aria-hidden="true" />
      {props.notice && <div className="toast" role="status">{props.notice}</div>}
      <div className="game-wrap">
        <header className="game-topbar">
          <div className="room-identity">
            <span className="room-chip">غرفة <bdi>{state.code}</bdi></span>
            <span className={connected ? "connection-state" : "connection-state offline"} role="status">
              {connected ? <RefreshCw className={refreshing ? "refreshing" : ""} aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
              {connected ? "متزامن" : "إعادة اتصال"}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              onClick={props.onToggleSound}
              aria-label={props.soundMuted ? "تشغيل المؤثرات الصوتية" : "كتم المؤثرات الصوتية"}
              aria-pressed={props.soundMuted}
              title={props.soundMuted ? "تشغيل المؤثرات الصوتية" : "كتم المؤثرات الصوتية"}
            >
              {props.soundMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            </button>
            <button className="icon-button" type="button" onClick={props.onShare} aria-label="مشاركة رابط الغرفة" title="مشاركة رابط الغرفة"><Share2 aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={props.onLeave} aria-label="الخروج على هذا الجهاز" title="الخروج على هذا الجهاز"><LogOut aria-hidden="true" /></button>
          </div>
        </header>

        <section className="play-view">
          <div className="players-line">
            <span><small>أنت</small>{state.me.name}</span>
            <span className="versus" aria-hidden="true">×</span>
            <span><small>الطرف الآخر</small>{state.partner?.name}</span>
          </div>

          <ol className="stage-rail" aria-label="مراحل اللعبة">
            {STAGES.map((item) => (
              <li key={item.id} className={item.id === state.stage ? "current" : item.id < state.stage ? "passed" : ""} aria-current={item.id === state.stage ? "step" : undefined}>
                <span>{item.id}</span><small>{item.name}</small>
              </li>
            ))}
          </ol>

          <section className="atmosphere-picker" aria-label="مستوى الأجواء">
            <p>أجواء ليلتكما <span aria-hidden="true">✦</span></p>
            <div className="atmosphere-options" role="group" aria-label="اختيار الأجواء">
              <button type="button" aria-pressed={atmosphere === "soft"} onClick={() => chooseAtmosphere("soft")}>هادئة</button>
              <button type="button" aria-pressed={atmosphere === "romantic"} onClick={() => chooseAtmosphere("romantic")}>رومانسية</button>
              <button type="button" aria-pressed={atmosphere === "bold"} onClick={() => chooseAtmosphere("bold")}>جريئة جدًا</button>
            </div>
            <button className="sound-test-button" type="button" aria-pressed={ambientOn} onClick={() => { void toggleAmbient().then(setAmbientOn); }}>
              {ambientOn ? "إيقاف الخلفية الصوتية ◼" : "تشغيل خلفية صوتية هادئة ♫"}
            </button>
            <button className="sound-test-button" type="button" onClick={() => { if (props.soundMuted) props.onToggleSound(); void playSoundFromGesture("reveal"); }}>
              {props.soundMuted ? "تشغيل الصوت وتجربته ♫" : "جرّب المؤثرات الصوتية ♫"}
            </button>
            <small>{atmosphere === "bold" ? "وهج دافئ وأنفاس اصطناعية وإيقاع متصاعد" : atmosphere === "romantic" ? "إضاءة ناعمة وانتقالات حالمة" : "أجواء هادئة ومؤثرات خفيفة"}</small>
          </section>
          <div className="heat-panel">
            <div className="heat-heading">
              <span><Flame aria-hidden="true" /> {heatLabel(state.heat)}</span>
              <strong>{state.heat}%</strong>
            </div>
            <div className="heat-track" role="progressbar" aria-label="مؤشر اللهيب" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.heat}>
              <span style={{ transform: `scaleX(${state.heat / 100})` }} />
            </div>
            <div className="heat-foot">
              <span>{state.streak > 0 ? `سلسلة مشتعلة ×${state.streak}` : "أكملا بطاقة لبدء السلسلة"}</span>
              <span>{state.secret ? "القرص متوقف للهمسة" : state.secretIn === 1 ? "بطاقة حتى الهمسة" : "بطاقتان حتى الهمسة"}</span>
            </div>
          </div>

          {state.secret ? (
            <SecretRound
              key={state.secret.id}
              secret={state.secret}
              roomCode={state.code}
              meId={state.me.id}
              meName={state.me.name}
              partnerName={state.partner?.name ?? "الطرف الآخر"}
              serverTime={state.serverTime}
              isPending={busy}
              error={secretError}
              onSubmit={props.onSubmitAnswer}
              onFinish={props.onFinishSecret}
            />
          ) : (
            <>
              <div className={state.me.isTurn ? "turn-banner my-turn" : "turn-banner"} role="status">
                <p>{state.me.isTurn ? "الدور عليك" : `الدور على ${state.partner?.name}`}</p>
                <span>{stage.hint}</span>
              </div>

              <div className="dial-box">
                <Dial slots={state.slots} cardSlot={state.card?.slot ?? null} version={state.version} spinning={props.spinning} />
                {state.me.isTurn && !state.card && (
                  <button className="spin-button" type="button" onClick={props.onSpin} disabled={busy || state.remaining === 0}>
                    {busy ? "جارٍ اختيار البطاقة…" : "أدر القرص"}
                  </button>
                )}
              </div>

              {state.card && (
                <article ref={cardRef} className={`question-card suspense-card${cardVisible ? " suspense-revealed" : " suspense-hidden"}`} aria-live="polite">
                  <CardTimer
                    endsAt={state.card.endsAt}
                    serverTime={state.serverTime}
                    onTick={props.onTimerTick}
                    onExpire={props.onTimerExpire}
                  />
                  {!cardVisible ? (
                    <div className="suspense-cover" role="status">
                      <span className="suspense-symbol" aria-hidden="true">✦</span>
                      <strong>{state.me.isTurn ? "لحظة… البطاقة تختار مفاجأتك" : "دور الطرف الآخر أولاً… ومفاجأتك قادمة"}</strong>
                      <p>استعدّا للكشف عن التحدي</p>
                      <button type="button" className="secondary-button" onClick={() => { setEarlyRevealVersion(cardVersion); void playSoundFromGesture("reveal"); }}>اكشف البطاقة الآن</button>
                    </div>
                  ) : (
                    <div className="suspense-content">
                  <p className="card-owner">بطاقة {state.card.forName} · دورك الخاص</p>
                  <p className="question-text">{state.card.text}</p>
                  <p className="card-tease">هذه بطاقتك وحدك الآن. بعد إنهائها يأتي دور الطرف الآخر بمفاجأة مختلفة. يمكنكما التخطي متى شئتما.</p>
                    </div>
                  )}
                </article>
              )}

              {!state.card && state.remaining === 0 && <p className="empty-stage" role="status">اكتملت بطاقات المرحلة. افتحا المرحلة التالية.</p>}
              {actionError && <p className="error-message" role="alert">{actionError}</p>}

              {state.me.isTurn ? (
                <div className="game-actions">
                  {state.card ? (
                    <>
                      <button className="done-button" type="button" onClick={props.onDone} disabled={busy}>تمّت البطاقة <bdi>+{CARD_HEAT}</bdi></button>
                      <button className="skip-button" type="button" onClick={props.onSkip} disabled={busy}>تخطّي <bdi>−{SKIP_HEAT}</bdi></button>
                    </>
                  ) : (
                    <button className="next-button" type="button" onClick={props.onNextStage} disabled={busy}>
                      {state.stage === 4 ? "جولة جديدة من البداية" : "المرحلة التالية"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="turn-hint">التحديث يصل تلقائياً. أزرار البطاقة تظهر على جهاز صاحب الدور فقط.</p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
