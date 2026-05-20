import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Globe, Lock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTripStore, type NetworkUser } from "@/stores/useTripStore";
import UserTripCard from "@/components/network/UserTripCard";
import RequestAccessModal from "@/components/network/RequestAccessModal";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function NetworkUserProfile() {
  const { id } = useParams<{ id: string }>();
  const user = useTripStore((s) => s.networkUsers.find((u) => u.id === id));
  const trips = useTripStore((s) => (id ? s.networkUserTrips[id] ?? [] : []));
  const requestAccess = useTripStore((s) => s.requestAccess);
  const [pending, setPending] = useState<NetworkUser | null>(null);

  const canView = useMemo(() => {
    if (!user) return false;
    return user.is_public || user.status === "connected";
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Link to="/network" className="font-inter text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back to Network
        </Link>
        <p className="mt-6 font-inter text-sm text-muted-foreground">Traveler not found.</p>
      </div>
    );
  }

  const handleConfirmRequest = () => {
    if (!pending) return;
    requestAccess(pending.id);
    toast.success(`Request sent to ${pending.name}`);
    setPending(null);
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to="/network"
          className="inline-flex items-center gap-1 font-inter text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.5} /> Back to Network
        </Link>

        {/* Profile header */}
        <header className="flex items-center gap-4 border-thin border-foreground/15 bg-card p-5 rounded-sm sm:p-6">
          <Avatar className="h-16 w-16 rounded-full">
            <AvatarFallback className="bg-accent/15 font-inter text-base text-accent">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-playfair text-xl font-semibold text-foreground sm:text-2xl truncate">
                {user.name}
              </h1>
              {user.is_public ? (
                <Globe className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              ) : (
                <Lock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
            <p className="font-inter text-xs text-muted-foreground sm:text-sm">
              {user.trips_planned} Trips Planned
              {user.status === "connected" && " · Connected"}
              {user.status === "pending" && " · Request pending"}
            </p>
          </div>
        </header>

        {/* Trips */}
        <section className="mt-8">
          <h2 className="font-playfair text-base font-semibold text-foreground mb-3">
            Trips visible to you
          </h2>

          {!canView ? (
            <div className="border-thin border-foreground/15 bg-card px-5 py-10 text-center rounded-sm">
              <Lock className="mx-auto h-5 w-5 text-accent mb-2" strokeWidth={1.5} />
              <p className="font-playfair text-sm font-semibold text-foreground">
                This profile is private
              </p>
              <p className="mx-auto mt-1 max-w-sm font-inter text-xs text-muted-foreground">
                Request access to see {user.name.split(" ")[0]}'s shared itineraries.
              </p>
              <Button
                size="sm"
                className="mt-4 font-inter text-xs rounded-sm"
                disabled={user.status !== "none"}
                onClick={() => setPending(user)}
              >
                {user.status === "pending" ? "Pending" : "Request Access"}
              </Button>
            </div>
          ) : trips.length === 0 ? (
            <div className="border-thin border-foreground/15 bg-card px-5 py-10 text-center rounded-sm">
              <p className="font-inter text-sm text-muted-foreground">
                {user.name.split(" ")[0]} hasn't shared any trips yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {trips.map((t) => (
                <UserTripCard key={t.id} trip={t} />
              ))}
            </div>
          )}
        </section>
      </div>

      <RequestAccessModal
        open={!!pending}
        name={pending?.name ?? null}
        onConfirm={handleConfirmRequest}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}