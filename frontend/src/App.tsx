import { useCallback, useEffect } from "react";
import { WeatherFX } from "./components/fx/WeatherFX";
import { Hero } from "./components/hero/Hero";
import { Nav } from "./components/nav/Nav";
import { useDawn } from "./hooks/useDawn";
import { useStore } from "./state/store";

export function App() {
  useDawn("planner");
  const fetchRides = useStore((s) => s.fetch);

  useEffect(() => {
    void fetchRides();
  }, [fetchRides]);

  const goPlan = useCallback(() => {
    document.getElementById("planner")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <>
      <div className="sky" aria-hidden />
      <WeatherFX plannerId="planner" />
      <Nav onPlan={goPlan} />
      <main>
        <Hero onPlan={goPlan} />
        <section id="story" style={{ height: "150vh" }} />
        <section id="planner" style={{ minHeight: "120vh" }} />
      </main>
    </>
  );
}
