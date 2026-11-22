import { useState, type FormEvent } from "react";
import { Flame, Link2, ShieldCheck, Users } from "lucide-react";
import type { Gender } from "@contracts/cards";
import { trpc } from "@/providers/trpc";

type EntryScreenProps = {
  roomCode: string;
  pending: boolean;
  error?: string;
  onCreate: (name: string, gender: Gender) => void;
  onJoin: (code: string, name: string, gender: Gender) => void;
  onNewRoom: () => void;
};

export function EntryScreen({ roomCode, pending, error, onCreate, onJoin, onNewRoom }: EntryScreenProps) {
  const [name, setName] = useState("");
  const [preferredGender, setGender] = useState<Gender>("مذكر");
  const preview = trpc.room.preview.useQuery(
    { code: roomCode || "AAAAAA" },
    { enabled: Boolean(roomCode), retry: false, staleTime: 5000 },
  );
  const roomFull = (preview.data?.playerCount ?? 0) >= 2;
  const takenGenders = preview.data?.takenGenders ?? [];
  const gender = !roomFull && takenGenders.includes(preferredGender)
    ? preferredGender === "مذكر" ? "مؤنث" : "مذكر"
    : preferredGender;
  const genderTaken = takenGenders.includes(gender);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending || roomFull || genderTaken) return;
    if (roomCode) onJoin(roomCode, trimmed, gender);
    else onCreate(trimmed, gender);
  }

  return (
    <main className="app-shell entry-screen">
      <div className="ambient" aria-hidden="true" />
      <section className="entry-layout">
        <header className="brand-header">
          <span className="brand-mark" aria-hidden="true"><Flame /></span>
          <p className="eyebrow">ليلتكما. بلا حسابات. بلا متفرجين.</p>
          <h1>روليت<br /><span>الإثارة</span></h1>
          <p className="lede">بطاقة واحدة بتكليف مختلف لكل جهاز، و90 ثانية للتحدي، وسؤالان سريان لا ينكشفان إلا معاً.</p>
        </header>

        <form className="entry-panel" onSubmit={submit}>
          <div className="room-heading">
            {roomCode ? <Link2 aria-hidden="true" /> : <Users aria-hidden="true" />}
            <div>
              <h2>{roomCode ? "أكمل الدخول إلى الغرفة" : "أنشئ غرفتكما الخاصة"}</h2>
              {roomCode && <p>رمز الغرفة: <bdi>{roomCode}</bdi></p>}
            </div>
          </div>

          {roomCode && preview.isLoading && <p className="form-status" role="status">جارٍ التحقق من الدعوة…</p>}
          {roomCode && preview.error && <p className="error-message" role="alert">{preview.error.message}</p>}
          {roomFull && <p className="error-message" role="alert">اكتملت الغرفة بلاعبين. افتحها من الجهاز الذي استُخدم سابقاً.</p>}

          <label htmlFor="player-name">الاسم الذي سيراه الطرف الآخر</label>
          <input
            id="player-name"
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="اكتب اسمك"
            maxLength={20}
            required
            autoComplete="nickname"
            autoFocus
          />

          <fieldset className="gender-field">
            <legend>أنا…</legend>
            <div className="gender-options">
              {(["مذكر", "مؤنث"] as Gender[]).map((option) => {
                const taken = preview.data?.takenGenders.includes(option) ?? false;
                return (
                  <label key={option} className={`${gender === option ? "gender-option selected" : "gender-option"}${taken ? " taken" : ""}`}>
                    <input
                      type="radio"
                      name="gender"
                      value={option}
                      checked={gender === option}
                      onChange={() => setGender(option)}
                      disabled={taken}
                    />
                    <span>{option === "مذكر" ? "الزوج" : "الزوجة"}</span>
                    {taken && <small>مسجّل</small>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && <p className="error-message" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending || roomFull || genderTaken || Boolean(roomCode && !preview.data)}>
            {pending ? "جارٍ تجهيز الغرفة…" : roomCode ? "ادخل الغرفة" : "أنشئ الغرفة واعرض الدعوة"}
          </button>
          {roomCode && (
            <button className="text-button entry-new-room" type="button" onClick={onNewRoom} disabled={pending}>
              ليست غرفتكما؟ أنشئ غرفة جديدة
            </button>
          )}
          <p className="privacy-note"><ShieldCheck aria-hidden="true" /> رمز جهازك لا يدخل في رابط الدعوة، والإجابات لا تُكشف قبل اكتمالها.</p>
        </form>
      </section>
    </main>
  );
}
