import { MapPin, Compass, Navigation } from "lucide-react";
import { useStudioStore } from "@/stores/useStudioStore";

const PIN_COLORS: Record<string, string> = {
  stays: "bg-[hsl(220,40%,55%)]",
  dining: "bg-[hsl(140,30%,50%)]",
  activity: "bg-[hsl(38,50%,55%)]",
  sites: "bg-[hsl(280,30%,55%)]",
};

export default function StudioMap() {
  const { activeFolder } = useStudioStore();

  const itemsWithCoords = activeFolder?.items.filter((i) => i.lat && i.lng) || [];
  const allItems = activeFolder?.items || [];

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Proximity Map
        </h2>
      </div>

      {/* Map area */}
      <div className="relative flex flex-1 flex-col bg-secondary/30">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(0deg, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {!activeFolder ? (
          <div className="relative z-10 flex flex-1 items-center justify-center px-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-thin border-border bg-background">
                <Compass className="h-5 w-5 text-accent" strokeWidth={1.5} />
              </div>
              <p className="font-playfair text-sm font-semibold text-foreground">World View</p>
              <p className="mt-1 mx-auto max-w-[200px] font-inter text-[10px] leading-relaxed text-muted-foreground">
                Select a collection to see a proximity view of your saved locations.
              </p>
            </div>
          </div>
        ) : (
          <div className="relative z-10 flex flex-1 flex-col">
            {/* Location header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
              <Navigation className="h-3 w-3 text-accent" />
              <span className="font-playfair text-xs font-semibold text-foreground">
                {activeFolder.location || "Unknown Region"}
              </span>
              <span className="ml-auto font-inter text-[10px] text-muted-foreground">
                {itemsWithCoords.length} pinned · {allItems.length} total
              </span>
            </div>

            {/* Simulated map with pin indicators */}
            <div className="flex flex-1 items-center justify-center px-4">
              {allItems.length === 0 ? (
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border-thin border-border bg-background">
                    <MapPin className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <p className="font-inter text-[10px] text-muted-foreground max-w-[180px] mx-auto leading-relaxed">
                    Add items with addresses to see them mapped here. Google Maps integration coming soon.
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-xs">
                  <p className="mb-3 text-center font-inter text-[10px] text-muted-foreground">
                    Pins by category
                  </p>
                  <div className="space-y-1.5">
                    {allItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 rounded-sm border-thin border-border bg-background px-2.5 py-1.5"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${PIN_COLORS[item.category] || "bg-muted-foreground"}`} />
                        <span className="flex-1 truncate font-inter text-[10px] text-foreground">
                          {item.title}
                        </span>
                        {item.address && (
                          <span className="hidden sm:block truncate max-w-[100px] font-inter text-[9px] text-muted-foreground">
                            {item.address}
                          </span>
                        )}
                        {(item.lat && item.lng) && (
                          <MapPin className="h-2.5 w-2.5 shrink-0 text-accent" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
