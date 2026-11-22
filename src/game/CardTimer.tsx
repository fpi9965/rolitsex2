import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { CARD_DURATION_MS } from "@contracts/game";

type CardTimerProps = {
  endsAt: number;
  serverTime: number;
  onTick: (second: number) => void;
  onExpire: () => void;
};

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function CardTimer({ endsAt, serverTime, onTick, onExpire }: CardTimerProps) {
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0);
  const previousSeconds = useRef<number | null>(null);

  useEffect(() => {
    clockOffset.current = serverTime - Date.now();
    setNow(Date.now());
  }, [serverTime]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    previousSeconds.current = null;
  }, [endsAt]);

  const remainingMs = Math.max(0, endsAt - (now + clockOffset.current));
  const seconds = Math.ceil(remainingMs / 1000);
  const expired = remainingMs === 0;
  const urgent = !expired && seconds <= 10;
  const progress = Math.min(1, remainingMs / CARD_DURATION_MS);

  useEffect(() => {
    const previous = previousSeconds.current;
    if (previous === seconds) return;
    if (expired) {
      if (previous !== null && previous > 0) onExpire();
    } else if (seconds > 0 && seconds <= 10 && (previous === null || seconds < previous)) {
      onTick(seconds);
    }
    previousSeconds.current = seconds;
  }, [expired, onExpire, onTick, seconds]);

  return (
    <div
      className={`card-timer${urgent ? " urgent" : ""}${expired ? " expired" : ""}`}
      role="timer"
      aria-label={expired ? "انتهى وقت التحدي" : `تبقى ${seconds} ثانية`}
    >
      <div className="timer-heading">
        <span><Timer aria-hidden="true" /> {expired ? "انتهى الوقت" : urgent ? "اللحظات الأخيرة" : "وقت التحدي"}</span>
        <bdi>{expired ? "0:00" : formatTime(seconds)}</bdi>
      </div>
      <div className="timer-track" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      {expired && <p>أكملا براحتكما أو تخطّيا البطاقة؛ لا عقوبة لانتهاء الوقت.</p>}
    </div>
  );
}
