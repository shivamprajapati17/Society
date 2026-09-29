import { redirect } from "next/navigation";

import MembersView from "@/components/MembersView";
import { getSessionProfile, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");
  // Admin-only, enforced server-side (not just middleware).
  if (!isAdmin(profile.role)) redirect("/app/today");

  return <MembersView viewerId={profile.id} />;
}
