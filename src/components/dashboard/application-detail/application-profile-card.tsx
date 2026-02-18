import { useMemo, type ReactNode } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, toKoreanDate, toKoreanDateTime } from "@/lib/utils";
import type { ApplicationDetail } from "@/types/application";

type Props = {
  application: ApplicationDetail;
};

type MetaRow = {
  label: string;
  value: ReactNode;
};

export function ApplicationProfileCard({ application }: Props) {
  const applicantName = application.name ?? "Unknown applicant";

  const metaRows: MetaRow[] = useMemo(
    () => [
      { label: "Part", value: application.applicationPartType },
      { label: "Pass Status", value: <StatusPill status={application.passStatus} /> },
      { label: "University", value: application.university ?? "-" },
      { label: "Major", value: application.major ?? "-" },
      { label: "Birth Date", value: toKoreanDate(application.birthDate) },
      {
        label: "Completed Semesters",
        value: application.completedSemesters ? `${application.completedSemesters}` : "-",
      },
      {
        label: "Enrollment",
        value: application.isEnrolled === null ? "-" : application.isEnrolled ? "Enrolled" : "Not enrolled",
      },
      {
        label: "Previous Activity",
        value: application.isPrevActivity === null ? "-" : application.isPrevActivity ? "Yes" : "No",
      },
      { label: "Submitted At", value: toKoreanDateTime(application.submittedAt) },
      { label: "Generation ID", value: application.generationId ?? "-" },
      { label: "User ID", value: application.userId ?? "-" },
      { label: "Phone", value: application.phoneNumber ?? "-" },
    ],
    [application],
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-2xl">{applicantName}</CardTitle>
          <CardDescription>Applicant profile and submission metadata.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {metaRows.map((row) => (
            <div key={row.label} className="rounded-xl border border-white/70 bg-white/70 p-3">
              <dt className="text-xs text-[color:var(--muted-foreground)]">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium text-[color:var(--foreground)]">{row.value}</dd>
            </div>
          ))}
        </dl>

        {application.pdfFileUrl && (
          <a
            href={application.pdfFileUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "mt-5 inline-flex border-emerald-200 bg-emerald-50/70 text-emerald-700",
            )}
          >
            <FileText className="h-4 w-4" />
            Open submitted PDF
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
