import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { syncScans } from "@/lib/scan.functions";
import { decodeSignedPass, verifySignedPass } from "@/lib/qr-crypto";
import { recordScan, getScan, getUnsynced, markSynced } from "@/lib/offline-cache";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ScannerShell } from "@/components/ScannerShell";

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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const sync = useServerFn(syncScans);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  // Warm the scanner chunk immediately so it's ready by the time the key loads.
  useEffect(() => { import("html5-qrcode").catch(() => {}); }, []);

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

  // Start camera-only scanner using Html5Qrcode (no file upload UI).
  useEffect(() => {
    if (!user || !publicKey) return;
    setCameraError(null);
    let stopped = false;
    let scanner: Html5Qrcode | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return;
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras?.length) {
          setCameraError("No camera found. Connect a camera and try again.");
          return;
        }
        if (stopped) return;
        const cameraId = cameras[0].id;
        scanner = new Html5Qrcode("qr-reader");
        await scanner.start(
          cameraId,
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (text: string) => {
            const now = Date.now();
            // debounce repeat scans (1.5s window)
            if (lastScanRef.current.code === text && now - lastScanRef.current.at < 1500) return;
            lastScanRef.current = { code: text, at: now };
            await handleScan(text);
          },
          () => {},
        );
      } catch (e) {
        if (!stopped) {
          setCameraError(e instanceof Error ? e.message : "Camera failed to start");
        }
      }
    })();

    return () => {
      stopped = true;
      if (scanner) {
        scanner.stop().catch(() => {}).then(() => scanner?.clear());
      }
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

