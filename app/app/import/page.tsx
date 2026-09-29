import { redirect } from "next/navigation";

import ImportView from "@/components/ImportView";
import { getSessionProfile, isCommittee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");
  if (!isCommittee(profile.role)) redirect("/app/today");

  return <ImportView />;
}
