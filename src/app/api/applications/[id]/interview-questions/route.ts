import { NextResponse } from "next/server";
import { z } from "zod";
import { generateInterviewQuestionsByAnswer } from "@/llm";
import { getApplicationById } from "@/lib/applications";

type ParamsContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  questionCount: z.number().int().min(1).max(3).optional(),
  answerId: z.string().regex(/^\d+$/).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: ParamsContext) {
  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid application_id." }, { status: 400 });
  }

  let questionCount = 3;
  let answerId: string | undefined;

  try {
    const body = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    if (parsed.data.questionCount) {
      questionCount = parsed.data.questionCount;
    }

    answerId = parsed.data.answerId;
  } catch {
    // Keep defaults if no JSON body exists.
  }

  try {
    const application = await getApplicationById(BigInt(id));
    if (!application) {
      return NextResponse.json({ message: "Application not found." }, { status: 404 });
    }

    const results = await generateInterviewQuestionsByAnswer(application, { questionCount, answerId });
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Error && error.message === "The requested answer does not exist for this application.") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate interview questions." },
      { status: 500 },
    );
  }
}
