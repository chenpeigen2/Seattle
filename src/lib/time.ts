import type { Phase } from "./types";

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/Los_Angeles",
  month: "long",
  day: "numeric",
});

const dawnFormat = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/Los_Angeles",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function seattleTime(ms: number): { text: string; hour: number; minute: number } {
  const parts = clockFormat.formatToParts(new Date(ms));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const hour = read("hour");
  const minute = read("minute");
  return {
    text: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
    minute,
  };
}

export function seattleDate(ms: number): string {
  return dateFormat.format(new Date(ms));
}

export function dawnTime(iso: string): string {
  return dawnFormat.format(new Date(iso));
}

export function scenePhase(
  nowMs: number,
  dawnAt: string,
  isDay: boolean | null,
): Phase {
  const { hour, minute } = seattleTime(nowMs);
  const decimal = hour + minute / 60;
  const dawn = Date.parse(dawnAt);
  if (Number.isFinite(dawn) && nowMs >= dawn && nowMs - dawn < 55 * 60_000) return "dawn";
  if (isDay === true) return "day";
  if (isDay === false) return decimal >= 16.5 && decimal < 21.5 ? "dusk" : "night";
  if (decimal >= 6 && decimal < 8) return "dawn";
  if (decimal >= 8 && decimal < 17.5) return "day";
  if (decimal >= 17.5 && decimal < 20) return "dusk";
  return "night";
}

export function dawnCountdown(dawnAt: string, nowMs: number): string {
  const remaining = Date.parse(dawnAt) - nowMs;
  if (!Number.isFinite(remaining)) return "天将亮";
  if (remaining <= 0) return "天就要亮了";
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `再过 ${minutes} 分钟，天就亮了`;
  if (minutes === 0) return `再过 ${hours} 小时，天就亮了`;
  return `再过 ${hours} 小时 ${minutes} 分，天就亮了`;
}

export function breatheWord(count: number): string {
  if (count === 1) return "一";
  if (count === 2) return "两";
  if (count === 3) return "三";
  if (count === 4) return "四";
  if (count === 5) return "五";
  return "几";
}

export function messageOpacity(
  createdAt: string,
  nowMs: number,
  dawnAt: string,
  index: number,
  total: number,
): number {
  const created = Date.parse(createdAt);
  const dawn = Date.parse(dawnAt);
  const ageHours = Number.isFinite(created) ? Math.max(0, (nowMs - created) / 3_600_000) : 0;
  const age = Math.max(0.7, 1 - ageHours * 0.009);
  const crowd = total > 18 ? Math.max(0.62, 1 - (total - 18) * 0.008 - (index / Math.max(1, total)) * 0.12) : 1;
  const remaining = Number.isFinite(dawn) ? dawn - nowMs : Infinity;
  const dawnFade =
    remaining <= 0
      ? 0
      : remaining < 2 * 3_600_000
        ? Math.max(0.16, 0.16 + (remaining / (2 * 3_600_000)) * 0.84)
        : 1;
  return Math.max(0.12, Math.min(1, age * crowd * dawnFade)) * 0.94;
}
