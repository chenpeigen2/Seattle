export interface Stroke {
  points: [number, number][];
  width: number;
}

export interface WindowMessage {
  id: string;
  text: string | null;
  strokes: Stroke[] | null;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  createdAt: string;
  mine: boolean;
}

export interface WindowPayload {
  night: string;
  question: string;
  dawnAt: string;
  serverNow: string;
  messages: WindowMessage[];
  breaths: { x: number; y: number }[];
  breathCount: number;
  keeper: boolean;
}

export interface Draft {
  text: string;
  strokes: Stroke[];
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

export type WeatherKind = "clear" | "cloud" | "fog" | "drizzle" | "rain" | "storm" | "snow";

export interface Weather {
  status: "loading" | "ready" | "unavailable";
  kind: WeatherKind;
  label: string | null;
  temperature: number | null;
  intensity: number;
  cloud: number;
  wind: number;
  isDay: boolean | null;
}

export type Phase = "dawn" | "day" | "dusk" | "night";
