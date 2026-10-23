import type { Stroke } from "./types";

const VIEW_WIDTH = 120;
const VIEW_HEIGHT = 40;
const HALO_SCALE = 2.2;
const HALO_SOFT_SCALE = 3.6;
const CORE_SCALE = 0.4;
const MAX_SAMPLES = 280;
const DEFAULT_WIDTH = 1.8;

interface Point {
  x: number;
  y: number;
}

export interface InkShape {
  haloSoft: string;
  halo: string;
  body: string;
  core: string;
}

export const INK_LAYERS = [
  { key: "haloSoft", opacity: 0.042 },
  { key: "halo", opacity: 0.062 },
  { key: "body", opacity: 0.82 },
  { key: "core", opacity: 0.22 },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function circlePath(point: Point, radius: number): string {
  const r = Math.max(0.03, radius);
  return `M${fmt(point.x - r)} ${fmt(point.y)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0Z`;
}

function closedPath(points: Point[]): string {
  const count = points.length;
  if (count < 3) return "";
  const start = midpoint(points[count - 1], points[0]);
  let path = `M${fmt(start.x)} ${fmt(start.y)}`;
  for (let index = 0; index < count; index += 1) {
    const current = points[index];
    const next = midpoint(current, points[(index + 1) % count]);
    path += `Q${fmt(current.x)} ${fmt(current.y)} ${fmt(next.x)} ${fmt(next.y)}`;
  }
  return `${path}Z`;
}

function preparePoints(stroke: Stroke): Point[] {
  const points: Point[] = [];
  for (const [rawX, rawY] of stroke.points) {
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
    const point = {
      x: clamp(rawX, 0, 1) * VIEW_WIDTH,
      y: clamp(rawY, 0, 1) * VIEW_HEIGHT,
    };
    const last = points[points.length - 1];
    if (last && distance(last, point) < 0.08) continue;
    points.push(point);
  }
  return points;
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const axis = (a: number, b: number, c: number, d: number) =>
    0.5 *
    (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return {
    x: axis(p0.x, p1.x, p2.x, p3.x),
    y: axis(p0.y, p1.y, p2.y, p3.y),
  };
}

function splinePath(points: Point[]): Point[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const control = [first, ...points, last];
  const dense: Point[] = [];
  for (let index = 0; index < control.length - 3; index += 1) {
    const p0 = control[index];
    const p1 = control[index + 1];
    const p2 = control[index + 2];
    const p3 = control[index + 3];
    const steps = clamp(Math.ceil(distance(p1, p2) / 0.5), 3, 32);
    for (let step = 0; step < steps; step += 1) {
      dense.push(catmullRom(p0, p1, p2, p3, step / steps));
    }
  }
  dense.push(last);
  return dense;
}

function resample(points: Point[], total: number, step: number): Point[] {
  if (points.length < 2 || total <= 0) return points;
  const count = Math.max(1, Math.floor(total / step));
  const spacing = total / count;
  const result: Point[] = [points[0]];
  let walked = 0;
  let target = spacing;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const segment = distance(from, to);
    while (segment > 0 && walked + segment >= target - 1e-6) {
      const t = clamp((target - walked) / segment, 0, 1);
      result.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
      target += spacing;
    }
    walked += segment;
  }
  const last = points[points.length - 1];
  const tail = result[result.length - 1];
  if (distance(tail, last) < spacing * 0.35) {
    result[result.length - 1] = last;
  } else {
    result.push(last);
  }
  return result;
}

function pathLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function widthProfile(base: number, count: number, length: number, seed: number): number[] {
  const softness = Math.min(1, length / 24);
  const widths: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = count <= 1 ? 0.5 : index / (count - 1);
    const head = 0.52 + 0.48 * smoothstep(0, 0.12, t);
    const tail = 0.13 + 0.87 * smoothstep(1, 0.55, t);
    const taper = 1 - (1 - head * tail) * (0.5 + 0.5 * softness);
    const breath =
      1 + 0.05 * Math.sin(t * 9.2 + seed) + 0.03 * Math.sin(t * 17.6 + seed * 1.7);
    widths.push(Math.max(0.08, base * taper * breath));
  }
  return widths;
}

function seedFor(points: Point[]): number {
  let seed = 0;
  const stride = Math.max(1, Math.floor(points.length / 12));
  for (let index = 0; index < points.length; index += stride) {
    seed = (seed * 31 + points[index].x * 0.73 + points[index].y * 1.17) % 6.28318;
  }
  return seed;
}

function ribbon(points: Point[], widths: number[], scale: number): string {
  const count = points.length;
  if (count < 2) return "";
  const edge: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(count - 1, index + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const half = Math.max(0.035, (widths[index] * scale) / 2);
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    edge.push({ x: points[index].x + nx, y: points[index].y + ny });
  }
  const boundary: Point[] = [];
  for (const point of edge) boundary.push(point);
  for (let index = edge.length - 1; index >= 0; index -= 1) {
    const center = points[index];
    boundary.push({ x: center.x * 2 - edge[index].x, y: center.y * 2 - edge[index].y });
  }
  const startRadius = Math.max(0.035, (widths[0] * scale) / 2);
  const endRadius = Math.max(0.035, (widths[count - 1] * scale) / 2);
  return `${closedPath(boundary)}${circlePath(points[0], startRadius)}${circlePath(
    points[count - 1],
    endRadius,
  )}`;
}

export function inkShape(stroke: Stroke): InkShape | null {
  const points = preparePoints(stroke);
  if (points.length === 0) return null;
  const base = clamp(
    Number.isFinite(stroke.width) ? stroke.width : DEFAULT_WIDTH,
    1.1,
    3.2,
  );

  if (points.length === 1 || pathLength(points) < 1.4) {
    const radius = base * 0.62;
    return {
      haloSoft: circlePath(points[0], radius * HALO_SOFT_SCALE),
      halo: circlePath(points[0], radius * HALO_SCALE),
      body: circlePath(points[0], radius),
      core: circlePath(points[0], radius * CORE_SCALE),
    };
  }

  const dense = splinePath(points);
  const length = pathLength(dense);
  const step = Math.max(0.65, length / MAX_SAMPLES);
  const samples = resample(dense, length, step);
  const widths = widthProfile(base, samples.length, length, seedFor(points));
  return {
    haloSoft: ribbon(samples, widths, HALO_SOFT_SCALE),
    halo: ribbon(samples, widths, HALO_SCALE),
    body: ribbon(samples, widths, 1),
    core: ribbon(samples, widths, CORE_SCALE),
  };
}
