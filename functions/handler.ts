import { sameHash, sha256 } from "./hash.ts";
import { screenText } from "./filter.ts";
import { pickQuestion } from "./questions.ts";
import { getSeattleNight } from "./time.ts";
import type { MessageRow, Store, Stroke } from "./types.ts";

const MAX_MESSAGES = 80;
const MAX_WRITES_PER_IP = 6;
const MAX_REPORT_ERASE = 3;
const MAX_BODY = 48_000;
const CLIENT_RE = /^[A-Za-z0-9_-]{16,120}$/;
const KEEPER_RE = /^[A-Za-z0-9_-]{32,120}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function fail(status: number, code: string): Response {
  return json({ error: code }, status);
}

function clientToken(request: Request): string | null {
  const token = request.headers.get("x-rain-window-client")?.trim() ?? "";
  return CLIENT_RE.test(token) ? token : null;
}

async function clientHash(request: Request): Promise<string | null> {
  const token = clientToken(request);
  return token ? sha256(`client:${token}`) : null;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded || real || "unknown";
  return ip.slice(0, 80);
}

async function ipHash(request: Request): Promise<string> {
  return sha256(`ip:${clientIp(request)}`);
}

function keeperKey(request: Request): string | null {
  const key = request.headers.get("x-rain-window-keeper")?.trim() ?? "";
  return KEEPER_RE.test(key) ? key : null;
}

async function isKeeper(request: Request, store: Store): Promise<boolean> {
  const key = keeperKey(request);
  if (!key) return false;
  const stored = await store.getMeta("keeper_hash");
  if (!stored) return false;
  return sameHash(stored, await sha256(`keeper:${key}`));
}

function asInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

function parsePlacement(body: Record<string, unknown>): { x: number; y: number; rotation: number; scale: number } {
  const x = asInt(body.x, 9, 91);
  const y = asInt(body.y, 24, 81);
  const rotation = asInt(body.rotation ?? 0, -7, 7);
  const scale = asInt(body.scale ?? 100, 86, 114);
  if (x === null || y === null || rotation === null || scale === null) {
    throw new ApiError(400, "invalid_placement");
  }
  return { x, y, rotation, scale };
}

function parseStrokes(value: unknown): Stroke[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) throw new ApiError(400, "invalid_strokes");
  if (value.length === 0) return null;
  if (value.length > 30) throw new ApiError(400, "invalid_strokes");

  let totalPoints = 0;
  const strokes: Stroke[] = [];
  for (const rawStroke of value) {
    if (typeof rawStroke !== "object" || rawStroke === null) throw new ApiError(400, "invalid_strokes");
    const candidate = rawStroke as Record<string, unknown>;
    const width = typeof candidate.width === "number" ? candidate.width : 2.2;
    if (!Number.isFinite(width) || width < 0.8 || width > 7) throw new ApiError(400, "invalid_strokes");
    if (!Array.isArray(candidate.points) || candidate.points.length < 2 || candidate.points.length > 140) {
      throw new ApiError(400, "invalid_strokes");
    }
    totalPoints += candidate.points.length;
    if (totalPoints > 700) throw new ApiError(400, "invalid_strokes");

    const points: [number, number][] = [];
    for (const point of candidate.points) {
      if (!Array.isArray(point) || point.length !== 2) throw new ApiError(400, "invalid_strokes");
      const px = point[0];
      const py = point[1];
      if (typeof px !== "number" || typeof py !== "number" || !Number.isFinite(px) || !Number.isFinite(py)) {
        throw new ApiError(400, "invalid_strokes");
      }
      if (px < 0 || px > 1 || py < 0 || py > 1) throw new ApiError(400, "invalid_strokes");
      points.push([Math.round(px * 1000) / 1000, Math.round(py * 1000) / 1000]);
    }
    strokes.push({ points, width: Math.round(width * 10) / 10 });
  }
  return strokes;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY) throw new ApiError(413, "payload_too_large");
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new ApiError(413, "payload_too_large");
  if (!raw.trim()) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("not_an_object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "invalid_json");
  }
}

function publicMessage(row: MessageRow, viewerHash: string | null) {
  return {
    id: row.id,
    text: row.text,
    strokes: row.strokes,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    scale: row.scale,
    createdAt: row.createdAt,
    mine: Boolean(viewerHash && row.clientHash === viewerHash),
  };
}

