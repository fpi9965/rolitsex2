import { useRef, useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { invitationUrl } from "./session";

export function InvitePanel({ code, meName }: { code: string; meName: string }) {
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const invite = invitationUrl(code);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite);
      setNotice("تم نسخ رابط الدعوة");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      setNotice("الرابط محدد؛ انسخه من حقل الدعوة");
    }
  }

  async function shareInvite() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "روليت الإثارة", text: "ادخل إلى غرفتنا الخاصة", url: invite });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyInvite();
  }

  return (
    <section className="waiting-view">
      <p className="eyebrow">أهلاً {meName}</p>
      <h1>بقي طرفان<br />وجهاز آخر.</h1>
      <p className="lede">أرسل الدعوة إلى الطرف الآخر. بعد إدخال الاسم والجنس، تبدأ اللعبة على الجهازين تلقائياً.</p>
      <div className="invite-code" aria-label={`رمز الغرفة ${code}`}><bdi>{code}</bdi></div>
      <div className="invite-box">
        <label htmlFor="invite-link"><Link2 aria-hidden="true" /> رابط الدعوة</label>
        <input ref={inputRef} id="invite-link" className="text-input invite-link" value={invite} readOnly onFocus={(event) => event.target.select()} dir="ltr" />
        <div className="invite-actions">
          <button className="primary-button" type="button" onClick={() => void copyInvite()}><Copy aria-hidden="true" /> نسخ الرابط</button>
          <button className="secondary-button" type="button" onClick={() => void shareInvite()}><Share2 aria-hidden="true" /> مشاركة</button>
        </div>
        {notice && <p className="copy-notice" role="status"><Check aria-hidden="true" /> {notice}</p>}
      </div>
      <div className="waiting-indicator" role="status"><span className="pulse-dot" /> بانتظار دخول الطرف الآخر…</div>
      <p className="privacy-note">لا ترسلا الرابط إلى غيركما. يمكن للطرف الآخر الانضمام مرة واحدة فقط.</p>
    </section>
  );
}
