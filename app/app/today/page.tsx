import { redirect } from "next/navigation";

import TodayView from "@/components/TodayView";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  return <TodayView role={profile.role} viewerId={profile.id} />;
}
