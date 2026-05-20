import { Lock, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { NetworkUser } from "@/stores/useTripStore";

interface Props {
  user: NetworkUser;
  variant?: "tile" | "row";
  onFollow: (id: string) => void;
  onRequestAccess: (user: NetworkUser) => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProfileCard({ user, variant = "tile", onFollow, onRequestAccess }: Props) {
  const actionLabel = (() => {
    if (user.status === "connected") return "Connected";
    if (user.status === "pending") return "Pending";
    return user.is_public ? "Follow" : "Request Access";
  })();

  const handleAction = () => {
    if (user.status !== "none") return;
    if (user.is_public) onFollow(user.id);
    else onRequestAccess(user);
  };

  const buttonVariant =
    user.status === "connected" ? "outline" : user.status === "pending" ? "ghost" : "default";

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 border-thin border-foreground/15 bg-card px-3 py-3 rounded-sm">
        <Avatar className="h-10 w-10 rounded-full">
          <AvatarFallback className="bg-accent/15 font-inter text-xs text-accent">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-playfair text-sm font-semibold text-foreground truncate">
              {user.name}
            </span>
            {user.is_public ? (
              <Globe className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
            ) : (
              <Lock className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
            )}
          </div>
          <p className="font-inter text-[11px] text-muted-foreground">
            {user.trips_planned} Trips Planned
          </p>
        </div>
        <Button
          size="sm"
          variant={buttonVariant}
          disabled={user.status !== "none"}
          onClick={handleAction}
          className={cn(
            "min-h-[36px] rounded-sm font-inter text-xs",
            user.status === "connected" && "gap-1.5",
          )}
        >
          {user.status === "connected" && <Check className="h-3 w-3" strokeWidth={2} />}
          {actionLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-44 shrink-0 snap-start flex-col items-center gap-2 border-thin border-foreground/15 bg-card p-4 rounded-sm">
      <Avatar className="h-14 w-14 rounded-full">
        <AvatarFallback className="bg-accent/15 font-inter text-sm text-accent">
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1">
        <span className="font-playfair text-sm font-semibold text-foreground text-center leading-tight">
          {user.name}
        </span>
        {user.is_public ? (
          <Globe className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
        ) : (
          <Lock className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
        )}
      </div>
      <p className="font-inter text-[11px] text-muted-foreground">
        {user.trips_planned} Trips Planned
      </p>
      <Button
        size="sm"
        variant={buttonVariant}
        disabled={user.status !== "none"}
        onClick={handleAction}
        className={cn("w-full min-h-[36px] rounded-sm font-inter text-xs mt-1")}
      >
        {user.status === "connected" && <Check className="h-3 w-3 mr-1" strokeWidth={2} />}
        {actionLabel}
      </Button>
    </div>
  );
}