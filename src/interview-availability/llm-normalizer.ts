import { createLlmRuntimeConfig } from "@/interview-question/client";
import type { LlmRuntimeConfig } from "@/interview-question/types";
import {
  AVAILABILITY_NORMALIZER_SYSTEM_PROMPT,
  buildAvailabilityNormalizerUserPrompt,
} from "@/interview-availability/llm-normalizer-prompts";

type NormalizedRange = {
  start: string;
  end: string;
};

type NormalizedEntry = {
  date: "2/28" | "3/1" | "3/2";
  allDay: boolean;
  ranges: NormalizedRange[];
};

type NormalizedPayload = {
  entries: NormalizedEntry[];
};

type AvailabilityTextNormalizer = (rawText: string) => Promise<string>;

const DATE_ORDER: NormalizedEntry["date"][] = ["2/28", "3/1", "3/2"];
const DATE_SET = new Set<NormalizedEntry["date"]>(DATE_ORDER);

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      const text = (part as { text?: unknown })?.text;
      return typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

function extractGeminiText(payload: unknown): string {
  const candidates = (payload as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini returned no candidates.");
  }

  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
  };
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error("Gemini returned no content parts.");
  }

  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned empty content.");
  }

  return text;
}

function extractJsonCandidate(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    return content.slice(firstBrace, lastBrace + 1).trim();
  }

  return content.trim();
}

function isValidTimeToken(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
  if (hour < 0 || hour > 24) return false;
  if (minute < 0 || minute > 59) return false;
  if (hour === 24 && minute !== 0) return false;
  return true;
}

function normalizeTimeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim();
  const match = compact.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const normalized = `${match[1].padStart(2, "0")}:${match[2]}`;
  return isValidTimeToken(normalized) ? normalized : null;
}

function normalizeAllDayToken(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;

  const compact = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(compact)) return true;
  if (["false", "0", "no", "n", "off"].includes(compact)) return false;
  return false;
}

function normalizeDateToken(value: unknown): NormalizedEntry["date"] | null {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/\s+/g, "");
  const normalized = compact
    .toLowerCase()
    .replace(/[.]/g, "/")
    .replace(/-/g, "/")
    .replace(/월/g, "/")
    .replace(/일/g, "");

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;

  const token = `${month}/${day}`;
  if (token === "2/28" || token === "3/1" || token === "3/2") {
    return token;
  }
  return null;
}

function normalizeRangeToken(value: unknown): NormalizedRange | null {
  if (typeof value === "string") {
    const match = value.trim().match(/(\d{1,2}:\d{2})\s*[~\-]\s*(\d{1,2}:\d{2})/);
    if (!match) return null;
    const start = normalizeTimeToken(match[1]);
    const end = normalizeTimeToken(match[2]);
    if (!start || !end) return null;
    return { start, end };
  }

  const start = normalizeTimeToken((value as { start?: unknown })?.start);
  const end = normalizeTimeToken((value as { end?: unknown })?.end);
  if (!start || !end) return null;
  return { start, end };
}

function sanitizeNormalizedPayload(payload: unknown): NormalizedPayload {
  const entries = (payload as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) {
    return { entries: [] };
  }

  const grouped = new Map<NormalizedEntry["date"], { allDay: boolean; ranges: Set<string> }>();

  for (const item of entries) {
    const date = normalizeDateToken((item as { date?: unknown })?.date);
    if (!date || !DATE_SET.has(date)) continue;

    const allDay = normalizeAllDayToken((item as { allDay?: unknown })?.allDay);
    const rawRanges = (item as { ranges?: unknown })?.ranges;

    if (!grouped.has(date)) {
      grouped.set(date, { allDay: false, ranges: new Set<string>() });
    }

    const target = grouped.get(date);
    if (!target) continue;

    if (allDay) {
      target.allDay = true;
      target.ranges.clear();
      continue;
    }

    if (!Array.isArray(rawRanges)) continue;
    for (const rawRange of rawRanges) {
      const range = normalizeRangeToken(rawRange);
      if (!range) continue;
      target.ranges.add(`${range.start}~${range.end}`);
    }
  }

  const normalizedEntries: NormalizedEntry[] = [];
  for (const date of DATE_ORDER) {
    const groupedEntry = grouped.get(date);
    if (!groupedEntry) continue;

    if (groupedEntry.allDay) {
      normalizedEntries.push({ date, allDay: true, ranges: [] });
      continue;
    }

    const ranges = Array.from(groupedEntry.ranges)
      .map((value) => {
        const [start, end] = value.split("~");
        return { start, end };
      })
      .filter((range) => Boolean(range.start) && Boolean(range.end));

    if (ranges.length === 0) continue;
    normalizedEntries.push({ date, allDay: false, ranges });
  }

  return { entries: normalizedEntries };
}

