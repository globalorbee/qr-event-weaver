import React from "react";
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  attendeeName?: string;
  eventName?: string;
  checkedInAt?: string;
  brandColor?: string;
}

const PassUsedEmail = ({
  attendeeName = "there",
  eventName = "the event",
  checkedInAt = "",
  brandColor = "#4F39F6",
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're checked in to {eventName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={{ textAlign: "center", paddingBottom: 8 }}>
          <div style={{ ...accent, backgroundColor: brandColor }} />
        </Section>
        <Heading style={h1}>You're in, {attendeeName} 🎉</Heading>
        <Text style={text}>
          Your pass for <strong>{eventName}</strong> was scanned successfully
          {checkedInAt ? ` at ${checkedInAt}` : ""}. Enjoy the event!
        </Text>
        <Text style={footer}>If this wasn't you, please contact the organizer right away.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: PassUsedEmail,
  subject: (d: Record<string, any>) => `You're checked in to ${d.eventName ?? "the event"}`,
  displayName: "Pass used",
  previewData: {
    attendeeName: "Jane",
    eventName: "Designers Meetup",
    checkedInAt: "Sat, Jun 15, 2026 · 7:12 PM",
    brandColor: "#4F39F6",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Inter, Arial, sans-serif" };
const container = { padding: "32px 24px", maxWidth: 560, margin: "0 auto" };
const accent = { width: 48, height: 4, borderRadius: 4, margin: "0 auto" };
const h1 = { fontSize: 24, fontWeight: 600, color: "#0a0a0a", margin: "16px 0 12px", letterSpacing: "-0.01em" };
const text = { fontSize: 15, color: "#333", lineHeight: 1.6, margin: "0 0 8px" };
const footer = { fontSize: 13, color: "#888", margin: "20px 0 0", textAlign: "center" as const };