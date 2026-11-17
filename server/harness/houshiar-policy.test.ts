import { describe, expect, it } from "vitest";
import { instanceConfigs } from "../config.ts";
import { makeFakeDriver } from "../testing/fake-driver.ts";
import { ProviderRegistry } from "./registry.ts";

describe("Houshiar registry policy", () => {
  it("blocks saved and renamed engines, and permits fixture drivers only by explicit injection", async () => {
    const fake = makeFakeDriver();
    const registry = new ProviderRegistry([fake.driver]);
    await registry.load({ houshiar: { driver: "fake", config: { apiKeyEnv: "HOUSHIAR_API_KEY" } }, other: { driver: "fake" } });
    expect(registry.instances()).toHaveLength(0);
    expect(await registry.describe()).toEqual([]);
    const fixture = new ProviderRegistry([fake.driver], { allowFixtureDrivers: true });
    await fixture.load({ other: { driver: "fake" } });
    expect(fixture.get("other")).not.toBeNull();
    expect(instanceConfigs({ instances: { claude: { driver: "claudeAgent" } } }).houshiar?.driver).toBe("openai-compat");
  });
});
