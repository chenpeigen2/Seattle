# 雨窗 · Seattle

> 一扇朝向西雅图的公共雾玻璃。天亮之前，谁都可以写下一句话。
> the seattle u can see

一扇面向西雅图埃利奥特湾（Elliott Bay）的窗。玻璃上总是蒙着一层雾，路过的人可以用手指在雾上写字、画一小笔；天亮时，整面玻璃被擦干净，窗上的问题随之换新。

每晚只留下一批痕迹：**每人每夜一条**（一句话，或一笔涂鸦），四十个字以内，没有名字，也没有来处。

## 特性

- **按「夜」结算**：以西雅图日出为界（本地用简化 NOAA 公式计算日出时间），天亮即翻页，旧夜的内容自动清理。
- **每夜一个问题**：30 条问题按日期轮换，写在窗的上方，提示你今晚想说什么。
- **写字与涂鸦**：可以只写字、只画画，或者两者都有。笔迹以矢量笔划存储，别人看到的和你画的是同一条线。
- **窗边的人**：其他访客在窗上的位置会显示为微光（呼吸），最多同时显示 8 个，让你知道此刻有人在。
- **真实天气**：接入 Open-Meteo，西雅图实况天气（晴/云/雾/雨/雪/雷暴）驱动雨幕强度、风声与云层；取不到时退化为雾。
- **天光流转**：夜→黎明→白昼→黄昏→夜，颜色、雨量、字迹透明度随之变化；天亮前两小时字迹开始变淡。
- **黎明擦除**：日出时刻播放擦窗动画，玻璃被抹净，新的一夜开始。
- **声音**：默认关闭的雨声（WebAudio 合成的粉噪声/布朗噪声，无外部音频资源），可随时开启。
- **克制的治理**：敏感词与链接/邮箱/手机号过滤；被 3 人举报即隐藏；作者可自行擦除自己的话；守窗人（keeper）可擦除任意一条。
- **匿名**：没有账号。浏览器本地生成一枚客户端标识，服务端只存 SHA-256 哈希；IP 也只存哈希。
- **无障碍**：尊重 `prefers-reduced-motion`，关键操作可用键盘完成，说明面板为原生 `<dialog>`。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 8 |
| 样式 | 原生 CSS（`src/styles.css`，CSS 变量 + 深色主题） |
| 后端 | Deno（Deno Deploy / `Deno.serve`）+ TypeScript |
| 存储 | Supabase（Postgres，REST via `@supabase/supabase-js`） |
| 天气 | Open-Meteo（无需 key） |
| 音频 | Web Audio API 程序化合成 |

## 目录结构

```
.
├── index.html                入口 HTML（含 meta / OG 信息）
├── src/
│   ├── App.tsx               主场景：状态编排、轮询、写入/举报/擦除
│   ├── main.tsx              React 挂载
│   ├── styles.css            全部样式
│   ├── components/
│   │   ├── Scene.tsx         天光、窗框、城市剪影
│   │   ├── RainCanvas.tsx    雨幕 canvas
│   │   ├── Ink.tsx           雾上笔迹渲染
│   │   ├── Composer.tsx      写字输入
│   │   ├── DrawingPad.tsx    涂鸦板
│   │   ├── Contribution.tsx  自己那条痕迹的呈现
│   │   ├── Breaths.tsx       其他访客的呼吸光点
│   │   ├── DawnWipe.tsx      黎明擦窗动画
│   │   └── Help.tsx          说明面板（dialog）
│   └── lib/
│       ├── api.ts            后端调用（15s 超时、错误码封装）
│       ├── client.ts         客户端标识 / keeper key / 欢迎标记
│       ├── types.ts          共享类型
│       ├── time.ts           西雅图时间、场景阶段、透明度曲线
│       ├── weather.ts        Open-Meteo 天气 hook
│       ├── sound.ts          程序化雨声
│       └── inkGeometry.ts    笔迹几何
├── functions/                Deno 后端
│   ├── index.ts              线上入口（Supabase client + handler）
│   ├── handler.ts            路由与业务规则（写/举报/擦除/呼吸/清理）
│   ├── adapter.mjs           站点运行时适配层（租户校验、DB 出口白名单）
│   ├── supabase-store.ts     Supabase 版存储实现
│   ├── filter.ts             敏感词 / 链接 / 邮箱 / 手机号过滤
│   ├── questions.ts          每夜问题
│   ├── hash.ts               SHA-256 工具
│   ├── time.ts               日出计算与「夜」划分
│   └── types.ts              存储接口与行类型
├── dev/
│   ├── function-local.ts     本地 Deno 函数服务（内存存储）
│   ├── memory-store.ts       内存存储实现 + 种子数据
│   └── api-smoke.mjs         API 冒烟脚本
├── package.json              前端依赖与脚本
├── deno.json                 Deno 配置（nodeModulesDir: auto）
└── vite.config.ts            开发代理 /functions/v1/app → 127.0.0.1:8787
```

