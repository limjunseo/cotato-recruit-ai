import { execFile } from "node:child_process";
import { INTERVIEW_QUESTION_SYSTEM_PROMPT } from "@/interview-question/interview-question-prompts";
import type { GenerateForAnswerInput } from "@/interview-question/generator/generator-types";
import { extractErrorMessage, normalizeMessageContent } from "@/interview-question/generator/generator-common";

const OPENCLAW_TIMEOUT_MS = 120_000;
const OPENCLAW_MAX_BUFFER_BYTES = 4 * 1024 * 1024;
let openClawUnavailableInProcess = false;

class LlmHttpError extends Error {
  status: number;
  headers: Headers;

  constructor(message: string, status: number, headers: Headers) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

class LlmCliError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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

function extractOpenClawText(payload: unknown): string {
  if (typeof payload === "string") return payload.trim();

  const normalized = normalizeMessageContent(payload);
  if (normalized) return normalized;

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = extractOpenClawText(item);
      if (text) return text;
    }
    return "";
  }

  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;

  for (const key of ["output_text", "output", "response", "result", "text", "content", "message"]) {
    const text = extractOpenClawText(record[key]);
    if (text) return text;
  }

  const choices = record.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const text = extractOpenClawText(choice);
      if (text) return text;
    }
  }

  return "";
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function findBalancedJsonEnd(source: string, start: number): number {
  const first = source[start];
  if (first !== "{" && first !== "[") return -1;

  const stack: string[] = [first];
  let inString = false;
  let escaping = false;

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const open = stack.pop();
      const matched = (open === "{" && char === "}") || (open === "[" && char === "]");
      if (!matched) return -1;
      if (stack.length === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractJsonCandidates(stdout: string): string[] {
  const trimmed = stripAnsi(stdout).trim();
  if (!trimmed) return [];

  const candidates = new Set<string>([trimmed]);
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char !== "{" && char !== "[") continue;

    const end = findBalancedJsonEnd(trimmed, index);
    if (end === -1) continue;
    candidates.add(trimmed.slice(index, end + 1).trim());
  }

  return Array.from(candidates).sort((left, right) => right.length - left.length);
}

function parseOpenClawStdout(stdout: string, stderr: string): string {
  const trimmed = stripAnsi(stdout).trim();
  if (!trimmed) {
    const stderrText = stderr.trim();
    throw new Error(`OpenClaw CLI returned empty stdout${stderrText ? `: ${stderrText}` : "."}`);
  }

  const candidates = extractJsonCandidates(trimmed);

  let lastParseError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const text = extractOpenClawText(parsed);
      if (text) return text;

      lastParseError = new Error("JSON parsed but response text was not found.");
    } catch (error) {
      lastParseError = error instanceof Error ? error : new Error("Unknown JSON parse error.");
    }
  }

  throw new Error(`Failed to parse OpenClaw JSON output. ${lastParseError?.message ?? "Unknown parse error."}`);
}

async function runOpenClawCommand(command: string, args: string[], prompt: string): Promise<string> {
  const composedMessage = `${INTERVIEW_QUESTION_SYSTEM_PROMPT}\n\n${prompt}`;
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";
  return new Promise((resolve, reject) => {
    execFile(
      command,
      [...args, "agent", "--agent", agentId, "--message", composedMessage, "--json"],
      {
        timeout: OPENCLAW_TIMEOUT_MS,
        maxBuffer: OPENCLAW_MAX_BUFFER_BYTES,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const stdoutText = String(stdout ?? "");
        const stderrText = String(stderr ?? "");

        if (error) {
          const code = (error as { code?: unknown }).code;
          const exitCode = typeof code === "number" ? code : null;
          const detail = stderrText.trim() || extractErrorMessage(error);
          const suffix = exitCode === null ? "" : ` (exit ${exitCode})`;
          reject(new LlmCliError(`OpenClaw CLI failed${suffix}: ${detail}`, 503));
          return;
        }

        try {
          const content = parseOpenClawStdout(stdoutText, stderrText);
          resolve(content);
        } catch (parseError) {
          reject(new LlmCliError(`OpenClaw JSON parse failed: ${extractErrorMessage(parseError)}`, 500));
        }
      },
    );
  });
}

async function requestOpenClawCompletion(prompt: string): Promise<string> {
  const attempts: Array<{ command: string; args: string[] }> = [];
  const configuredBin = process.env.OPENCLAW_BIN?.trim();
  if (configuredBin) {
    attempts.push({ command: configuredBin, args: [] });
  }

  attempts.push({ command: "openclaw", args: [] });

  if (process.platform === "win32") {
    const wslBin = process.env.OPENCLAW_WSL_BIN?.trim();
    if (wslBin) {
      attempts.push({ command: "wsl", args: [wslBin] });
    }
    attempts.push({ command: "wsl", args: ["openclaw"] });
  }

  let lastError: unknown = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      return await runOpenClawCommand(attempt.command, attempt.args, prompt);
    } catch (error) {
      lastError = error;
      const hasNext = index < attempts.length - 1;
      if (!hasNext || !isOpenClawNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenClaw command execution failed.");
}

function isOpenClawNotFoundError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes("enoent") ||
    message.includes("einval") ||
    message.includes("spawn einval") ||
    message.includes("not recognized as an internal or external command") ||
    message.includes("command not found")
  );
}

function isOpenClawEnabled(): boolean {
  const raw = process.env.LOCAL_LLM_USE_OPENCLAW?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function requestLocalOpenAiCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider !== "local") {
    throw new Error("Invalid runtime provider for local completion.");
  }

  const baseRequest = {
    model: input.runtime.model,
    messages: [
      {
        role: "system" as const,
        content: INTERVIEW_QUESTION_SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: prompt,
      },
    ],
    temperature: 0.2,
  };

  let response;
  try {
    response = await input.runtime.client.chat.completions.create({
      ...baseRequest,
      response_format: { type: "json_object" },
    });
  } catch {
    response = await input.runtime.client.chat.completions.create(baseRequest);
  }

  const content = normalizeMessageContent(response.choices[0]?.message?.content ?? "");
  if (!content) {
    throw new Error("Local LLM returned empty content.");
  }

  return content;
}

async function requestLocalCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider !== "local") {
    throw new Error("Invalid runtime provider for local completion.");
  }

  if (!isOpenClawEnabled()) {
    return requestLocalOpenAiCompletion(input, prompt);
  }
  if (openClawUnavailableInProcess) {
    return requestLocalOpenAiCompletion(input, prompt);
  }

  try {
    return await requestOpenClawCompletion(prompt);
  } catch (error) {
    if (!isOpenClawNotFoundError(error)) {
      throw error;
    }

    openClawUnavailableInProcess = true;
    console.warn("[llm] openclaw binary not found. Disabling OpenClaw for this process and falling back.", {
      reason: extractErrorMessage(error),
    });
    return requestLocalOpenAiCompletion(input, prompt);
  }
}

async function requestGeminiCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider !== "gemini") {
    throw new Error("Invalid runtime provider for Gemini completion.");
  }

  const url = `${input.runtime.endpoint}/models/${encodeURIComponent(input.runtime.model)}:generateContent?key=${encodeURIComponent(input.runtime.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: INTERVIEW_QUESTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LlmHttpError(`Gemini API ${response.status}: ${errorText || "Unknown error"}`, response.status, response.headers);
  }

  const payload = (await response.json()) as unknown;
  return extractGeminiText(payload);
}

export async function requestCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider === "gemini") {
    return requestGeminiCompletion(input, prompt);
  }

  return requestLocalCompletion(input, prompt);
}
