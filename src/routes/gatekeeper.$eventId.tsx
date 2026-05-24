import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { syncScans } from "@/lib/scan.functions";
import { decodeSignedPass, verifySignedPass } from "@/lib/qr-crypto";
import { recordScan, getScan, getUnsynced, markSynced } from "@/lib/offline-cache";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, WifiOff, Wifi, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/gatekeeper/$eventId")({
  head: () => ({ meta: [{ title: "Gatekeeper — Passly" }] }),
  component: Gatekeeper,
});

type State =
  | { kind: "idle" }
  | { kind: "valid"; name: string }
  | { kind: "used"; name: string }
  | { kind: "invalid"; reason: string };

function Gatekeeper() {
  const { eventId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const scannerRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const sync = useServerFn(syncScans);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Load event public key
  useEffect(() => {
    if (!user) return;
    supabase.from("events").select("public_key").eq("id", eventId).maybeSingle().then(({ data }) => {
      setPublicKey((data?.public_key as string | null) ?? null);
    });
  }, [user, eventId]);

  // Refresh unsynced count
  const refreshPending = async () => {
    const u = await getUnsynced();
    setPendingCount(u.length);
  };
  useEffect(() => { refreshPending(); }, []);

  // Background sync when online
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    const run = async () => {
      const u = await getUnsynced();
      if (!u.length || cancelled) return;
      try {
        await sync({ data: { scans: u.map((s) => ({ passCode: s.passCode, scannedAt: s.scannedAt })) } });
        await markSynced(u.map((s) => s.passCode));
        refreshPending();
      } catch (e) {
        console.warn("sync failed", e);
      }
    };
    run();
    const onOnline = () => run();
    window.addEventListener("online", onOnline);
    return () => { cancelled = true; window.removeEventListener("online", onOnline); };
  }, [online, sync]);

  // Start scanner
  useEffect(() => {
    if (!user || !publicKey) return;
    let stopped = false;
    let scanner: { clear: () => Promise<void> } | null = null;

    (async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (stopped) return;
      const s = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
        false,
      );
      scanner = s as unknown as { clear: () => Promise<void> };
      scannerRef.current = scanner;
      s.render(
        async (text) => {
          const now = Date.now();
          // debounce repeat scans (1.5s window)
          if (lastScanRef.current.code === text && now - lastScanRef.current.at < 1500) return;
          lastScanRef.current = { code: text, at: now };
          await handleScan(text);
        },
        () => {},
      );
    })();

    return () => {
      stopped = true;
      if (scanner) scanner.clear().catch(() => {});
    };
  }, [user, publicKey]);

  const handleScan = async (text: string) => {
    if (!publicKey) return;
    const decoded = decodeSignedPass(text);
    if (!decoded || decoded.e !== eventId) {
      setState({ kind: "invalid", reason: "Not for this event" });
      return;
    }
    const ok = await verifySignedPass(decoded, publicKey);
    if (!ok) {
      setState({ kind: "invalid", reason: "Signature does not verify" });
      return;
    }
    // Check IndexedDB
    const prev = await getScan(decoded.c);
    if (prev) {
      setState({ kind: "used", name: decoded.a.slice(0, 8) });
      return;
    }
    await recordScan({
      passCode: decoded.c,
      eventId: decoded.e,
      attendeeId: decoded.a,
      scannedAt: Date.now(),
      synced: false,
    });
    refreshPending();
    setState({ kind: "valid", name: decoded.a.slice(0, 8) });
    // Try immediate push when online
    if (online) {
      try {
        await sync({ data: { scans: [{ passCode: decoded.c, scannedAt: Date.now() }] } });
        await markSynced([decoded.c]);
        refreshPending();
      } catch {}
    }
  };

  if (!user) return null;

  const bg =
    state.kind === "valid" ? "bg-green-600"
    : state.kind === "invalid" ? "bg-red-600"
    : state.kind === "used" ? "bg-amber-500"
    : "bg-background";

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bg}`}>
      <div className="mx-auto max-w-md px-4 py-4">
        <div className="flex items-center justify-between gap-2 text-white">
          <Link to="/events/$eventId" params={{ eventId }} className="inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1">
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Offline"}
            </span>
            <span className="rounded-full bg-black/30 px-2 py-0.5">{pendingCount} pending</span>
          </div>
        </div>

        {state.kind === "idle" ? (
          <>
            <h1 className="mb-4 mt-4 text-center font-display text-2xl font-semibold text-foreground">Scan a pass</h1>
            {!publicKey && <p className="text-center text-sm text-muted-foreground">Loading event key…</p>}
            <div id="qr-reader" className="overflow-hidden rounded-2xl bg-card" />
          </>
        ) : (
          <div className="mt-12 flex flex-col items-center text-white">
            {state.kind === "valid" && <Check className="h-32 w-32" strokeWidth={3} />}
            {state.kind === "invalid" && <X className="h-32 w-32" strokeWidth={3} />}
            {state.kind === "used" && <AlertTriangle className="h-32 w-32" strokeWidth={3} />}
            <h2 className="mt-6 text-center text-5xl font-black uppercase tracking-tight">
              {state.kind === "valid" && "Valid"}
              {state.kind === "invalid" && "Invalid / Tampered"}
              {state.kind === "used" && "Already Used"}
            </h2>
            {"reason" in state && state.reason && <p className="mt-2 text-sm opacity-80">{state.reason}</p>}
            <Button className="mt-10" variant="secondary" onClick={() => setState({ kind: "idle" })}>
              Scan next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}