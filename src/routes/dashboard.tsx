import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, Users, ArrowRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null);

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

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { error } = await supabase.from("events").delete().eq("id", pendingDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Event deleted");
    setPendingDelete(null);
    load();
  };

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
              <div key={e.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50">
                <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: e.brand_color }} />
                <div className="absolute right-2 top-3 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(ev) => ev.stopPropagation()}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Event options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate({ to: "/events/new", search: { edit: e.id } })}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit event
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setPendingDelete(e)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete event
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link to="/events/$eventId" params={{ eventId: e.id }} className="block p-6">
                  <h3 className="font-display text-lg font-semibold leading-tight pr-8">{e.name}</h3>
                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{format(new Date(e.event_date), "MMM d, yyyy · h:mm a")}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /><span className="truncate">{e.venue}</span></div>
                    <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{counts[e.id] ?? 0} attendees</div>
                  </div>
                  <div className="mt-5 flex items-center text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Manage <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{pendingDelete?.name}</strong> and all of its attendee passes. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete event
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </AppLayout>
  );
}
