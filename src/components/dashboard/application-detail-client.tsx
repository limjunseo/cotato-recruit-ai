"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { AnswerGenerationCard } from "@/components/dashboard/application-detail/answer-generation-card";
import { ApplicationProfileCard } from "@/components/dashboard/application-detail/application-profile-card";
import { useApplicationDetailAi } from "@/components/dashboard/application-detail/use-application-detail-ai";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApplicationDetail } from "@/types/application";

type Props = {
  application: ApplicationDetail;
};

export function ApplicationDetailClient({ application }: Props) {
  const {
    questionCount,
    setQuestionCount,
    generatedByAnswer,
    loadingTarget,
    notionLoading,
    notionPageUrl,
    error,
    handleGenerateQuestions,
    handleSendToNotion,
  } = useApplicationDetailAi({ applicationId: application.applicationId });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/applications" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        <span className="text-xs text-[color:var(--muted-foreground)]">application_id: {application.applicationId}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <ApplicationProfileCard application={application} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
        <AnswerGenerationCard
          application={application}
          questionCount={questionCount}
          setQuestionCount={setQuestionCount}
          generatedByAnswer={generatedByAnswer}
          loadingTarget={loadingTarget}
          notionLoading={notionLoading}
          notionPageUrl={notionPageUrl}
          error={error}
          onGenerateQuestions={handleGenerateQuestions}
          onSendToNotion={handleSendToNotion}
        />
      </motion.div>
    </div>
  );
}
