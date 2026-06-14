import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import StudioWorkbench from "@/components/studio/StudioWorkbench";
import StudioMap from "@/components/studio/StudioMap";
import StudioDesignLab from "@/components/studio/StudioDesignLab";
import { useStudioStore } from "@/stores/useStudioStore";
import SeoHead from "@/components/SeoHead";

export default function Studio() {
  const activeFolder = useStudioStore((s) => s.activeFolder);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <SeoHead
        title="Studio — TML Concierge"
        description="Curate inspiration, capture saved places, and arrange ideas on the proximity map before they land in your trip."
        path="/studio"
        noindex
      />
      {!activeFolder ? (
        <StudioDesignLab />
      ) : (
        <>
          {/* Desktop: 2-column resizable Workbench | Proximity Map */}
          <div className="hidden h-full sm:block">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={60} minSize={40}>
                <StudioWorkbench />
              </ResizablePanel>
              <ResizableHandle className="bg-border" />
              <ResizablePanel defaultSize={40} minSize={25} maxSize={55}>
                <StudioMap />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
          {/* Mobile: workbench only; map opens contextually */}
          <div className="flex h-full flex-col sm:hidden">
            <StudioWorkbench />
          </div>
        </>
      )}
    </div>
  );
}
