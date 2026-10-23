import { getClientToken, readKeeperKey } from "./client";
import type { Stroke, WindowMessage, WindowPayload } from "./types";

export class WindowApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0) {
    super(code);
    this.name = "WindowApiError";
    this.code = code;
    this.status = status;
  }
}

function headers(json = false): HeadersInit {
  const result: Record<string, string> = {
    "x-rain-window-client": getClientToken(),
  };
  if (json) result["content-type"] = "application/json";
  const keeper = readKeeperKey();
  if (keeper) result["x-rain-window-keeper"] = keeper;
  return result;
}

async function call<T>(action: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/functions/v1/app?action=${action}`, {
      method: body === undefined ? "GET" : "POST",
      headers: headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const code =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : "window_unavailable";
      throw new WindowApiError(code, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof WindowApiError) throw error;
    throw new WindowApiError("window_unavailable");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function fetchWindow(): Promise<WindowPayload> {
  return call<WindowPayload>("window");
}

export function writeToWindow(input: {
  text: string;
  strokes: Stroke[];
  x: number;
  y: number;
  rotation: number;
  scale: number;
}): Promise<{ message: WindowMessage; night: string; dawnAt: string }> {
  return call("write", input);
}

export function reportMessage(id: string): Promise<{ reports: number; hidden: boolean }> {
  return call("report", { id });
}

export function eraseMessage(id?: string): Promise<{ erased: boolean }> {
  return call("erase", id ? { id } : {});
}

export function sendBreath(x: number, y: number): Promise<{ ok: boolean }> {
  return call("breath", { x, y });
}

export function sweepWindow(): Promise<{ cleaned: boolean }> {
  return call("cleanup", {});
}
