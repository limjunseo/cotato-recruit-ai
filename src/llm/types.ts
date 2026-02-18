import OpenAI from "openai";

export type LocalLlmRuntimeConfig = {
  provider: "local";
  client: OpenAI;
  model: string;
};

export type GeminiLlmRuntimeConfig = {
  provider: "gemini";
  model: string;
  apiKey: string;
  endpoint: string;
};

export type LlmRuntimeConfig = LocalLlmRuntimeConfig | GeminiLlmRuntimeConfig;

export type GenerateInterviewQuestionsOptions = {
  questionCount?: number;
  answerId?: string;
};
