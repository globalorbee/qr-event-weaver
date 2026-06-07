import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { format } from "date-fns";
import { Calendar, MapPin, User as UserIcon } from "lucide-react";
import { bestForeground } from "@/lib/contrast";
import { encodeSignedPass, signPayload, type SignedPass } from "@/lib/qr-crypto";

export type PassData = {
  eventName: string;
  eventDate: string | Date;
  venue: string;
  attendeeName: string;
  ticketType: string;
  brandColor: string;
  organizerName: string;
  passCode: string;
  bannerUrl?: string | null;
  status?: "unused" | "used";
  // Optional: produce a signed QR payload instead of a plain URL
  eventId?: string;
  attendeeId?: string;
  privateKey?: string | null;
  signedPayload?: SignedPass | null;
  // Optional expressive font name for the attendee display
  attendeeFont?: string | null;
};

export function EventPass({ data, innerRef }: { data: PassData; innerRef?: React.Ref<HTMLDivElement> }) {
  const [qr, setQr] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const fg = bestForeground(data.brandColor);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const build = async () => {
      let qrData: string;
      if (data.signedPayload) {
        qrData = encodeSignedPass(data.signedPayload);
      } else if (data.eventId && data.attendeeId && data.privateKey) {
        const sig = await signPayload(
          { a: data.attendeeId, e: data.eventId, t: data.ticketType, c: data.passCode },
          data.privateKey,
        );
        qrData = encodeSignedPass({ a: data.attendeeId, e: data.eventId, t: data.ticketType, c: data.passCode, s: sig });
      } else {
        qrData = `${window.location.origin}/pass/${data.passCode}`;
      }
      const url = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 320,
        color: { dark: "#000000", light: "#ffffff" },
      });
      if (!cancelled) setQr(url);
    };
    build();
    return () => { cancelled = true; };
  }, [mounted, data.passCode, data.signedPayload, data.eventId, data.attendeeId, data.privateKey, data.ticketType]);

  const date = new Date(data.eventDate);

  return (
    <div
      ref={innerRef}
      className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] text-white shadow-2xl"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Banner */}
      <div
        className="relative h-32 w-full"
        style={{
          background: data.bannerUrl
            ? `url(${data.bannerUrl}) center/cover`
            : `linear-gradient(135deg, ${data.brandColor} 0%, #1B1B1B 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Event Pass</p>
          <h3
            className="truncate text-xl font-semibold leading-tight"
            style={{ fontFamily: "Clash Display, Inter, sans-serif", letterSpacing: "-0.02em" }}
          >
            {data.eventName}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold uppercase"
            style={{ backgroundColor: data.brandColor, color: fg }}
          >
            {data.attendeeName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-base font-semibold"
              style={data.attendeeFont ? { fontFamily: `'${data.attendeeFont}', cursive`, fontSize: "1.2rem" } : undefined}
            >
              {data.attendeeName}
            </p>
            <p className="text-xs text-white/60">{data.ticketType}</p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
            style={{
              backgroundColor: data.status === "used" ? "#1B1B1B" : `${data.brandColor}22`,
              color: data.status === "used" ? "#666" : data.brandColor,
              border: `1px solid ${data.status === "used" ? "#333" : data.brandColor}`,
            }}
          >
            {data.status === "used" ? "Used" : "Valid"}
          </span>
        </div>

        <div className="space-y-2 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" style={{ color: data.brandColor }} />
            <span suppressHydrationWarning>
              {mounted ? format(date, "EEE, MMM d, yyyy · h:mm a") : format(date, "EEE, MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" style={{ color: data.brandColor }} />
            <span className="truncate">{data.venue}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5" style={{ color: data.brandColor }} />
            <span className="truncate">By {data.organizerName}</span>
          </div>
        </div>

        {/* Perforation */}
        <div className="relative my-2">
          <div className="border-t border-dashed border-white/15" />
          <div className="absolute -left-7 -top-3 h-6 w-6 rounded-full bg-background" />
          <div className="absolute -right-7 -top-3 h-6 w-6 rounded-full bg-background" />
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt="QR code" className="h-40 w-40 rounded-md bg-white p-2" />
          ) : (
            <div className="h-40 w-40 animate-pulse rounded-md bg-white/10" />
          )}
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">
            {data.passCode.slice(0, 8)} · {data.passCode.slice(8, 16)}
          </p>
        </div>
      </div>
    </div>
  );
}