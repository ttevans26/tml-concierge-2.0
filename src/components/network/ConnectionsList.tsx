import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTripStore } from "@/stores/useTripStore";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function ConnectionsList() {
  const users = useTripStore((s) => s.networkUsers);
  const connections = useMemo(
    () => users.filter((u) => u.status === "connected"),
    [users],
  );

  return (
    <aside className="border-thin border-foreground/15 bg-card rounded-sm">
      <header className="flex items-center gap-2 border-b border-foreground/10 px-4 py-3">
        <Users className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        <h2 className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
          Your Connections
        </h2>
        <span className="ml-auto font-inter text-[11px] text-muted-foreground">
          {connections.length}
        </span>
      </header>

      {connections.length === 0 ? (
        <div className="px-4 py-6">
          <p className="font-inter text-xs text-muted-foreground">
            Follow travelers from the directory to build your network.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {connections.map((u) => (
            <li key={u.id}>
              <Link
                to={`/network/user/${u.id}`}
                className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 border-b border-foreground/5 last:border-b-0 hover:bg-secondary/40 transition-colors"
              >
                <Avatar className="h-9 w-9 rounded-full">
                  <AvatarFallback className="bg-accent/15 font-inter text-[11px] text-accent">
                    {initials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-playfair text-sm font-semibold text-foreground truncate">
                    {u.name}
                  </p>
                  <p className="font-inter text-[11px] text-muted-foreground">
                    {u.trips_planned} Trips Planned
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}