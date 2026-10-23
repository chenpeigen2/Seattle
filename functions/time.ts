const SEATTLE_TZ = "America/Los_Angeles";
const SEATTLE_LAT = (47.6062 * Math.PI) / 180;
const SEATTLE_LON = -122.3321;
const RAD = Math.PI / 180;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SEATTLE_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SEATTLE_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export interface SeattleNight {
  night: string;
  nightStart: Date;
  dawnAt: Date;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function dateParts(date: Date): DateParts {
  const parts = dateFormatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function dateKey(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function addDays(parts: DateParts, days: number): DateParts {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function julianDay(parts: DateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000 + 2440587.5;
}

// Sunrise equation for Seattle. Good to a few minutes; enough for a window.
function sunrise(parts: DateParts): Date {
  const jd = julianDay(parts);
  const n = Math.ceil(jd - 2451545.0 + 0.0008);
  const jStar = n - SEATTLE_LON / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C =
    1.9148 * Math.sin(M * RAD) +
    0.02 * Math.sin(2 * M * RAD) +
    0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit =
    2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const delta = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosOmega =
    (Math.sin(-0.833 * RAD) - Math.sin(SEATTLE_LAT) * Math.sin(delta)) /
    (Math.cos(SEATTLE_LAT) * Math.cos(delta));
  const omega = Math.acos(Math.max(-1, Math.min(1, cosOmega))) / RAD;
  const rise = transit - omega / 360;
  return new Date((rise - 2440587.5) * 86400000);
}

export function getSeattleNight(now: Date): SeattleNight {
  const today = dateParts(now);
  const todaySunrise = sunrise(today);
  if (now.getTime() >= todaySunrise.getTime()) {
    const tomorrow = addDays(today, 1);
    return {
      night: dateKey(today),
      nightStart: todaySunrise,
      dawnAt: sunrise(tomorrow),
    };
  }
  const yesterday = addDays(today, -1);
  return {
    night: dateKey(yesterday),
    nightStart: sunrise(yesterday),
    dawnAt: todaySunrise,
  };
}

export function seattleClock(iso: string): string {
  return clockFormatter.format(new Date(iso));
}

export function dateKeyFor(iso: string): string {
  return dateKey(dateParts(new Date(iso)));
}
