import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { EventPass } from "@/components/EventPass";
import { WalletButtons } from "@/components/WalletButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, ArrowLeft, Upload, Check, X, Share2, FileText, ImageIcon, ScanLine,
  LayoutGrid, List as ListIcon, Table as TableIcon, Search, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { useCurrentEvent } from "@/stores/use-current-event";
import { sendTransactionalEmail } from "@/lib/email/send";
import { createAttendeePass, createBulkAttendeePasses } from "@/lib/pass.functions";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({ meta: [{ title: "Event — Peras" }] }),
  component: EventDetail,
});

type Event = {
  id: string;
  name: string;
  event_type: string | null;
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
  email: string | null;
  ticket_type: string;
  pass_code: string;
  status: "unused" | "used";
  checked_in_at: string | null;
  created_at: string;
  signature: string | null;
};

type ViewMode = "table" | "grid" | "list";

function EventDetail() {
  const { eventId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [previewing, setPreviewing] = useState<Attendee | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "used" | "unused">("all");
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const setCurrent = useCurrentEvent((s) => s.setCurrent);
  const createOnePass = useServerFn(createAttendeePass);
  const createManyPasses = useServerFn(createBulkAttendeePasses);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadEvent = async () => {
    const { data: ev } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
    setEvent(ev as Event);
    if (ev) setCurrent({ id: ev.id, name: ev.name, brand_color: ev.brand_color });
  };

  const loadAttendees = async () => {
    const { data } = await supabase
      .from("attendees")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setAttendees((data as Attendee[]) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    loadEvent();
    loadAttendees();
  }, [user, eventId]);

  // Realtime updates so the stats card reflects check-ins instantly
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`event-attendees-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendees", filter: `event_id=eq.${eventId}` },
        () => loadAttendees(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, eventId]);

  const sendIssuedEmail = async (a: { id: string; name: string; email: string | null; ticket_type: string; pass_code: string }) => {
    if (!a.email || !event) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await sendTransactionalEmail({
      templateName: "pass-issued",
      recipientEmail: a.email,
      idempotencyKey: `pass-issued-${a.id}`,
      templateData: {
        attendeeName: a.name,
        eventName: event.name,
        eventDate: format(new Date(event.event_date), "EEE, MMM d, yyyy · h:mm a"),
        venue: event.venue,
        ticketType: a.ticket_type,
        brandColor: event.brand_color,
        passUrl: `${origin}/pass/${a.pass_code}`,
        passImageUrl: `${origin}/api/public/pass-image/${a.pass_code}`,
      },
    });
  };

  const sendUsedEmail = async (a: Attendee) => {
    if (!a.email || !event) return;
    await sendTransactionalEmail({
      templateName: "pass-used",
      recipientEmail: a.email,
      idempotencyKey: `pass-used-${a.id}-${a.checked_in_at ?? Date.now()}`,
      templateData: {
        attendeeName: a.name,
        eventName: event.name,
        checkedInAt: format(new Date(), "EEE, MMM d, yyyy · h:mm a"),
        brandColor: event.brand_color,
      },
    });
  };

  const addAttendee = async (name: string, ticket: string, email: string) => {
    let data: Attendee;
    try {
      data = await createOnePass({ data: { eventId, name, ticketType: ticket || "General", email: email || null } }) as Attendee;
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Could not create attendee");
    }
    toast.success("Attendee added");
    loadAttendees();
    if (email) {
      sendIssuedEmail(data as Attendee).then(() => toast.success("Pass emailed to attendee"));
    }
  };

  const bulkAdd = async (text: string, sharedTicket: string) => {
    const rows = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const records = rows
      .map((r) => {
        const parts = r.split(",").map((s) => s?.trim());
        const name = parts[0];
        const email = parts[1] && parts[1].includes("@") ? parts[1] : null;
        return name ? { name, email } : null;
      })
      .filter(Boolean) as Array<{ name: string; email: string | null }>;

    if (!records.length) return toast.error("No valid rows. Use: Name, email (per line)");
    let data: Attendee[];
    try {
      data = await createManyPasses({ data: { eventId, attendees: records, ticketType: sharedTicket || "General" } }) as Attendee[];
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Could not create attendees");
    }
    toast.success(`${records.length} attendees added`);
    loadAttendees();
    // Send emails to those with addresses
    const withEmail = (data as Attendee[]).filter((a) => !!a.email);
    if (withEmail.length) {
      toast.message(`Emailing passes to ${withEmail.length} attendee${withEmail.length === 1 ? "" : "s"}…`);
      await Promise.allSettled(withEmail.map((a) => sendIssuedEmail(a)));
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("attendees").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadAttendees();
  };

  const toggleStatus = async (a: Attendee) => {
    const newStatus = a.status === "used" ? "unused" : "used";
    const checkedInAt = newStatus === "used" ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("attendees")
      .update({ status: newStatus, checked_in_at: checkedInAt })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    loadAttendees();
    if (newStatus === "used" && a.email) {
      sendUsedEmail({ ...a, status: newStatus, checked_in_at: checkedInAt });
    }
  };

  const deleteEvent = async () => {
    if (!confirm("Delete this event and all attendees?")) return;
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard" });
  };

  const ticketTypes = useMemo(() => {
    const set = new Set(attendees.map((a) => a.ticket_type));
    return Array.from(set);
  }, [attendees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return attendees.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (ticketFilter !== "all" && a.ticket_type !== ticketFilter) return false;
      if (q && !(a.name.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [attendees, search, statusFilter, ticketFilter]);

  const totalCount = attendees.length;
  const checkedIn = attendees.filter((a) => a.status === "used").length;
  const remaining = totalCount - checkedIn;
  const progressPct = totalCount > 0 ? Math.round((checkedIn / totalCount) * 100) : 0;

  if (!event) {
    return (
      <AppLayout title="Event">
        <div className="p-10 text-sm text-muted-foreground">Loading…</div>
      </AppLayout>
    );
  }

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
            <p className="mt-1 text-sm text-muted-foreground">
              {event.event_type && <span className="capitalize">{event.event_type.replace("_", " ")} · </span>}
              {event.venue} · {format(new Date(event.event_date), "MMM d, yyyy · h:mm a")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/gatekeeper/$eventId" params={{ eventId: event.id }}>
              <Button variant="outline"><ScanLine className="mr-2 h-4 w-4" />Gatekeeper</Button>
            </Link>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild><Button variant="outline"><Upload className="mr-2 h-4 w-4" />Bulk add</Button></DialogTrigger>
              <BulkDialog onSubmit={async (t, s) => { await bulkAdd(t, s); setBulkOpen(false); }} />
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add attendee</Button></DialogTrigger>
              <AddDialog onSubmit={async (n, t, e) => { await addAttendee(n, t, e); setAddOpen(false); }} />
            </Dialog>
            <Button variant="ghost" size="icon" onClick={deleteEvent}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          <Stat label="Total passes" value={totalCount} />
          <Stat label="Checked in" value={checkedIn} color={event.brand_color} />
          <Stat label="Remaining" value={remaining} />
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Check-in progress</p>
            <p className="mt-1 font-display text-3xl font-semibold">{progressPct}%</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: event.brand_color }}
              />
            </div>
          </div>
        </div>

        {attendees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <h3 className="font-display text-xl font-semibold">No attendees yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add one manually or use bulk add to create passes for many at once.</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="unused">Unused</SelectItem>
                  <SelectItem value="used">Checked in</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ticketFilter} onValueChange={setTicketFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Ticket type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ticket types</SelectItem>
                  {ticketTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto inline-flex rounded-lg border border-border p-1">
                {(["table", "list", "grid"] as ViewMode[]).map((v) => {
                  const Icon = v === "table" ? TableIcon : v === "list" ? ListIcon : LayoutGrid;
                  return (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                        view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                      aria-label={`${v} view`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mb-3 text-sm text-muted-foreground">
              Showing {filtered.length} of {totalCount}
            </p>

            {view === "table" && (
              <AttendeeTable
                rows={filtered}
                onView={setPreviewing}
                onToggle={toggleStatus}
                onRemove={remove}
                onEmail={(a) => sendIssuedEmail(a).then(() => toast.success("Pass emailed"))}
                brandColor={event.brand_color}
              />
            )}
            {view === "list" && (
              <div className="space-y-2">
                {filtered.map((a) => (
                  <AttendeeListRow key={a.id} a={a} brandColor={event.brand_color} onView={() => setPreviewing(a)} onToggle={() => toggleStatus(a)} onRemove={() => remove(a.id)} />
                ))}
              </div>
            )}
            {view === "grid" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((a) => (
                  <AttendeeCard key={a.id} a={a} brandColor={event.brand_color} onView={() => setPreviewing(a)} onToggle={() => toggleStatus(a)} onRemove={() => remove(a.id)} />
                ))}
              </div>
            )}
          </>
        )}

        <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
          {previewing && event && (
            <PassPreview event={event} attendee={previewing} onEmail={() => sendIssuedEmail(previewing).then(() => toast.success("Pass emailed"))} />
          )}
        </Dialog>
      </main>
    </AppLayout>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}

function StatusPill({ status, brandColor }: { status: "used" | "unused"; brandColor: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium uppercase"
      style={{
        fontSize: 12,
        backgroundColor: status === "used" ? "var(--muted)" : `${brandColor}1F`,
        color: status === "used" ? "var(--muted-foreground)" : brandColor,
      }}
    >
      {status === "used" ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {status === "used" ? "checked in" : "unused"}
    </span>
  );
}

function AttendeeTable({
  rows, onView, onToggle, onRemove, onEmail, brandColor,
}: {
  rows: Attendee[];
  onView: (a: Attendee) => void;
  onToggle: (a: Attendee) => void;
  onRemove: (id: string) => void;
  onEmail: (a: Attendee) => void;
  brandColor: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-left">Ticket type</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Issued</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{a.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.email ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.ticket_type}</td>
              <td className="px-4 py-3"><StatusPill status={a.status} brandColor={brandColor} /></td>
              <td className="px-4 py-3 text-muted-foreground">{format(new Date(a.created_at), "MMM d, yyyy · h:mm a")}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => onView(a)}>View</Button>
                {a.email && (
                  <Button size="sm" variant="ghost" onClick={() => onEmail(a)} title="Email pass">
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => onToggle(a)} title={a.status === "used" ? "Mark unused" : "Mark checked in"}>
                  {a.status === "used" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRemove(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No matches</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AttendeeListRow({
  a, brandColor, onView, onToggle, onRemove,
}: { a: Attendee; brandColor: string; onView: () => void; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold uppercase text-white"
        style={{ backgroundColor: brandColor }}
      >
        {a.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.name}</p>
        <p className="truncate text-sm text-muted-foreground">{a.email ?? a.ticket_type}</p>
      </div>
      <StatusPill status={a.status} brandColor={brandColor} />
      <span className="text-sm text-muted-foreground">{format(new Date(a.created_at), "MMM d")}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onView}>View</Button>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {a.status === "used" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function AttendeeCard({
  a, brandColor, onView, onToggle, onRemove,
}: { a: Attendee; brandColor: string; onView: () => void; onToggle: () => void; onRemove: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <StatusPill status={a.status} brandColor={brandColor} />
        <span className="text-sm text-muted-foreground">{format(new Date(a.created_at), "MMM d")}</span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold uppercase text-white"
          style={{ backgroundColor: brandColor }}
        >
          {a.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{a.name}</p>
          <p className="truncate text-sm text-muted-foreground">{a.ticket_type}</p>
        </div>
      </div>
      {a.email && <p className="mt-2 truncate text-sm text-muted-foreground">{a.email}</p>}
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onView}>View pass</Button>
        <Button size="sm" variant="ghost" onClick={onToggle}>
          {a.status === "used" ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function AddDialog({ onSubmit }: { onSubmit: (name: string, ticket: string, email: string) => void }) {
  const [name, setName] = useState("");
  const [ticket, setTicket] = useState("General");
  const [email, setEmail] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add attendee</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1.5"><Label className="text-sm">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-sm">Ticket type</Label><Input value={ticket} onChange={(e) => setTicket(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label className="text-sm">Email (optional — pass is emailed)</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        </div>
      </div>
      <DialogFooter><Button onClick={() => name && onSubmit(name, ticket, email)}>Add</Button></DialogFooter>
    </DialogContent>
  );
}

function BulkDialog({ onSubmit }: { onSubmit: (text: string, sharedTicket: string) => void }) {
  const [text, setText] = useState("");
  const [sharedTicket, setSharedTicket] = useState("General");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Bulk add attendees</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">
        One per line: <code className="rounded bg-muted px-1">Name, email@example.com</code> (email optional). All attendees share the same ticket type below — every attendee gets a unique signed pass using your event brand color.
      </p>
      <div className="space-y-1.5">
        <Label className="text-sm">Shared ticket type</Label>
        <Input value={sharedTicket} onChange={(e) => setSharedTicket(e.target.value)} placeholder="General" />
      </div>
      <Textarea
        rows={10}
        placeholder={"Jane Doe, jane@example.com\nJohn Smith, john@example.com\nAlex Rivera"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <DialogFooter><Button onClick={() => onSubmit(text, sharedTicket)}>Create passes</Button></DialogFooter>
    </DialogContent>
  );
}

function PassPreview({ event, attendee, onEmail }: { event: Event; attendee: Attendee; onEmail: () => void }) {
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
    signedPayload: attendee.signature
      ? { a: attendee.id, e: event.id, t: attendee.ticket_type, c: attendee.pass_code, s: attendee.signature }
      : null,
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
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPng}><ImageIcon className="mr-2 h-4 w-4" />PNG</Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          <Button variant="outline" size="sm" onClick={share}><Share2 className="mr-2 h-4 w-4" />Share</Button>
          {attendee.email && (
            <Button variant="outline" size="sm" onClick={onEmail}><Mail className="mr-2 h-4 w-4" />Email</Button>
          )}
        </div>
        <WalletButtons />
      </div>
    </DialogContent>
  );
}