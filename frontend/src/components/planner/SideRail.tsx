import { useEffect, useState } from "react";
import { Ban, Compass, Cpu, ListChecks, MapPin, Timer } from "lucide-react";
import { useStore } from "../../state/store";
import { BikeIcon } from "./BikeIcon";

const ITEMS = [
  { href: "#planner", label: "Planner", Icon: Compass },
  { href: "#why", label: "Why this route", Icon: ListChecks },
  { href: "#timeline", label: "Timeline", Icon: Timer },
  { href: "#pitstops", label: "Pitstops", Icon: MapPin },
  { href: "#excluded", label: "Ruled out", Icon: Ban },
];

/** Villa-style vertical rail, shown while the planner is on screen. */
export function SideRail() {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState("#planner");
  const bike = useStore((s) => s.inputs.bike);
  const openEngine = useStore((s) => s.openEngine);

  useEffect(() => {
    const planner = document.getElementById("planner");
    if (!planner) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(planner);

    const spy = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    const watch = () => ITEMS.forEach((i) => {
      const el = document.querySelector(i.href);
      if (el) spy.observe(el);
    });
    watch();
    const retry = setInterval(watch, 1500); // sections appear once results arrive
    return () => {
      io.disconnect();
      spy.disconnect();
      clearInterval(retry);
    };
  }, []);

  return (
    <nav className={`rail ${visible ? "is-visible" : ""}`} aria-label="Planner sections">
      {ITEMS.map(({ href, label, Icon }) => (
        <a key={href} href={href} className={active === href ? "is-on" : ""} aria-label={label} title={label}>
          <Icon size={18} strokeWidth={1.7} />
        </a>
      ))}
      <button onClick={() => openEngine(true)} aria-label="Engine room" title="Engine room">
        <Cpu size={18} strokeWidth={1.7} />
      </button>
      <span className="rail__bike" title={`Riding a ${bike}`}>
        <BikeIcon bike={bike} size={34} />
      </span>
    </nav>
  );
}
