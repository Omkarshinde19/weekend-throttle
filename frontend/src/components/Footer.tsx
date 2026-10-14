import { Github } from "lucide-react";
import "./footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <p className="footer__big">
        Ride with the <em>weather</em>,<br /> not against it.
      </p>
      <div className="footer__row">
        <span>Weekend Throttle · an AI mini project — a rule-based expert system for riders.</span>
        <span>
          Maps © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> via{" "}
          <a href="https://openfreemap.org">OpenFreeMap</a> · Weather by <a href="https://open-meteo.com">Open-Meteo</a> ·
          Routing by <a href="https://project-osrm.org">OSRM</a>
        </span>
        <a className="footer__gh" href="https://github.com/Omkarshinde19/weekend-throttle">
          <Github size={15} /> Source
        </a>
      </div>
      <p className="footer__note">Route and pitstop data is an unverified sample — check conditions locally before you ride.</p>
    </footer>
  );
}