async function maybeCleanup(store: Store, night: string, nightStart: string, minGapMs: number): Promise<boolean> {
  const last = await store.getMeta("last_cleanup");
  if (last) {
    const lastTime = Date.parse(last);
    if (Number.isFinite(lastTime) && Date.now() - lastTime < minGapMs) return false;
  }
  await store.cleanup(night, nightStart);
  await store.setMeta("last_cleanup", new Date().toISOString());
  return true;
}

export interface HandlerOptions {
  now?: () => Date;
}

export function createHandler(store: Store, options: HandlerOptions = {}) {
  const now = options.now ?? (() => new Date());

  async function handleWindow(request: Request): Promise<Response> {
    const moment = now();
    const night = getSeattleNight(moment);
    const viewerHash = await clientHash(request);
    const [messages, presence, keeper] = await Promise.all([
      store.listMessages(night.night, MAX_MESSAGES),
      store.listPresence(night.night, new Date(moment.getTime() - 90_000).toISOString()),
      isKeeper(request, store),
    ]);
    const others = presence.filter((row) => row.clientHash !== viewerHash);
    return json({
      night: night.night,
      question: pickQuestion(night.night),
      dawnAt: night.dawnAt.toISOString(),
      serverNow: moment.toISOString(),
      messages: messages.map((row) => publicMessage(row, viewerHash)),
      breaths: others.slice(0, 8).map((row) => ({ x: row.x, y: row.y })),
      breathCount: others.length,
      keeper,
    });
  }

  async function handleWrite(request: Request): Promise<Response> {
    const hash = await clientHash(request);
    if (!hash) return fail(400, "missing_client");
    const body = await readBody(request);

    const rawText = body.text;
    if (rawText !== undefined && rawText !== null && typeof rawText !== "string") {
      return fail(400, "invalid_text");
    }
    let text: string | null = null;
    if (typeof rawText === "string" && rawText.trim()) {
      if (Array.from(rawText).length > 40) return fail(400, "too_long");
      const screened = screenText(rawText);
      if (!screened.ok) return fail(400, "not_allowed");
      text = screened.text;
    }

    let strokes: Stroke[] | null = null;
    try {
      strokes = parseStrokes(body.strokes);
    } catch {
      return fail(400, "invalid_strokes");
    }
    if (!text && !strokes) return fail(400, "empty");

    let placement: ReturnType<typeof parsePlacement>;
    try {
      placement = parsePlacement(body);
    } catch {
      return fail(400, "invalid_placement");
    }

    const moment = now();
    const night = getSeattleNight(moment);
    const existing = await store.findLatestByClient(night.night, hash);
    if (existing) return fail(409, "already_written");

    const perIp = await ipHash(request);
    if ((await store.countByIp(night.night, perIp)) >= MAX_WRITES_PER_IP) {
      return fail(429, "ip_limit");
    }

    const row: MessageRow = {
      id: crypto.randomUUID(),
      night: night.night,
      text,
      strokes,
      x: placement.x,
      y: placement.y,
      rotation: placement.rotation,
      scale: placement.scale,
      clientHash: hash,
      ipHash: perIp,
      createdAt: moment.toISOString(),
      hidden: false,
      reports: 0,
      erasedAt: null,
      erasedBy: null,
    };
    await store.insertMessage(row);
    try {
      await maybeCleanup(store, night.night, night.nightStart.toISOString(), 10 * 60_000);
    } catch {
      // A failed housekeeping pass must not fail the contribution itself.
    }
    return json({ message: publicMessage(row, hash), night: night.night, dawnAt: night.dawnAt.toISOString() }, 201);
  }

  async function handleReport(request: Request): Promise<Response> {
    const hash = await clientHash(request);
    if (!hash) return fail(400, "missing_client");
    const body = await readBody(request);
    const id = typeof body.id === "string" ? body.id : "";
    if (!UUID_RE.test(id)) return fail(400, "invalid_id");

    const night = getSeattleNight(now());
    const message = await store.getMessage(id);
    if (!message || message.night !== night.night || message.hidden || message.erasedAt) {
      return fail(404, "not_found");
    }
    if (message.clientHash === hash) return fail(400, "own_message");

    await store.insertReport({
      id: crypto.randomUUID(),
      messageId: message.id,
      reporterHash: hash,
      createdAt: now().toISOString(),
    });
    const reports = await store.countReports(message.id);
    const hidden = reports >= MAX_REPORT_ERASE;
    if (hidden) {
      await store.updateMessage(message.id, {
        hidden: true,
        reports,
        text: null,
        strokes: null,
        erasedAt: now().toISOString(),
        erasedBy: "crowd",
      });
    } else {
      await store.updateMessage(message.id, { reports });
    }
    return json({ reports, hidden });
  }

  async function handleErase(request: Request): Promise<Response> {
    const hash = await clientHash(request);
    if (!hash) return fail(400, "missing_client");
    const body = await readBody(request);
    const requestedId = typeof body.id === "string" ? body.id : null;
    const night = getSeattleNight(now());
    const keeper = await isKeeper(request, store);

    let message: MessageRow | null = null;
    if (requestedId) {
      if (!UUID_RE.test(requestedId)) return fail(400, "invalid_id");
      message = await store.getMessage(requestedId);
    } else if (keeper) {
      return fail(400, "invalid_id");
    } else {
      message = await store.findLatestByClient(night.night, hash);
    }

    if (!message || message.night !== night.night || message.hidden || message.erasedAt) {
      return fail(404, "not_found");
    }
    if (!keeper && message.clientHash !== hash) return fail(403, "not_yours");

    await store.updateMessage(message.id, {
      hidden: true,
      text: null,
      strokes: null,
      erasedAt: now().toISOString(),
      erasedBy: keeper ? "keeper" : "author",
    });
    return json({ erased: true });
  }

  async function handleBreath(request: Request): Promise<Response> {
    const hash = await clientHash(request);
    if (!hash) return fail(400, "missing_client");
    const body = await readBody(request);
    const x = asInt(body.x, 6, 94);
    const y = asInt(body.y, 10, 90);
    if (x === null || y === null) return fail(400, "invalid_placement");
    const night = getSeattleNight(now());
    await store.upsertPresence({
      clientHash: hash,
      night: night.night,
      x,
      y,
      lastSeen: now().toISOString(),
    });
    return json({ ok: true });
  }

  async function handleClaimKeeper(request: Request): Promise<Response> {
    const key = keeperKey(request);
    if (!key) return fail(400, "invalid_key");
    const body = await readBody(request);
    const supplied = typeof body.key === "string" ? body.key.trim() : "";
    if (!KEEPER_RE.test(supplied) || supplied !== key) return fail(400, "invalid_key");
    const hash = await sha256(`keeper:${key}`);
    const stored = await store.getMeta("keeper_hash");
    if (stored) {
      if (sameHash(stored, hash)) return json({ claimed: true, already: true });
      return fail(409, "keeper_taken");
    }
    await store.setMeta("keeper_hash", hash);
    await store.setMeta("keeper_claimed_at", now().toISOString());
    return json({ claimed: true, already: false });
  }

  async function handleCleanup(request: Request): Promise<Response> {
    await clientHash(request);
    const night = getSeattleNight(now());
    const cleaned = await maybeCleanup(store, night.night, night.nightStart.toISOString(), 5 * 60_000);
    return json({ cleaned });
  }

  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "window";
    if (request.method === "GET") {
      if (action === "window") return await handleWindow(request);
      return fail(405, "method_not_allowed");
    }
    if (request.method !== "POST") return fail(405, "method_not_allowed");
    switch (action) {
      case "write":
        return await handleWrite(request);
      case "report":
        return await handleReport(request);
      case "erase":
        return await handleErase(request);
      case "breath":
        return await handleBreath(request);
      case "claim_keeper":
        return await handleClaimKeeper(request);
      case "cleanup":
        return await handleCleanup(request);
      default:
        return fail(404, "not_found");
    }
  }

  return {
    async handle(request: Request): Promise<Response> {
      try {
        return await route(request);
      } catch (error) {
        if (error instanceof ApiError) return fail(error.status, error.code);
        return fail(503, "window_unavailable");
      }
    },
  };
}
