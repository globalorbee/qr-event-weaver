import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { EventPass } from "@/components/EventPass";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/pass/$passCode")({
  head: () => ({ meta: [{ title: "Verify Pass — Passly" }] }),
  component: PassVerify,
});

type Data = {
  name: string;
  ticket_type: string;
  pass_code: string;
  status: "unused" | "used";
  events: {
    name: string;
    event_date: string;
    venue: string;
    brand_color: string;
    organizer_name: string;
    banner_url: string | null;
  } | null;
};

function PassVerify() {
  const { passCode } = Route.useParams();
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("attendees")
        .select("name, ticket_type, pass_code, status, events(name, event_date, venue, brand_color, organizer_name, banner_url)")
        .eq("pass_code", passCode)
        .maybeSingle();
      setData(data as Data | null);
    })();
  }, [passCode]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
        {data === undefined && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
        {data === null && (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-2xl font-semibold">Invalid pass</h2>
            <p className="mt-2 text-sm text-muted-foreground">This pass code doesn't exist.</p>
          </div>
        )}
        {data && data.events && (
          <>
            <div
              className={`mb-6 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium ${
                data.status === "used"
                  ? "border-muted bg-muted text-muted-foreground"
                  : "border-primary/40 bg-primary/10 text-primary"
              }`}
            >
              {data.status === "used" ? (
                <><XCircle className="h-4 w-4" /> Already used</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Valid pass</>
              )}
            </div>
            <EventPass
              data={{
                eventName: data.events.name,
                eventDate: data.events.event_date,
                venue: data.events.venue,
                attendeeName: data.name,
                ticketType: data.ticket_type,
                brandColor: data.events.brand_color,
                organizerName: data.events.organizer_name,
                passCode: data.pass_code,
                bannerUrl: data.events.banner_url,
                status: data.status,
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}