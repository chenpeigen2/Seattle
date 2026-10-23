import { useEffect, useState } from "react";
import type { Weather, WeatherKind } from "./types";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=47.6062&longitude=-122.3321" +
  "&current=temperature_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,is_day" +
  "&timezone=America%2FLos_Angeles&forecast_days=1";

const FALLBACK: Weather = {
  status: "unavailable",
  kind: "fog",
  label: null,
  temperature: null,
  intensity: 0,
  cloud: 82,
  wind: 8,
  isDay: null,
};

interface Conditions {
  kind: WeatherKind;
  label: string;
  base: number;
}

const CODES: Record<number, Conditions> = {
  0: { kind: "clear", label: "晴", base: 0 },
  1: { kind: "clear", label: "晴间云", base: 0 },
  2: { kind: "cloud", label: "多云", base: 0 },
  3: { kind: "cloud", label: "阴", base: 0 },
  45: { kind: "fog", label: "有雾", base: 0 },
  48: { kind: "fog", label: "雾凇", base: 0 },
  51: { kind: "drizzle", label: "细雨", base: 0.28 },
  53: { kind: "drizzle", label: "细雨", base: 0.38 },
  55: { kind: "drizzle", label: "密雨", base: 0.5 },
  56: { kind: "drizzle", label: "冻雨", base: 0.36 },
  57: { kind: "drizzle", label: "冻雨", base: 0.48 },
  61: { kind: "rain", label: "小雨", base: 0.44 },
  63: { kind: "rain", label: "中雨", base: 0.66 },
  65: { kind: "rain", label: "大雨", base: 0.92 },
  66: { kind: "rain", label: "冻雨", base: 0.55 },
  67: { kind: "rain", label: "冻雨", base: 0.78 },
  71: { kind: "snow", label: "小雪", base: 0.34 },
  73: { kind: "snow", label: "中雪", base: 0.5 },
  75: { kind: "snow", label: "大雪", base: 0.72 },
  77: { kind: "snow", label: "雪粒", base: 0.32 },
  80: { kind: "rain", label: "阵雨", base: 0.46 },
  81: { kind: "rain", label: "阵雨", base: 0.64 },
  82: { kind: "rain", label: "骤雨", base: 0.9 },
  85: { kind: "snow", label: "阵雪", base: 0.42 },
  86: { kind: "snow", label: "阵雪", base: 0.62 },
  95: { kind: "storm", label: "雷雨", base: 0.8 },
  96: { kind: "storm", label: "雷雨", base: 0.9 },
  99: { kind: "storm", label: "雷雨", base: 1 },
};

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    is_day?: number;
  };
}

async function readWeather(): Promise<Weather> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error("weather_unavailable");
    const data = (await response.json()) as OpenMeteoResponse;
    const current = data.current;
    if (!current || typeof current.weather_code !== "number") throw new Error("weather_unavailable");
    const conditions = CODES[current.weather_code] ?? { kind: "cloud" as const, label: "阴", base: 0 };
    const precipitation = typeof current.precipitation === "number" ? current.precipitation : 0;
    const intensity =
      conditions.kind === "clear" || conditions.kind === "cloud" || conditions.kind === "fog"
        ? 0
        : Math.min(1, conditions.base + Math.min(0.18, precipitation * 0.04));
    return {
      status: "ready",
      kind: conditions.kind,
      label: conditions.label,
      temperature:
        typeof current.temperature_2m === "number" ? Math.round(current.temperature_2m) : null,
      intensity,
      cloud: typeof current.cloud_cover === "number" ? current.cloud_cover : 60,
      wind: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : 0,
      isDay: current.is_day === 1 ? true : current.is_day === 0 ? false : null,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export function useWeather(): Weather {
  const [weather, setWeather] = useState<Weather>({
    ...FALLBACK,
    status: "loading",
  });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const next = await readWeather();
        if (alive) setWeather(next);
      } catch {
        if (alive) {
          setWeather((previous) => (previous.status === "ready" ? previous : FALLBACK));
        }
      }
    };

    void load();
    const interval = window.setInterval(load, 15 * 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return weather;
}
