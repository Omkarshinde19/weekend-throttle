import { forwardRef, useMemo } from "react";
import { Pt, ridge, shadowFaces, snowCaps, toPath } from "../../lib/ridge";

const VB = "0 0 1600 900";
const BOTTOM = 900;

// Hand-placed control points; midpoint displacement adds the crags.
const FAR: Pt[] = [[-60, 520], [120, 468], [260, 498], [420, 438], [600, 482], [760, 428], [900, 470], [1080, 418], [1260, 468], [1420, 430], [1660, 480]];
const MID: Pt[] = [[-60, 610], [90, 505], [230, 565], [360, 455], [520, 545], [640, 470], [760, 560], [880, 520], [1000, 448], [1150, 545], [1300, 470], [1450, 545], [1660, 500]];
const MAIN: Pt[] = [[-60, 770], [150, 690], [300, 725], [460, 610], [565, 655], [690, 485], [800, 372], [880, 432], [950, 478], [1030, 445], [1110, 545], [1222, 610], [1352, 570], [1500, 705], [1660, 680]];
const FORE: Pt[] = [[-60, 792], [200, 762], [420, 802], [620, 772], [800, 822], [1000, 792], [1200, 742], [1400, 762], [1660, 728]];

export function useRange() {
  return useMemo(() => {
    const far = ridge(FAR, 0.32, 5, 11);
    const mid = ridge(MID, 0.42, 5, 23);
    const main = ridge(MAIN, 0.46, 6, 7);
    const fore = ridge(FORE, 0.12, 4, 5);
    return {
      far: toPath(far, { bottom: BOTTOM }),
      mid: toPath(mid, { bottom: BOTTOM }),
      midSnow: snowCaps(mid, 492, 31),
      main: toPath(main, { bottom: BOTTOM }),
      mainSnow: snowCaps(main, 478, 41),
      mainShadow: shadowFaces(main, BOTTOM, 3),
      fore: toPath(fore, { bottom: BOTTOM }),
    };
  }, []);
}

type LayerProps = { className?: string };

export const FarLayer = forwardRef<SVGSVGElement, LayerProps & { d: string }>(({ d, className }, ref) => (
  <svg ref={ref} className={`range range--far ${className ?? ""}`} viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden>
    <path d={d} />
  </svg>
));

export const MidLayer = forwardRef<SVGSVGElement, LayerProps & { d: string; snow: string[] }>(({ d, snow, className }, ref) => (
  <svg ref={ref} className={`range range--mid ${className ?? ""}`} viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden>
    <path d={d} className="rock" />
    {snow.map((s, i) => (
      <path key={i} d={s} className="snow" />
    ))}
  </svg>
));

export const MainLayer = forwardRef<SVGSVGElement, LayerProps & { d: string; snow: string[]; shadow: string[] }>(
  ({ d, snow, shadow, className }, ref) => (
    <svg ref={ref} className={`range range--main ${className ?? ""}`} viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="mainRock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="rock-top" />
          <stop offset="1" className="rock-bottom" />
        </linearGradient>
        <linearGradient id="alpenglow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="glow-a" />
          <stop offset="1" className="glow-b" />
        </linearGradient>
      </defs>
      <path d={d} fill="url(#mainRock)" />
      {snow.map((s, i) => (
        <path key={`s${i}`} d={s} className="snow" fill="url(#alpenglow)" />
      ))}
      {shadow.map((s, i) => (
        <path key={`h${i}`} d={s} className="shadow" />
      ))}
    </svg>
  ),
);

const FLAG_COLOURS = ["#2f6fd1", "#f1f1ec", "#d23b3b", "#2f9e5b", "#f2c230"];

function PrayerFlags({ x1, y1, x2, y2, sag, count }: { x1: number; y1: number; x2: number; y2: number; sag: number; count: number }) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag;
  const at = (t: number): [number, number] => [
    (1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t * t * x2,
    (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t * t * y2,
  ];
  return (
    <g className="flags">
      <line x1={x1} y1={y1} x2={x1} y2={y1 + 95} className="pole" />
      <line x1={x2} y1={y2} x2={x2} y2={y2 + 120} className="pole" />
      <path d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} className="string" />
      {Array.from({ length: count }, (_, i) => {
        const [x, y] = at((i + 0.7) / (count + 0.4));
        return (
          <rect
            key={i}
            x={x - 6}
            y={y}
            width={12}
            height={16}
            fill={FLAG_COLOURS[i % 5]}
            className="flag"
            style={{ animationDelay: `${(i % 7) * -0.37}s`, transformOrigin: `${x}px ${y}px` }}
          />
        );
      })}
    </g>
  );
}

function Chorten({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g className="chorten" transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-26} y={-14} width={52} height={14} />
      <rect x={-21} y={-26} width={42} height={12} />
      <rect x={-17} y={-36} width={34} height={10} />
      <path d="M-15 -36 Q-15 -62 0 -64 Q15 -62 15 -36 Z" />
      <rect x={-6} y={-72} width={12} height={8} />
      <path d="M-4 -72 L0 -104 L4 -72 Z" />
      <path d="M-5 -108 Q0 -114 5 -108 Q0 -111 -5 -108 Z" />
    </g>
  );
}

function Rider({ x, y }: { x: number; y: number }) {
  return (
    <g className="rider" transform={`translate(${x} ${y})`}>
      <path className="beam" d="M10 -9 L120 -32 L120 14 Z" />
      <circle className="lamp" cx={10} cy={-9} r={2.6} />
      <circle cx={-12} cy={0} r={6} className="wheel" />
      <circle cx={10} cy={0} r={6} className="wheel" />
      <path d="M-14 -6 L-2 -12 L8 -12 L12 -6 L6 -4 L-8 -4 Z" />
      <path d="M-4 -12 L-2 -24 Q1 -28 4 -24 L6 -14 Z" />
      <circle cx={1} cy={-29} r={4} />
    </g>
  );
}

export const ForeLayer = forwardRef<SVGSVGElement, LayerProps & { d: string }>(({ d, className }, ref) => (
  <svg ref={ref} className={`range range--fore ${className ?? ""}`} viewBox={VB} preserveAspectRatio="xMidYMax slice" aria-hidden>
    <path d={d} className="ground" />
    <path className="road" d="M-30 892 C 210 866, 420 846, 560 822 S 900 806, 1080 796 S 1350 776, 1640 768" />
    <path className="road-line" d="M-30 892 C 210 866, 420 846, 560 822 S 900 806, 1080 796 S 1350 776, 1640 768" />
    <Chorten x={300} y={808} s={1.05} />
    <Chorten x={378} y={812} s={0.62} />
    <PrayerFlags x1={1150} y1={672} x2={1470} y2={640} sag={46} count={15} />
    <Rider x={930} y={800} />
  </svg>
));
