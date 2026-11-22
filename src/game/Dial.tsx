type DialProps = {
  slots: { used: boolean }[];
  cardSlot: number | null;
  version: number;
  spinning: boolean;
};

export function Dial({ slots, cardSlot, version, spinning }: DialProps) {
  const remaining = slots.filter((slot) => !slot.used).length;
  const rotation = cardSlot === null ? version * 23 : version * 95 + cardSlot * 37;
  return (
    <div className={spinning ? "dial mystery-orb spinning" : "dial mystery-orb"}
      role="img" aria-busy={spinning} aria-label={`كرة المفاجآت، ${remaining} بطاقة متبقية`}>
      <div className="orb-aura" aria-hidden="true" />
      <div className="orb-ring" style={{ transform: `rotate(${rotation}deg)` }} aria-hidden="true">
        <span className="orb-spark orb-spark-one">✧</span>
        <span className="orb-spark orb-spark-two">✦</span>
        <span className="orb-spark orb-spark-three">✧</span>
      </div>
      <div className="orb-core">
        <span className="orb-glyph" aria-hidden="true">✦</span>
        <strong>{remaining}</strong>
        <small>مفاجأة متبقية</small>
      </div>
    </div>
  );
}
