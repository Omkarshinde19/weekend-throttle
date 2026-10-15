import { describe, expect, it } from "vitest";
import { mix, sample } from "../lib/color";
import { describe as describeCond, describeThen } from "../lib/describeRule";
import { clamp, range } from "../lib/scroll";
import { sanitize } from "../state/persist";
import type { Inputs } from "../state/store";
import { fmtMinutes, toIso } from "../state/store";

describe("describeRule", () => {
  it("renders nested conditions as a sentence", () => {
    const when = {
      all: [
        { fact: "derived.rain_level", op: "in", value: ["moderate", "heavy"] },
        { not: { fact: "route.surface", op: "eq", value: "paved" } },
        { any: [{ fact: "x", op: "gt", value_fact: "y" }, { fact: "z", op: "exists" }] },
      ],
    };
    expect(describeCond(when)).toBe(
      "derived.rain_level is one of [moderate, heavy] AND NOT route.surface is paved AND (x > y OR z is known)",
    );
  });

  it("renders actions", () => {
    expect(describeThen({ set: { "derived.road_wet": true }, multiply: { "derived.break_factor": 0.85 } })).toBe(
      "derived.road_wet := true, derived.break_factor ×= 0.85",
    );
    expect(describeThen(undefined)).toBe("");
  });
});

describe("colour", () => {
  it("mixes and samples gradients", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
    const stops: [number, string][] = [
      [0, "#000000"],
      [1, "#ff0000"],
    ];
    expect(sample(stops, -1)).toBe("#000000");
    expect(sample(stops, 2)).toBe("#ff0000");
    expect(sample(stops, 0.5)).toBe("rgb(128, 0, 0)");
  });
});

describe("scroll maths", () => {
  it("clamps and maps ranges", () => {
    expect(clamp(5)).toBe(1);
    expect(clamp(-5)).toBe(0);
    expect(range(150, 100, 200)).toBe(0.5);
    expect(range(50, 100, 200)).toBe(0);
  });
});

describe("time helpers", () => {
  it("formats departure times and IST timestamps", () => {
    expect(fmtMinutes(0)).toBe("12:00 am");
    expect(fmtMinutes(15 * 60 + 30)).toBe("3:30 pm");
    expect(fmtMinutes(12 * 60 + 5)).toBe("12:05 pm");
    expect(toIso("2026-10-17", 15 * 60 + 30)).toBe("2026-10-17T15:30:00+05:30");
  });
});

describe("sanitize (shared links / stored inputs)", () => {
  const defaults: Inputs = {
    intent: "photography",
    bike: "cruiser",
    experience: "intermediate",
    pillion: false,
    date: "2026-10-17",
    minutes: 930,
    budget: 5,
    weather: "live",
  };

  it("accepts valid values", () => {
    const out = sanitize(
      { intent: "food", bike: "scooter", experience: "beginner", pillion: "1", date: "2026-10-20", minutes: "452", budget: "7.5", weather: "fog" },
      defaults,
      "2026-10-15",
    );
    expect(out).toEqual({ intent: "food", bike: "scooter", experience: "beginner", pillion: true, date: "2026-10-20", minutes: 450, budget: 7.5, weather: "fog" });
  });

  it("falls back on junk, past dates and out-of-range numbers", () => {
    const out = sanitize(
      { intent: "racing", bike: "<script>", date: "2020-01-01", minutes: "99999", budget: "-3", weather: "snow" },
      defaults,
      "2026-10-15",
    );
    expect(out).toEqual(defaults);
  });
});
