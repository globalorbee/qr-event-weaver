import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/attendees")({
  head: () => ({ meta: [{ title: "Attendees — Peras" }] }),
  component: AttendeesPage,
});

type Row = {
  id: string;
  name: string;
  ticket_type: string;
  status: string;
  event_id: string;
  events: { name: string } | null;
};
type EventOpt = { id: string; name: string };

function AttendeesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("attendees")
      .select("id,name,ticket_type,status,event_id,events(name)")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => setRows((data as Row[]) ?? []));
    supabase
      .from("events")
      .select("id,name")
      .order("created_at", { ascending: false })
      .then(({ data }) => setEvents((data as EventOpt[]) ?? []));
  }, [user]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
        if (!q) return true;
        const t = q.toLowerCase();
        return r.name.toLowerCase().includes(t) || (r.events?.name ?? "").toLowerCase().includes(t);
      }),
    [rows, q, eventFilter],
  );

  if (!user) return null;

  return (
    <AppLayout title="Attendees">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">All attendees</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length} of {rows.length} across {events.length} event{events.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search by name or event…"
            className="w-full max-w-xs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="All events" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile: list view */}
        <div className="space-y-2 md:hidden">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: r.event_id }}
                    className="mt-0.5 block truncate text-sm text-primary hover:underline"
                  >
                    {r.events?.name ?? "—"}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">{r.ticket_type}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${r.status === "used" ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">No attendees</div>
          )}
        </div>

        {/* Tablet/Desktop: table view */}
        <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Ticket</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <Link to="/events/$eventId" params={{ eventId: r.event_id }} className="text-primary hover:underline">
                      {r.events?.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.ticket_type}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${r.status === "used" ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">No attendees</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}