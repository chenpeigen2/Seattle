const BLOCKED_PHRASES = [
  "加我微信",
  "加微信",
  "微信号",
  "加qq",
  "扣扣号",
  "代购",
  "刷单",
  "博彩",
  "赌博",
  "贷款",
  "办证",
  "裸聊",
  "约炮",
  "一夜情",
  "援交",
  "卖淫",
  "色情",
  "黄片",
  "成人视频",
  "私聊我",
  "扫码",
  "进群",
  "兼职日结",
  "高薪兼职",
  "免费领取",
  "点击链接",
  "傻逼",
  "傻b",
  "煞笔",
  "操你妈",
  "草你妈",
  "你妈死了",
  "狗日的",
  "婊子",
  "贱人",
  "去死吧",
  "杀了你",
  "弄死你",
  "fuck you",
  "motherfucker",
  "nigger",
  "rape",
  "kys",
];

const LINK_RE = /(?:https?:\/\/|www\.)[^\s]+/i;
const DOMAIN_RE = /\b[a-z0-9][a-z0-9-]{0,62}\.(?:com|cn|net|org|io|me|co|xyz|top|club|shop|vip|cc|tv)\b/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:^|\D)1[3-9]\d{9}(?:\D|$)/;
const QQ_RE = /(?:qq|扣扣|企鹅)\s*[:：]?\s*\d{5,12}/i;
const WECHAT_RE = /(?:微信|wechat|vx|v信|威信)\s*[:：]?\s*[a-z0-9_-]{4,}/i;
const REPEAT_RE = /(.)\1{7,}/;

export interface ScreenResult {
  ok: boolean;
  text: string;
}

export function screenText(raw: string): ScreenResult {
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return { ok: false, text };
  if (Array.from(text).length > 40) return { ok: false, text };

  const lower = text.toLowerCase();
  if (
    LINK_RE.test(text) ||
    DOMAIN_RE.test(text) ||
    EMAIL_RE.test(text) ||
    PHONE_RE.test(text) ||
    QQ_RE.test(text) ||
    WECHAT_RE.test(text) ||
    REPEAT_RE.test(text)
  ) {
    return { ok: false, text };
  }
  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase)) return { ok: false, text };
  }
  return { ok: true, text };
}
