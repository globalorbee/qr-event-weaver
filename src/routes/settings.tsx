import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Peras" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  if (!user) return null;

  return (
    <AppLayout title="Settings">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Account preferences and appearance.</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Appearance</h3>
              <p className="mt-1 text-xs text-muted-foreground">Toggle between dark and light themes.</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-sm font-medium">Account</h3>
          <p className="mt-1 text-xs text-muted-foreground">Signed in as <span className="font-mono">{user.email}</span></p>
          <Button variant="outline" className="mt-4" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
            Sign out
          </Button>
        </section>
      </div>
    </AppLayout>
  );
}