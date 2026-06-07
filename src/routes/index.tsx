import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { EventPass } from "@/components/EventPass";
import { QrCode, Zap, Users, Download, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(79,57,246,0.35), transparent 60%)",
            }}
          />
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-2 lg:py-32">
            <div className="flex flex-col justify-center">
              <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#4F39F6" }} />
                QR-powered event passes
              </span>
              <h1 className="font-display text-5xl font-semibold tracking-tight md:text-6xl lg:text-7xl">
                Branded event passes.<br />
                <span style={{ color: "#4F39F6" }}>Generated in seconds.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-white/70">
                Create scannable QR passes for meetups, weddings, workshops and conferences.
                No design skills required.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/login">
                  <Button size="lg" className="gap-2">
                    Start free <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#how">
                  <Button size="lg" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/5">
                    How it works
                  </Button>
                </a>
              </div>
            </div>
            <div className="flex min-w-0 items-center justify-center overflow-hidden px-1 sm:px-0">
              <div className="w-full max-w-[360px] origin-center rotate-2 transition-transform hover:rotate-0 sm:rotate-3">
                <EventPass
                  data={{
                    eventName: "Designers Meetup '26",
                    eventDate: "2026-06-15T19:00:00.000Z",
                    venue: "The Wing, NYC",
                    attendeeName: "Alex Rivera",
                    ticketType: "VIP",
                    brandColor: "#4F39F6",
                    organizerName: "Studio North",
                    passCode: "demo1234demo5678demo9abc",
                    status: "unused",
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="how" className="border-t border-white/10 bg-black">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold md:text-4xl">Everything an organizer needs.</h2>
            <p className="mt-3 max-w-xl text-white/60">
              From small private gatherings to large conferences — Peras scales without the overhead.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Zap, title: "Instant creation", text: "Spin up an event and start issuing passes in under a minute." },
                { icon: QrCode, title: "Scannable QR", text: "Every pass has a unique code with a live verification page." },
                { icon: Users, title: "Attendee records", text: "Track who's checked in and who hasn't, in real time." },
                { icon: Download, title: "PNG & PDF export", text: "Download passes individually or share via a public link." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(79,57,246,0.15)" }}>
                    <Icon className="h-5 w-5" style={{ color: "#4F39F6" }} />
                  </div>
                  <h3 className="font-display text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-white/60">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-black">
          <div className="mx-auto max-w-7xl px-6 py-8 text-center text-sm text-white/50">
            © {new Date().getFullYear()} Peras. Built for organizers.
          </div>
        </footer>
      </main>
    </div>
  );
}
