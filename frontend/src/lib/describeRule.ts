/** Turns the rule DSL back into a readable sentence for the engine room. */

type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { fact: string; op: string; value?: unknown; value_fact?: string };

const OPS: Record<string, string> = {
  eq: "is",
  ne: "is not",
  in: "is one of",
  not_in: "is not one of",
  contains: "includes",
  contains_any: "includes any of",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
  between: "is between",
  exists: "is known",
};

function value(v: unknown): string {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  return String(v);
}

export function describe(c: unknown): string {
  const cond = c as Cond;
  if ("all" in cond) return cond.all.map(describe).join(" AND ");
  if ("any" in cond) return `(${cond.any.map(describe).join(" OR ")})`;
  if ("not" in cond) return `NOT ${describe(cond.not)}`;
  const rhs = cond.op === "exists" ? "" : ` ${cond.value_fact ?? value(cond.value)}`;
  return `${cond.fact} ${OPS[cond.op] ?? cond.op}${rhs}`;
}

export function describeThen(then: unknown): string {
  if (!then || typeof then !== "object") return "";
  const t = then as { set?: Record<string, unknown>; multiply?: Record<string, number> };
  const parts = [
    ...Object.entries(t.set ?? {}).map(([k, v]) => `${k} := ${value(v)}`),
    ...Object.entries(t.multiply ?? {}).map(([k, v]) => `${k} ×= ${v}`),
  ];
  return parts.join(", ");
}
