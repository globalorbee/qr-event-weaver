import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, WifiOff, Wifi, ScanLine } from "lucide-react";
import { type ReactNode } from "react";

export type ScannerState =
  | { kind: "idle" }
  | { kind: "valid"; name: string }
  | { kind: "used"; name: string }
  | { kind: "invalid"; reason: string };

export function ScannerShell({
  online,
  pendingCount,
  state,
  onReset,
  back,
  readerId,
  ready,
  header,
  cameraError,
  brandColor = "#4F39F6",
}: {
  online: boolean;
  pendingCount: number;
  state: ScannerState;
  onReset: () => void;
  back?: ReactNode;
  readerId: string;
  ready: boolean;
  header?: ReactNode;
  cameraError?: string | null;
  brandColor?: string;
}) {
  const accent =
    state.kind === "valid" ? brandColor
    : state.kind === "invalid" ? "#ef4444"
    : state.kind === "used" ? "#f59e0b"
    : brandColor;

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
          <div className="min-w-0 flex-1">{back ?? header}</div>
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
            {!ready && <p className="mb-3 text-center text-sm text-white/40">Loading…</p>}
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-2">
              <div id={readerId} />
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
              style={{ backgroundColor: brandColor, color: "#fff" }}
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