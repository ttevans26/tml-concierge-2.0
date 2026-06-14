import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTripStore, type NetworkUser } from "@/stores/useTripStore";
import ProfileCard from "@/components/network/ProfileCard";
import RequestAccessModal from "@/components/network/RequestAccessModal";
import ConnectionsList from "@/components/network/ConnectionsList";
import { toast } from "sonner";
import SeoHead from "@/components/SeoHead";

export default function Network() {
  const users = useTripStore((s) => s.networkUsers);
  const query = useTripStore((s) => s.networkQuery);
  const setQuery = useTripStore((s) => s.setNetworkQuery);
  const followUser = useTripStore((s) => s.followUser);
  const requestAccess = useTripStore((s) => s.requestAccess);

  const [pendingTarget, setPendingTarget] = useState<NetworkUser | null>(null);

  const suggested = useMemo(
    () => users.filter((u) => u.status === "none").slice(0, 6),
    [users],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return users.filter((u) => u.name.toLowerCase().includes(q));
  }, [users, query]);

  const handleFollow = (id: string) => {
    followUser(id);
    toast.success("Following");
  };

  const handleConfirmRequest = () => {
    if (!pendingTarget) return;
    requestAccess(pendingTarget.id);
    toast.success(`Request sent to ${pendingTarget.name}`);
    setPendingTarget(null);
  };

  return (
    <div className="min-h-full bg-background">
      <SeoHead
        title="Network — TML Concierge"
        description="Follow fellow travelers, request access to shared itineraries, and discover trip inspiration from your network."
        path="/network"
        noindex
      />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <header className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-thin border-accent/40 rounded-sm">
            <Users className="h-4 w-4 text-accent" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-playfair text-2xl font-semibold text-foreground sm:text-3xl">
              Travel Network
            </h1>
            <p className="font-inter text-xs text-muted-foreground sm:text-sm">
              Discover other travelers and curators on the platform.
            </p>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          {/* Left rail — connections repository */}
          <ConnectionsList />

          <div>
            {/* Search panel */}
            <section className="mb-8 border-thin border-foreground/15 bg-card p-5 rounded-sm sm:p-6">
          <label
            htmlFor="network-search"
            className="block font-inter text-[11px] uppercase tracking-widest text-muted-foreground mb-2"
          >
            Find a traveler
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              id="network-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search travelers by name..."
              className="pl-10 h-11 font-inter text-sm rounded-sm border-foreground/15"
            />
          </div>
        </section>

        {/* Search results */}
        {query.trim() && (
          <section className="mb-8">
            <h2 className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground mb-3">
              Search Results — {results.length}
            </h2>
            {results.length === 0 ? (
              <div className="border-thin border-foreground/15 bg-card px-4 py-8 text-center rounded-sm">
                <p className="font-inter text-sm text-muted-foreground">
                  No travelers match "{query}".
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {results.map((u) => (
                  <ProfileCard
                    key={u.id}
                    user={u}
                    variant="row"
                    onFollow={handleFollow}
                    onRequestAccess={setPendingTarget}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Suggested */}
        <section>
          <h2 className="font-playfair text-base font-semibold text-foreground mb-3">
            Suggested Connections
          </h2>
          {suggested.length === 0 ? (
            <div className="border-thin border-foreground/15 bg-card px-4 py-8 text-center rounded-sm">
              <p className="font-inter text-sm text-muted-foreground">
                You're connected with everyone we'd suggest.
              </p>
            </div>
          ) : (
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
                {suggested.map((u) => (
                  <ProfileCard
                    key={u.id}
                    user={u}
                    variant="tile"
                    onFollow={handleFollow}
                    onRequestAccess={setPendingTarget}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
          </div>
        </div>
      </div>

      <RequestAccessModal
        open={!!pendingTarget}
        name={pendingTarget?.name ?? null}
        onConfirm={handleConfirmRequest}
        onCancel={() => setPendingTarget(null)}
      />
      <p className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
        Curated demo network · Live social graph arrives in Release 2.0
      </p>
    </div>
  );
}