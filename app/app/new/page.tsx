import { redirect } from "next/navigation";

import NewComplaintForm from "@/components/NewComplaintForm";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  return <NewComplaintForm role={profile.role} flatNo={profile.flat_no} />;
}
