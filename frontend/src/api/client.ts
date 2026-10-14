import type { RecommendRequest, RecommendResponse, RulesResponse, SunInfo, Weather } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("Can't reach the ride engine. Is the backend running on :8000?");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(`Engine replied ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  recommend: (body: RecommendRequest, signal?: AbortSignal) =>
    request<RecommendResponse>("/recommend", { method: "POST", body: JSON.stringify(body), signal }),
  rules: () => request<RulesResponse>("/rules"),
  sun: (lat: number, lng: number) => request<SunInfo>(`/sun?lat=${lat}&lng=${lng}`),
  weather: (lat: number, lng: number) => request<Weather>(`/weather?lat=${lat}&lng=${lng}`),
};
