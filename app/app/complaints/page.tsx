import { redirect } from "next/navigation";

import ClustersPanel from "@/components/ClustersPanel";
import ComplaintsList from "@/components/ComplaintsList";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  return (
    <div className="stack">
      <ComplaintsList role={profile.role} viewerId={profile.id} />
      {/* Merging and bulk-resolving are committee/admin actions. */}
      {profile.role !== "resident" ? <ClustersPanel /> : null}
    </div>
  );
}
