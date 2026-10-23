export interface Stroke {
  points: [number, number][];
  width: number;
}

export interface MessageRow {
  id: string;
  night: string;
  text: string | null;
  strokes: Stroke[] | null;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  clientHash: string;
  ipHash: string;
  createdAt: string;
  hidden: boolean;
  reports: number;
  erasedAt: string | null;
  erasedBy: string | null;
}

export interface ReportRow {
  id: string;
  messageId: string;
  reporterHash: string;
  createdAt: string;
}

export interface PresenceRow {
  clientHash: string;
  night: string;
  x: number;
  y: number;
  lastSeen: string;
}

export interface Store {
  listMessages(night: string, limit: number): Promise<MessageRow[]>;
  getMessage(id: string): Promise<MessageRow | null>;
  findLatestByClient(night: string, clientHash: string): Promise<MessageRow | null>;
  countByIp(night: string, ipHash: string): Promise<number>;
  insertMessage(row: MessageRow): Promise<void>;
  updateMessage(id: string, patch: Partial<MessageRow>): Promise<void>;
  insertReport(row: ReportRow): Promise<void>;
  countReports(messageId: string): Promise<number>;
  listPresence(night: string, since: string): Promise<PresenceRow[]>;
  upsertPresence(row: PresenceRow): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  cleanup(activeNight: string, nightStart: string): Promise<void>;
}
