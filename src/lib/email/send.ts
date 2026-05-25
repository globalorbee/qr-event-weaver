import { supabase } from "@/integrations/supabase/client";

export interface SendEmailParams {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
}

/**
 * Sends a transactional email via the Lovable email pipeline.
 * Silently no-ops (with a console warning) when the email infrastructure
 * hasn't been provisioned yet so the rest of the app keeps working.
 */
export async function sendTransactionalEmail(params: SendEmailParams) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/lovable/email/transactional/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      console.warn("[email] send failed", res.status, await res.text().catch(() => ""));
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[email] send error", e);
    return { ok: false };
  }
}