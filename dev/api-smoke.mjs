const base = "http://127.0.0.1:8787/?action=";
const send = async (action, body, client, keeper) => {
  const headers = { "content-type": "application/json" };
  if (client) headers["x-rain-window-client"] = client;
  if (keeper) headers["x-rain-window-keeper"] = keeper;
  const response = await fetch(base + action, { method: "POST", headers, body: JSON.stringify(body) });
  return response.json();
};
const read = async (client, keeper) => {
  const headers = {};
  if (client) headers["x-rain-window-client"] = client;
  if (keeper) headers["x-rain-window-keeper"] = keeper;
  const response = await fetch(base + "window", { headers });
  return response.json();
};

const writer = "smoke-client-0000000000001";
const eraser = "smoke-client-0000000000002";
const r1 = "smoke-client-0000000000011";
const r2 = "smoke-client-0000000000012";
const r3 = "smoke-client-0000000000013";
const keeper = "keeper-0123456789abcdef0123456789abcdef";

const written = await send("write", {
  text: "雨落在窗上，像一封没有署名的信。",
  strokes: [{ width: 2.2, points: [[0.1, 0.6], [0.4, 0.2], [0.9, 0.5]] }],
  x: 55, y: 47, rotation: -2, scale: 103,
}, writer);
console.log("write", written.message?.text, "mine", written.message?.mine);

const win = await read(writer);
const own = win.messages.find((message) => message.mine);
console.log("read night", win.night, "own found", Boolean(own), "total", win.messages.length);

console.log("second write", await send("write", { text: "又一次。", x: 40, y: 40 }, writer));
console.log("own report", await send("report", { id: own.id }, writer));
console.log("report 1 by other", await send("report", { id: own.id }, r1));
console.log("report 2 by other", await send("report", { id: own.id }, r2));
console.log("report 3 by other", await send("report", { id: own.id }, r3));
console.log("after hide", (await read(writer)).messages.some((message) => message.id === own.id));

const another = await send("write", { text: "留一句给守窗人。", x: 33, y: 60 }, "smoke-client-0000000000021");
const keeperResult = await send("erase", { id: another.message.id }, eraser, keeper);
console.log("keeper erase", keeperResult, "still there", (await read()).messages.some((message) => message.id === another.message.id));

console.log("breath", await send("breath", { x: 50, y: 50 }, r1));
const withBreath = await read(r2);
console.log("breath count", withBreath.breathCount, "breaths", withBreath.breaths);
console.log("cleanup", await send("cleanup", {}, writer));
console.log("bad placement", await send("write", { text: "越界。", x: 2, y: 2 }, "smoke-client-0000000000031"));
console.log("bad link", await send("write", { text: "来 www.example.com 看看", x: 50, y: 50 }, "smoke-client-0000000000032"));
console.log("bad strokes", await send("write", { strokes: [{ points: [[2, 2]], width: 2 }], x: 50, y: 50 }, "smoke-client-0000000000033"));