function toCanonicalUnavailableText(payload: NormalizedPayload): string {
  if (payload.entries.length === 0) return "";

  return payload.entries
    .map((entry) => {
      if (entry.allDay) {
        return `${entry.date} 00:00~24:00`;
      }
      return `${entry.date} ${entry.ranges.map((range) => `${range.start}~${range.end}`).join(", ")}`;
    })
    .join("\n");
}

async function requestLocalNormalization(runtime: LlmRuntimeConfig, prompt: string): Promise<string> {
  if (runtime.provider !== "local") {
    throw new Error("Invalid runtime provider for local normalization.");
  }

  const baseRequest = {
    model: runtime.model,
    messages: [
      {
        role: "system" as const,
        content: AVAILABILITY_NORMALIZER_SYSTEM_PROMPT,
      },
      { role: "user" as const, content: prompt },
    ],
    temperature: 0.1,
  };

  let response;
  try {
    response = await runtime.client.chat.completions.create({
      ...baseRequest,
      response_format: { type: "json_object" },
    });
  } catch {
    response = await runtime.client.chat.completions.create(baseRequest);
  }

  const content = normalizeMessageContent(response.choices[0]?.message?.content ?? "");
  if (!content) {
    throw new Error("Local LLM returned empty content for availability normalization.");
  }

  return content;
}

async function requestGeminiNormalization(runtime: LlmRuntimeConfig, prompt: string): Promise<string> {
  if (runtime.provider !== "gemini") {
    throw new Error("Invalid runtime provider for Gemini normalization.");
  }

  const url = `${runtime.endpoint}/models/${encodeURIComponent(runtime.model)}:generateContent?key=${encodeURIComponent(runtime.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: AVAILABILITY_NORMALIZER_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText || "Unknown error"}`);
  }

  const payload = (await response.json()) as unknown;
  return extractGeminiText(payload);
}

async function normalizeTextWithLlm(rawText: string, runtime: LlmRuntimeConfig): Promise<string> {
  const prompt = buildAvailabilityNormalizerUserPrompt(rawText);
  const content =
    runtime.provider === "gemini"
      ? await requestGeminiNormalization(runtime, prompt)
      : await requestLocalNormalization(runtime, prompt);

  const parsed = JSON.parse(extractJsonCandidate(content)) as unknown;
  const sanitized = sanitizeNormalizedPayload(parsed);
  return toCanonicalUnavailableText(sanitized);
}

function isLlmNormalizerEnabled() {
  const flag = process.env.INTERVIEW_AVAILABILITY_USE_LLM_NORMALIZER?.trim().toLowerCase();
  if (!flag) return true;
  return !["0", "false", "off", "no"].includes(flag);
}

export function isInterviewAvailabilityLlmEnabled() {
  return isLlmNormalizerEnabled();
}

export function createStrictAvailabilityLlmNormalizer(): AvailabilityTextNormalizer {
  if (!isLlmNormalizerEnabled()) {
    throw new Error("Interview availability LLM normalizer is disabled.");
  }

  let runtime: LlmRuntimeConfig | null = null;
  const cache = new Map<string, string>();

  return async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return "";

    const cached = cache.get(trimmed);
    if (cached !== undefined) {
      return cached;
    }

    runtime ??= createLlmRuntimeConfig();
    const normalized = await normalizeTextWithLlm(trimmed, runtime);
    cache.set(trimmed, normalized);
    return normalized;
  };
}

export function createAvailabilityTextNormalizer(): AvailabilityTextNormalizer {
  const enabled = isLlmNormalizerEnabled();
  let runtime: LlmRuntimeConfig | null = null;
  let disabledByError = !enabled;
  const cache = new Map<string, string>();

  return async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return rawText;
    if (!enabled || disabledByError) return rawText;

    const cached = cache.get(trimmed);
    if (cached !== undefined) {
      return cached;
    }

    try {
      runtime ??= createLlmRuntimeConfig();
      const normalized = await normalizeTextWithLlm(trimmed, runtime);
      const next = normalized || rawText;
      cache.set(trimmed, next);
      return next;
    } catch (error) {
      disabledByError = true;
      console.warn("[interview-availability] LLM normalizer disabled due to error. Falling back to regex parser.", {
        message: error instanceof Error ? error.message : String(error),
      });
      return rawText;
    }
  };
}
