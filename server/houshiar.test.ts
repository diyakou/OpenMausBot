import { instanceConfigs, persistableInstanceConfigs } from "./config.ts";
import { describe, expect, it } from "vitest";
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
