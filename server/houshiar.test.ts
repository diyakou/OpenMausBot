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
