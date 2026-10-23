import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import Breaths from "./components/Breaths";
import Composer from "./components/Composer";
import Contribution, { inkAnchor, inkTransform } from "./components/Contribution";
import DawnWipe from "./components/DawnWipe";
import Help from "./components/Help";
import Ink from "./components/Ink";
import Scene from "./components/Scene";
import {
  eraseMessage,
  fetchWindow,
  reportMessage,
  sendBreath,
  sweepWindow,
  WindowApiError,
  writeToWindow,
} from "./lib/api";
import { hasSeenWelcome, markWelcomeSeen } from "./lib/client";
import { WindowSound } from "./lib/sound";
import { breatheWord, dawnCountdown, scenePhase, seattleTime } from "./lib/time";
import type { Stroke, WindowMessage, WindowPayload } from "./lib/types";
import { useWeather } from "./lib/weather";

interface Notice {
  id: number;
  text: string;
}

interface Wisp {
  id: number;
  x: number;
  y: number;
  size: number;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useSmallScreen(): boolean {
  const [small, setSmall] = useState(() => window.matchMedia("(max-width: 899px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const onChange = () => setSmall(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return small;
}

function inkHash(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function inkBoxes(): { x0: number; x1: number; y0: number; y1: number }[] {
  const glass = document.querySelector<HTMLElement>(".window");
  if (!glass) return [];
  const pane = glass.getBoundingClientRect();
  if (!pane.width || !pane.height) return [];
  return Array.from(document.querySelectorAll<HTMLElement>(".contribution")).map((node) => {
    const box = node.getBoundingClientRect();
    return {
      x0: ((box.left - pane.left) / pane.width) * 100,
      x1: ((box.right - pane.left) / pane.width) * 100,
      y0: ((box.top - pane.top) / pane.height) * 100,
      y1: ((box.bottom - pane.top) / pane.height) * 100,
    };
  });
}

function randomPlacement(
  occupied: WindowMessage[] = [],
  avoidComposer = false,
): { x: number; y: number } {
  const mobile = window.innerWidth < 900;
  const bounds = mobile
    ? { x0: 16, x1: 84, y0: 23, y1: 30 }
    : { x0: 14, x1: 86, y0: 28, y1: 78 };
  const draft = mobile ? { w: 62, h: 9 } : { w: 27, h: 8 };
  const boxes = inkBoxes();
  if (avoidComposer && !mobile) boxes.push({ x0: 66, x1: 100, y0: 12, y1: 80 });
  let best = { x: (bounds.x0 + bounds.x1) / 2, y: (bounds.y0 + bounds.y1) / 2 };
  let bestScore = -Infinity;
  for (let gx = bounds.x0; gx <= bounds.x1; gx += 3) {
    for (let gy = bounds.y0; gy <= bounds.y1; gy += 2) {
      const x = gx + (Math.random() - 0.5) * 2;
      const y = gy + (Math.random() - 0.5) * 1.2;
      const anchor = inkAnchor(x);
      const left = anchor === "left" ? x : anchor === "right" ? x - draft.w : x - draft.w / 2;
      const top = y - draft.h / 2;
      const right = left + draft.w;
      const bottom = top + draft.h;

      let overlap = 0;
      for (const box of boxes) {
        const hitX = Math.min(right, box.x1 + 1) - Math.max(left, box.x0 - 1);
        const hitY = Math.min(bottom, box.y1 + 1) - Math.max(top, box.y0 - 1);
        if (hitX > 0 && hitY > 0) overlap += hitX * hitY;
      }
      const outside =
        Math.max(0, 3 - left) +
        Math.max(0, right - 97) +
        Math.max(0, 2 - top) +
        Math.max(0, bottom - 92);
      let nearest = 24;
      for (const message of occupied) {
        nearest = Math.min(nearest, Math.hypot((x - message.x) * 0.9, (y - message.y) * 1.9));
      }
      const score = -overlap * 14 - outside * 20 + nearest * 0.5 + Math.random() * 2;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function errorCopy(code: string | undefined): string {
  switch (code) {
    case "already_written":
      return "今夜你已经留下一句了。";
    case "ip_limit":
      return "这扇窗今晚有点挤。明晚再来吧。";
    case "not_allowed":
      return "这句话没能留在窗上。换一句吧。";
    case "too_long":
      return "一句话就好，最多四十个字。";
    case "empty":
      return "写一句，或画一小笔。";
    case "invalid_strokes":
      return "这一笔有点重，再画一次试试。";
    case "invalid_placement":
      return "这里放不下，换个地方吧。";
    case "not_found":
      return "这句话已经散了。";
    case "not_yours":
      return "只能擦掉自己写的那句。";
    case "own_message":
      return "这一句是你自己的。";
    case "keeper_taken":
      return "这扇窗已经有守窗人了。";
    case "missing_client":
      return "窗没有听清。再试一次。";
    default:
      return "雾太重，没能送出去。等一会儿再试。";
  }
}

export default function App() {
  const [data, setData] = useState<WindowPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(() => new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftStrokes, setDraftStrokes] = useState<Stroke[]>([]);
  const [placement, setPlacement] = useState({ x: 50, y: 52 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(100);
  const [padReset, setPadReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dawnEvent, setDawnEvent] = useState(0);
  const [wisps, setWisps] = useState<Wisp[]>([]);
  const [dissolving, setDissolving] = useState<Set<string>>(() => new Set());
  const [inkPlacements, setInkPlacements] = useState<Record<string, { x: number; y: number }>>({});
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  const smallScreen = useSmallScreen();
  const [hostBadge, setHostBadge] = useState(() =>
    Boolean(document.querySelector("#qoder-sites-watermark")),
  );
  const mobileReadableLimit =
    viewport.h >= 820 ? (viewport.w >= 420 ? 8 : 6) : viewport.h >= 700 ? 5 : viewport.h >= 600 ? 4 : 3;
  const readableInk = (() => {
    if (!smallScreen || !data) return null;
    const newest = [...data.messages].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const keep = new Set(newest.slice(0, mobileReadableLimit).map((message) => message.id));
    const own = data.messages.find((message) => message.mine);
    if (own) keep.add(own.id);
    return keep;
  })();
  const weather = useWeather();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (hostBadge) return;
    const hasBadge = () => Boolean(document.querySelector("#qoder-sites-watermark"));
    if (hasBadge()) {
      setHostBadge(true);
      return;
    }
    const observer = new MutationObserver(() => {
      if (!hasBadge()) return;
      observer.disconnect();
      setHostBadge(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [hostBadge]);

  const dataRef = useRef<WindowPayload | null>(null);
  const nightRef = useRef<string | null>(null);
  const welcomeRef = useRef(false);
  const noticeIdRef = useRef(0);
  const wispIdRef = useRef(0);
  const wispTimers = useRef<number[]>([]);
  const dissolveTimers = useRef<number[]>([]);
  const soundRef = useRef<WindowSound | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);

  const wet =
    weather.kind === "rain" ||
    weather.kind === "drizzle" ||
    weather.kind === "storm" ||
    weather.kind === "snow";

  const notify = useCallback((text: string) => {
    noticeIdRef.current += 1;
    setNotice({ id: noticeIdRef.current, text });
  }, []);

  const commitData = useCallback((next: WindowPayload | null) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const loadWindow = useCallback(async (): Promise<WindowPayload | null> => {
    try {
      const next = await fetchWindow();
      const previousNight = nightRef.current;
      if (previousNight && previousNight !== next.night) {
        nightRef.current = next.night;
        setDawnEvent((value) => value + 1);
        setComposerOpen(false);
        setRewriteOpen(false);
        setSelectedId(null);
        setNewId(null);
        setReported(new Set());
        setDissolving(new Set());
        dissolveTimers.current.forEach((timer) => window.clearTimeout(timer));
        dissolveTimers.current = [];
        setDraftText("");
        setDraftStrokes([]);
        setPadReset((value) => value + 1);
      }
      nightRef.current = next.night;
      commitData(next);
      setStatus("ready");

      if (!welcomeRef.current) {
        welcomeRef.current = true;
        if (!hasSeenWelcome()) {
          window.setTimeout(() => {
            notify("玻璃上的字，天亮就会散。");
            markWelcomeSeen();
          }, 4_200);
        }
      }
      return next;
    } catch {
      if (!dataRef.current) setStatus("error");
      return null;
    }
  }, [commitData, notify]);

  const retry = useCallback(async () => {
    setStatus("loading");
    await loadWindow();
  }, [loadWindow]);

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      const loaded = await loadWindow();
      if (loaded && alive) void sweepWindow().catch(() => {});
    };
    void boot();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadWindow();
    }, 60_000);
    const tick = window.setInterval(() => setNow(Date.now()), 20_000);
    const breathe = () => {
      if (document.visibilityState !== "visible") return;
      void sendBreath(Math.round(14 + Math.random() * 72), Math.round(24 + Math.random() * 52)).catch(
        () => {},
      );
    };
    const firstBreath = window.setTimeout(breathe, 9_000);
    const breathLoop = window.setInterval(breathe, 42_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadWindow();
      breathe();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      window.clearInterval(poll);
      window.clearInterval(tick);
      window.clearInterval(breathLoop);
      window.clearTimeout(firstBreath);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadWindow]);

  useEffect(() => {
    if (!data?.dawnAt) return;
    const delay = Date.parse(data.dawnAt) - Date.now() + 5_000;
    if (!Number.isFinite(delay)) return;
    const timer = window.setTimeout(() => void loadWindow(), clamp(delay, 2_000, 2_100_000_000));
    return () => window.clearTimeout(timer);
  }, [data?.dawnAt, loadWindow]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4_800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!newId) return;
    const timer = window.setTimeout(() => setNewId(null), 2_400);
    return () => window.clearTimeout(timer);
  }, [newId]);

  useEffect(() => {
    if (!dawnEvent) return;
    const timer = window.setTimeout(() => setDawnEvent(0), 5_600);
    return () => window.clearTimeout(timer);
  }, [dawnEvent]);

  useEffect(() => {
    if (selectedId && data && !data.messages.some((message) => message.id === selectedId)) {
      setSelectedId(null);
    }
  }, [data, selectedId]);

  useEffect(() => {
    if (rewriteOpen && !data?.messages.some((message) => message.mine)) setRewriteOpen(false);
  }, [rewriteOpen, data]);

  useEffect(() => {
    soundRef.current?.setWet(wet);
  }, [wet]);

  useEffect(() => () => soundRef.current?.dispose(), []);

  useEffect(() => {
    if (!rewriteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !rewriting) setRewriteOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rewriteOpen, rewriting]);

  useEffect(
    () => () => {
      wispTimers.current.forEach((timer) => window.clearTimeout(timer));
      dissolveTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.body.classList.contains("keyboard-open")) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        setViewport((previous) =>
          Math.abs(previous.w - w) < 40 && Math.abs(previous.h - h) < 80 ? previous : { w, h },
        );
      }, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useLayoutEffect(() => {
    if (!smallScreen) {
      setInkPlacements((previous) => (Object.keys(previous).length ? {} : previous));
      return;
    }
    const messages = data?.messages ?? [];
    if (messages.length === 0) {
      setInkPlacements((previous) => (Object.keys(previous).length ? {} : previous));
      return;
    }
    if (composerOpen) return;

    const win = windowRef.current;
    const layer = win?.querySelector<HTMLElement>("#ink-layer");
    if (!win || !layer) return;
    const winRect = win.getBoundingClientRect();
    if (winRect.width < 1 || winRect.height < 1) return;

    const nodes = new Map<string, HTMLElement>();
    layer.querySelectorAll<HTMLElement>(".contribution[data-ink-id]").forEach((node) => {
      const id = node.dataset.inkId;
      if (id) nodes.set(id, node);
    });

    interface Box {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      cx: number;
      cy: number;
    }
    const overlapArea = (a: Box, b: Box) =>
      Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
      Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const boxFor = (left: number, top: number, w: number, h: number): Box => ({
      x0: left,
      y0: top,
      x1: left + w,
      y1: top + h,
      cx: left + w / 2,
      cy: top + h / 2,
    });
    const relativeBox = (el: Element, pad: number): Box => {
      const r = el.getBoundingClientRect();
      const x0 = r.left - winRect.left - pad;
      const y0 = r.top - winRect.top - pad;
      const x1 = r.right - winRect.left + pad;
      const y1 = r.bottom - winRect.top + pad;
      return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };

    const questionEl = win.querySelector(".question-block");
    const footerEl = win.querySelector(".bottombar");
    const topbarEl = win.querySelector(".topbar");
    const reserved: Box[] = [];
    if (questionEl) reserved.push(relativeBox(questionEl, 10));
    if (footerEl) reserved.push(relativeBox(footerEl, 10));
    if (topbarEl) reserved.push(relativeBox(topbarEl, 6));

    const fieldTop = Math.max(
      questionEl ? questionEl.getBoundingClientRect().bottom - winRect.top + 18 : 120,
      topbarEl ? topbarEl.getBoundingClientRect().bottom - winRect.top + 16 : 60,
    );
    const fieldBottom = (footerEl ? footerEl.getBoundingClientRect().top - winRect.top : winRect.height - 96) - 22;
    if (fieldBottom - fieldTop < 56) return;

    const sizes = messages
      .flatMap((message) => {
        const node = nodes.get(message.id);
        if (!node) return [];
        const scale = message.scale / 100;
        return [
          {
            message,
            w: node.offsetWidth * scale,
            h: node.offsetHeight * scale,
            sediment: !!readableInk && !readableInk.has(message.id),
          },
        ];
      });
    if (sizes.length === 0) return;

    const clearItems = sizes
      .filter((item) => !item.sediment)
      .sort((a, b) => a.message.y - b.message.y || a.message.x - b.message.x);
    const sedimentItems = sizes
      .filter((item) => item.sediment)
      .sort((a, b) => a.message.y - b.message.y || a.message.x - b.message.x);
    const clearRow = new Map(clearItems.map((item, index) => [item.message.id, index]));

    const placedClear: Box[] = [];
    const placedSediment: Box[] = [];
    const next: Record<string, { x: number; y: number }> = {};
    const edge = 10;

    for (const item of [...clearItems, ...sedimentItems]) {
      const { message, w, h, sediment } = item;
      const drift = inkHash(message.id);
      const prefX = (message.x / 100) * winRect.width + ((drift % 13) - 6) * 0.7;
      const row = clearRow.get(message.id);
      const prefY =
        !sediment && row !== undefined && clearItems.length > 1
          ? fieldTop + ((row + 0.5) / clearItems.length) * (fieldBottom - fieldTop)
          : (message.y / 100) * winRect.height + ((Math.floor(drift / 13) % 13) - 6) * 0.7;
      const minCenter = edge + w / 2;
      const maxCenter = winRect.width - edge - w / 2;
      const fallbackCenter = clamp(prefX, minCenter, maxCenter);
      const fallbackTop = clamp(prefY - h / 2, fieldTop, Math.max(fieldTop, fieldBottom - h));
      const fallbackAnchor = inkAnchor((fallbackCenter / winRect.width) * 100);
      let bestScore = -Infinity;
      let bestCenter = fallbackCenter;
      let bestTop = fallbackTop;
      let bestBox = boxFor(
        fallbackCenter - (fallbackAnchor === "center" ? w / 2 : fallbackAnchor === "right" ? w : 0),
        fallbackTop,
        w,
        h,
      );

      for (let centerX = minCenter; centerX <= maxCenter; centerX += 6) {
        const xPct = (centerX / winRect.width) * 100;
        const anchor = inkAnchor(xPct);
        const left = centerX - (anchor === "center" ? w / 2 : anchor === "right" ? w : 0);
        if (left < edge || left + w > winRect.width - edge) continue;
        for (let top = fieldTop; top <= fieldBottom - h; top += 5) {
          const box = boxFor(left, top, w, h);
          let penalty = 0;
          for (const area of reserved) penalty += overlapArea(box, area) * 55;
          for (const area of placedClear) penalty += overlapArea(box, area) * 55;
          for (const area of placedSediment) {
            penalty += overlapArea(box, area) * (sediment ? 3 : 55);
          }
          let crowd = 0;
          for (const area of placedClear) {
            const distance = Math.hypot(box.cx - area.cx, box.cy - area.cy);
            if (distance < (sediment ? 44 : 54)) {
              crowd += ((sediment ? 44 : 54) - distance) * (sediment ? 0.8 : 1.4);
            }
          }
          const score =
            -penalty -
            Math.abs(centerX - prefX) * 0.4 -
            Math.abs(box.cy - prefY) * 0.72 -
            crowd;
          if (score > bestScore) {
            bestScore = score;
            bestCenter = centerX;
            bestTop = top;
            bestBox = box;
          }
        }
      }

      const gap = sediment ? 3 : 7;
      (sediment ? placedSediment : placedClear).push({
        x0: bestBox.x0 - gap,
        y0: bestBox.y0 - gap,
        x1: bestBox.x1 + gap,
        y1: bestBox.y1 + gap,
        cx: bestBox.cx,
        cy: bestBox.cy,
      });
      next[message.id] = {
        x: Math.round((bestCenter / winRect.width) * 1000) / 10,
        y: Math.round(((bestTop + h / 2) / winRect.height) * 1000) / 10,
      };
    }

    setInkPlacements((previous) => {
      const previousIds = Object.keys(previous);
      const nextIds = Object.keys(next);
      if (
        previousIds.length === nextIds.length &&
        nextIds.every(
          (id) =>
            previous[id] &&
            Math.abs(previous[id].x - next[id].x) < 0.05 &&
            Math.abs(previous[id].y - next[id].y) < 0.05,
        )
      ) {
        return previous;
      }
      return next;
    });
  }, [smallScreen, hostBadge, data?.messages, composerOpen, viewport.w, viewport.h]);

  const own = data?.messages.find((message) => message.mine) ?? null;
  const clock = seattleTime(now);
  const phase = scenePhase(now, data?.dawnAt ?? "", weather.isDay);
  const question = data?.question ?? (status === "error" ? "你想把什么，留在这扇窗上？" : "窗正在起雾…");
  const dawnLabel = data
    ? dawnCountdown(data.dawnAt, now)
    : status === "error"
      ? "窗外的雾暂时太重"
      : "西雅图的夜，正在起雾";

  const toggleSound = async () => {
    if (!soundRef.current) soundRef.current = new WindowSound();
    if (soundOn) {
      soundRef.current.stop();
      setSoundOn(false);
      return;
    }
    try {
      await soundRef.current.start(wet);
      setSoundOn(true);
    } catch {
      notify("声音没能打开。也许再多等一会儿。");
    }
  };

  const addWisp = (x: number, y: number) => {
    if (reducedMotion) return;
    wispIdRef.current += 1;
    const wisp: Wisp = {
      id: wispIdRef.current,
      x,
      y,
      size: 90 + Math.random() * 120,
    };
    setWisps((current) => [...current.slice(-4), wisp]);
    const timer = window.setTimeout(() => {
      setWisps((current) => current.filter((entry) => entry.id !== wisp.id));
    }, 1_800);
    wispTimers.current.push(timer);
  };

  const handMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const glow = handRef.current;
    if (!glow) return;
    const rect = event.currentTarget.getBoundingClientRect();
    glow.style.setProperty("--hand-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    glow.style.setProperty("--hand-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
    glow.classList.add("is-visible");
  };

  const handLeave = () => handRef.current?.classList.remove("is-visible");

  const touchGlass = (event: ReactPointerEvent<HTMLDivElement>) => {
    setSelectedId(null);
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (x < 2 || x > 98 || y < 2 || y > 98) return;
    addWisp(x, y);
  };

  const openComposer = () => {
    setComposerError(null);
    setSelectedId(null);
    setRewriteOpen(false);
    if (!draftText.trim() && draftStrokes.length === 0) {
      const next = randomPlacement(dataRef.current?.messages ?? [], true);
      setPlacement(next);
      setRotation(Math.round((Math.random() * 4 - 2) * 10) / 10);
      setScale(97 + Math.round(Math.random() * 6));
    }
    setComposerOpen(true);
  };

  const beginWriting = () => {
    if (status === "error") {
      void retry();
      return;
    }
    if (status !== "ready") return;
    if (own) {
      setRewriteOpen(true);
      return;
    }
    openComposer();
  };

  const randomizePlacement = () => {
    const next = randomPlacement(dataRef.current?.messages ?? [], true);
    setPlacement(next);
    setRotation(Math.round((Math.random() * 4 - 2) * 10) / 10);
    setScale(97 + Math.round(Math.random() * 6));
  };

  const placeAt = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mobile = window.innerWidth < 900;
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, mobile ? 16 : 9, mobile ? 84 : 91);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, mobile ? 23 : 24, mobile ? 30 : 81);
    setPlacement({ x: Math.round(x), y: Math.round(y) });
    addWisp(x, y);
  };

  const submitDraft = async () => {
    if (!dataRef.current) return;
    setSubmitting(true);
    setComposerError(null);
    try {
      const result = await writeToWindow({
        text: draftText.trim(),
        strokes: draftStrokes,
        x: placement.x,
        y: placement.y,
        rotation,
        scale,
      });
      if (result.night !== nightRef.current) {
        setDawnEvent((value) => value + 1);
        await loadWindow();
      } else {
        const current = dataRef.current;
        if (current) {
          commitData({
            ...current,
            messages: [...current.messages, result.message],
          });
        }
        setNewId(result.message.id);
      }
      setComposerOpen(false);
      setSelectedId(null);
      setDraftText("");
      setDraftStrokes([]);
      setPadReset((value) => value + 1);
      setPlacement(randomPlacement(dataRef.current?.messages ?? []));
      setRotation(0);
      setScale(100);
      notify("留在窗上了。天亮时，它会散。");
    } catch (error) {
      const code = error instanceof WindowApiError ? error.code : undefined;
      if (code === "already_written") {
        setComposerOpen(false);
        setRewriteOpen(true);
        notify("今夜你已经留下一句了。");
        void loadWindow();
      } else {
        setComposerError(errorCopy(code));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const removeMessage = (id: string) => {
    const current = dataRef.current;
    if (!current) return;
    commitData({ ...current, messages: current.messages.filter((message) => message.id !== id) });
  };

  const dissolveMessage = (id: string, delay = 760) => {
    if (reducedMotion) {
      removeMessage(id);
      setSelectedId((current) => (current === id ? null : current));
      return;
    }
    setDissolving((current) => new Set(current).add(id));
    const timer = window.setTimeout(() => {
      dissolveTimers.current = dissolveTimers.current.filter((entry) => entry !== timer);
      removeMessage(id);
      setSelectedId((current) => (current === id ? null : current));
      setDissolving((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }, delay);
    dissolveTimers.current.push(timer);
  };

  const handleReport = async (id: string) => {
    setReported((current) => new Set(current).add(id));
    try {
      const result = await reportMessage(id);
      if (result.hidden) {
        dissolveMessage(id, 1_050);
        setSelectedId(null);
        notify("这句话慢慢散了。");
      } else {
        setSelectedId(null);
        notify("已经告诉守窗人了。");
      }
    } catch (error) {
      setReported((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      notify(errorCopy(error instanceof WindowApiError ? error.code : undefined));
    }
  };

  const handleErase = async (id: string) => {
    try {
      await eraseMessage(id);
      dissolveMessage(id, 980);
      notify("擦掉了。");
    } catch (error) {
      notify(errorCopy(error instanceof WindowApiError ? error.code : undefined));
      if (error instanceof WindowApiError && error.code === "not_found") void loadWindow();
    }
  };

  const confirmRewrite = async () => {
    if (!own || rewriting) return;
    setRewriting(true);
    try {
      await eraseMessage(own.id);
      dissolveMessage(own.id, 940);
      setRewriteOpen(false);
      openComposer();
      notify("擦掉了。可以重新写一句。");
    } catch (error) {
      notify(errorCopy(error instanceof WindowApiError ? error.code : undefined));
    } finally {
      setRewriting(false);
    }
  };

  const topbar = (
    <header className="topbar">
      <div className="identity">
        <div className="brand-line">
          <span className="brand-seal" aria-hidden="true">雨</span>
          <span className="brand">雨窗</span>
          <span className="brand-rule" aria-hidden="true" />
          <span className="brand-en">RAIN WINDOW</span>
        </div>
        <div className="meta-line">
          <span>SEATTLE</span>
          <span className="meta-sep" aria-hidden="true" />
          <span>{clock.text}</span>
          {weather.status === "ready" && weather.label && (
            <>
              <span className="meta-sep" aria-hidden="true" />
              <span>
                {weather.label}
                {weather.temperature !== null ? ` ${weather.temperature}°` : ""}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="top-actions">
        {data?.keeper && <span className="keeper-mark">守窗人</span>}
        <button
          type="button"
          className={`sound-toggle ${soundOn ? "is-on" : ""}`}
          onClick={() => void toggleSound()}
          aria-pressed={soundOn}
          aria-label={soundOn ? "关掉窗外的声音" : wet ? "听窗外的雨" : "听窗外的风"}
        >
          <span className="sound-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="sound-label">
            {soundOn ? (wet ? "雨声" : "风声") : wet ? "听雨" : "听风"}
          </span>
        </button>
        <button
          type="button"
          className="help-button"
          onClick={() => setHelpOpen(true)}
          aria-label="关于这扇窗"
        >
          ?
        </button>
      </div>
    </header>
  );

  return (
    <div
      className={`app phase-${phase} wx-${weather.kind} ${reducedMotion ? "reduce-motion" : ""} ${
        composerOpen ? "is-composing" : ""
      } ${dawnEvent ? "is-dawning" : ""}`}
    >
      <div className="room" aria-hidden="true" />
      <div className="window-frame">
        <div
          className="window"
          ref={windowRef}
          onPointerMove={handMove}
          onPointerLeave={handLeave}
        >
          <Scene weather={weather} phase={phase} reducedMotion={reducedMotion} />
          <div className="hand-glow" ref={handRef} aria-hidden="true" />

          <div
            className="touch-layer"
            onPointerDown={touchGlass}
            aria-hidden="true"
          />

          <div className="wisps" aria-hidden="true">
            {wisps.map((wisp) => (
              <span
                key={wisp.id}
                className="wisp"
                style={{ left: `${wisp.x}%`, top: `${wisp.y}%`, width: wisp.size, height: wisp.size }}
              />
            ))}
          </div>

          <div
            className={`ink-layer ${
              smallScreen && (data?.messages.length ?? 0) > mobileReadableLimit ? "is-crowded" : ""
            }`}
            id="ink-layer"
          >
            {data && (
              <Breaths breaths={data.breaths} />
            )}
            {data?.messages.map((message, index) => {
              const placed = smallScreen ? inkPlacements[message.id] : undefined;
              return (
                <Contribution
                  key={message.id}
                  message={message}
                  now={now}
                  dawnAt={data.dawnAt}
                  index={index}
                  total={data.messages.length}
                  keeper={data.keeper}
                  selected={selectedId === message.id}
                  isNew={newId === message.id}
                  dissolving={dissolving.has(message.id)}
                  reported={reported.has(message.id)}
                  sediment={!!readableInk && !readableInk.has(message.id)}
                  displayX={placed?.x}
                  displayY={placed?.y}
                  onSelect={() => setSelectedId((current) => (current === message.id ? null : message.id))}
                  onReport={(id) => void handleReport(id)}
                  onErase={(id) => void handleErase(id)}
                />
              );
            })}
            {composerOpen && (
              <div
                className={`ghost is-anchor-${inkAnchor(placement.x)} ${placement.y > 70 ? "is-tag-above" : ""}`}
                style={
                  {
                    left: `${placement.x}%`,
                    top: `${placement.y}%`,
                    transform: inkTransform(placement.x, rotation, scale),
                    "--x": placement.x,
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                <span className="ghost-ring" />
                <div className="mark-halo" />
                <div className="mark-body">
                  <Ink strokes={draftStrokes} className="mark-ink" />
                  {draftText.trim() ? (
                    <p className="ink-text">{draftText}</p>
                  ) : draftStrokes.length === 0 ? (
                    <span className="ghost-empty">就写在这里</span>
                  ) : null}
                </div>
                <span className="ghost-tag">轻点玻璃，换个地方</span>
              </div>
            )}
          </div>

          {composerOpen && (
            <div
              className="placement-layer"
              onClick={placeAt}
              data-interactive="true"
              aria-hidden="true"
            />
          )}

          <div className="ui">
            {topbar}
            <div className={`question-block ${data ? "is-set" : ""}`} key={question}>
              <span className="question-label">{data ? "今日之问" : "窗上的问题"}</span>
              <p className="question">{question}</p>
            </div>

            {!composerOpen && status === "error" && (
              <div className="center-note">
                <p>窗里的声音暂时断了。</p>
                <button type="button" onClick={() => void retry()}>
                  再敲一敲玻璃
                </button>
              </div>
            )}
            {!composerOpen && status === "ready" && data?.messages.length === 0 && (
              <div className="center-note is-empty">
                <p>玻璃很干净。第一句话，留给你。</p>
              </div>
            )}

            <footer className="bottombar">
              <div className="foot-notes">
                <span className={`dawn-note ${data && Date.parse(data.dawnAt) - now < 3_600_000 ? "is-near" : ""}`}>
                  {dawnLabel}
                </span>
                {data && data.breathCount > 0 && (
                  <>
                    <span className="foot-sep" aria-hidden="true" />
                    <span className="presence-note">
                      <i aria-hidden="true" />
                      窗边另有{breatheWord(data.breathCount)}处呼吸
                    </span>
                  </>
                )}
              </div>
              <div className="cta-wrap">
                {own ? (
                  <span className="cta-note">你的字已在窗上</span>
                ) : (
                  <span className="cta-note">一句话，或一小笔画</span>
                )}
                <button
                  type="button"
                  className="cta"
                  onClick={beginWriting}
                  disabled={status === "loading"}
                >
                  {status === "error"
                    ? "再敲一敲玻璃"
                    : status === "loading"
                      ? "窗正在起雾…"
                      : own
                        ? "重写今夜的句子"
                        : "在窗上写一句"}
                </button>
              </div>
            </footer>
          </div>

          <Composer
            open={composerOpen}
            text={draftText}
            strokes={draftStrokes}
            placement={placement}
            submitting={submitting}
            error={composerError}
            padReset={padReset}
            onText={setDraftText}
            onStrokes={setDraftStrokes}
            onClose={() => {
              if (!submitting) setComposerOpen(false);
            }}
            onRandomize={randomizePlacement}
            onSubmit={submitDraft}
          />

          {rewriteOpen && (
            <>
              <div
                className="prompt-backdrop"
                onClick={() => {
                  if (!rewriting) setRewriteOpen(false);
                }}
              />
              <div
                className="rewrite-prompt"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rewrite-title"
              >
                <span className="rewrite-kicker">今夜，你已经写过</span>
                <h2 id="rewrite-title">擦掉，重新写一句？</h2>
                <p>新写的字会留在窗上，直到下一次天亮。旧的这一句，会彻底消失。</p>
                <div className="rewrite-actions">
                  <button
                    type="button"
                    className="prompt-quiet"
                    onClick={() => setRewriteOpen(false)}
                    disabled={rewriting}
                    autoFocus
                  >
                    留着
                  </button>
                  <button
                    type="button"
                    className="prompt-primary"
                    onClick={() => void confirmRewrite()}
                    disabled={rewriting}
                  >
                    {rewriting ? "正在擦…" : "擦掉重写"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {notice && (
        <div key={notice.id} className="notice" role="status" aria-live="polite">
          {notice.text}
        </div>
      )}

      <Help
        open={helpOpen}
        dawnAt={data?.dawnAt ?? null}
        keeper={Boolean(data?.keeper)}
        onClose={() => setHelpOpen(false)}
      />

      <DawnWipe key={dawnEvent} show={dawnEvent > 0} />
    </div>
  );
}
