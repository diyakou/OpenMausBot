// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({ api: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/state/store", () => ({ api: fixture.api, useStore: () => ({ state: { instances: [] }, dispatch: fixture.dispatch }) }));
import { HoushiarSetup } from "./HoushiarSetup";

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLocale("en");
  fixture.api.mockReset();
  fixture.dispatch.mockReset();
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
  fixture.api.mockResolvedValue({ instances: [] });
  expect(container.querySelector("input")!.type).toBe("password");
  expect(container.querySelector("button")!.disabled).toBe(true);
  await submit();
  expect(fixture.api).toHaveBeenCalledExactlyOnceWith("/api/instances/houshiar", { method: "PATCH", body: JSON.stringify({ apiKey: "fixture-secret" }) });
  expect(container.querySelector("input")!.value).toBe("");
  expect(container.querySelector("[role=status]")!.textContent).toBe("Houshiar connected");
  expect(container.innerHTML).not.toContain("fixture-secret");
  expect(fixture.dispatch).toHaveBeenCalledWith({ type: "instances", instances: [] });
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
