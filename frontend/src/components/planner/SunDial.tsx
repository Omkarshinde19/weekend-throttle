import { PointerEvent, useCallback, useMemo, useRef } from "react";
import { fmtMinutes } from "../../state/store";

const MIN = 4 * 60;
const MAX = 22 * 60;
const BELOW = 32; // degrees the arc continues under the horizon at each end

const W = 300;
const H = 170;
const CX = W / 2;
const CY = 140;
const R = 118;

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Departure-time picker drawn as the sun's path. Drag the sun along the arc: sunrise sits on the
 * left horizon, sunset on the right, the golden hour glows just before it, night is below the line.
 */
export function SunDial({
  minutes,
  onChange,
  sunrise = "06:30",
  sunset = "18:12",
}: {
  minutes: number;
  onChange: (m: number) => void;
  sunrise?: string;
  sunset?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const rise = toMin(sunrise);
  const set = toMin(sunset);

  // minutes ↔ angle (degrees, 0 = left horizon, 180 = right horizon, negative = below)
  const toAngle = useCallback(
    (m: number) => {
      if (m <= rise) return -BELOW + ((m - MIN) / (rise - MIN)) * BELOW;
      if (m >= set) return 180 + ((m - set) / (MAX - set)) * BELOW;
      return ((m - rise) / (set - rise)) * 180;
    },
    [rise, set],
  );
  const fromAngle = useCallback(
    (a: number) => {
      const m = a < 0 ? MIN + ((a + BELOW) / BELOW) * (rise - MIN) : a > 180 ? set + ((a - 180) / BELOW) * (MAX - set) : rise + (a / 180) * (set - rise);
      return Math.round(Math.min(MAX, Math.max(MIN, m)) / 15) * 15;
    },
    [rise, set],
  );

  const point = (a: number, r = R) => {
    const rad = (a * Math.PI) / 180;
    return [CX - Math.cos(rad) * r, CY - Math.sin(rad) * r] as const;
  };
  const arc = (a0: number, a1: number, r = R) => {
    const [x0, y0] = point(a0, r);
    const [x1, y1] = point(a1, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  const golden = useMemo(() => [toAngle(Math.max(rise, set - 60)), 180] as const, [toAngle, rise, set]);
  const angle = toAngle(minutes);
  const [kx, ky] = point(angle);
  const night = minutes < rise || minutes > set;

  const pick = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - CX;
    const y = CY - ((e.clientY - r.top) / r.height) * H;
    let a = (Math.atan2(y, -x) * 180) / Math.PI; // 0 at left, 90 at top, 180 at right
    if (a < -90) a += 360;
    onChange(fromAngle(Math.min(180 + BELOW, Math.max(-BELOW, a))));
  };

  return (
    <div className="sundial">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="sundial__svg"
        role="slider"
        aria-label="Departure time"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={minutes}
        aria-valuetext={fmtMinutes(minutes)}
        tabIndex={0}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => e.buttons && pick(e)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(MAX, minutes + 15));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(MIN, minutes - 15));
        }}
      >
        <path d={arc(-BELOW, 180 + BELOW)} className="sundial__track" />
        <path d={arc(0, 180)} className="sundial__day" />
        <path d={arc(golden[0], golden[1])} className="sundial__golden" />
        <line x1={8} x2={W - 8} y1={CY} y2={CY} className="sundial__horizon" />
        <text x={point(0)[0]} y={CY + 18} className="sundial__label" textAnchor="middle">
          ↑ {sunrise}
        </text>
        <text x={point(180)[0]} y={CY + 18} className="sundial__label" textAnchor="middle">
          ↓ {sunset}
        </text>
        <line x1={CX} y1={CY} x2={kx} y2={ky} className="sundial__hand" />
        <circle cx={kx} cy={ky} r={13} className={`sundial__knob ${night ? "is-night" : ""}`} />
      </svg>
      <div className="sundial__readout">
        <span className="sundial__time">{fmtMinutes(minutes)}</span>
        <span className="sundial__hint">{night ? "riding in the dark" : minutes >= set - 60 ? "golden hour" : "daylight"}</span>
      </div>
    </div>
  );
}
