import { useEffect, useState } from "react";
import { ArrowRight, Cpu } from "lucide-react";
import { onScrollFrame } from "../../lib/scroll";
import { useStore } from "../../state/store";
import "./nav.css";

const LINKS = [
  { href: "#top", label: "Home" },
  { href: "#story", label: "How it thinks" },
  { href: "#planner", label: "Planner" },
];

export function Nav({ onPlan }: { onPlan: () => void }) {
  const [day, setDay] = useState(false);
  const openEngine = useStore((s) => s.openEngine);

  useEffect(
    () =>
      onScrollFrame(() => {
        const dawn = parseFloat(document.documentElement.style.getPropertyValue("--dawn")) || 0;
        setDay((prev) => (prev ? dawn > 0.66 : dawn > 0.7));
      }),
    [],
  );

  return (
    <header className={`nav ${day ? "nav--day" : ""}`}>
      <a href="#top" className="nav__brand" aria-label="Weekend Throttle home">
        <svg viewBox="0 0 40 28" className="nav__mark" aria-hidden>
          <path d="M1 26 L12 9 L18 16 L26 3 L39 26 Z" />
          <path d="M26 3 L23 9 L25.5 8 L27 10.5 L29 7.5 Z" className="nav__mark-snow" />
        </svg>
        <span>
          Weekend <b>Throttle</b>
        </span>
      </a>

      <nav className="nav__links" aria-label="Sections">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href}>
            {l.label}
          </a>
        ))}
        <button onClick={() => openEngine(true)}>Engine room</button>
      </nav>

      <div className="nav__actions">
        <button className="nav__icon" onClick={() => openEngine(true)} aria-label="Open the engine room">
          <Cpu size={16} />
        </button>
        <button className="nav__start" onClick={onPlan}>
          Start a ride
          <span>
            <ArrowRight size={15} />
          </span>
        </button>
      </div>
    </header>
  );
}
