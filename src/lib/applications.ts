import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeApplicationDetail, serializeApplicationList } from "@/lib/serializers";
import { PART_TYPES, PASS_STATUSES, type ApplicationFilters, type ApplicationListResponse } from "@/types/application";

const PART_FILTER_VALUES = ["ALL", ...PART_TYPES] as const;
const PASS_FILTER_VALUES = ["ALL", ...PASS_STATUSES] as const;

const filterSchema = z.object({
  q: z.string().trim().default(""),
  part: z.enum(PART_FILTER_VALUES).default("ALL"),
  passStatus: z.enum(PASS_FILTER_VALUES).default("ALL"),
  notionExists: z.enum(["all", "yes", "no"]).default("all"),
  submitted: z.enum(["all", "yes", "no"]).default("all"),
  enrolled: z.enum(["all", "yes", "no"]).default("all"),
  prevActivity: z.enum(["all", "yes", "no"]).default("all"),
  generationId: z.string().trim().default(""),
  submittedFrom: z.string().trim().default(""),
  submittedTo: z.string().trim().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function toBooleanFilter(value: "all" | "yes" | "no") {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

function parseDate(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function parseFilters(rawParams: Record<string, string | undefined>): ApplicationFilters {
  return filterSchema.parse(rawParams);
}

function buildWhere(filters: ApplicationFilters): Prisma.ApplicationWhereInput {
  const submittedFrom = parseDate(filters.submittedFrom);
  const submittedTo = parseDate(filters.submittedTo);

  if (submittedTo) {
    submittedTo.setHours(23, 59, 59, 999);
  }

  const where: Prisma.ApplicationWhereInput = {
    ...(filters.part !== "ALL" ? { application_part_type: filters.part } : {}),
    ...(filters.passStatus !== "ALL" ? { pass_status: filters.passStatus } : {}),
    ...(toBooleanFilter(filters.submitted) !== undefined ? { is_submitted: toBooleanFilter(filters.submitted) } : {}),
    ...(toBooleanFilter(filters.enrolled) !== undefined ? { is_enrolled: toBooleanFilter(filters.enrolled) } : {}),
    ...(toBooleanFilter(filters.prevActivity) !== undefined
      ? { is_prev_activity: toBooleanFilter(filters.prevActivity) }
      : {}),
    ...(filters.generationId && /^\d+$/.test(filters.generationId)
      ? { generation_id: BigInt(filters.generationId) }
      : {}),
    ...(submittedFrom || submittedTo
      ? {
          submitted_at: {
            ...(submittedFrom ? { gte: submittedFrom } : {}),
            ...(submittedTo ? { lte: submittedTo } : {}),
          },
        }
      : {}),
  };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { major: { contains: filters.q } },
      { university: { contains: filters.q } },
      { phone_number: { contains: filters.q } },
    ];
  }

  return where;
}

export async function getApplications(rawParams: Record<string, string | undefined>): Promise<ApplicationListResponse> {
  const filters = parseFilters(rawParams);
  const where = buildWhere(filters);
  const skip = (filters.page - 1) * filters.pageSize;

  const [rows, total] = await prisma.$transaction([
    prisma.application.findMany({
      where,
      orderBy: [{ submitted_at: "desc" }, { application_id: "desc" }],
      skip,
      take: filters.pageSize,
    }),
    prisma.application.count({ where }),
  ]);

  return {
    items: rows.map(serializeApplicationList),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getApplicationById(applicationId: bigint) {
  const row = await prisma.application.findUnique({
    where: { application_id: applicationId },
    include: {
      answers: {
        include: {
          question: true,
        },
        orderBy: [{ question_id: "asc" }, { answer_id: "asc" }],
      },
    },
  });

  if (!row) return null;
  return serializeApplicationDetail(row);
}
