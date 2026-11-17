import { afterEach, describe, expect, it, vi } from "vitest";
import { HoushiarVoice } from "./houshiar-voice.ts";

function setup() {
  const events: unknown[] = [];
  const sent: unknown[] = [];
  const socket = {
    readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null,
    send(data: string) { sent.push(JSON.parse(data)); }, close: vi.fn(),
  };
  const voice = new HoushiarVoice("secret", (event) => events.push(event), () => socket as unknown as WebSocket);
  const receive = (event: unknown) => (socket.onmessage as unknown as (e: { data: string }) => void)({ data: JSON.stringify(event) });
  return { voice, socket, receive, events, sent };
}

afterEach(() => vi.useRealTimers());

describe("Houshiar voice transport", () => {
  it("handles turns and complete audio files", () => {
    const t = setup();
    expect(() => t.voice.append(Buffer.from("a"))).toThrow();
    t.receive({ type: "session.created" });
    t.voice.append(Buffer.from("a"));
    expect(t.sent).toEqual([{ type: "audio.append", audio: "YQ==", mime: "audio/webm" }, { type: "audio.commit" }]);
    expect(() => t.voice.append(Buffer.from("b"))).toThrow();
    t.receive({ type: "transcript.done", text: "hello" });
    t.receive({ type: "assistant.delta", text: "hi" });
    t.receive({ type: "audio.delta", audio: "YQ==" });
    t.receive({ type: "response.done", stats: { seconds: 1 } });
    expect(t.events).toContainEqual({ type: "audio.delta", audio: "YQ==", format: "mp3" });
    t.voice.clearHistory();
    expect(t.sent.at(-1)).toEqual({ type: "history.clear" });
    t.voice.close();
  });
  it("handles quota without response.done and cancels", () => {
    const t = setup();
    t.receive({ type: "session.created" });
    t.voice.append(Buffer.from("a"));
    t.receive({ type: "error", error: { code: 4403, message: "secret" } });
    expect(t.events.at(-1)).toEqual({ type: "error", code: "quota" });
    expect(JSON.stringify(t.events)).not.toContain("secret");
    const next = setup();
    next.receive({ type: "session.created" });
    next.voice.append(Buffer.from("a"));
    next.voice.cancel();
    expect(next.sent.at(-1)).toEqual({ type: "cancel" });
    expect(next.socket.close).toHaveBeenCalled();
  });
  it("times out without response.done", () => {
    vi.useFakeTimers();
    const t = setup();
    t.receive({ type: "session.created" });
    t.voice.append(Buffer.from("a"));
    vi.advanceTimersByTime(60_000);
    expect(t.events.at(-1)).toEqual({ type: "error", code: "timeout" });
  });
});
