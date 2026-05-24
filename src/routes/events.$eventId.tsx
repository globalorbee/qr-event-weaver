import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { EventPass } from "@/components/EventPass";
import { WalletButtons } from "@/components/WalletButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, Upload, Check, X, Share2, FileText, ImageIcon, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { useCurrentEvent } from "@/stores/use-current-event";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({ meta: [{ title: "Event — Passly" }] }),
  component: EventDetail,
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
  public_key?: string | null;
  private_key?: string | null;
};
type Attendee = {
  id: string;
  event_id: string;
  name: string;
  ticket_type: string;
  pass_code: string;
  status: "unused" | "used";
  checked_in_at: string | null;
};

function EventDetail() {
  const { eventId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [previewing, setPreviewing] = useState<Attendee | null>(null);
  const setCurrent = useCurrentEvent((s) => s.setCurrent);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const load = async () => {
    const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    setEvent(ev as Event);
    if (ev) setCurrent({ id: ev.id, name: ev.name, brand_color: ev.brand_color });
    const { data: ats } = await supabase
      .from("attendees")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setAttendees((ats as Attendee[]) ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user, eventId]);

  const addAttendee = async (name: string, ticket: string) => {
    const { error } = await supabase.from("attendees").insert({ event_id: eventId, name, ticket_type: ticket || "General" });
    if (error) return toast.error(error.message);
    toast.success("Attendee added");
    load();
  };

  const bulkAdd = async (text: string) => {
    const rows = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const records = rows.map((r) => {
      const [name, ticket] = r.split(",").map((s) => s?.trim());
      return { event_id: eventId, name, ticket_type: ticket || "General" };
    }).filter((r) => r.name);
    if (!records.length) return toast.error("No valid rows");
    const { error } = await supabase.from("attendees").insert(records);
    if (error) return toast.error(error.message);
    toast.success(`${records.length} attendees added`);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("attendees").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleStatus = async (a: Attendee) => {
    const newStatus = a.status === "used" ? "unused" : "used";
    const { error } = await supabase
      .from("attendees")
      .update({ status: newStatus, checked_in_at: newStatus === "used" ? new Date().toISOString() : null })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  };

  const deleteEvent = async () => {
    if (!confirm("Delete this event and all attendees?")) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  if (!event) return <AppLayout title="Event"><div className="p-10 text-sm text-muted-foreground">Loading…</div></AppLayout>;

  return (
    <AppLayout title={event.name}>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-block h-1 w-12 rounded-full" style={{ backgroundColor: event.brand_color }} />
            <h1 className="font-display text-3xl font-semibold tracking-tight">{event.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{event.venue} · {new Date(event.event_date).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/gatekeeper/$eventId" params={{ eventId: event.id }}>
              <Button variant="outline"><ScanLine className="mr-2 h-4 w-4" />Gatekeeper</Button>
            </Link>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild><Button variant="outline"><Upload className="mr-2 h-4 w-4" />Bulk add</Button></DialogTrigger>
              <BulkDialog onSubmit={async (t) => { await bulkAdd(t); setBulkOpen(false); }} />
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add attendee</Button></DialogTrigger>
              <AddDialog onSubmit={async (n, t) => { await addAttendee(n, t); setAddOpen(false); }} />
            </Dialog>
            <Button variant="ghost" size="icon" onClick={deleteEvent}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-8">
          <Stat label="Total passes" value={attendees.length} />
          <Stat label="Checked in" value={attendees.filter((a) => a.status === "used").length} color={event.brand_color} />
          <Stat label="Remaining" value={attendees.filter((a) => a.status === "unused").length} />
        </div>

        {attendees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <h3 className="font-display text-xl font-semibold">No attendees yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add one manually or paste a CSV (name,type per line).</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Ticket</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.ticket_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                        style={{
                          backgroundColor: a.status === "used" ? "#1B1B1B" : `${event.brand_color}22`,
                          color: a.status === "used" ? "#888" : event.brand_color,
                        }}
                      >
                        {a.status === "used" ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setPreviewing(a)}>View pass</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(a)}>
                        {a.status === "used" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
          {previewing && event && (
            <PassPreview event={event} attendee={previewing} />
          )}
        </Dialog>
      </main>
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold" style={{ color: color }}>{value}</p>
    </div>
  );
}

function AddDialog({ onSubmit }: { onSubmit: (name: string, ticket: string) => void }) {
  const [name, setName] = useState("");
  const [ticket, setTicket] = useState("General");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add attendee</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Ticket type</Label><Input value={ticket} onChange={(e) => setTicket(e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={() => name && onSubmit(name, ticket)}>Add</Button></DialogFooter>
    </DialogContent>
  );
}

function BulkDialog({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Bulk add attendees</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">One per line: <code className="rounded bg-muted px-1">Name, Ticket Type</code></p>
      <Textarea rows={10} placeholder={"Jane Doe, VIP\nJohn Smith, General"} value={text} onChange={(e) => setText(e.target.value)} />
      <DialogFooter><Button onClick={() => onSubmit(text)}>Add all</Button></DialogFooter>
    </DialogContent>
  );
}

function PassPreview({ event, attendee }: { event: Event; attendee: Attendee }) {
  const ref = useRef<HTMLDivElement>(null);
  const data = {
    eventName: event.name,
    eventDate: event.event_date,
    venue: event.venue,
    attendeeName: attendee.name,
    ticketType: attendee.ticket_type,
    brandColor: event.brand_color,
    organizerName: event.organizer_name,
    passCode: attendee.pass_code,
    bannerUrl: event.banner_url,
    status: attendee.status,
    eventId: event.id,
    attendeeId: attendee.id,
    privateKey: event.private_key,
  };

  const downloadPng = async () => {
    if (!ref.current) return;
    const dataUrl = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
    const link = document.createElement("a");
    link.download = `pass-${attendee.name.replace(/\s+/g, "-")}.png`;
    link.href = dataUrl;
    link.click();
  };

  const downloadPdf = async () => {
    if (!ref.current) return;
    const dataUrl = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
    const pdf = new jsPDF({ unit: "pt", format: [360, 600] });
    pdf.addImage(dataUrl, "PNG", 0, 0, 360, 600);
    pdf.save(`pass-${attendee.name.replace(/\s+/g, "-")}.pdf`);
  };

  const share = async () => {
    const url = `${window.location.origin}/pass/${attendee.pass_code}`;
    await navigator.clipboard.writeText(url);
    toast.success("Pass link copied to clipboard");
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Pass preview</DialogTitle></DialogHeader>
      <div className="flex justify-center py-4">
        <EventPass data={data} innerRef={ref} />
      </div>
      <div className="space-y-3">
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPng}><ImageIcon className="mr-2 h-4 w-4" />PNG</Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" onClick={share}><Share2 className="mr-2 h-4 w-4" />Share</Button>
        </div>
        <WalletButtons />
      </div>
    </DialogContent>
  );
}