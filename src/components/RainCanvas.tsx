import { useEffect, useRef } from "react";
import type { WeatherKind } from "../lib/types";

interface Props {
  kind: WeatherKind;
  intensity: number;
  reducedMotion: boolean;
}

interface Drop {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
  drift: number;
  size: number;
}

function wetKind(kind: WeatherKind): boolean {
  return kind === "rain" || kind === "drizzle" || kind === "storm" || kind === "snow";
}

export default function RainCanvas({ kind, intensity, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let drops: Drop[] = [];
    let frame = 0;
    let last = 0;

    const makeDrops = () => {
      if (!wetKind(kind)) {
        drops = [];
        return;
      }
      const snow = kind === "snow";
      const base = snow ? 0.55 : 1;
      const count = Math.round(
        Math.min(210, Math.max(18, ((width * height) / 15_000) * (0.28 + intensity * 1.35) * base)),
      );
      drops = Array.from({ length: reducedMotion ? Math.round(count * 0.4) : count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: (snow ? 1.4 : 8) + Math.random() * (snow ? 2 : 17),
        speed: snow ? 18 + Math.random() * 30 : 300 + Math.random() * 430 * (0.45 + intensity),
        alpha: (snow ? 0.22 : 0.1) + Math.random() * (snow ? 0.34 : 0.24),
        drift: snow ? -9 + Math.random() * 18 : -34 - Math.random() * 50,
        size: snow ? 0.8 + Math.random() * 1.8 : 0.65 + Math.random() * 0.85,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      makeDrops();
      draw(0);
    };

    const draw = (delta: number) => {
      context.clearRect(0, 0, width, height);
      if (!wetKind(kind)) return;
      const snow = kind === "snow";
      for (const drop of drops) {
        drop.y += drop.speed * delta;
        drop.x += drop.drift * delta;
        if (drop.y > height + drop.length) {
          drop.y = -drop.length;
          drop.x = Math.random() * width;
        }
        if (drop.x < -30) drop.x = width + 20;
        if (drop.x > width + 30) drop.x = -20;
        context.beginPath();
        if (snow) {
          context.fillStyle = `rgba(232, 238, 238, ${drop.alpha})`;
          context.arc(drop.x, drop.y, drop.size, 0, Math.PI * 2);
          context.fill();
        } else {
          context.strokeStyle = `rgba(214, 228, 232, ${drop.alpha})`;
          context.lineWidth = drop.size;
          context.moveTo(drop.x, drop.y);
          context.lineTo(drop.x + drop.drift * 0.035, drop.y + drop.length);
          context.stroke();
        }
      }
    };

    const tick = (time: number) => {
      const delta = last ? Math.min(0.05, (time - last) / 1000) : 0.016;
      last = time;
      draw(delta);
      if (!reducedMotion) frame = window.requestAnimationFrame(tick);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (!reducedMotion) frame = window.requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [kind, intensity, reducedMotion]);

  return <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />;
}
