type ParsedInterviewGeneration = {
  evaluationSummary: string;
  questions: string[];
};

const SUMMARY_MAX_LENGTH = 150;
const DEFAULT_SUMMARY = "평가 요약을 생성하지 못했습니다.";

const STRUCTURAL_ONLY_PATTERN = /^[\s`"'{}[\],:]+$/;
const JSON_KEY_LABEL_PATTERN = /^["']?\s*(evaluationsummary|summary|questions)\s*["']?\s*:/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasMeaningfulText(value: string): boolean {
  return /[A-Za-z0-9가-힣]/.test(value);
}

function stripWrappingQuotes(value: string): string {
  return value
    .trim()
    .replace(/^[`"'“”‘’]+/, "")
    .replace(/[`"'“”‘’,]+$/, "")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .trim();
}

function sanitizeLine(value: string): string {
  return stripWrappingQuotes(
    value
      .replace(/^(\d+[).\s-]+|[-*]\s+)/, "")
      .replace(/,\s*$/, "")
      .trim(),
  );
}

function isNonContentLine(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  if (STRUCTURAL_ONLY_PATTERN.test(normalized)) return true;
  if (/^```/i.test(normalized)) return true;
  if (/^json$/i.test(normalized)) return true;
  return JSON_KEY_LABEL_PATTERN.test(normalized);
}

function clipSummary(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized || !hasMeaningfulText(normalized)) return "";
  if (normalized.length <= SUMMARY_MAX_LENGTH) return normalized;
  return normalized.slice(0, SUMMARY_MAX_LENGTH).trim();
}

function parseQuestionsFromLines(content: string, questionCount: number): string[] {
  const cleaned = content
    .split("\n")
    .map((line) => sanitizeLine(line))
    .filter(Boolean)
    .filter((line) => !isNonContentLine(line))
    .filter((line) => line.length > 5);

  if (cleaned.length === 0) return [];
  return cleaned.slice(0, questionCount);
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

function parseFromJson(content: string, questionCount: number): ParsedInterviewGeneration | null {
  try {
    const candidate = extractJsonCandidate(content);
    const parsed = JSON.parse(candidate) as {
      evaluationSummary?: unknown;
      summary?: unknown;
      questions?: unknown;
    };

    const rawSummary =
      typeof parsed.evaluationSummary === "string"
        ? parsed.evaluationSummary
        : typeof parsed.summary === "string"
          ? parsed.summary
          : "";

    const summary = clipSummary(sanitizeLine(rawSummary));
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQuestions
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeText(sanitizeLine(item)))
      .filter((item) => !isNonContentLine(item))
      .filter((item) => item.length > 5)
      .slice(0, questionCount);

    if (questions.length === 0) return null;
    return { evaluationSummary: summary, questions };
  } catch {
    return null;
  }
}

function parseSummaryFromText(content: string): string {
  const lines = content
    .split("\n")
    .map((line) => sanitizeLine(line))
    .filter(Boolean);

  const labeled = lines.find((line) => /^(evaluation\s*summary|summary|평가\s*요약)\s*[:：]/i.test(line));
  if (labeled) {
    const value = labeled.replace(/^(evaluation\s*summary|summary|평가\s*요약)\s*[:：]\s*/i, "");
    const summary = clipSummary(value);
    if (summary) return summary;
  }

  const firstParagraphLine = lines.find((line) => !isNonContentLine(line) && !/^(\d+[).\s-]+|[-*]\s+)/.test(line));
  if (firstParagraphLine) {
    const summary = clipSummary(firstParagraphLine);
    if (summary) return summary;
  }

  const clippedRaw = clipSummary(content.replace(/[{}[\]`"]+/g, " "));
  if (clippedRaw) return clippedRaw;
  return DEFAULT_SUMMARY;
}

export function parseInterviewGeneration(content: string, questionCount: number): ParsedInterviewGeneration {
  const jsonParsed = parseFromJson(content, questionCount);

  if (jsonParsed) {
    return {
      evaluationSummary: jsonParsed.evaluationSummary || parseSummaryFromText(content),
      questions: jsonParsed.questions,
    };
  }

  const questions = parseQuestionsFromLines(content, questionCount);
  if (questions.length === 0) {
    throw new Error("AI returned no valid interview questions.");
  }

  return {
    evaluationSummary: parseSummaryFromText(content),
    questions,
  };
}
