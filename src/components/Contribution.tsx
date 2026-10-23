import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { messageOpacity } from "../lib/time";
import type { WindowMessage } from "../lib/types";
import Ink from "./Ink";

export function inkAnchor(x: number): "left" | "center" | "right" {
  if (x < 27) return "left";
  if (x > 73) return "right";
  return "center";
}

export function inkTransform(x: number, rotation: number, scale: number): string {
  const shift = inkAnchor(x) === "left" ? "0%" : inkAnchor(x) === "right" ? "-100%" : "-50%";
  return `translate(${shift}, -50%) rotate(${rotation}deg) scale(${scale / 100})`;
}

interface Props {
  message: WindowMessage;
  now: number;
  dawnAt: string;
  index: number;
  total: number;
  keeper: boolean;
  selected: boolean;
  isNew: boolean;
  dissolving: boolean;
  reported: boolean;
  sediment?: boolean;
  displayX?: number;
  displayY?: number;
  onSelect: () => void;
  onReport: (id: string) => void;
  onErase: (id: string) => void;
}

export default function Contribution({
  message,
  now,
  dawnAt,
  index,
  total,
  keeper,
  selected,
  isNew,
  dissolving,
  reported,
  sediment,
  displayX,
  displayY,
  onSelect,
  onReport,
  onErase,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number>(0);
  const x = displayX ?? message.x;
  const y = displayY ?? message.y;
  const opacity = messageOpacity(message.createdAt, now, dawnAt, index, total);
  const chars = message.text ? Array.from(message.text).length : 0;
  const measure = chars > 0 && chars <= 9 ? "is-brief" : chars >= 26 ? "is-long" : "";
  const actionsAbove = y > 68;
  const spoken = message.text ? `窗上的一处字：${message.text}` : "窗上的一小幅画";

  useEffect(() => {
    if (!selected) setConfirming(false);
  }, [selected]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const askErase = () => {
    if (!confirming) {
      setConfirming(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setConfirming(false), 4_000);
      return;
    }
    window.clearTimeout(timer.current);
    setConfirming(false);
    onErase(message.id);
  };

  return (
    <div
      className={`contribution is-anchor-${inkAnchor(x)} ${measure} ${selected ? "is-selected" : ""} ${isNew ? "is-new" : ""} ${dissolving ? "is-dissolving" : ""} ${actionsAbove ? "actions-above" : ""} ${opacity < 0.4 ? "is-fading" : ""} ${sediment ? "is-sediment" : ""}`}
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          transform: inkTransform(x, message.rotation, message.scale),
          zIndex: selected ? 60 : 10 + index,
          "--ink-fade": opacity,
          "--x": x,
        } as CSSProperties
      }
      data-ink-id={message.id}
      data-interactive="true"
      tabIndex={0}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        } else if (event.key === "Escape" && selected) {
          onSelect();
        }
      }}
      role="group"
      aria-label={`${spoken}${keeper ? "。你是守窗人，可以擦去它。" : message.mine ? "。这是你留下的。" : "。"}`}
    >
      <div className="mark-halo" aria-hidden="true" />
      <div className="mark-body">
        {message.strokes && <Ink strokes={message.strokes} className="mark-ink" />}
        {message.text && <p className="ink-text">{message.text}</p>}
      </div>
      <div className="mark-actions" onClick={(event) => event.stopPropagation()}>
        {keeper ? (
          <button type="button" className="mark-action" onClick={askErase}>
            {confirming ? "真的擦去？" : "擦去"}
          </button>
        ) : message.mine ? (
          <button type="button" className="mark-action" onClick={askErase}>
            {confirming ? "真的擦掉？" : "擦掉"}
          </button>
        ) : (
          <button
            type="button"
            className="mark-action"
            disabled={reported}
            onClick={() => onReport(message.id)}
          >
            {reported ? "已告诉守窗人" : "告诉守窗人"}
          </button>
        )}
      </div>
    </div>
  );
}
