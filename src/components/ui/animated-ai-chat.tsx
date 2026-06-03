import * as React from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimatedAIChatProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  quickPrompts?: { label: string; value: string }[];
  className?: string;
}

/**
 * AnimatedAIChat — TML editorial chat composer.
 * Inspired by the 21st.dev animated chat input. In-house implementation
 * using only Tailwind + CSS so we don't pull external map/motion deps.
 */
export function AnimatedAIChat({
  value,
  onChange,
  onSubmit,
  disabled,
  sending,
  placeholder = "Ask the Concierge…",
  quickPrompts,
  className,
}: AnimatedAIChatProps) {
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = React.useState(false);

  // Auto-grow
  React.useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !sending) onSubmit();
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {quickPrompts && quickPrompts.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickPrompts.map((q, i) => (
            <button
              key={q.value}
              type="button"
              onClick={() => onChange(q.value)}
              disabled={disabled || sending}
              className="animate-stagger-in inline-flex items-center gap-1 rounded-editorial border border-foil bg-foil-soft px-2.5 py-1 font-inter text-[10px] uppercase tracking-wider text-foreground/80 transition-all duration-quick ease-editorial hover:-translate-y-px hover:border-foil-strong hover:bg-accent/10"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Sparkles className="h-2.5 w-2.5 text-accent" strokeWidth={1.5} />
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          "group relative overflow-hidden rounded-editorial border bg-surface-3 transition-all duration-soft ease-editorial",
          focused
            ? "border-foil-strong shadow-foil"
            : "border-border shadow-paper hover:border-foil",
        )}
      >
        {/* Animated foil ring sweep on focus */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent transition-opacity duration-soft",
            focused ? "opacity-100" : "opacity-0",
          )}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled || sending}
          placeholder={placeholder}
          rows={1}
          className="block w-full resize-none border-0 bg-transparent px-3 py-2.5 pr-12 font-inter text-[12px] leading-relaxed text-foreground placeholder:font-playfair placeholder:italic placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || sending || !value.trim()}
          aria-label="Send"
          className={cn(
            "absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-editorial transition-all duration-quick ease-magnetic",
            value.trim() && !sending
              ? "bg-foil text-accent-foreground shadow-foil hover:-translate-y-px"
              : "bg-muted text-muted-foreground",
          )}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
        </button>
      </div>
      <p className="mt-1 text-right font-inter text-[9px] uppercase tracking-widest text-muted-foreground/70">
        ⌘↵ to send · Shift+↵ for newline
      </p>
    </div>
  );
}

export default AnimatedAIChat;