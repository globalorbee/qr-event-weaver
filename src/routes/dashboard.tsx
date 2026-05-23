import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Passly" }] }),
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
  const [open, setOpen] = useState(false);

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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Your events</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage events and issue passes.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New event</Button>
            </DialogTrigger>
            <NewEventDialog onCreated={() => { setOpen(false); load(); }} />
          </Dialog>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-xl font-semibold">No events yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create your first event to start issuing passes.</p>
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
    </div>
  );
}

function NewEventDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    event_date: "",
    venue: "",
    brand_color: "#ed2100",
    organizer_name: "",
    organizer_contact: "",
    banner_url: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!form.name || !form.event_date || !form.venue || !form.organizer_name) {
      toast.error("Fill required fields");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("events").insert({
      user_id: user.id,
      name: form.name,
      event_date: new Date(form.event_date).toISOString(),
      venue: form.venue,
      brand_color: form.brand_color,
      organizer_name: form.organizer_name,
      organizer_contact: form.organizer_contact || null,
      banner_url: form.banner_url || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Event created");
    onCreated();
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Create event</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <Field label="Event name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Date & time *"><Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></Field>
        <Field label="Venue / location *"><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></Field>
        <Field label="Organizer name *"><Input value={form.organizer_name} onChange={(e) => setForm({ ...form, organizer_name: e.target.value })} /></Field>
        <Field label="Organizer contact (email/phone)"><Input value={form.organizer_contact} onChange={(e) => setForm({ ...form, organizer_contact: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Brand color">
            <div className="flex gap-2">
              <Input type="color" className="h-10 w-14 cursor-pointer p-1" value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} />
              <Input value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} />
            </div>
          </Field>
          <Field label="Banner image URL"><Input placeholder="https://…" value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} /></Field>
        </div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy}>Create event</Button></DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}