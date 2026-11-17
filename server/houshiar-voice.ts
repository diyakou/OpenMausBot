import WebSocket from "ws";

const VOICE_URL = "wss://api.houshiar-ai.ir/v1/voice-chat";
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_EVENT_CHARS = 16 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

type VoiceEvent =
  | { type: "session.created" | "transcript.started" | "audio.done" }
  | { type: "transcript.done" | "assistant.delta" | "assistant.done"; text: string }
  | { type: "audio.delta"; audio: string; format: "mp3" }
  | { type: "response.done"; stats: unknown }
  | { type: "error"; code: "quota" | "provider" | "connection" | "protocol" | "timeout" };

type Socket = Pick<WebSocket, "readyState" | "send" | "close" | "onopen" | "onmessage" | "onerror" | "onclose">;
type SocketFactory = (url: string, key: string) => Socket;

/** Server-only connection. Audio events contain complete base64 MP3 files, not fragments of one file. */
export class HoushiarVoice {
  private socket: Socket;
  private ready = false;
  private active = false;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly emit: (event: VoiceEvent) => void;

  constructor(key: string, emit: (event: VoiceEvent) => void, open: SocketFactory = (url, secret) =>
    new WebSocket(url, { headers: { Authorization: `Bearer ${secret}` }, maxPayload: MAX_EVENT_CHARS })) {
    if (!key.trim() || /[\r\n]/.test(key)) throw new Error("Invalid voice credential");
    this.emit = emit;
    this.socket = open(VOICE_URL, key);
    this.socket.onmessage = (event) => this.receive(event.data);
    this.socket.onerror = () => this.fail("connection");
    this.socket.onclose = (event) => this.fail(event.code === 4403 ? "quota" : "connection");
    this.arm();
  }

  append(audio: Buffer): void {
    if (!this.ready || this.closed || this.active) throw new Error("Voice session is not ready for audio");
    if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new Error("Invalid voice audio size");
    this.active = true;
    try {
      this.socket.send(JSON.stringify({ type: "audio.append", audio: audio.toString("base64"), mime: "audio/webm" }));
      this.socket.send(JSON.stringify({ type: "audio.commit" }));
      this.arm();
    } catch {
      this.fail("connection");
    }
  }

  clearHistory(): void {
    if (!this.ready || this.closed || this.active) throw new Error("Voice session is not idle");
    try { this.socket.send(JSON.stringify({ type: "history.clear" })); } catch { this.fail("connection"); }
  }

  cancel(): void {
    if (this.closed) return;
    try { if (this.socket.readyState === 1) this.socket.send(JSON.stringify({ type: "cancel" })); } catch { /* socket is closing */ }
    this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    try { this.socket.close(); } catch { /* socket is already closed */ }
  }

  private arm(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fail("timeout"), TIMEOUT_MS);
    this.timer.unref?.();
  }

  private fail(code: Extract<VoiceEvent, { type: "error" }>["code"]): void {
    if (this.closed) return;
    this.close();
    this.emit({ type: "error", code });
  }

  private receive(data: unknown): void {
    if (this.closed) return;
    if (typeof data !== "string" || data.length > MAX_EVENT_CHARS) return this.fail("protocol");
    let event: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(data);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return this.fail("protocol");
      event = parsed as Record<string, unknown>;
    } catch { return this.fail("protocol"); }
    if (event.type === "error") {
      const nested = event.error && typeof event.error === "object" ? (event.error as Record<string, unknown>).code : undefined;
      return this.fail([4403, "4403", "daily_voice_limit"].includes(nested as string | number) || [4403, "4403", "daily_voice_limit"].includes(event.code as string | number) ? "quota" : "provider");
    }
    if (event.type === "session.created" && !this.ready) {
      this.ready = true;
      clearTimeout(this.timer);
      this.emit({ type: "session.created" });
      return;
    }
    if (!this.ready || !this.active) return this.fail("protocol");
    if (event.type === "response.done") {
      this.active = false;
      clearTimeout(this.timer);
      this.emit({ type: "response.done", stats: event.stats });
    } else if (event.type === "transcript.started" || event.type === "audio.done") {
      this.emit({ type: event.type });
    } else if ((event.type === "transcript.done" || event.type === "assistant.delta" || event.type === "assistant.done") && typeof event.text === "string") {
      this.emit({ type: event.type, text: event.text });
    } else if (event.type === "audio.delta" && typeof event.audio === "string" && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.audio) && event.audio.length > 0) {
      this.emit({ type: "audio.delta", audio: event.audio, format: "mp3" });
    } else {
      this.fail("protocol");
    }
  }
}
