import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GeminiFooter() {
  const [bubbleOpen, setBubbleOpen] = useState(false);

  return (
    <>
      {/* Sticky Footer */}
      <footer className="sticky bottom-0 z-30 flex h-10 items-center justify-between border-t border-border bg-background/95 px-6 backdrop-blur-sm">
        <p className="font-inter text-[10px] text-muted-foreground tracking-wide">
          © {new Date().getFullYear()} TML Network
        </p>

        <Button
          size="sm"
          onClick={() => setBubbleOpen(!bubbleOpen)}
          className="gap-1.5 rounded-full bg-accent text-accent-foreground font-inter text-xs hover:bg-accent/90 shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          Gemini Concierge
        </Button>
      </footer>

      {/* Chat Bubble */}
      <div
        className={cn(
          "fixed bottom-14 right-6 z-50 w-72 rounded-sm border border-border bg-card p-5 shadow-lg transition-all duration-200",
          bubbleOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
            <p className="font-playfair text-sm font-semibold text-foreground">Gemini Concierge</p>
          </div>
          <button onClick={() => setBubbleOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-3 font-inter text-xs leading-relaxed text-muted-foreground">
          The Gemini Concierge is currently learning your travel preferences. This feature is coming soon to the TML Network.
        </p>
      </div>
    </>
  );
}
