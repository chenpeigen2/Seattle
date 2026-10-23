import type { MessageRow, PresenceRow, ReportRow, Store } from "../functions/types.ts";

const clock = () => Date.now();

function minutesAgo(minutes: number): string {
  return new Date(clock() - minutes * 60_000).toISOString();
}

const seed: MessageRow[] = [
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a01",
    night: "",
    text: "雨下得很轻，像有人在远处翻书。",
    strokes: null,
    x: 27,
    y: 35,
    rotation: -2,
    scale: 98,
    clientHash: "seed-1",
    ipHash: "seed",
    createdAt: minutesAgo(390),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a02",
    night: "",
    text: "今天终于把那封没有寄出的信，读完了。",
    strokes: null,
    x: 73,
    y: 52,
    rotation: 1.5,
    scale: 101,
    clientHash: "seed-2",
    ipHash: "seed",
    createdAt: minutesAgo(330),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a03",
    night: "",
    text: "如果你也睡不着，我们就算见过面了。",
    strokes: null,
    x: 38,
    y: 66,
    rotation: -1,
    scale: 96,
    clientHash: "seed-3",
    ipHash: "seed",
    createdAt: minutesAgo(300),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a04",
    night: "",
    text: "想念一个人的时候，我就会来窗边站一会儿。",
    strokes: null,
    x: 77,
    y: 30,
    rotation: 2,
    scale: 94,
    clientHash: "seed-4",
    ipHash: "seed",
    createdAt: minutesAgo(260),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a05",
    night: "",
    text: "妈妈，我今天有好好吃饭。",
    strokes: null,
    x: 20,
    y: 58,
    rotation: -3,
    scale: 102,
    clientHash: "seed-5",
    ipHash: "seed",
    createdAt: minutesAgo(210),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a06",
    night: "",
    text: "海上的灯一盏一盏亮起来，像有人回信。",
    strokes: null,
    x: 37,
    y: 81,
    rotation: 0.5,
    scale: 93,
    clientHash: "seed-6",
    ipHash: "seed",
    createdAt: minutesAgo(170),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a07",
    night: "",
    text: "我把今天的难过，画成了一条很短的线。",
    strokes: [
      {
        width: 2.4,
        points: [
          [0.08, 0.62],
          [0.2, 0.48],
          [0.32, 0.58],
          [0.44, 0.36],
          [0.56, 0.5],
          [0.68, 0.3],
          [0.82, 0.42],
          [0.92, 0.34],
        ],
      },
    ],
    x: 62,
    y: 72,
    rotation: -1.5,
    scale: 100,
    clientHash: "seed-7",
    ipHash: "seed",
    createdAt: minutesAgo(120),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
  {
    id: "6b1d3f0a-6d64-4f4f-9f1c-3a3f3e0f0a08",
    night: "",
    text: "愿你今晚睡得好。",
    strokes: null,
    x: 50,
    y: 47,
    rotation: 1,
    scale: 104,
    clientHash: "seed-8",
    ipHash: "seed",
    createdAt: minutesAgo(70),
    hidden: false,
    reports: 0,
    erasedAt: null,
    erasedBy: null,
  },
];

export class MemoryStore implements Store {
  #messages: MessageRow[];
  #reports: ReportRow[] = [];
  #presence = new Map<string, PresenceRow>();
  #meta = new Map<string, string>();

  constructor(activeNight: string) {
    const seeded = seed.map((row) => ({ ...row, night: activeNight }));
    this.#messages = seeded;
  }

  async listMessages(night: string, limit: number): Promise<MessageRow[]> {
    return this.#messages
      .filter((row) => row.night === night && !row.hidden && !row.erasedAt)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async getMessage(id: string): Promise<MessageRow | null> {
    const row = this.#messages.find((candidate) => candidate.id === id);
    return row ? { ...row } : null;
  }

  async findLatestByClient(night: string, clientHash: string): Promise<MessageRow | null> {
    const rows = this.#messages.filter(
      (row) => row.night === night && row.clientHash === clientHash && !row.hidden && !row.erasedAt,
    );
    const row = rows[rows.length - 1];
    return row ? { ...row } : null;
  }

  async countByIp(night: string, ipHash: string): Promise<number> {
    return this.#messages.filter((row) => row.night === night && row.ipHash === ipHash).length;
  }

  async insertMessage(row: MessageRow): Promise<void> {
    this.#messages.push({ ...row });
  }

  async updateMessage(id: string, patch: Partial<MessageRow>): Promise<void> {
    const row = this.#messages.find((candidate) => candidate.id === id);
    if (row) Object.assign(row, patch);
  }

  async insertReport(row: ReportRow): Promise<void> {
    if (this.#reports.some((entry) => entry.messageId === row.messageId && entry.reporterHash === row.reporterHash)) return;
    this.#reports.push({ ...row });
  }

  async countReports(messageId: string): Promise<number> {
    return this.#reports.filter((row) => row.messageId === messageId).length;
  }

  async listPresence(night: string, since: string): Promise<PresenceRow[]> {
    return Array.from(this.#presence.values()).filter(
      (row) => row.night === night && row.lastSeen >= since,
    );
  }

  async upsertPresence(row: PresenceRow): Promise<void> {
    this.#presence.set(row.clientHash, { ...row });
  }

  async getMeta(key: string): Promise<string | null> {
    return this.#meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.#meta.set(key, value);
  }

  async cleanup(activeNight: string, nightStart: string): Promise<void> {
    this.#messages = this.#messages.filter((row) => row.night === activeNight);
    this.#reports = this.#reports.filter((row) => row.createdAt >= nightStart);
    for (const [key, row] of this.#presence) {
      if (row.night !== activeNight || row.lastSeen < new Date(clock() - 10 * 60_000).toISOString()) {
        this.#presence.delete(key);
      }
    }
  }
}
