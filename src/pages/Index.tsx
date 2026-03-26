import { MapPin, Compass, CreditCard } from "lucide-react";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      {/* Brand Mark */}
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-inter font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Digital Travel Studio
        </p>
        <h1 className="text-5xl font-playfair font-bold tracking-tight text-foreground md:text-6xl">
          TML Concierge
        </h1>
        <div className="mx-auto mt-4 h-px w-16 bg-accent" />
      </div>

      {/* Tagline */}
      <p className="mb-16 max-w-md text-center font-inter text-base text-muted-foreground leading-relaxed">
        A premium planning tool for tech-savvy travelers who maximize their
        points, spend, and experiences.
      </p>

      {/* Feature Pillars */}
      <div className="grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { icon: MapPin, label: "Matrix Timeline", desc: "Organize every detail" },
          { icon: Compass, label: "Ideas Vault", desc: "Capture inspiration" },
          { icon: CreditCard, label: "Splurge Engine", desc: "Optimize your spend" },
        ].map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex flex-col items-center rounded-sm border-thin border-border bg-card p-8 text-center"
          >
            <Icon className="mb-4 h-5 w-5 text-accent" strokeWidth={1.5} />
            <h2 className="mb-1 text-sm font-playfair font-semibold text-foreground">
              {label}
            </h2>
            <p className="text-xs font-inter text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      {/* Footer Note */}
      <p className="mt-20 text-[11px] font-inter text-muted-foreground tracking-wide">
        Phase 1 — Foundation &amp; Design System ✓
      </p>
    </div>
  );
};

export default Index;
