import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { INK_LAYERS, inkShape } from "../lib/inkGeometry";
import type { InkShape } from "../lib/inkGeometry";
import type { Stroke } from "../lib/types";

interface Props {
  onChange: (strokes: Stroke[]) => void;
  resetToken: number;
  disabled?: boolean;
}

interface InkPaths {
  haloSoft: Path2D;
  halo: Path2D;
  body: Path2D;
  core: Path2D;
}

function pathsFor(shape: InkShape): InkPaths {
  return {
    haloSoft: new Path2D(shape.haloSoft),
    halo: new Path2D(shape.halo),
    body: new Path2D(shape.body),
    core: new Path2D(shape.core),
  };
}

const MAX_STROKES = 30;
const MAX_STROKE_POINTS = 136;
const MAX_POINTS = 620;
const STEP = 0.55;
const INK_WIDTH = 1.8;
const INK_RGB = "29, 37, 42";

function farEnough(from: [number, number], to: [number, number]): boolean {
  return Math.hypot((to[0] - from[0]) * 120, (to[1] - from[1]) * 40) >= STEP;
}

export default function DrawingPad({ onChange, resetToken, disabled = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const pointerRef = useRef<number | null>(null);
  const emitTimer = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const pathCache = useRef(new WeakMap<Stroke, InkPaths | null>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const paint = useCallback(() => {
    frameRef.current = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(width / 120, 0, 0, height / 40, 0, 0);
    context.clearRect(0, 0, 120, 40);

    for (const stroke of strokesRef.current) {
      let paths: InkPaths | null | undefined;
      if (stroke === activeRef.current) {
        const shape = inkShape(stroke);
        paths = shape ? pathsFor(shape) : null;
      } else {
        paths = pathCache.current.get(stroke);
        if (paths === undefined) {
          const shape = inkShape(stroke);
          paths = shape ? pathsFor(shape) : null;
          pathCache.current.set(stroke, paths);
        }
      }
      if (!paths) continue;
      for (const layer of INK_LAYERS) {
        context.fillStyle = `rgba(${INK_RGB}, ${layer.opacity})`;
        context.fill(paths[layer.key]);
      }
    }
  }, []);

  const schedulePaint = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(paint);
  }, [paint]);

  const emit = useCallback((immediate = false) => {
    const send = () => {
      onChangeRef.current(
        strokesRef.current.map((stroke) => ({
          width: stroke.width,
          points: stroke.points.map(([x, y]) => [x, y] as [number, number]),
        })),
      );
    };
    window.clearTimeout(emitTimer.current);
    if (immediate) {
      send();
    } else {
      emitTimer.current = window.setTimeout(send, 90);
    }
  }, []);

  useEffect(() => {
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    window.clearTimeout(emitTimer.current);
    strokesRef.current = [];
    activeRef.current = null;
    pointerRef.current = null;
    pathCache.current = new WeakMap();
    paint();
    emit(true);
  }, [resetToken, paint, emit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(schedulePaint);
    observer.observe(canvas);
    schedulePaint();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [schedulePaint]);

  const pointFor = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): [number, number] | null => {
    if (rect.width === 0 || rect.height === 0) return null;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
  };

  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || pointerRef.current !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const point = pointFor(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    if (!point) return;
    if (strokesRef.current.length >= MAX_STROKES) return;
    const total = strokesRef.current.reduce((sum, stroke) => sum + stroke.points.length, 0);
    if (total >= MAX_POINTS) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    const stroke: Stroke = { width: INK_WIDTH, points: [point] };
    activeRef.current = stroke;
    strokesRef.current.push(stroke);
    schedulePaint();
    emit();
  };

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || pointerRef.current !== event.pointerId) return;
    const stroke = activeRef.current;
    if (!stroke) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const native = event.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const samples = native.getCoalescedEvents?.() ?? [];
    const batch = samples.length > 0 ? samples : [native];
    let total = 0;
    for (const candidate of strokesRef.current) total += candidate.points.length;
    let changed = false;
    for (const sample of batch) {
      if (stroke.points.length >= MAX_STROKE_POINTS || total >= MAX_POINTS) break;
      const point = pointFor(sample.clientX, sample.clientY, rect);
      if (!point) continue;
      const last = stroke.points[stroke.points.length - 1];
      if (!farEnough(last, point)) continue;
      stroke.points.push(point);
      total += 1;
      changed = true;
    }
    if (!changed) return;
    event.preventDefault();
    schedulePaint();
    emit();
  };

  const finish = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    const stroke = activeRef.current;
    activeRef.current = null;
    if (!stroke) return;
    if (stroke.points.length === 1) {
      const [x, y] = stroke.points[0];
      stroke.points.push([
        x > 0.996 ? x - 0.004 : x + 0.004,
        y > 0.985 ? y - 0.004 : y + 0.004,
      ]);
    }
    schedulePaint();
    emit(true);
  };

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    pointerRef.current = null;
    activeRef.current = null;
    strokesRef.current = strokesRef.current.slice(0, -1);
    schedulePaint();
    emit(true);
  };

  const clear = () => {
    pointerRef.current = null;
    activeRef.current = null;
    strokesRef.current = [];
    schedulePaint();
    emit(true);
  };

  return (
    <div className={`sketch ${disabled ? "is-disabled" : ""}`}>
      <div className="sketch-head">
        <span>也可以画一小笔</span>
        <div className="sketch-tools">
          <button type="button" onClick={undo} disabled={disabled} aria-label="退回上一笔">
            退回一笔
          </button>
          <button type="button" onClick={clear} disabled={disabled} aria-label="重画">
            重画
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="sketch-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        aria-label="在雾上画一小幅画"
      />
      <span className="sketch-hint" aria-hidden="true">一小幅就好。可以不画。</span>
    </div>
  );
}
