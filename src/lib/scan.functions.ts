import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Bulk sync of offline scans. Marks attendees used by pass_code.
export const syncScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      scans: z
        .array(
          z.object({
            passCode: z.string().min(8).max(64),
            scannedAt: z.number().int(),
          }),
        )
        .min(1)
        .max(500),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const results: Array<{ passCode: string; ok: boolean }> = [];
    for (const s of data.scans) {
      const { error } = await supabase
        .from("attendees")
        .update({ status: "used", checked_in_at: new Date(s.scannedAt).toISOString() })
        .eq("pass_code", s.passCode);
      results.push({ passCode: s.passCode, ok: !error });
    }
    return { results };
  });