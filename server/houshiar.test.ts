import { ClaudeDriver } from "./drivers/claude.ts";
import { CLAUDE_MODEL_ID } from "./drivers/claude-model-extras.ts";
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


afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it("returns the Houshiar endpoint to the model picker without exposing credentials", () => {
  const instances = withEndpointUrls([{ instanceId: "houshiar" }], instanceConfigs({ instances: { houshiar: { driver: "openai-compat", config: { key: "fixture-secret" } } } }));
  expect(instances).toEqual([{ instanceId: "houshiar", url: "https://api.houshiar-ai.ir/v1" }]);
  expect(JSON.stringify(instances)).not.toContain("fixture-secret");
});

it("loads authenticated models before the Houshiar instance becomes available", async () => {
  const requested: string[] = [];
  const childCreate = vi.spyOn(ClaudeDriver, "create");
  const models = [
    { id: "hoshiar/model-1[1m][x2]", name: "Fixture model", supported_endpoints: ["/v1/messages"] },
    { id: "hoshiar/model-2" },
    { id: "chat-only", supported_endpoints: ["/v1/chat/completions"] },
    { id: "bad model" },
  ];
  vi.stubEnv("HTTPS_PROXY", "http://fixture-proxy:9");
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    requested.push(String(url));
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture-key");
    return Response.json({ data: models });
  }));
  const instance = await OpenAICompatDriver.create({
    instanceId: "houshiar", displayName: "Houshiar", enabled: true,
    config: OpenAICompatDriver.decodeConfig({ apiKeyEnv: "HOUSHIAR_API_KEY", key: "fixture-key" }), environment: {},
  });
  try {
    expect(instance.driverKind).toBe("claudeAgent");
    expect(childCreate.mock.calls[0][0].environment).toMatchObject({ HTTPS_PROXY: "", https_proxy: "", NO_PROXY: "*", NODE_USE_ENV_PROXY: "0" });
    expect(instance.models.options.map((row) => row.id)).toEqual(["hoshiar/model-1[1m][x2]", "hoshiar/model-2"]);
    expect(instance.models.options[0].label).toBe("Fixture model");
    expect(requested).toEqual(["https://api.houshiar-ai.ir/v1/models"]);
    models.push({ id: "hoshiar/new-model[x3]" });
    await instance.refreshModels?.();
    expect(instance.models.options.map((row) => row.id)).toContain("hoshiar/new-model[x3]");
    expect(childCreate.mock.calls[0][0].config.endpointModels).toContain("hoshiar/new-model[x3]");
  } finally { await instance.dispose(); }
});

it("adopts a key entered in the generic form only when it was saved for Houshiar", () => {
  const cfg = instanceConfigs({ openaiCompat: { url: "https://api.houshiar-ai.ir/v1", key: "fixture-migrated-key" } });
  expect(cfg.houshiar.config).toMatchObject({ key: "fixture-migrated-key", apiKeyEnv: "HOUSHIAR_API_KEY" });
});


it.each(["hosh/claude-opus-5-5[x2]", "hosh/model[x12]", "hosh/model[x1.5]", "claude-opus-5[1m]"])("accepts the gateway model id unchanged: %s", (id) => {
  expect(CLAUDE_MODEL_ID.test(id)).toBe(true);
});
it.each(["--model", "hosh/model[x2];echo", "hosh/model[x2] extra", "hosh/model[$(cmd)]", "hosh/model[x0]", "hosh/model[x2]\n"])("rejects malformed model ids: %s", (id) => {
  expect(CLAUDE_MODEL_ID.test(id)).toBe(false);
});
