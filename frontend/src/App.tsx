import { useCallback, useEffect } from "react";
import { WeatherFX } from "./components/fx/WeatherFX";
import { Hero } from "./components/hero/Hero";
import { Nav } from "./components/nav/Nav";
import { Planner } from "./components/planner/Planner";
import { Story } from "./components/story/Story";
import { useDawn } from "./hooks/useDawn";
import { useStore } from "./state/store";

export function App() {
  useDawn("planner");
  const fetchRides = useStore((s) => s.fetch);
  const loadRoutes = useStore((s) => s.loadRoutes);

  useEffect(() => {
    void fetchRides();
    void loadRoutes();
  }, [fetchRides, loadRoutes]);

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
        <Story />
        <Planner />
      </main>
    </>
  );
}
