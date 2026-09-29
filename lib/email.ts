import { Resend } from "resend";

import { digestFrom, resendKey } from "@/lib/env";

export interface EmailInput {
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Sends an email when Resend is configured. Returns false (never throws) when
 * the key is missing or the provider rejects the request.
 */
export async function sendEmail(input: EmailInput): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;

  try {
    const resend = new Resend(key);
    const result = await resend.emails.send({
      from: digestFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return !result.error;
  } catch (error) {
    console.error(
      `[email] send failed: ${error instanceof Error ? error.name : "unknown"}`,
    );
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(resendKey());
}
