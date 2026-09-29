import { redirect } from "next/navigation";

import ProfileSetupForm from "@/components/ProfileSetupForm";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?error=no_invite");

  return (
    <ProfileSetupForm
      profile={{
        full_name: profile.full_name,
        flat_no: profile.flat_no,
        phone: profile.phone,
        preferred_lang: profile.preferred_lang,
        role: profile.role,
      }}
      requireName={!profile.full_name}
    />
  );
}
