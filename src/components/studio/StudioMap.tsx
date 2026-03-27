import { MapPin, Compass } from "lucide-react";
import { useStudioStore } from "@/stores/useStudioStore";

export default function StudioMap() {
  const { activeFolder } = useStudioStore();

  const itemsWithCoords = activeFolder?.items.filter((i) => i.lat && i.lng) || [];

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Proximity Map
        </h2>
      </div>

      {/* Map placeholder */}
      <div className="relative flex flex-1 items-center justify-center bg-secondary/30">
        {/* Stylized map background */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(0deg, hsl(var(--border)) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 text-center px-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-thin border-border bg-background">
            <Compass className="h-5 w-5 text-accent" strokeWidth={1.5} />
          </div>

          {!activeFolder ? (
            <>
              <p className="font-playfair text-sm font-semibold text-foreground">
                World View
              </p>
              <p className="mt-1 font-inter text-[10px] leading-relaxed text-muted-foreground max-w-[200px] mx-auto">
                Select a collection to see a proximity view of your saved locations.
              </p>
            </>
          ) : itemsWithCoords.length === 0 ? (
            <>
              <p className="font-playfair text-sm font-semibold text-foreground">
                {activeFolder.location}
              </p>
              <p className="mt-1 font-inter text-[10px] leading-relaxed text-muted-foreground max-w-[200px] mx-auto">
                Add items with coordinates to see them mapped here. Google Maps integration coming soon.
              </p>
            </>
          ) : (
            <>
              <p className="font-playfair text-sm font-semibold text-foreground">
                {activeFolder.location}
              </p>
              <p className="mt-1 font-inter text-[10px] text-muted-foreground">
                {itemsWithCoords.length} pinned locations
              </p>
            </>
          )}

          {/* Pin indicators */}
          {activeFolder && activeFolder.items.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {activeFolder.items.slice(0, 8).map((item) => {
                const pinColor =
                  item.category === "stays" ? "bg-[hsl(220,40%,55%)]" :
                  item.category === "dining" ? "bg-[hsl(140,30%,50%)]" :
                  item.category === "activity" ? "bg-[hsl(38,50%,55%)]" :
                  "bg-[hsl(280,30%,55%)]";
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-1 rounded-sm border-thin border-border bg-background px-2 py-1`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${pinColor}`} />
                    <span className="font-inter text-[9px] text-muted-foreground truncate max-w-[80px]">
                      {item.title}
                    </span>
                  </div>
                );
              })}
              {activeFolder.items.length > 8 && (
                <span className="font-inter text-[9px] text-muted-foreground px-1 py-1">
                  +{activeFolder.items.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
