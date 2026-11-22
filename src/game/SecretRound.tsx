import { useEffect, useState, type FormEvent } from "react";
import { Eye, LockKeyhole, PenLine, Sparkles } from "lucide-react";
import type { SecretState } from "@contracts/game";
import { draftKey } from "./session";
import { useServerTime } from "./useServerTime";

type SecretRoundProps = {
  secret: SecretState;
  roomCode: string;
  meId: number;
  meName: string;
  partnerName: string;
  serverTime: number;
  isPending: boolean;
  error?: string;
  onSubmit: (answer: string) => void;
  onFinish: () => void;
};

export function SecretRound({
  secret,
  roomCode,
  meId,
  meName,
  partnerName,
  serverTime,
  isPending,
  error,
  onSubmit,
  onFinish,
}: SecretRoundProps) {
  const storageKey = draftKey(roomCode, secret.id, meId);
  const [answer, setAnswer] = useState(() => secret.myAnswer ?? localStorage.getItem(storageKey) ?? "");
  const now = useServerTime(serverTime, 150, secret.status === "countdown");

  useEffect(() => {
    if (secret.mySubmitted) {
      localStorage.removeItem(storageKey);
    } else if (answer.trim()) {
      localStorage.setItem(storageKey, answer);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [answer, secret.mySubmitted, storageKey]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (trimmed && !isPending) onSubmit(trimmed);
  }

  const remainingMs = secret.revealAt ? secret.revealAt - now : 0;
  const countdown = Math.max(0, Math.ceil(remainingMs / 1000));

  return (
    <section className={`secret-round secret-${secret.status}`}>
      <div className="secret-kicker">
        <LockKeyhole aria-hidden="true" />
        <span>همسة سرية</span>
        <span className="secret-number">سؤالان · كشف واحد</span>
      </div>

      {secret.status === "writing" && !secret.mySubmitted && (
        <form onSubmit={submit} className="secret-compose">
          <p className="secret-overline">على جهازك فقط</p>
          <h2>{secret.title}</h2>
          <p className="secret-question">{secret.question}</p>
          <label htmlFor="secret-answer">إجابتك المخفية</label>
          <textarea
            id="secret-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            maxLength={300}
            rows={5}
            placeholder="اكتب بصراحة… تبقى مسودتك على جهازك إذا أعدت تحميل الصفحة"
            required
          />
          <div className="answer-meta">
            <span><LockKeyhole aria-hidden="true" /> محجوبة عن {partnerName}</span>
            <bdi>{answer.length}/300</bdi>
          </div>
          <button className="primary-button seal-button" type="submit" disabled={!answer.trim() || isPending}>
            <PenLine aria-hidden="true" />
            {isPending ? "جارٍ إغلاق الإجابة…" : "احفظ إجابتي سراً"}
          </button>
        </form>
      )}

      {secret.status === "writing" && secret.mySubmitted && (
        <div className="sealed-waiting">
          <span className="sealed-icon"><LockKeyhole aria-hidden="true" /></span>
          <p className="secret-overline">وصلت إجابتك وأُغلقت</p>
          <h2>{secret.partnerSubmitted ? "اكتملت الإجابتان" : `بانتظار إجابة ${partnerName}`}</h2>
          <p className="secret-question">سؤالك كان: {secret.question}</p>
          <blockquote>{secret.myAnswer}</blockquote>
          <div className="waiting-indicator" role="status">
            <span className="pulse-dot" />
            {secret.partnerSubmitted ? "استعدا للكشف…" : "لا تصل إجابتك إلى الجهاز الآخر قبل الكشف."}
          </div>
        </div>
      )}

      {secret.status === "countdown" && (
        <div className="countdown-view" role="status" aria-live="polite">
          <Sparkles aria-hidden="true" className="countdown-spark" />
          <p className="secret-overline">أُغلقت الإجابتان</p>
          <h2>لا تستعجلا…</h2>
          <div className="countdown-number" key={countdown} aria-label={countdown ? `${countdown} ثوانٍ` : "الكشف الآن"}>
            {countdown || "الآن"}
          </div>
          <p>ضعا الجوالين بينكما، واقرأا الإجابتين معاً.</p>
        </div>
      )}

      {secret.status === "revealed" && (
        <div className="reveal-view">
          <div className="reveal-heading">
            <Eye aria-hidden="true" />
            <div><p className="secret-overline">حان الكشف</p><h2>{secret.title}</h2></div>
          </div>
          <article className="answer-reveal mine">
            <p className="answer-author">إجابتك · {meName}</p>
            <p className="answer-question">{secret.question}</p>
            <p className="answer-text">{secret.myAnswer}</p>
          </article>
          <article className="answer-reveal partner">
            <p className="answer-author">إجابة {partnerName}</p>
            <p className="answer-question">{secret.partnerQuestion}</p>
            <p className="answer-text">{secret.partnerAnswer}</p>
          </article>
          <p className="reveal-challenge">اختارا تفصيلاً واحداً من الإجابتين ونفّذاه بما يريحكما، ثم عودا إلى القرص.</p>
          <button className="primary-button" type="button" onClick={onFinish} disabled={isPending}>
            {isPending ? "جارٍ العودة…" : "احتفظنا بالفكرة؛ عودة إلى القرص"}
          </button>
        </div>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  );
}
