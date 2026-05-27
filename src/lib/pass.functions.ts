import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signPayload } from "@/lib/qr-crypto";

const attendeeInput = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  ticketType: z.string().trim().min(1).max(80).default("General"),
  email: z.string().trim().email().max(240).nullable().optional(),
});

function newPassCode() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

async function ensureSignature(attendee: { id: string; event_id: string; ticket_type: string; pass_code: string; signature: string | null }, privateKey?: string | null) {
  if (attendee.signature || !privateKey) return attendee.signature;
  const signature = await signPayload(
    { a: attendee.id, e: attendee.event_id, t: attendee.ticket_type, c: attendee.pass_code },
    privateKey,
  );
  await supabaseAdmin.from("attendees").update({ signature }).eq("id", attendee.id);
  return signature;
}

async function getEventPrivateKey(eventId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("private_key")
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) throw new Error("Event not found");
  return data.private_key as string | null;
}

export const createAttendeePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => attendeeInput.parse(input))
  .handler(async ({ data, context }) => {
    const privateKey = await getEventPrivateKey(data.eventId, context.userId);
    const { data: attendee, error } = await context.supabase
      .from("attendees")
      .insert({
        event_id: data.eventId,
        name: data.name,
        ticket_type: data.ticketType || "General",
        email: data.email || null,
        pass_code: newPassCode(),
      })
      .select("*")
      .single();
    if (error || !attendee) throw new Error(error?.message ?? "Could not create attendee");
    const signature = await ensureSignature(attendee, privateKey);
    return { ...attendee, signature };
  });

export const createBulkAttendeePasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      eventId: z.string().uuid(),
      attendees: z.array(z.object({
        name: z.string().trim().min(1).max(160),
        email: z.string().trim().email().max(240).nullable().optional(),
      })).min(1).max(500),
      ticketType: z.string().trim().min(1).max(80).default("General"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const privateKey = await getEventPrivateKey(data.eventId, context.userId);
    const records = data.attendees.map((a) => ({
      event_id: data.eventId,
      name: a.name,
      email: a.email || null,
      ticket_type: data.ticketType || "General",
      pass_code: newPassCode(),
    }));
    const { data: rows, error } = await context.supabase.from("attendees").insert(records).select("*");
    if (error || !rows) throw new Error(error?.message ?? "Could not create attendees");
    const signed = await Promise.all(
      rows.map(async (attendee) => ({ ...attendee, signature: await ensureSignature(attendee, privateKey) })),
    );
    return signed;
  });

export const verifyPass = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ passCode: z.string().min(8).max(64).regex(/^[a-f0-9]+$/i) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("attendees")
      .select("id, event_id, name, ticket_type, pass_code, signature, status, events(name, event_date, venue, brand_color, organizer_name, banner_url, private_key)")
      .eq("pass_code", data.passCode)
      .maybeSingle();
    if (error) {
      console.error("verifyPass error", error);
      return null;
    }
    if (row && row.events) {
      const ev = row.events as { private_key?: string | null };
      const signature = await ensureSignature(row as any, ev.private_key);
      return { ...row, signature, events: { ...ev, private_key: undefined } };
    }
    return row;
  });