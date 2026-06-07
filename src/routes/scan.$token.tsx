import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getGatekeeperContext, syncScansByToken } from "@/lib/gatekeeper-token.functions";
import { decodeSignedPass, verifySignedPass } from "@/lib/qr-crypto";
import { recordScan, getScan, getUnsynced, markSynced } from "@/lib/offline-cache";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, WifiOff, Wifi } from "lucide-react";

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

  useEffect(() => {
    if (!ctx?.publicKey) return;
    let stopped = false;
    let scanner: { clear: () => Promise<void> } | null = null;
    (async () => {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (stopped) return;
      const s = new Html5QrcodeScanner(
        "qr-reader-public",
        { fps: 10, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
        false,
      );
      scanner = s as unknown as { clear: () => Promise<void> };
      s.render(async (text) => {
        const now = Date.now();
        if (lastScanRef.current.code === text && now - lastScanRef.current.at < 1500) return;
        lastScanRef.current = { code: text, at: now };
        await handleScan(text);
      }, () => {});
    })();
    return () => { stopped = true; if (scanner) scanner.clear().catch(() => {}); };
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

  const accent =
    state.kind === "valid" ? ctx.brandColor
    : state.kind === "invalid" ? "#ef4444"
    : state.kind === "used" ? "#a3a3a3"
    : "transparent";

  const title =
    state.kind === "valid" ? "Pass verified"
    : state.kind === "invalid" ? "Pass rejected"
    : state.kind === "used" ? "Already checked in"
    : "";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-md px-5 py-5">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span className="truncate">
            <span className="font-display text-base font-semibold text-white">{ctx.eventName}</span>
            <span className="ml-2 text-white/40">· {ctx.label}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "Online" : "Offline"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{pending} pending</span>
          </span>
        </div>

        {state.kind === "idle" ? (
          <>
            <h1 className="mb-1 mt-6 text-center font-display text-2xl font-semibold">Scan a pass</h1>
            <p className="mb-5 text-center text-sm text-white/50">Point the camera at the attendee's QR code</p>
            <div id="qr-reader-public" className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]" />
          </>
        ) : (
          <div className="mt-10">
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8"
              style={{ boxShadow: `0 0 0 1px ${accent}33, 0 20px 60px -20px ${accent}55` }}
            >
              <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}1A`, border: `1px solid ${accent}55` }}>
                {state.kind === "valid" && <Check className="h-10 w-10" strokeWidth={2.5} style={{ color: accent }} />}
                {state.kind === "invalid" && <X className="h-10 w-10" strokeWidth={2.5} style={{ color: accent }} />}
                {state.kind === "used" && <AlertTriangle className="h-10 w-10" strokeWidth={2.5} style={{ color: accent }} />}
              </div>
              <p className="text-center text-xs uppercase tracking-[0.25em] text-white/40">Scan result</p>
              <h2 className="mt-2 text-center font-display text-3xl font-semibold tracking-tight">{title}</h2>
              {"reason" in state && state.reason && <p className="mt-3 text-center text-sm text-white/50">{state.reason}</p>}
            </div>
            <Button className="mt-6 w-full" style={{ backgroundColor: ctx.brandColor, color: "#fff" }} onClick={() => setState({ kind: "idle" })}>
              Scan next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}