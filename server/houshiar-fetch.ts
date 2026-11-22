import { Agent, fetch, type RequestInit } from "undici";

let directAgent: Agent | undefined;

const networkCodes = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

export function houshiarModelFetchFailure(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") return "request timed out";
  const code = (error as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof code === "string" && networkCodes.has(code)) return `network error (${code})`;
  return "request failed";
}

export function fetchHoushiarDirect(url: string, init: RequestInit): ReturnType<typeof fetch> {
  directAgent ??= new Agent();
  // Electron 43.7.9's global fetch uses a dispatcher handler incompatible with this Undici Agent.
  return fetch(url, { ...init, dispatcher: directAgent, redirect: "error" });
}
