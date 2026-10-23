import { memo, useMemo } from "react";
import { INK_LAYERS, inkShape } from "../lib/inkGeometry";
import type { Stroke } from "../lib/types";

interface Props {
  strokes: Stroke[];
  className?: string;
}

function Ink({ strokes, className }: Props) {
  const shapes = useMemo(() => strokes.map((stroke) => inkShape(stroke)), [strokes]);
  if (!shapes.some(Boolean)) return null;
  return (
    <svg
      className={className ? `ink ${className}` : "ink"}
      viewBox="0 0 120 40"
      role="img"
      aria-label="一小幅手绘"
    >
      {shapes.map((shape, index) =>
        shape ? (
          <g key={index} fill="var(--ink)">
            {INK_LAYERS.map((layer) => (
              <path key={layer.key} d={shape[layer.key]} opacity={layer.opacity} />
            ))}
          </g>
        ) : null,
      )}
    </svg>
  );
}

export default memo(Ink);
