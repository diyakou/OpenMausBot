import { WebSocket, WebSocketServer, type RawData } from "ws";
import { HoushiarVoice } from "../houshiar-voice.ts";
import { isSameOrigin, type RequestAuth } from "../request-auth.ts";
import type { Upgrades } from "./upgrades.ts";
import { PASS, type RouteHandler } from "./table.ts";

const PATH = "/api/live/houshiar";
const MAX_AUDIO = 10 * 1024 * 1024;
const MAX_BUFFERED = 20 * 1024 * 1024;
const MAX_CALL_MS = 30 * 60_000;

export function createHoushiarVoiceRoutes(deps: {
  upgrades: Upgrades;
  key(): string;
  authorized(auth: RequestAuth): boolean;
  signedIn(auth: RequestAuth): boolean;
}): { route: RouteHandler; close(): void; revoke(sessionId: string): void } {
  const server = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: MAX_AUDIO });
  const clients = new Map<WebSocket, RequestAuth>();
  deps.upgrades.route((path) => path === PATH);
  const route: RouteHandler = async ({ req, res, path, method, auth, json }) => {
    if (path !== PATH) return PASS;
    res.setHeader("cache-control", "no-store");
    if (method !== "GET") return json(res, 405, { error: "method not allowed" });
    const pending = deps.upgrades.pending(req);
    if (!pending) return json(res, 426, { error: "WebSocket upgrade required" });
    if (!isSameOrigin(req) || !deps.authorized(auth) || !deps.signedIn(auth)) return json(res, 403, { error: "forbidden" });
    if (clients.size) return json(res, 409, { error: "A voice call is already running." });
    const key = deps.key().trim();
    if (!key || /[\r\n]/.test(key)) return json(res, 409, { error: "Houshiar API key is not configured.", needsKey: true });
    if (pending.socket.destroyed) return;
    pending.release();
    server.handleUpgrade(req, pending.socket, pending.head, (ws) => {
      clients.set(ws, auth);
      let voice: HoushiarVoice;
      const stop = () => { voice?.close(); clients.delete(ws); clearInterval(check); clearTimeout(deadline); };
      const check = setInterval(() => { if (!deps.signedIn(auth) || !deps.authorized(auth)) ws.close(1008, "authorization expired"); }, 15_000);
      check.unref();
      const deadline = setTimeout(() => ws.close(1000, "call time limit"), MAX_CALL_MS);
      deadline.unref();
      ws.on("error", () => ws.terminate());
      ws.on("close", stop);
      try {
        voice = new HoushiarVoice(key, (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > MAX_BUFFERED) { ws.terminate(); return; }
          ws.send(JSON.stringify(event), (error) => { if (error) ws.terminate(); });
          if (event.type === "error") ws.close(1011, "voice connection failed");
        });
      } catch {
        ws.close(1011, "voice connection failed");
        return;
      }
      ws.on("message", (data: RawData, binary: boolean) => {
        if (!deps.signedIn(auth) || !deps.authorized(auth)) { ws.close(1008, "authorization expired"); return; }
        try {
          if (binary) {
            const audio = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
            voice.append(audio);
          } else {
            const text = Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(data);
            if (text.length > 1024) throw new Error("Invalid command");
            const command: unknown = JSON.parse(text.toString("utf8"));
            if (!command || typeof command !== "object" || Array.isArray(command) || Object.keys(command).length !== 1) throw new Error("Invalid command");
            if ((command as { type?: unknown }).type === "history.clear") voice.clearHistory();
            else if ((command as { type?: unknown }).type === "cancel") { voice.cancel(); ws.close(1000, "cancelled"); }
            else throw new Error("Invalid command");
          }
        } catch { ws.close(1008, "invalid voice message"); }
      });
    });
    res.detachSocket(pending.socket);
  };
  return {
    route,
    close: () => { for (const ws of clients.keys()) ws.terminate(); server.close(); },
    revoke: (sessionId) => { for (const [ws, auth] of clients) if (auth.kind === "session" && auth.session.id === sessionId) ws.terminate(); },
  };
}
