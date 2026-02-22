export const PART_TYPES = ["BE", "DE", "FE", "PM"] as const;
export const PASS_STATUSES = ["FAIL", "PASS", "PENDING", "WAITLISTED"] as const;

export type PartType = (typeof PART_TYPES)[number];
export type PassStatus = (typeof PASS_STATUSES)[number];
export type TriState = "all" | "yes" | "no";

export type ApplicationListItem = {
  applicationId: string;
  applicationPartType: PartType;
  completedSemesters: number | null;
  isEnrolled: boolean | null;
  isSubmitted: boolean | null;
  isSyncedToNotion: boolean;
  name: string | null;
  passStatus: PassStatus | null;
  submittedAt: string | null;
  university: string | null;
  major: string | null;
  generationId: string | null;
};

export type ApplicationDetail = {
  applicationId: string;
  applicationPartType: PartType;
  birthDate: string | null;
  completedSemesters: number | null;
  gender: string | null;
  isEnrolled: boolean | null;
  isPrevActivity: boolean | null;
  isSubmitted: boolean | null;
  isSyncedToNotion: boolean;
  notionSyncedAt: string | null;
  major: string | null;
  name: string | null;
  passStatus: PassStatus | null;
  pdfFileKey: string | null;
  pdfFileUrl: string | null;
  phoneNumber: string | null;
  submittedAt: string | null;
  university: string | null;
  generationId: string | null;
  userId: string | null;
  unavailableInterviewTimes: string | null;
  interviewAvailabilityNormalization: {
    sourceText: string;
    normalizedText: string | null;
    status: "PENDING" | "SUCCESS" | "FAILED";
    syncedAt: string | null;
    lastError: string | null;
  } | null;
  answers: ApplicationAnswer[];
};

export type ApplicationAnswer = {
  answerId: string;
  questionId: string;
  questionContent: string | null;
  questionType: PartType | null;
  content: string;
};

export type GeneratedAnswerQuestions = {
  answerId: string;
  questionId: string;
  answerContent: string;
  evaluationSummary: string;
  questions: string[];
  source: "ai";
};

export type ApplicationFilters = {
  q: string;
  part: PartType | "ALL";
  passStatus: PassStatus | "ALL";
  notionExists: TriState;
  submitted: TriState;
  enrolled: TriState;
  prevActivity: TriState;
  generationId: string;
  submittedFrom: string;
  submittedTo: string;
  page: number;
  pageSize: number;
};

export type ApplicationListResponse = {
  items: ApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
};
