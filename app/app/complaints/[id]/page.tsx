import { redirect } from "next/navigation";

import ComplaintDetail from "@/components/ComplaintDetail";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  return <ComplaintDetail id={id} role={profile.role} viewerId={profile.id} />;
}
