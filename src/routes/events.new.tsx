import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/events/new")({
  head: () => ({ meta: [{ title: "New event — Peras" }] }),
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
  attendee_name: z.string().trim().min(2).max(80),
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [warnedColor, setWarnedColor] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

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
    setBusy(true);
    try {
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
        })
        .select()
        .single();
      if (error) throw error;
      // Add the first attendee
      await supabase.from("attendees").insert({
        event_id: ev.id,
        name: form.attendee_name,
        ticket_type: form.ticket_type,
        email: form.attendee_email || null,
      });
      toast.success("Event created with keypair");
      navigate({ to: "/events/$eventId", params: { eventId: ev.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <AppLayout title="Create event">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_400px]">
        {/* Form */}
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight">New event</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fill the details — the pass updates in real time.</p>
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
            <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">First attendee</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Attendee name" error={errors.attendee_name}>
                <Input value={form.attendee_name} onChange={(e) => setField("attendee_name", e.target.value)} />
              </Field>
              <Field label="Ticket type" error={errors.ticket_type}>
                <Input value={form.ticket_type} onChange={(e) => setField("ticket_type", e.target.value)} />
              </Field>
            </div>
            <Field label="Attendee email (optional — pass is emailed to them)" error={errors.attendee_email}>
              <Input type="email" value={form.attendee_email} onChange={(e) => setField("attendee_email", e.target.value)} placeholder="jane@example.com" />
            </Field>
          </section>

          <Button size="lg" disabled={busy} onClick={submit}>
            {busy ? "Creating…" : "Create event & generate signed pass"}
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
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}