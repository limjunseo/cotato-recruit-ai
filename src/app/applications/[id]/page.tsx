import { notFound } from "next/navigation";
import { ApplicationDetailClient } from "@/components/dashboard/application-detail-client";
import { getApplicationById } from "@/lib/applications";

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const application = await getApplicationById(BigInt(id));
  if (!application) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <ApplicationDetailClient application={application} />
    </main>
  );
}
