// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import { ApiError } from "@/state/api";

const fixture = vi.hoisted(() => ({ api: vi.fn(), dispatch: vi.fn(), instances: [] as unknown[] }));
vi.mock("@/state/store", () => ({ api: fixture.api, useStore: () => ({ state: { instances: fixture.instances }, dispatch: fixture.dispatch }) }));
import { HoushiarSetup } from "./HoushiarSetup";

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLocale("en");
  fixture.api.mockReset();
  fixture.dispatch.mockReset();
  fixture.instances = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(createElement(HoushiarSetup)); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

async function submit() {
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "fixture-secret");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}

it("saves only the Houshiar key, clears the field and publishes the returned model list", async () => {
  fixture.api.mockResolvedValue({ instances: [{ instanceId: "houshiar", models: { options: [{ id: "fixture-model" }] } }] });
  expect(container.querySelector("input")!.type).toBe("password");
  expect(container.querySelector("button")!.disabled).toBe(true);
  await submit();
  expect(fixture.api).toHaveBeenCalledExactlyOnceWith("/api/instances/houshiar", { method: "PATCH", body: JSON.stringify({ apiKey: "fixture-secret" }) });
  expect(container.querySelector("input")!.value).toBe("");
  expect(container.querySelector("[role=status]")!.textContent).toBe("Houshiar connected");
  expect(container.innerHTML).not.toContain("fixture-secret");
  expect(fixture.dispatch).toHaveBeenCalledWith({ type: "instances", instances: [{ instanceId: "houshiar", models: { options: [{ id: "fixture-model" }] } }] });
});

it("shows an inline retryable failure without exposing the server error or key", async () => {
  fixture.api.mockRejectedValue(new Error("fixture-secret"));
  await submit();
  expect(container.querySelector("[role=alert]")!.textContent).toContain("Try again");
  expect(container.textContent).not.toContain("fixture-secret");
  expect(container.querySelector("button")!.disabled).toBe(false);
});

it("reports an unreadable catalog as a warning instead of a connected status", async () => {
  fixture.api.mockResolvedValue({ instances: [], warning: "unreadable" });
  await submit();
  expect(container.querySelector("[role=alert]")!.textContent).toContain("did not return its models");
  expect(container.querySelector("[role=status]")).toBeNull();
});

it("reloads the catalog after saving without asking for the key again", async () => {
  fixture.api.mockResolvedValueOnce({ instances: [] }).mockResolvedValueOnce({
    instances: [{ instanceId: "houshiar", models: { options: [{ id: "auto" }, { id: "fixture-model" }] } }],
  });
  await submit();
  expect(container.querySelector("input")!.value).toBe("");
  await act(async () => { container.querySelector<HTMLButtonElement>('button[type="button"]')!.click(); });
  expect(fixture.api).toHaveBeenLastCalledWith("/api/instances/houshiar/refresh-models", { method: "POST", body: "{}" });
  expect(container.querySelector("[role=status]")!.textContent).toBe("Houshiar connected");
});

it("shows the missing CLI reason instead of a connected status", async () => {
  fixture.instances = [{
    instanceId: "houshiar", driverKind: "claudeAgent", displayName: "Houshiar", access: "api",
    snapshot: { state: "unavailable", reason: "`claude` CLI not found" },
    models: { options: [{ id: "auto" }] },
    install: { command: { win32: "npm install -g @anthropic-ai/claude-code" } },
  }];
  await act(async () => { root.render(createElement(HoushiarSetup)); });
  expect(container.textContent).toContain("CLI not found");
  expect(container.textContent).toContain("npm install -g @anthropic-ai/claude-code");
  expect(container.querySelector("[role=status]")).toBeNull();
});

it("explains why an active turn blocks changing the key without exposing the server response", async () => {
  fixture.api.mockRejectedValue(new ApiError("fixture-secret", 409));
  await submit();
  expect(container.querySelector("[role=alert]")!.textContent).toContain("Wait for active Houshiar replies");
  expect(container.textContent).not.toContain("fixture-secret");
});
