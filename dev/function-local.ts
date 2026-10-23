import { createHandler } from "../functions/handler.ts";
import { getSeattleNight } from "../functions/time.ts";
import { MemoryStore } from "./memory-store.ts";

const store = new MemoryStore(getSeattleNight(new Date()).night);
const handler = createHandler(store);

Deno.serve({ hostname: "127.0.0.1", port: 8787 }, async (request) => {
  const response = await handler.handle(request);
  console.log(request.method, new URL(request.url).search, response.status);
  return response;
});

console.log("Rain Window local function → http://127.0.0.1:8787");
