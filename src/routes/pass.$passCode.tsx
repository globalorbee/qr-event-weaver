import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPass } from "@/lib/pass.functions";
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
  const verify = useServerFn(verifyPass);

  useEffect(() => {
    verify({ data: { passCode } }).then((r) => setData((r as Data | null) ?? null)).catch(() => setData(null));
  }, [passCode, verify]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
        {data === undefined && <Loader2 className="h-8 w-8 animate-spin text-white/50" />}
        {data === null && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h2 className="mt-4 font-display text-2xl font-semibold">Invalid pass</h2>
            <p className="mt-2 text-sm text-white/60">This pass code doesn't exist.</p>
          </div>
        )}
        {data && data.events && (
          <>
            <div
              className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
              style={
                data.status === "used"
                  ? { borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)" }
                  : { borderColor: "rgba(79,57,246,0.4)", backgroundColor: "rgba(79,57,246,0.12)", color: "#a99cff" }
              }
            >
              {data.status === "used" ? (
                <><XCircle className="h-4 w-4" /> Already checked in</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Pass valid</>
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