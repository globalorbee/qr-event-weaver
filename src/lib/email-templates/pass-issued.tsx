import React from "react";
import {
  Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  attendeeName?: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  ticketType?: string;
  brandColor?: string;
  passUrl?: string;
  passImageUrl?: string;
}

const PassIssuedEmail = ({
  attendeeName = "there",
  eventName = "your event",
  eventDate = "",
  venue = "",
  ticketType = "General",
  brandColor = "#4F39F6",
  passUrl = "#",
  passImageUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your pass for {eventName} is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: "center", paddingBottom: 8 }}>
          <div style={{ ...accent, backgroundColor: brandColor }} />
        </Section>
        <Heading style={h1}>Hi {attendeeName}, your pass is ready</Heading>
        <Text style={text}>
          You're confirmed for <strong>{eventName}</strong>{eventDate ? ` on ${eventDate}` : ""}
          {venue ? `, at ${venue}` : ""}.
        </Text>
        <Text style={meta}>Ticket type: <strong>{ticketType}</strong></Text>
        {passImageUrl ? (
          <Section style={{ textAlign: "center", margin: "24px 0" }}>
            <Img src={passImageUrl} alt="Your event pass" width="320" style={{ borderRadius: 16, margin: "0 auto" }} />
          </Section>
        ) : null}
        <Section style={{ textAlign: "center", margin: "28px 0" }}>
          <Link href={passUrl} style={{ ...button, backgroundColor: brandColor }}>
            Open your pass
          </Link>
        </Section>
        <Text style={footer}>
          Present the QR code at the entrance — it's tied to your name and can only be scanned once.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: PassIssuedEmail,
  subject: (d: Record<string, any>) => `Your pass for ${d.eventName ?? "the event"}`,
  displayName: "Pass issued",
  previewData: {
    attendeeName: "Jane",
    eventName: "Designers Meetup",
    eventDate: "Sat, Jun 15, 2026",
    venue: "The Wing, NYC",
    ticketType: "VIP",
    brandColor: "#4F39F6",
    passUrl: "https://example.com/pass/demo",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 24px", maxWidth: 560, margin: "0 auto" };
const accent = { width: 48, height: 4, borderRadius: 4, margin: "0 auto" };
const h1 = { fontSize: 24, fontWeight: 600, color: "#0a0a0a", margin: "16px 0 12px", letterSpacing: "-0.01em" };
const text = { fontSize: 15, color: "#333", lineHeight: 1.6, margin: "0 0 8px" };
const meta = { fontSize: 14, color: "#555", margin: "0 0 16px" };
const button = {
  display: "inline-block",
  padding: "12px 22px",
  borderRadius: 999,
  color: "#ffffff",
  fontWeight: 600,
  fontSize: 14,
  textDecoration: "none",
};
const footer = { fontSize: 13, color: "#888", margin: "20px 0 0", textAlign: "center" as const };