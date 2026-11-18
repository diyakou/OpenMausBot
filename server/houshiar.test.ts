import { withEndpointUrls } from "./openai-compat-endpoints.ts";
import { instanceConfigs, persistableInstanceConfigs } from "./config.ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatDriver } from "./drivers/openai-compat.ts";
import { DEFAULT_FLEET } from "./instance-fleets.ts";

describe("Houshiar connection", () => {
  it("pins the endpoint and isolates its key from compatible provider overrides", () => {
    const config = OpenAICompatDriver.decodeConfig({ apiKeyEnv: "HOUSHIAR_API_KEY", url: "https://example.com/v1" });
    expect(config.url).toBe("https://api.houshiar-ai.ir/v1");
    expect(config.apiKeyEnv).toBe("HOUSHIAR_API_KEY");
    expect(DEFAULT_FLEET.houshiar.config).toMatchObject({ url: config.url, apiKeyEnv: config.apiKeyEnv });
  });
});


it("keeps Houshiar independent of workspace provider defaults", () => {
  const config = instanceConfigs({ openaiCompat: { key: "other-key", url: "https://other.example/v1", model: "other-model", provider: "other" } });
  expect(config.houshiar.config).toMatchObject({ url: "https://api.houshiar-ai.ir/v1", provider: "", apiKeyEnv: "HOUSHIAR_API_KEY" });
  expect(config.houshiar.config).not.toHaveProperty("model");
  expect(persistableInstanceConfigs({}).houshiar.config).toMatchObject({ apiKeyEnv: "HOUSHIAR_API_KEY" });
});


afterEach(() => vi.unstubAllGlobals());

it("returns the Houshiar endpoint to the model picker without exposing credentials", () => {
  const instances = withEndpointUrls([{ instanceId: "houshiar" }], instanceConfigs({ instances: { houshiar: { driver: "openai-compat", config: { key: "fixture-secret" } } } }));
  expect(instances).toEqual([{ instanceId: "houshiar", url: "https://api.houshiar-ai.ir/v1" }]);
  expect(JSON.stringify(instances)).not.toContain("fixture-secret");
});

it("loads authenticated models before the Houshiar instance becomes available", async () => {
  const requested: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    requested.push(String(url));
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-key");
    return Response.json({ data: [
      { id: "hoshiar/model-1", name: "Fixture model", supported_endpoints: ["/v1/messages"] },
      { id: "hoshiar/model-2" },
      { id: "chat-only", supported_endpoints: ["/v1/chat/completions"] },
    ] });
  }));
  const instance = await OpenAICompatDriver.create({
    instanceId: "houshiar", displayName: "Houshiar", enabled: true,
    config: OpenAICompatDriver.decodeConfig({ apiKeyEnv: "HOUSHIAR_API_KEY", key: "fixture-key" }), environment: {},
  });
  try {
    expect(instance.driverKind).toBe("claudeAgent");
    expect(instance.models.options.map((row) => row.id)).toEqual(["hoshiar/model-1", "hoshiar/model-2"]);
    expect(requested).toEqual(["https://api.houshiar-ai.ir/v1/models"]);
  } finally { await instance.dispose(); }
});

it("adopts a key entered in the generic form only when it was saved for Houshiar", () => {
  const cfg = instanceConfigs({ openaiCompat: { url: "https://api.houshiar-ai.ir/v1", key: "fixture-migrated-key" } });
  expect(cfg.houshiar.config).toMatchObject({ key: "fixture-migrated-key", apiKeyEnv: "HOUSHIAR_API_KEY" });
});
