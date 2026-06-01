import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { loadGoogleMapsScript } from "@/lib/googleMaps";

export interface PlacePick {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (pick: PlacePick) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Bias suggestions. "cities" / "regions" / "establishment". */
  types?: "cities" | "regions" | "establishment";
  autoFocus?: boolean;
}

const PRIMARY_TYPES: Record<NonNullable<Props["types"]>, string[]> = {
  cities: ["locality", "administrative_area_level_3"],
  regions: ["locality", "administrative_area_level_1", "administrative_area_level_2", "country"],
  establishment: ["establishment"],
};

export default function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  id,
  className,
  types,
  autoFocus,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const reqIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ensureSessionToken = useCallback(async () => {
    if (sessionTokenRef.current) return sessionTokenRef.current;
    await loadGoogleMapsScript();
    const g = (window as any).google;
    if (!g?.maps?.importLibrary) return null;
    try {
      const places: any = await g.maps.importLibrary("places");
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    } catch (err) {
      console.error("PlaceAutocomplete: failed to init session token", err);
      return null;
    }
    return sessionTokenRef.current;
  }, []);

  const runSearch = useCallback(
    async (input: string) => {
      const myReq = ++reqIdRef.current;
      setLoading(true);
      try {
        await loadGoogleMapsScript();
        const g = (window as any).google;
        if (!g?.maps?.importLibrary) {
          if (myReq === reqIdRef.current) setSuggestions([]);
          return;
        }
        const places: any = await g.maps.importLibrary("places");
        const sessionToken = await ensureSessionToken();
        const req: any = { input, sessionToken };
        if (types) req.includedPrimaryTypes = PRIMARY_TYPES[types];

        const { suggestions: raw } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
        if (myReq !== reqIdRef.current) return;

        const mapped: Suggestion[] = (raw || [])
          .map((s: any) => {
            const p = s.placePrediction;
            if (!p) return null;
            const main = p.mainText?.text || p.text?.text || "";
            const secondary = p.secondaryText?.text || "";
            return {
              placeId: p.placeId,
              mainText: main,
              secondaryText: secondary,
              description: secondary ? `${main}, ${secondary}` : main,
            } as Suggestion;
          })
          .filter(Boolean) as Suggestion[];

        setSuggestions(mapped);
        setHighlight(0);
        setOpen(mapped.length > 0);
      } catch (err) {
        console.error("PlaceAutocomplete search failed", err);
        if (myReq === reqIdRef.current) setSuggestions([]);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    },
    [ensureSessionToken, types],
  );

  const handleChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => runSearch(v.trim()), 220);
  };

  const handlePick = (s: Suggestion) => {
    onChange(s.description);
    onSelect?.({
      description: s.description,
      placeId: s.placeId,
      mainText: s.mainText,
      secondaryText: s.secondaryText,
    });
    setOpen(false);
    setSuggestions([]);
    sessionTokenRef.current = null; // rotate token after a pick
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handlePick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className="border-thin font-inter text-sm"
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-sm border-thin border-border bg-card shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handlePick(s)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex w-full items-start gap-2 px-3 py-2.5 text-left min-h-[44px] transition-colors",
                i === highlight ? "bg-accent/10" : "bg-transparent",
              )}
            >
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="flex-1 min-w-0">
                <span className="block font-inter text-sm text-foreground truncate">{s.mainText}</span>
                {s.secondaryText && (
                  <span className="block font-inter text-[11px] text-muted-foreground truncate">
                    {s.secondaryText}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}