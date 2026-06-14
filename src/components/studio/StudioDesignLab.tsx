import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import StudioVault from "./StudioVault";
import StudioMap from "./StudioMap";
import PasteSocialDialog from "./PasteSocialDialog";
import SocialImportsTray from "./SocialImportsTray";

/**
 * Studio landing surface when no folder is active.
 * Full-width header band at the top, then a 2-column body
 * (Ideas Vault | Proximity Map) on desktop, stacked on mobile.
 */
export default function StudioDesignLab() {
  const [pasteSocialOpen, setPasteSocialOpen] = useState(false);
  const [socialRefreshKey, setSocialRefreshKey] = useState(0);

  return (
    <div className="flex h-full flex-col bg-surface-1">
      {/* Full-width editorial header band */}
      <header className="border-b border-border bg-card px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-inter text-[10px] font-semibold uppercase tracking-[0.3em] text-accent">
              Design Lab
            </p>
            <h1 className="mt-1 font-display-md text-ink">
              The <span className="italic-accent text-accent">atlas</span> of your ideas
            </h1>
            <p className="mt-2 max-w-2xl font-inter text-[12px] leading-relaxed text-muted-foreground">
              Open a collection from the vault to start curating — the atlas on
              the right will focus once a destination is in view. Or seed a
              fresh idea from a social link.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="foilOutline"
              className="h-9 min-h-[44px] gap-1.5 font-inter text-xs"
              onClick={() => setPasteSocialOpen(true)}
            >
              <Share2 className="h-3.5 w-3.5" /> Paste Social Link
            </Button>
            <SocialImportsTray refreshKey={socialRefreshKey} />
          </div>
        </div>
      </header>

      {/* Two-column body */}
      <div className="flex-1 min-h-0">
        {/* Desktop: resizable split. Mobile: stacked. */}
        <div className="hidden h-full sm:block">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={38} minSize={26} maxSize={55}>
              <StudioVault />
            </ResizablePanel>
            <ResizableHandle className="bg-border" />
            <ResizablePanel defaultSize={62} minSize={40}>
              <StudioMap />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <div className="flex h-full flex-col sm:hidden">
          <div className="flex-1 min-h-0">
            <StudioVault />
          </div>
        </div>
      </div>

      <PasteSocialDialog
        open={pasteSocialOpen}
        onOpenChange={setPasteSocialOpen}
        onImported={() => setSocialRefreshKey((k) => k + 1)}
      />
    </div>
  );
}