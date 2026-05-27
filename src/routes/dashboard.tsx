import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Peras" }] }),
  component: Dashboard,
});

type Event = {
  id: string;
  name: string;
  event_date: string;
  venue: string;
  brand_color: string;
  organizer_name: string;
  organizer_contact: string | null;
  banner_url: string | null;
};

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: true });
    setEvents((data as Event[]) ?? []);
    if (data?.length) {
      const { data: atts } = await supabase
        .from("attendees")
        .select("event_id")
        .in("event_id", data.map((e) => e.id));
      const c: Record<string, number> = {};
      atts?.forEach((a: any) => (c[a.event_id] = (c[a.event_id] ?? 0) + 1));
      setCounts(c);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return null;

  return (
    <AppLayout title="Events">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Your events</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage events and issue passes.</p>
          </div>
          <Link to="/events/new">
            <Button><Plus className="mr-2 h-4 w-4" />New event</Button>
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold">No events yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first event to start issuing passes.</p>
            <Link to="/events/new" className="mt-4 inline-block">
              <Button className="mt-4"><Plus className="mr-2 h-4 w-4" />Create event</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Link
                key={e.id}
                to="/events/$eventId"
                params={{ eventId: e.id }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
              >
                <div
                  className="absolute inset-x-0 top-0 h-1"
                  style={{ backgroundColor: e.brand_color }}
                />
                <h3 className="font-display text-lg font-semibold leading-tight">{e.name}</h3>
                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{format(new Date(e.event_date), "MMM d, yyyy · h:mm a")}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{e.venue}</span></div>
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{counts[e.id] ?? 0} attendees</div>
                </div>
                <div className="mt-5 flex items-center text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Manage <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  );
}
