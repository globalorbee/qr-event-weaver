import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { EventPass } from "@/components/EventPass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateKeypair } from "@/lib/qr-crypto";
import { isScannerRisky } from "@/lib/contrast";
import { toast } from "sonner";
import { z } from "zod";
import { X, Plus } from "lucide-react";

export const Route = createFileRoute("/events/new")({
  head: () => ({ meta: [{ title: "New event — Peras" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ edit: typeof s.edit === "string" ? s.edit : undefined }),
  component: NewEvent,
});

const PRESET_FONTS = [
  { label: "Default (clean)", value: "" },
  { label: "Caveat (signature)", value: "Caveat" },
  { label: "Pacifico (curved)", value: "Pacifico" },
  { label: "Fredoka (bubbly)", value: "Fredoka" },
  { label: "Dancing Script", value: "Dancing Script" },
  { label: "Permanent Marker", value: "Permanent Marker" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Name too short").max(120),
  event_type: z.string().min(1),
  event_date: z.string().min(1, "Pick a date"),
  venue: z.string().trim().min(2).max(200),
  organizer_name: z.string().trim().min(2).max(120),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  attendee_name: z.string().trim().max(80).optional().or(z.literal("")),
  attendee_email: z.string().trim().email().max(200).optional().or(z.literal("")),
  ticket_type: z.string().trim().min(1).max(40),
});

const EVENT_TYPES = [
  { value: "wedding", label: "Wedding" },
  { value: "workshop", label: "Workshop" },
  { value: "conference", label: "Conference" },
  { value: "meetup", label: "Meetup" },
  { value: "seminar", label: "Seminar" },
  { value: "private_gathering", label: "Private gathering" },
  { value: "other", label: "Other" },
];

function NewEvent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { edit: editId } = useSearch({ from: "/events/new" });
  const isEdit = !!editId;
  const [form, setForm] = useState({
    name: "",
    event_type: "meetup",
    event_date: "",
    venue: "",
    organizer_name: "",
    brand_color: "#4F39F6",
    banner_url: "",
    attendee_name: "Jane Attendee",
    attendee_email: "",
    ticket_type: "General",
    attendee_font: "",
  });
  const [ticketTypes, setTicketTypes] = useState<string[]>(["General"]);
  const [newTicketType, setNewTicketType] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState<boolean>(isEdit);
  const [warnedColor, setWarnedColor] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!isEdit || !user) return;
    (async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", editId!).maybeSingle();
      if (error || !data) {
        toast.error("Event not found");
        navigate({ to: "/dashboard" });
        return;
      }
      const ev = data as any;
      const local = new Date(ev.event_date);
      const tzOffset = local.getTimezoneOffset() * 60000;
      const localStr = new Date(local.getTime() - tzOffset).toISOString().slice(0, 16);
      setForm((p) => ({
        ...p,
        name: ev.name ?? "",
        event_type: ev.event_type ?? "other",
        event_date: localStr,
        venue: ev.venue ?? "",
        organizer_name: ev.organizer_name ?? "",
        brand_color: ev.brand_color ?? "#4F39F6",
        banner_url: ev.banner_url ?? "",
        ticket_type: (ev.ticket_types?.[0] as string) ?? "General",
      }));
      setTicketTypes(Array.isArray(ev.ticket_types) && ev.ticket_types.length ? ev.ticket_types : ["General"]);
      setLoadingEdit(false);
    })();
  }, [isEdit, editId, user, navigate]);

  // Load expressive font dynamically
  useEffect(() => {
    if (!form.attendee_font || typeof document === "undefined") return;
    const id = `font-${form.attendee_font.replace(/\s/g, "")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(form.attendee_font)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [form.attendee_font]);

  // Contrast nudge toast
  useEffect(() => {
    if (!/^#[0-9a-fA-F]{6}$/.test(form.brand_color)) return;
    if (form.brand_color === warnedColor) return;
    if (isScannerRisky(form.brand_color)) {
      toast.warning("This brand color may be hard for scanners", {
        description: "Consider a higher-contrast color for reliable QR scanning.",
      });
      setWarnedColor(form.brand_color);
    }
  }, [form.brand_color, warnedColor]);

  const setField = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const addTicketType = () => {
    const t = newTicketType.trim();
    if (!t) return;
    if (ticketTypes.includes(t)) return toast.error("Already added");
    setTicketTypes((p) => [...p, t]);
    setNewTicketType("");
  };
  const removeTicketType = (t: string) => {
    if (ticketTypes.length <= 1) return toast.error("Keep at least one ticket type");
    setTicketTypes((p) => p.filter((x) => x !== t));
    if (form.ticket_type === t) setField("ticket_type", ticketTypes.find((x) => x !== t) ?? "General");
  };

  const previewDate = useMemo(
    () => (form.event_date ? new Date(form.event_date).toISOString() : new Date(Date.now() + 86400000).toISOString()),
    [form.event_date],
  );

  const submit = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (!ticketTypes.length) {
      toast.error("Add at least one ticket type");
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        const { error } = await supabase
          .from("events")
          .update({
            name: form.name,
            event_type: form.event_type,
            event_date: new Date(form.event_date).toISOString(),
            venue: form.venue,
            brand_color: form.brand_color,
            organizer_name: form.organizer_name,
            banner_url: form.banner_url || null,
            ticket_types: ticketTypes,
          } as any)
          .eq("id", editId!);
        if (error) throw error;
        toast.success("Event updated");
        navigate({ to: "/events/$eventId", params: { eventId: editId! } });
        return;
      }
      const keys = await generateKeypair();
      const { data: ev, error } = await supabase
        .from("events")
        .insert({
          user_id: user.id,
          name: form.name,
          event_type: form.event_type,
          event_date: new Date(form.event_date).toISOString(),
          venue: form.venue,
          brand_color: form.brand_color,
          organizer_name: form.organizer_name,
          banner_url: form.banner_url || null,
          public_key: keys.publicKey,
          private_key: keys.privateKey,
          ticket_types: ticketTypes,
        } as any)
        .select()
        .single();
      if (error) throw error;
      if (form.attendee_name?.trim()) {
        await supabase.from("attendees").insert({
          event_id: ev.id,
          name: form.attendee_name,
          ticket_type: form.ticket_type,
          email: form.attendee_email || null,
        });
      }
      toast.success("Event created with keypair");
      navigate({ to: "/events/$eventId", params: { eventId: ev.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  if (loadingEdit) {
    return <AppLayout title="Edit event"><div className="p-10 text-sm text-muted-foreground">Loading…</div></AppLayout>;
  }

  return (
    <AppLayout title={isEdit ? "Edit event" : "Create event"}>
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_400px]">
        {/* Form */}
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">{isEdit ? "Edit event" : "New event"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEdit ? "Update the details — changes apply to all attendees." : "Fill the details — the pass updates in real time."}
            </p>
          </div>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Event</h3>
            <Field label="Event name" error={errors.name}>
              <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Designers Meetup '26" />
            </Field>
            <Field label="Event type" error={errors.event_type}>
              <Select value={form.event_type} onValueChange={(v) => setField("event_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date & time" error={errors.event_date}>
                <Input type="datetime-local" value={form.event_date} onChange={(e) => setField("event_date", e.target.value)} />
              </Field>
              <Field label="Venue" error={errors.venue}>
                <Input value={form.venue} onChange={(e) => setField("venue", e.target.value)} placeholder="The Wing, NYC" />
              </Field>
            </div>
            <Field label="Organizer" error={errors.organizer_name}>
              <Input value={form.organizer_name} onChange={(e) => setField("organizer_name", e.target.value)} placeholder="Studio North" />
            </Field>
            <Field label="Banner URL (optional)">
              <Input value={form.banner_url} onChange={(e) => setField("banner_url", e.target.value)} placeholder="https://…" />
            </Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Branding</h3>
            <Field label="Brand color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent"
                  value={form.brand_color}
                  onChange={(e) => setField("brand_color", e.target.value)}
                />
                <Input value={form.brand_color} onChange={(e) => setField("brand_color", e.target.value)} className="font-mono" />
              </div>
              {isScannerRisky(form.brand_color) && (
                <p className="mt-1 text-xs text-amber-500">Low contrast — scanners may struggle.</p>
              )}
            </Field>
            <Field label="Attendee name font (expressive)">
              <Select value={form.attendee_font} onValueChange={(v) => setField("attendee_font", v)}>
                <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  {PRESET_FONTS.map((f) => (
                    <SelectItem key={f.value || "default"} value={f.value || "_default"}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Ticket types</h3>
            <p className="text-xs text-muted-foreground">
              Add the ticket types available for this event. You'll pick from these when adding attendees.
            </p>
            <div className="flex flex-wrap gap-2">
              {ticketTypes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                  {t}
                  <button type="button" onClick={() => removeTicketType(t)} className="rounded-full p-0.5 hover:bg-muted" aria-label={`Remove ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {ticketTypes.length === 0 && <p className="text-xs text-muted-foreground">No ticket types yet.</p>}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTicketType}
                onChange={(e) => setNewTicketType(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTicketType(); } }}
                placeholder="e.g. VIP, Early bird, Student"
              />
              <Button type="button" variant="outline" onClick={addTicketType}><Plus className="h-4 w-4" /></Button>
            </div>
          </section>

          {!isEdit && (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">First attendee (optional)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Attendee name" error={errors.attendee_name}>
                  <Input value={form.attendee_name} onChange={(e) => setField("attendee_name", e.target.value)} />
                </Field>
                <Field label="Ticket type" error={errors.ticket_type}>
                  <Select value={form.ticket_type} onValueChange={(v) => setField("ticket_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ticketTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Attendee email (optional — pass is emailed to them)" error={errors.attendee_email}>
                <Input type="email" value={form.attendee_email} onChange={(e) => setField("attendee_email", e.target.value)} placeholder="jane@example.com" />
              </Field>
            </section>
          )}

          <Button size="lg" disabled={busy} onClick={submit}>
            {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create event & generate signed pass"}
          </Button>
        </div>

        {/* Sticky preview */}
        <aside className="relative">
          <div className="sticky top-20">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Real-time preview
            </div>
            <div className="flex justify-center">
              <EventPass
                data={{
                  eventName: form.name || "Your event name",
                  eventDate: previewDate,
                  venue: form.venue || "Venue name",
                  attendeeName: form.attendee_name || "Attendee",
                  ticketType: form.ticket_type || "General",
                  brandColor: form.brand_color,
                  organizerName: form.organizer_name || "Organizer",
                  passCode: "preview1234demoabc5678ef",
                  bannerUrl: form.banner_url || null,
                  status: "unused",
                  attendeeFont: form.attendee_font === "_default" ? null : form.attendee_font,
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </AppLayout>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}