export type LlmConfig = {
  provider: "local" | "gemini";
  model: string;
  endpoint?: string;
  apiKey: string;
};

const DEFAULT_LOCAL_LLM_ENDPOINT = "http://127.0.0.1:11434/v1";
const DEFAULT_LOCAL_LLM_MODEL = "gemma3:12b";
const DEFAULT_LOCAL_LLM_API_KEY = "ollama";
const DEFAULT_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

function parseProvider(rawProvider: string | undefined): "local" | "gemini" {
  const normalized = (rawProvider ?? "local").trim().toLowerCase();
  if (normalized === "local" || normalized === "gemini") return normalized;
  throw new Error("Invalid LLM_PROVIDER. Use 'local' or 'gemini'.");
}

function normalizeLocalLlmEndpoint(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid LOCAL_LLM_ENDPOINT. Example: http://127.0.0.1:11434/v1");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid LOCAL_LLM_ENDPOINT protocol. Use http:// or https://");
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (!normalizedPath || normalizedPath === "/") {
    parsed.pathname = "/v1";
  } else {
    parsed.pathname = normalizedPath;
  }

  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/$/, "");
}

function normalizeGeminiEndpoint(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid GEMINI_API_ENDPOINT. Example: https://generativelanguage.googleapis.com/v1beta");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid GEMINI_API_ENDPOINT protocol. Use http:// or https://");
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function getLlmConfig(): LlmConfig {
  const provider = parseProvider(process.env.LLM_PROVIDER);

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini.");
    }

    return {
      provider,
      endpoint: normalizeGeminiEndpoint(process.env.GEMINI_API_ENDPOINT ?? DEFAULT_GEMINI_ENDPOINT),
      model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
      apiKey,
    };
  }

  const endpoint = normalizeLocalLlmEndpoint(
    process.env.LOCAL_LLM_ENDPOINT ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_LOCAL_LLM_ENDPOINT,
  );

  return {
    provider: "local",
    endpoint,
    model: process.env.LOCAL_LLM_MODEL ?? process.env.OLLAMA_MODEL ?? DEFAULT_LOCAL_LLM_MODEL,
    apiKey: process.env.LOCAL_LLM_API_KEY ?? DEFAULT_LOCAL_LLM_API_KEY,
  };
}
