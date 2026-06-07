import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Validate a gatekeeper share token. Public — no auth required.
// Returns the event's public key + display info so the scanner can verify locally.
export const getGatekeeperContext = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tk, error } = await supabaseAdmin
      .from("gatekeeper_tokens")
      .select("id,event_id,label,revoked,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !tk) throw new Error("Invalid scan link");
    if (tk.revoked) throw new Error("This scan link has been revoked");
    if (tk.expires_at && new Date(tk.expires_at).getTime() < Date.now()) {
      throw new Error("This scan link has expired");
    }
    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("id,name,brand_color,public_key,event_date,venue")
      .eq("id", tk.event_id)
      .maybeSingle();
    if (!ev) throw new Error("Event not found");
    return {
      eventId: ev.id,
      eventName: ev.name,
      brandColor: ev.brand_color,
      publicKey: ev.public_key,
      eventDate: ev.event_date,
      venue: ev.venue,
      label: tk.label,
    };
  });

// Sync scans recorded under a gatekeeper share token. Public.
export const syncScansByToken = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      token: z.string().min(8).max(128),
      scans: z
        .array(z.object({ passCode: z.string().min(8).max(64), scannedAt: z.number().int() }))
        .min(1)
        .max(500),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tk } = await supabaseAdmin
      .from("gatekeeper_tokens")
      .select("event_id,revoked,expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tk || tk.revoked) throw new Error("Invalid scan link");
    if (tk.expires_at && new Date(tk.expires_at).getTime() < Date.now()) {
      throw new Error("Scan link expired");
    }
    const results: Array<{ passCode: string; ok: boolean }> = [];
    for (const s of data.scans) {
      const { error } = await supabaseAdmin
        .from("attendees")
        .update({ status: "used", checked_in_at: new Date(s.scannedAt).toISOString() })
        .eq("pass_code", s.passCode)
        .eq("event_id", tk.event_id);
      results.push({ passCode: s.passCode, ok: !error });
    }
    return { results };
  });