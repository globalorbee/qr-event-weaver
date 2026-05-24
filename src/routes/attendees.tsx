import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/attendees")({
  head: () => ({ meta: [{ title: "Attendees — Passly" }] }),
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

function AttendeesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
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
  }, [user]);

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.events?.name.toLowerCase().includes(q.toLowerCase()),
  );

  if (!user) return null;

  return (
    <AppLayout title="Attendees">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">All attendees</h2>
            <p className="mt-1 text-sm text-muted-foreground">{rows.length} across all your events</p>
          </div>
          <Input
            placeholder="Search…"
            className="max-w-xs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border">
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