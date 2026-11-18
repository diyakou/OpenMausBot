import { Agent } from "undici";

let directAgent: Agent | undefined;

export function fetchHoushiarDirect(url: string, init: RequestInit): Promise<Response> {
  directAgent ??= new Agent();
  return fetch(url, { ...init, dispatcher: directAgent, redirect: "error" } as RequestInit);
}
