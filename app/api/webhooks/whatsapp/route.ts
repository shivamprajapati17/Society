import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Phase 2 stub. The Meta Cloud API webhook will verify
 * `X-Hub-Signature-256`, map the sender phone to a profile and create a
 * complaint with `source = 'whatsapp'`.
 */
export async function POST() {
  return errorResponse(
    "VALIDATION",
    "WhatsApp intake is not enabled yet (planned for Phase 2).",
    501,
  );
}

export { POST as GET };
