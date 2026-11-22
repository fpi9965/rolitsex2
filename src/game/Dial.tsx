type DialProps = {
  slots: { used: boolean }[];
  cardSlot: number | null;
  version: number;
  spinning: boolean;
};

const CX = 125;
const CY = 125;
const OUTER = 116;
const INNER = 60;

function polar(angle: number, radius: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(radians), CY + radius * Math.sin(radians)];
}

function segmentPath(start: number, end: number) {
  const [x0, y0] = polar(start, OUTER);
  const [x1, y1] = polar(end, OUTER);
  const [x2, y2] = polar(end, INNER);
  const [x3, y3] = polar(start, INNER);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${OUTER} ${OUTER} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${INNER} ${INNER} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function Dial({ slots, cardSlot, version, spinning }: DialProps) {
  const count = Math.max(slots.length, 1);
  const segment = 360 / count;
  const rotation = cardSlot === null ? version * 12 : 360 * (version + 3) - (cardSlot + 0.5) * segment;
  const remaining = slots.filter((slot) => !slot.used).length;

  return (
    <div className={spinning ? "dial spinning" : "dial"} aria-label={`القرص، ${remaining} بطاقات متبقية`} role="img" aria-busy={spinning}>
      <span className="pointer" aria-hidden="true" />
      <svg viewBox="0 0 250 250" className="dial-svg" aria-hidden="true">
        <defs>
          <radialGradient id="ember-gradient" cx="45%" cy="35%" r="70%">
            <stop offset="20%" stopColor="var(--ember)" />
            <stop offset="100%" stopColor="var(--wine)" />
          </radialGradient>
        </defs>
        <circle className="dial-orbit" cx={CX} cy={CY} r="121" />
        <g className="dial-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
          {slots.map((slot, index) => (
            <path key={index} d={segmentPath(index * segment, (index + 1) * segment)} className={slot.used ? "segment used" : "segment"} />
          ))}
        </g>
        <circle className="dial-hub" cx={CX} cy={CY} r={INNER} />
        <text className="hub-number" x={CX} y="128">{remaining}</text>
        <text className="hub-label" x={CX} y="150">متبقٍ</text>
      </svg>
    </div>
  );
}
