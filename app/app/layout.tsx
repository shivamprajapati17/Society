import { redirect } from "next/navigation";

import AppShell from "@/components/AppShell";
import { getSessionProfile } from "@/lib/auth";
import { isAdminConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!isAdminConfigured()) redirect("/login?error=not_configured");

  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  const admin = createAdminClient();
  const { data: society } = await admin
    .from("societies")
    .select("name")
    .eq("id", profile.society_id)
    .maybeSingle();

  return (
    <AppShell
      role={profile.role}
      fullName={profile.full_name}
      flatNo={profile.flat_no}
      societyName={society?.name ?? "Your society"}
    >
      {children}
    </AppShell>
  );
}
