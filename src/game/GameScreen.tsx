import { useEffect, useRef } from "react";
import { Flame, LogOut, RefreshCw, Share2, WifiOff } from "lucide-react";
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
  onSpin: () => void;
  onDone: () => void;
  onSkip: () => void;
  onNextStage: () => void;
  onSubmitAnswer: (answer: string) => void;
  onFinishSecret: () => void;
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
  const stage = STAGES.find((item) => item.id === state.stage) ?? STAGES[0];
  const cardVersion = state.card ? state.version : null;

  useEffect(() => {
    if (cardVersion === null) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [cardVersion]);

  return (
    <main className="app-shell game-screen">
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

          <div className="heat-panel">
            <div className="heat-heading">
              <span><Flame aria-hidden="true" /> {heatLabel(state.heat)}</span>
              <strong>{state.heat}%</strong>
            </div>
            <div className="heat-track" role="progressbar" aria-label="مؤشر اللهيب" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.heat}>
              <span style={{ transform: `scaleX(${state.heat / 100})` }} />
            </div>
            <div className="heat-foot">
              <span>{state.streak > 0 ? `سلسلة مشتعلة ×${state.streak}` : "أتما بطاقة لبدء السلسلة"}</span>
              <span>{state.secret ? "القرص متوقف للهمسة" : state.secretIn === 1 ? "بطاقة حتى الهمسة" : "بطاقتان حتى الهمسة"}</span>
            </div>
          </div>

          {state.secret ? (
            <SecretRound
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
                <article ref={cardRef} className="question-card" aria-live="polite">
                  <CardTimer endsAt={state.card.endsAt} serverTime={state.serverTime} />
                  <p className="card-owner">بطاقة {state.card.forName} · {state.me.isTurn ? "تكليفك أنت" : "تكليفك مع صاحب الدور"}</p>
                  <p className="question-text">{state.card.text}</p>
                  <p className="card-tease">لكل جهاز نص مختلف؛ نفّذا ما يظهر لكل منكما بما يريحكما، ثم سجّلا النتيجة من جهاز صاحب الدور.</p>
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
