import { useEffect, useState, type FormEvent } from "react";
import { Eye, LockKeyhole, PenLine, Sparkles } from "lucide-react";

type SecretRoundData = {
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

type SecretRoundProps = {
  secret: SecretRoundData;
  meName: string;
  partnerName: string;
  isPending: boolean;
  error?: string;
  onSubmit: (answer: string) => void;
  onFinish: () => void;
};

export function SecretRound({
  secret,
  meName,
  partnerName,
  isPending,
  error,
  onSubmit,
  onFinish,
}: SecretRoundProps) {
  const [answer, setAnswer] = useState(secret.myAnswer ?? "");
  // The parent remounts this component per round (key), so the draft answer
  // resets with each new question without a state-syncing effect.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (secret.status !== "countdown") return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [secret.status, secret.revealAt]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = answer.trim();
    if (trimmed) onSubmit(trimmed);
  }

  const countdown = secret.revealAt
    ? Math.max(1, Math.ceil((secret.revealAt - now) / 1000))
    : 3;

  return (
    <section className={`secret-round secret-${secret.status}`} aria-live="polite">
      <div className="secret-kicker">
        <LockKeyhole aria-hidden="true" />
        <span>جولة همسة سرية</span>
        <span className="secret-number">لكلٍّ منكما سؤال</span>
      </div>

      {secret.status === "writing" && !secret.mySubmitted && (
        <form onSubmit={submit} className="secret-compose">
          <p className="secret-overline">سؤالك وحدك · اكتب بحرية</p>
          <h2>{secret.title}</h2>
          <p className="secret-question">{secret.question}</p>
          <label htmlFor="secret-answer">إجابتك المخفية</label>
          <textarea
            id="secret-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            maxLength={300}
            rows={5}
            placeholder="اكتب بصراحة… لن تظهر إجابتك للطرف الآخر قبل أن يرسل إجابته"
            required
          />
          <div className="answer-meta">
            <span><LockKeyhole aria-hidden="true" /> لا يمكن للطرف الآخر رؤيتها الآن</span>
            <bdi>{answer.length}/300</bdi>
          </div>
          <button className="primary-button seal-button" type="submit" disabled={!answer.trim() || isPending}>
            <PenLine aria-hidden="true" />
            {isPending ? "جارٍ إخفاء الإجابة…" : "احفظ إجابتي سراً"}
          </button>
        </form>
      )}

      {secret.status === "writing" && secret.mySubmitted && (
        <div className="sealed-waiting">
          <span className="sealed-icon"><LockKeyhole aria-hidden="true" /></span>
          <p className="secret-overline">أُغلقت إجابتك</p>
          <h2>{secret.partnerSubmitted ? "وصلت الإجابتان" : `بانتظار إجابة ${partnerName}`}</h2>
          <p className="secret-question">سؤالك كان: {secret.question}</p>
          <blockquote>{secret.myAnswer}</blockquote>
          <div className="waiting-indicator" role="status">
            <span className="pulse-dot" />
            {secret.partnerSubmitted ? "استعدا للكشف…" : "الطرف الآخر ما زال يكتب؛ لا يستطيع رؤية ما كتبت."}
          </div>
        </div>
      )}

      {secret.status === "countdown" && (
        <div className="countdown-view">
          <Sparkles aria-hidden="true" className="countdown-spark" />
          <p className="secret-overline">اكتملت الإجابتان وأُغلقتا</p>
          <h2>لا تستعجلا… الكشف بعد</h2>
          <div className="countdown-number" key={countdown} aria-label={`${countdown} ثوانٍ`}>{countdown}</div>
          <p>ضعا الجوالين بينكما، واقرأا الإجابتين معاً.</p>
        </div>
      )}

      {secret.status === "revealed" && (
        <div className="reveal-view">
          <div className="reveal-heading">
            <Eye aria-hidden="true" />
            <div>
              <p className="secret-overline">انكشف السر</p>
              <h2>{secret.title}</h2>
            </div>
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
          <p className="reveal-challenge">اختارا الآن تفصيلاً واحداً من الإجابتين ونفّذاه، أو احتفظا به للجولة القادمة.</p>
          <button className="primary-button" type="button" onClick={onFinish} disabled={isPending}>
            {isPending ? "جارٍ العودة…" : "العودة إلى القرص"}
          </button>
        </div>
      )}

      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
  );
}
