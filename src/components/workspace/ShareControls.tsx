import { useState } from "react";
import { Globe, Lock, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "sonner";

export default function ShareControls() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (!activeTrip) return null;

  const isPublic = activeTrip.is_published;
  const shareUrl = activeTrip.share_token
    ? `${window.location.origin}/itinerary/${activeTrip.share_token}`
    : "";

  const handleToggle = async () => {
    setToggling(true);
    await updateTrip(activeTrip.id, { is_published: !isPublic });
    toast.success(isPublic ? "Trip set to Private" : "Trip set to Public");
    setToggling(false);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Intelligence link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] gap-1.5 touch-manipulation font-inter text-xs"
        >
          {isPublic ? (
            <Globe className="h-3.5 w-3.5 text-accent" />
          ) : (
            <Lock className="h-3.5 w-3.5" />
          )}
          <span>{isPublic ? "Public" : "Private"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-playfair text-sm font-semibold text-foreground">
              Strategic Sharing
            </h4>
            <p className="mt-0.5 font-inter text-[10px] text-muted-foreground leading-relaxed">
              Public mode shares logistics with financial data redacted.
            </p>
          </div>

          <Button
            variant={isPublic ? "destructive" : "default"}
            size="sm"
            className="w-full min-h-[44px] font-inter text-xs touch-manipulation"
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling
              ? "Updating…"
              : isPublic
              ? "Set to Private"
              : "Set to Public"}
          </Button>

          {isPublic && shareUrl && (
            <div className="space-y-2">
              <div className="rounded-sm border border-border bg-secondary/30 px-2.5 py-2">
                <p className="break-all font-inter text-[9px] text-muted-foreground">
                  {shareUrl}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full min-h-[44px] gap-1.5 font-inter text-xs touch-manipulation"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy Intelligence Link"}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
