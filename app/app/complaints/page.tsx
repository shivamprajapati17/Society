import { redirect } from "next/navigation";

import ComplaintsList from "@/components/ComplaintsList";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  return <ComplaintsList role={profile.role} viewerId={profile.id} />;
}
