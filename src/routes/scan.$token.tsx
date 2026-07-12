import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { useServerFn } from "@tanstack/react-start";
import { getGatekeeperContext, syncScansByToken } from "@/lib/gatekeeper-token.functions";
import { decodeSignedPass, verifySignedPass } from "@/lib/qr-crypto";
import { recordScan, getScan, getUnsynced, markSynced } from "@/lib/offline-cache";
import { ScannerShell } from "@/components/ScannerShell";

export const Route = createFileRoute("/scan/$token")({
  head: () => ({ meta: [{ title: "Scan — Peras" }] }),
  component: PublicScanner,
});

type Ctx = {
  eventId: string;
  eventName: string;
  brandColor: string;
  publicKey: string | null;
  label: string;
};

type State =
  | { kind: "idle" }
  | { kind: "valid"; name: string }
  | { kind: "used"; name: string }
  | { kind: "invalid"; reason: string };

function PublicScanner() {
  const { token } = Route.useParams();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const getCtx = useServerFn(getGatekeeperContext);
  const sync = useServerFn(syncScansByToken);

  useEffect(() => {
    // Warm the scanner chunk in parallel with the context request.
    import("html5-qrcode").catch(() => {});
    getCtx({ data: { token } })
      .then((r) => setCtx(r as Ctx))
      .catch((e) => setErr(e instanceof Error ? e.message : "Invalid link"));
  }, [token, getCtx]);

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

  const refreshPending = async () => setPending((await getUnsynced()).length);
  useEffect(() => { refreshPending(); }, []);

  useEffect(() => {
    if (!online || !ctx) return;
    let cancelled = false;
    const run = async () => {
      const u = await getUnsynced();
      if (!u.length || cancelled) return;
      try {
        await sync({ data: { token, scans: u.map((s) => ({ passCode: s.passCode, scannedAt: s.scannedAt })) } });
        await markSynced(u.map((s) => s.passCode));
        refreshPending();
      } catch (e) { console.warn(e); }
    };
    run();
    return () => { cancelled = true; };
  }, [online, ctx, sync, token]);

  // Start camera-only scanner using Html5Qrcode (no file upload UI).
  useEffect(() => {
    if (!ctx?.publicKey) return;
    let stopped = false;
    let scanner: Html5Qrcode | null = null;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped) return;
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras?.length) return;
      if (stopped) return;
      const cameraId = cameras[0].id;
      scanner = new Html5Qrcode("qr-reader-public");
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (text) => {
          const now = Date.now();
          if (lastScanRef.current.code === text && now - lastScanRef.current.at < 1500) return;
          lastScanRef.current = { code: text, at: now };
          await handleScan(text);
        },
        () => {},
      );
    })();
    return () => {
      stopped = true;
      if (scanner) {
        scanner.stop().catch(() => {}).then(() => scanner?.clear());
      }
    };
  }, [ctx?.publicKey, state.kind === "idle"]);

  const handleScan = async (text: string) => {
    if (!ctx?.publicKey) return;
    const decoded = decodeSignedPass(text);
    if (!decoded || decoded.e !== ctx.eventId) {
      setState({ kind: "invalid", reason: "Not for this event" });
      return;
    }
    const ok = await verifySignedPass(decoded, ctx.publicKey);
    if (!ok) { setState({ kind: "invalid", reason: "Signature does not verify" }); return; }
    const prev = await getScan(decoded.c);
    if (prev) { setState({ kind: "used", name: decoded.a.slice(0, 8) }); return; }
    await recordScan({ passCode: decoded.c, eventId: decoded.e, attendeeId: decoded.a, scannedAt: Date.now(), synced: false });
    refreshPending();
    setState({ kind: "valid", name: decoded.a.slice(0, 8) });
    if (online) {
      try {
        await sync({ data: { token, scans: [{ passCode: decoded.c, scannedAt: Date.now() }] } });
        await markSynced([decoded.c]);
        refreshPending();
      } catch {}
    }
  };

  if (err) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center text-white">
        <div>
          <h1 className="font-display text-2xl font-semibold">Link unavailable</h1>
          <p className="mt-2 text-sm text-white/60">{err}</p>
        </div>
      </div>
    );
  }
  if (!ctx) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-sm text-white/60">Loading…</div>;
  }

  return (
    <ScannerShell
      online={online}
      pendingCount={pending}
      state={state}
      onReset={() => setState({ kind: "idle" })}
      readerId="qr-reader-public"
      ready={!!ctx.publicKey}
      header={
        <div className="min-w-0 truncate">
          <span className="font-display text-base font-semibold text-white">{ctx.eventName}</span>
          <span className="ml-2 text-xs text-white/40">· {ctx.label}</span>
        </div>
      }
    />
  );
}