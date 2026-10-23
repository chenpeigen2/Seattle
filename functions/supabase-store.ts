import type { MessageRow, PresenceRow, ReportRow, Store } from "./types.ts";

type Db = {
  from(table: string): any;
};

interface MessageRecord {
  id: string;
  night: string;
  content: string | null;
  strokes: MessageRow["strokes"];
  x: number;
  y: number;
  rotation: number;
  scale: number;
  client_hash: string;
  ip_hash: string;
  created_at: string;
  hidden: boolean;
  reports: number | null;
  erased_at: string | null;
  erased_by: string | null;
}

function toMessage(record: MessageRecord): MessageRow {
  return {
    id: record.id,
    night: record.night,
    text: record.content,
    strokes: record.strokes,
    x: record.x,
    y: record.y,
    rotation: record.rotation,
    scale: record.scale,
    clientHash: record.client_hash,
    ipHash: record.ip_hash,
    createdAt: record.created_at,
    hidden: record.hidden,
    reports: record.reports ?? 0,
    erasedAt: record.erased_at,
    erasedBy: record.erased_by,
  };
}

function toRecord(row: MessageRow): Record<string, unknown> {
  return {
    id: row.id,
    night: row.night,
    content: row.text,
    strokes: row.strokes,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    scale: row.scale,
    client_hash: row.clientHash,
    ip_hash: row.ipHash,
    created_at: row.createdAt,
    hidden: row.hidden,
    reports: row.reports,
    erased_at: row.erasedAt,
    erased_by: row.erasedBy,
  };
}

function patchRecord(patch: Partial<MessageRow>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  if ("night" in patch) record.night = patch.night;
  if ("text" in patch) record.content = patch.text;
  if ("strokes" in patch) record.strokes = patch.strokes;
  if ("x" in patch) record.x = patch.x;
  if ("y" in patch) record.y = patch.y;
  if ("rotation" in patch) record.rotation = patch.rotation;
  if ("scale" in patch) record.scale = patch.scale;
  if ("createdAt" in patch) record.created_at = patch.createdAt;
  if ("hidden" in patch) record.hidden = patch.hidden;
  if ("reports" in patch) record.reports = patch.reports;
  if ("erasedAt" in patch) record.erased_at = patch.erasedAt;
  if ("erasedBy" in patch) record.erased_by = patch.erasedBy;
  return record;
}

function fail(error: unknown): never {
  throw new Error(typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "database_error");
}

function exactCount(result: { count: number | null; error: unknown }): number {
  if (result.error) fail(result.error);
  const count = result.count;
  if (count === null || !Number.isSafeInteger(count) || count < 0) {
    throw new Error("count_unavailable");
  }
  return count;
}

export class SupabaseStore implements Store {
  #db: Db;

  constructor(db: unknown) {
    this.#db = db as Db;
  }

  async listMessages(night: string, limit: number): Promise<MessageRow[]> {
    const { data, error } = await this.#db
      .from("seattle_messages")
      .select("*")
      .eq("night", night)
      .eq("hidden", false)
      .is("erased_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) fail(error);
    return (data ?? []).map((row: MessageRecord) => toMessage(row));
  }

  async getMessage(id: string): Promise<MessageRow | null> {
    const { data, error } = await this.#db
      .from("seattle_messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) fail(error);
    return data ? toMessage(data as MessageRecord) : null;
  }

  async findLatestByClient(night: string, clientHash: string): Promise<MessageRow | null> {
    const { data, error } = await this.#db
      .from("seattle_messages")
      .select("*")
      .eq("night", night)
      .eq("client_hash", clientHash)
      .eq("hidden", false)
      .is("erased_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) fail(error);
    const row = Array.isArray(data) ? data[0] : null;
    return row ? toMessage(row as MessageRecord) : null;
  }

  async countByIp(night: string, ipHash: string): Promise<number> {
    const result = await this.#db
      .from("seattle_messages")
      .select("id", { count: "exact" })
      .eq("night", night)
      .eq("ip_hash", ipHash)
      .limit(1);
    return exactCount(result);
  }

  async insertMessage(row: MessageRow): Promise<void> {
    const { error } = await this.#db.from("seattle_messages").insert(toRecord(row));
    if (error) fail(error);
  }

  async updateMessage(id: string, patch: Partial<MessageRow>): Promise<void> {
    const { error } = await this.#db.from("seattle_messages").update(patchRecord(patch)).eq("id", id);
    if (error) fail(error);
  }

  async insertReport(row: ReportRow): Promise<void> {
    const { error } = await this.#db.from("seattle_reports").insert({
      id: row.id,
      message_id: row.messageId,
      reporter_hash: row.reporterHash,
      created_at: row.createdAt,
    });
    if (!error) return;
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "23505") return;
    fail(error);
  }

  async countReports(messageId: string): Promise<number> {
    const result = await this.#db
      .from("seattle_reports")
      .select("id", { count: "exact" })
      .eq("message_id", messageId)
      .limit(1);
    return exactCount(result);
  }

  async listPresence(night: string, since: string): Promise<PresenceRow[]> {
    const { data, error } = await this.#db
      .from("seattle_presence")
      .select("*")
      .eq("night", night)
      .gte("last_seen", since);
    if (error) fail(error);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      clientHash: String(row.client_hash),
      night: String(row.night),
      x: Number(row.x),
      y: Number(row.y),
      lastSeen: String(row.last_seen),
    }));
  }

  async upsertPresence(row: PresenceRow): Promise<void> {
    const { error } = await this.#db.from("seattle_presence").upsert(
      {
        client_hash: row.clientHash,
        night: row.night,
        x: row.x,
        y: row.y,
        last_seen: row.lastSeen,
      },
      { onConflict: "client_hash" },
    );
    if (error) fail(error);
  }

  async getMeta(key: string): Promise<string | null> {
    const { data, error } = await this.#db
      .from("seattle_meta")
      .select("meta_value")
      .eq("meta_key", key)
      .maybeSingle();
    if (error) fail(error);
    return data ? String(data.meta_value) : null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const { error } = await this.#db.from("seattle_meta").upsert({ meta_key: key, meta_value: value }, { onConflict: "meta_key" });
    if (error) fail(error);
  }

  async cleanup(activeNight: string, nightStart: string): Promise<void> {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();
    const oldMessages = await this.#db.from("seattle_messages").delete().neq("night", activeNight);
    if (oldMessages.error) fail(oldMessages.error);
    const stalePresence = await this.#db.from("seattle_presence").delete().lt("last_seen", stale);
    if (stalePresence.error) fail(stalePresence.error);
    const oldPresence = await this.#db.from("seattle_presence").delete().neq("night", activeNight);
    if (oldPresence.error) fail(oldPresence.error);
    const oldReports = await this.#db.from("seattle_reports").delete().lt("created_at", nightStart);
    if (oldReports.error) fail(oldReports.error);
  }
}
