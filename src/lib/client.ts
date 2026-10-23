const CLIENT_KEY = "rain-window:client";
const KEEPER_KEY = "rain-window:keeper";
const KEEPER_RE = /^[A-Za-z0-9_-]{32,120}$/;

let memoryClient: string | null = null;
let memoryKeeper: string | null = null;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing can refuse storage; the session token still lives in memory.
  }
}

export function getClientToken(): string {
  if (memoryClient) return memoryClient;
  const stored = readStorage(CLIENT_KEY);
  if (stored && /^[A-Za-z0-9_-]{16,120}$/.test(stored)) {
    memoryClient = stored;
    return stored;
  }
  const token = crypto.randomUUID();
  memoryClient = token;
  writeStorage(CLIENT_KEY, token);
  return token;
}

export function readKeeperKey(): string | null {
  if (memoryKeeper) return memoryKeeper;

  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const params = new URLSearchParams(hash);
    const candidate = params.get("keeper")?.trim() ?? "";
    if (KEEPER_RE.test(candidate)) {
      memoryKeeper = candidate;
      writeStorage(KEEPER_KEY, candidate);
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {
        // The key is already held in memory; the visible hash is not fatal.
      }
      return candidate;
    }
  }

  const stored = readStorage(KEEPER_KEY);
  if (stored && KEEPER_RE.test(stored)) {
    memoryKeeper = stored;
    return stored;
  }
  return null;
}

export function hasSeenWelcome(): boolean {
  return readStorage("rain-window:welcomed") === "1";
}

export function markWelcomeSeen(): void {
  writeStorage("rain-window:welcomed", "1");
}
