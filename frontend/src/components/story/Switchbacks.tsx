import { useEffect, useRef, useState } from "react";
import { onScrollFrame, range } from "../../lib/scroll";

/**
 * A Khardung La–style switchback road that draws itself down its section as you scroll,
 * with a headlight riding the tip.
 */
function switchbackPath(w: number, h: number): string {
  const rows = Math.max(3, Math.round(h / 300));
  const rowH = h / rows;
  const left = w * 0.12;
  const right = w * 0.88;
  const turn = Math.min(70, rowH * 0.3);
  let x = w * 0.5;
  let y = 0;
  let d = `M${x} ${y}`;
  for (let i = 0; i < rows; i++) {
    const goingRight = i % 2 === 0;
    const end = goingRight ? right : left;
    const yNext = y + rowH;
    // Long traverse across the slope, descending as it goes…
    d += ` C${x} ${y + rowH * 0.35}, ${end - (goingRight ? turn * 2 : -turn * 2)} ${yNext - rowH * 0.45}, ${end} ${yNext - turn}`;
    // …then a tight hairpin.
    d += ` Q${end + (goingRight ? turn : -turn)} ${yNext}, ${end - (goingRight ? turn * 0.6 : -turn * 0.6)} ${yNext}`;
    x = end - (goingRight ? turn * 0.6 : -turn * 0.6);
    y = yNext;
  }
  return d;
}

export function Switchbacks() {
  const wrap = useRef<HTMLDivElement>(null);
  const road = useRef<SVGPathElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const lamp = useRef<SVGGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrap.current!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size.w || !road.current) return;
    const path = road.current;
    const total = path.getTotalLength();
    path.style.strokeDasharray = `${total}`;
    reveal.current!.style.strokeDasharray = `${total}`;

    return onScrollFrame(({ y, vh }) => {
      const el = wrap.current!;
      const top = el.getBoundingClientRect().top + y;
      const t = range(y, top - vh * 0.75, top + el.offsetHeight - vh * 0.6);
      const len = total * t;
      path.style.strokeDashoffset = String(total - len);
      reveal.current!.style.strokeDashoffset = String(total - len);
      const p = path.getPointAtLength(len);
      const q = path.getPointAtLength(Math.min(total, len + 4));
      const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      lamp.current!.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle})`);
      lamp.current!.style.opacity = t > 0.001 && t < 0.999 ? "1" : "0";
    });
  }, [size]);

  const d = size.w ? switchbackPath(size.w, size.h) : "";
  return (
    <div ref={wrap} className="switchbacks" aria-hidden>
      {size.w > 0 && (
        <svg width={size.w} height={size.h}>
          <defs>
            <mask id="road-reveal" maskUnits="userSpaceOnUse">
              <path ref={reveal} d={d} stroke="#fff" strokeWidth={40} fill="none" />
            </mask>
          </defs>
          <path d={d} className="switchbacks__shoulder" />
          <path ref={road} d={d} className="switchbacks__road" />
          <path d={d} className="switchbacks__paint" mask="url(#road-reveal)" />
          <g ref={lamp} className="switchbacks__lamp">
            <path d="M0 0 L90 -26 L90 26 Z" className="switchbacks__beam" />
            <circle r={5} />
          </g>
        </svg>
      )}
    </div>
  );
}
