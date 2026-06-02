import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/native";

/** Subtle pill that appears in the header when the device is offline. */
export default function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-1 rounded-sm border-thin border-[hsl(var(--accent-bronze)/0.4)] bg-[hsl(var(--accent-bronze)/0.08)] px-1.5 py-0.5 font-inter text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--accent-bronze))]"
      title="Showing locally cached data"
    >
      <CloudOff className="h-3 w-3" strokeWidth={1.5} />
      Offline
    </div>
  );
}