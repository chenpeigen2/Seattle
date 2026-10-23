import { useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { Stroke } from "../lib/types";
import DrawingPad from "./DrawingPad";

interface Props {
  open: boolean;
  text: string;
  strokes: Stroke[];
  placement: { x: number; y: number };
  submitting: boolean;
  error: string | null;
  padReset: number;
  onText: (value: string) => void;
  onStrokes: (strokes: Stroke[]) => void;
  onClose: () => void;
  onRandomize: () => void;
  onSubmit: () => Promise<void>;
}

function placeWord(x: number, y: number): string {
  const horizontal = x < 42 ? "左" : x > 58 ? "右" : "";
  const vertical = y < 40 ? "上" : y > 64 ? "下" : "";
  if (!horizontal && !vertical) return "正中";
  if (!vertical) return `${horizontal}侧`;
  if (!horizontal) return `${vertical}方`;
  return `${horizontal}${vertical}角`;
}

export default function Composer({
  open,
  text,
  strokes,
  placement,
  submitting,
  error,
  padReset,
  onText,
  onStrokes,
  onClose,
  onRandomize,
  onSubmit,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const points = Array.from(text).length;
  const hasInk = text.trim().length > 0 || strokes.length > 0;

  useEffect(() => {
    const panel = panelRef.current;
    if (panel) panel.toggleAttribute("inert", !open);
  }, [open]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
      document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
      document.body.classList.toggle("keyboard-open", inset > 80);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      document.documentElement.style.removeProperty("--keyboard-inset");
      document.body.classList.remove("keyboard-open");
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (window.matchMedia("(min-width: 900px)").matches) {
      const timer = window.setTimeout(() => textRef.current?.focus(), 260);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  const changeText = (value: string) => {
    onText(Array.from(value).slice(0, 40).join(""));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasInk || submitting) return;
    await onSubmit();
  };

  return (
    <div
      ref={panelRef}
      className={`composer ${open ? "is-open" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="composer-title"
      aria-hidden={!open}
    >
      <div className="composer-head">
        <div>
          <h2 id="composer-title">
            <span className="composer-mark" aria-hidden="true" />
            在雾上留一句
          </h2>
          <p>天亮时，它会随雾散去。</p>
        </div>
        <button type="button" className="composer-close" onClick={onClose} disabled={submitting}>
          再想想
        </button>
      </div>

      <form
        onSubmit={submit}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && hasInk && !submitting) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      >
        <label className="visually-hidden" htmlFor="window-note">
          写一句留给天亮的话，四十个字以内
        </label>
        <div className="composer-note">
          <textarea
            id="window-note"
            ref={textRef}
            value={text}
            onChange={(event) => changeText(event.target.value)}
            placeholder="写一句留给天亮的话…"
            rows={2}
            maxLength={80}
            disabled={submitting}
          />
          <span className={`counter ${points >= 34 ? "is-near" : ""}`} aria-live="polite">
            {points >= 34 ? `${40 - points}` : ""}
          </span>
        </div>

        <DrawingPad onChange={onStrokes} resetToken={padReset} disabled={submitting} />

        <div className="placement-row">
          <span>
            字落在窗的<strong>{placeWord(placement.x, placement.y)}</strong>。
          </span>
          <button type="button" onClick={onRandomize} disabled={submitting}>
            换个地方
          </button>
          <span className="placement-hint">或轻点玻璃</span>
        </div>

        {error && (
          <p className="composer-error" role="alert">
            {error}
          </p>
        )}

        <div className="composer-actions">
          <button type="submit" className="composer-submit" disabled={!hasInk || submitting}>
            {submitting ? "正在留在窗上…" : "留在窗上"}
          </button>
          <span className="composer-small">
            <i aria-hidden="true" />
            每人每夜，只留一处。
          </span>
        </div>
      </form>
    </div>
  );
}
