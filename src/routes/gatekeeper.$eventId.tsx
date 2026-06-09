import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { syncScans } from "@/lib/scan.functions";
import { decodeSignedPass, verifySignedPass } from "@/lib/qr-crypto";
import { recordScan, getScan, getUnsynced, markSynced } from "@/lib/offline-cache";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, WifiOff, Wifi, ArrowLeft, ScanLine } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/gatekeeper/$eventId")({
  head: () => ({ meta: [{ title: "Gatekeeper — Peras" }] }),
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

  return (
    <ScannerShell
      online={online}
      pendingCount={pendingCount}
      state={state}
      onReset={() => setState({ kind: "idle" })}
      back={
        <Link
          to="/events/$eventId"
          params={{ eventId }}
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      }
      readerId="qr-reader"
      ready={!!publicKey}
    />
  );
}

export function ScannerShell({
  online,
  pendingCount,
  state,
  onReset,
  back,
  readerId,
  ready,
  header,
}: {
  online: boolean;
  pendingCount: number;
  state: State;
  onReset: () => void;
  back?: React.ReactNode;
  readerId: string;
  ready: boolean;
  header?: React.ReactNode;
}) {
  const accent =
    state.kind === "valid" ? "#4F39F6"
    : state.kind === "invalid" ? "#ef4444"
    : state.kind === "used" ? "#f59e0b"
    : "#4F39F6";

  const title =
    state.kind === "valid" ? "Pass verified"
    : state.kind === "invalid" ? "Pass rejected"
    : state.kind === "used" ? "Already checked in"
    : "";

  const subtitle =
    state.kind === "valid" ? "Welcome them in."
    : state.kind === "invalid" ? "This pass couldn't be verified."
    : state.kind === "used" ? "This pass was scanned earlier."
    : "";

  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-6 pt-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">{back ?? header}</div>
          <div className="flex shrink-0 items-center gap-2 text-[11px] text-white/60">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "Online" : "Offline"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {pendingCount} pending
            </span>
          </div>
        </div>

        {state.kind === "idle" ? (
          <div className="mt-6 flex flex-1 flex-col">
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
                <ScanLine className="h-5 w-5 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-semibold">Scan a pass</h1>
              <p className="mt-1 text-sm text-white/50">
                Point the camera at the attendee's QR code
              </p>
            </div>
            {!ready && (
              <p className="mb-3 text-center text-sm text-white/40">Loading…</p>
            )}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-2">
              <div id={readerId} />
              {/* corner brackets overlay */}
              <div className="pointer-events-none absolute inset-3 rounded-2xl">
                <span className="absolute left-0 top-0 h-6 w-6 rounded-tl-xl border-l-2 border-t-2 border-primary" />
                <span className="absolute right-0 top-0 h-6 w-6 rounded-tr-xl border-r-2 border-t-2 border-primary" />
                <span className="absolute bottom-0 left-0 h-6 w-6 rounded-bl-xl border-b-2 border-l-2 border-primary" />
                <span className="absolute bottom-0 right-0 h-6 w-6 rounded-br-xl border-b-2 border-r-2 border-primary" />
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-white/35">
              Hold steady — passes verify automatically
            </p>
          </div>
        ) : (
          <div className="mt-10 flex flex-1 flex-col">
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8"
              style={{ boxShadow: `0 0 0 1px ${accent}33, 0 20px 60px -20px ${accent}66` }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: `${accent}1A`, border: `1px solid ${accent}55` }}
              >
                {state.kind === "valid" && <Check className="h-10 w-10" strokeWidth={2.5} style={{ color: accent }} />}
                {state.kind === "invalid" && <X className="h-10 w-10" strokeWidth={2.5} style={{ color: accent }} />}
                {state.kind === "used" && <AlertTriangle className="h-10 w-10" strokeWidth={2.5} style={{ color: accent }} />}
              </div>
              <p className="text-center text-xs uppercase tracking-[0.25em] text-white/40">Scan result</p>
              <h2 className="mt-2 text-center font-display text-3xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-center text-sm text-white/60">{subtitle}</p>
              {"reason" in state && state.reason && (
                <p className="mt-3 text-center text-sm text-white/50">{state.reason}</p>
              )}
            </div>
            <Button
              className="mt-6 w-full"
              style={{ backgroundColor: "#4F39F6", color: "#fff" }}
              onClick={onReset}
            >
              Scan next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}