## 本地开发

需要 Node 20+（前端）与 Deno 1.40+（后端）。

```bash
# 1. 安装前端依赖
npm install

# 2. 启动后端（内存存储，无需数据库），监听 127.0.0.1:8787
npm run dev:function

# 3. 另开一个终端启动前端，Vite 会把 /functions/v1/app 代理到 8787
npm run dev
# → http://127.0.0.1:5173
```

冒烟测试（需要后端已启动）：

```bash
node dev/api-smoke.mjs
```

其它脚本：

```bash
npm run build         # tsc --noEmit + vite build，产物在 dist/
npm run preview       # 预览构建产物
npm run check:function  # deno check functions/index.ts
```

## API

所有请求都打到 `/functions/v1/app?action=<action>`，客户端标识放在请求头 `x-rain-window-client`，守窗人密钥放在 `x-rain-window-keeper`。

| action | 方法 | 说明 |
| --- | --- | --- |
| `window` | GET | 取当前这一夜的窗：问题、剩余痕迹、呼吸光点、天亮时间 |
| `write` | POST | 留下一句话 / 一笔画（每人每夜限一条） |
| `report` | POST | 举报某条痕迹（累计 3 次自动隐藏） |
| `erase` | POST | 擦除（默认擦自己的；守窗人可传 `id` 擦任意一条） |
| `breath` | POST | 上报自己在窗上的位置 |
| `claim_keeper` | POST | 认领守窗人身份（写入 `keeper_hash`） |
| `cleanup` | POST | 手动触发过期清理 |

错误码：`missing_client`、`invalid_text`、`too_long`、`not_allowed`、`invalid_strokes`、`invalid_placement`、`already_written`、`ip_limit`、`own_message`、`not_found`、`not_yours`、`invalid_key`、`keeper_taken`、`method_not_allowed`、`payload_too_large`、`window_unavailable`。

## 限制与规则

| 项目 | 限制 |
| --- | --- |
| 文字长度 | 40 字（按 Unicode 码点计） |
| 每夜写入 | 每人 1 条；每 IP 6 条 |
| 笔划 | 最多 30 笔，每笔 2–140 点，总点数 ≤ 700，坐标归一化到 0–1 |
| 请求体 | ≤ 48 KB |
| 单夜留存 | 最多 80 条痕迹，过夜自动清理 |
| 举报阈值 | 3 次举报即隐藏并清空内容 |

## 隐私

- 没有账号、没有邮箱、没有第三方用户画像。
- 浏览器本地生成随机客户端标识，服务端只保存 `sha256("client:" + token)`。
- IP 同样只以哈希形式保存，用于限流，不回传、不展示。
- 天气来自 Open-Meteo 的公开接口，不携带任何个人标识。

## 部署

- **前端**：Vite 静态产物（`dist/`）可部署到任意静态托管。
- **后端**：`functions/index.ts` 使用 `Deno.serve`，可直接部署到 Deno Deploy；`adapter.mjs` 负责校验站点运行时注入的租户头，并把数据库请求限制在 Supabase REST 出口上。
- 需要的环境变量：`SUPABASE_URL`、`SUPABASE_ANON_KEY`。

## License

[MIT](./LICENSE) © 2026 chenpeigen
