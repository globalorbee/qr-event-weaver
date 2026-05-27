import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import QRCode from "qrcode";
import { encodeSignedPass, signPayload } from "@/lib/qr-crypto";

// Returns an SVG event pass that always reflects the latest event details.
// Since the URL is keyed by passCode (immutable), updates to event name,
// venue, or date are reflected next time the image is fetched.
export const Route = createFileRoute("/api/public/pass-image/$passCode")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const passCode = String(params.passCode || "").slice(0, 64);
        if (!/^[a-f0-9]{8,64}$/i.test(passCode)) {
          return new Response("bad code", { status: 400 });
        }

        const { data } = await supabaseAdmin
          .from("attendees")
          .select("id, event_id, name, ticket_type, pass_code, signature, status, events(name, event_date, venue, brand_color, organizer_name, private_key)")
          .eq("pass_code", passCode)
          .maybeSingle();

        if (!data || !data.events) {
          return new Response("not found", { status: 404 });
        }

        const ev = data.events as {
          name: string; event_date: string; venue: string; brand_color: string; organizer_name: string; private_key?: string | null;
        };
        const date = new Date(ev.event_date);
        const dateStr = date.toUTCString().slice(0, 22);
        const signature = data.signature ?? (ev.private_key
          ? await signPayload({ a: data.id, e: data.event_id, t: data.ticket_type, c: data.pass_code }, ev.private_key)
          : null);
        if (signature && !data.signature) {
          await supabaseAdmin.from("attendees").update({ signature }).eq("id", data.id);
        }
        const qrPayload = signature
          ? encodeSignedPass({ a: data.id, e: data.event_id, t: data.ticket_type, c: data.pass_code, s: signature })
          : `${new URL(request.url).origin}/pass/${data.pass_code}`;
        const qrSvg = await QRCode.toString(qrPayload, {
          type: "svg",
          errorCorrectionLevel: "H",
          margin: 1,
          width: 240,
          color: { dark: "#000000", light: "#ffffff" },
        });
        const qrImage = `data:image/svg+xml;base64,${btoa(qrSvg)}`;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080" viewBox="0 0 720 1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(ev.brand_color)}"/>
      <stop offset="100%" stop-color="#1B1B1B"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1080" rx="36" fill="#0a0a0a"/>
  <rect x="0" y="0" width="720" height="320" rx="36" fill="url(#g)"/>
  <text x="40" y="280" font-family="sans-serif" font-size="44" font-weight="700" fill="#ffffff">${escapeXml(ev.name)}</text>
  <text x="40" y="310" font-family="sans-serif" font-size="18" fill="#ffffffcc">EVENT PASS</text>

  <text x="40" y="400" font-family="sans-serif" font-size="22" fill="#999">Attendee</text>
  <text x="40" y="440" font-family="sans-serif" font-size="36" font-weight="600" fill="#fff">${escapeXml(data.name)}</text>
  <text x="40" y="470" font-family="sans-serif" font-size="20" fill="${escapeXml(ev.brand_color)}">${escapeXml(data.ticket_type)}</text>

  <line x1="40" y1="520" x2="680" y2="520" stroke="#222" stroke-dasharray="6 6"/>

  <text x="40" y="580" font-family="sans-serif" font-size="18" fill="#999">When</text>
  <text x="40" y="610" font-family="sans-serif" font-size="22" fill="#fff">${escapeXml(dateStr)}</text>

  <text x="40" y="670" font-family="sans-serif" font-size="18" fill="#999">Where</text>
  <text x="40" y="700" font-family="sans-serif" font-size="22" fill="#fff">${escapeXml(ev.venue)}</text>

  <text x="40" y="760" font-family="sans-serif" font-size="18" fill="#999">Organized by</text>
  <text x="40" y="790" font-family="sans-serif" font-size="22" fill="#fff">${escapeXml(ev.organizer_name)}</text>

  <rect x="240" y="830" width="240" height="240" rx="18" fill="#ffffff"/>
  <image x="252" y="842" width="216" height="216" href="${qrImage}"/>

  <text x="40" y="1020" font-family="monospace" font-size="14" fill="#666">${escapeXml(passCode)}</text>
  <text x="40" y="1050" font-family="sans-serif" font-size="14" fill="${data.status === "used" ? "#666" : escapeXml(ev.brand_color)}">${data.status === "used" ? "USED" : "VALID"}</text>
</svg>`;

        return new Response(svg, {
          status: 200,
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      },
    },
  },
});

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}