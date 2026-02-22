import OpenAI from "openai";
import { getLlmConfig } from "@/interview-question/config";
import type { LlmRuntimeConfig } from "@/interview-question/types";

export function createLlmRuntimeConfig(): LlmRuntimeConfig {
  const config = getLlmConfig();

  if (config.provider === "gemini") {
    return {
      provider: "gemini",
      model: config.model,
      apiKey: config.apiKey,
      endpoint: config.endpoint ?? "https://generativelanguage.googleapis.com/v1beta",
    };
  }

  return {
    provider: "local",
    client: new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint,
    }),
    model: config.model,
  };
}
