import type { Application, ApplicationAnswer, Question } from "@prisma/client";
import type {
  ApplicationAnswer as ApplicationAnswerDto,
  ApplicationDetail,
  ApplicationListItem,
  PartType,
  PassStatus,
} from "@/types/application";

function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "bigint") return value === BigInt(1);
  if (value instanceof Uint8Array) return value[0] === 1;
  return null;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function serializeApplicationList(row: Application): ApplicationListItem {
  return {
    applicationId: row.application_id.toString(),
    applicationPartType: row.application_part_type as PartType,
    completedSemesters: row.completed_semesters ?? null,
    isEnrolled: normalizeBoolean(row.is_enrolled),
    isSubmitted: normalizeBoolean(row.is_submitted),
    name: row.name ?? null,
    passStatus: (row.pass_status as PassStatus | null) ?? null,
    submittedAt: toIso(row.submitted_at),
    university: row.university ?? null,
    major: row.major ?? null,
    generationId: row.generation_id?.toString() ?? null,
  };
}

type ApplicationAnswerWithQuestion = ApplicationAnswer & { question: Question | null };
type ApplicationWithAnswers = Application & { answers: ApplicationAnswerWithQuestion[] };

function serializeApplicationAnswer(row: ApplicationAnswerWithQuestion): ApplicationAnswerDto {
  return {
    answerId: row.answer_id.toString(),
    questionId: row.question_id.toString(),
    questionContent: row.question?.content ?? null,
    questionType: (row.question?.question_type as PartType | undefined) ?? null,
    content: row.content ?? "",
  };
}

export function serializeApplicationDetail(row: ApplicationWithAnswers): ApplicationDetail {
  return {
    applicationId: row.application_id.toString(),
    applicationPartType: row.application_part_type as PartType,
    birthDate: toDateOnly(row.birth_date),
    completedSemesters: row.completed_semesters ?? null,
    gender: row.gender ?? null,
    isEnrolled: normalizeBoolean(row.is_enrolled),
    isPrevActivity: normalizeBoolean(row.is_prev_activity),
    isSubmitted: normalizeBoolean(row.is_submitted),
    major: row.major ?? null,
    name: row.name ?? null,
    passStatus: (row.pass_status as PassStatus | null) ?? null,
    pdfFileKey: row.pdf_file_key ?? null,
    pdfFileUrl: row.pdf_file_url ?? null,
    phoneNumber: row.phone_number ?? null,
    submittedAt: toIso(row.submitted_at),
    university: row.university ?? null,
    generationId: row.generation_id?.toString() ?? null,
    userId: row.user_id?.toString() ?? null,
    answers: row.answers.map(serializeApplicationAnswer),
  };
}
