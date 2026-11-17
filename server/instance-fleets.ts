// The engine instances a fresh install starts with, and the ones an existing product fleet gains.
// instanceConfigs (config.ts) copies every entry before it changes one.
import type { InstanceConfigMap } from "./contracts.ts";

export const OPENAI_API_INSTANCE = "openai";
export const OPENROUTER_API_INSTANCE = "openrouter";
export const XAI_API_INSTANCE = "xaiApi";
export const CLAUDE_API_INSTANCE = "claudeApi";
export const API_KEY_FLEET: InstanceConfigMap = {
  [OPENAI_API_INSTANCE]: {
    driver: "openai-compat", displayName: "OpenAI", access: "api", icon: { kind: "preset", preset: "openai" },
    config: { url: "https://api.openai.com/v1", apiKeyEnv: "OMB_OPENAI_API_KEY", catalog: "openai" },
  },
  [CLAUDE_API_INSTANCE]: {
    driver: "claudeAgent", displayName: "Claude (API key)", access: "api", icon: { kind: "preset", preset: "anthropic" },
    config: { requireApiKey: true },
  },
  [XAI_API_INSTANCE]: { driver: "grok", displayName: "xAI", access: "api", icon: { kind: "preset", preset: "xai" } },
  [OPENROUTER_API_INSTANCE]: {
    driver: "openai-compat", displayName: "OpenRouter", access: "api", icon: { kind: "preset", preset: "openrouter" },
    config: { url: "https://openrouter.ai/api/v1", apiKeyEnv: "OMB_OPENROUTER_API_KEY" },
  },
};

// Google retired Gemini CLI for the free/Pro/Ultra tiers on 2026-06-18; enterprise licences restore it with
// `{"instances": {"gemini": {"driver": "geminiAgent"}}}`.
export const DEFAULT_FLEET: InstanceConfigMap = {
  houshiar: { driver: "openai-compat", displayName: "Houshiar", access: "api", config: { url: "https://api.houshiar-ai.ir/v1", apiKeyEnv: "HOUSHIAR_API_KEY", provider: "" } },
};

export const PRODUCT_FLEET_ADDITIONS = { houshiar: DEFAULT_FLEET.houshiar! } as const;
