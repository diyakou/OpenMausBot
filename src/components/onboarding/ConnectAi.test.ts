// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ConnectAi } from "./ConnectAi";
vi.mock("@/state/store", () => ({ api: vi.fn(), useStore: () => ({ state: { instances: [{ instanceId: "claude", displayName: "Claude" }, { instanceId: "openai", displayName: "OpenAI" }] }, dispatch: vi.fn() }) }));

it("offers only the Houshiar key even with a legacy provider list", () => {
  const html = renderToStaticMarkup(createElement(ConnectAi, { tested: null }));
  expect(html).toContain("Houshiar API key");
  expect(html).toContain('type="password"');
  expect(html).not.toMatch(/Claude|OpenAI|ModelGo|Other ways/);
});
