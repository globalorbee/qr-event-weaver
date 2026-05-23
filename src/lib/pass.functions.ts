import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const verifyPass = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ passCode: z.string().min(8).max(64).regex(/^[a-f0-9]+$/i) }).parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("attendees")
      .select("name, ticket_type, pass_code, status, events(name, event_date, venue, brand_color, organizer_name, banner_url)")
      .eq("pass_code", data.passCode)
      .maybeSingle();
    if (error) {
      console.error("verifyPass error", error);
      return null;
    }
    return row;
  });