import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import StudioVault from "@/components/studio/StudioVault";
import StudioWorkbench from "@/components/studio/StudioWorkbench";
import StudioMap from "@/components/studio/StudioMap";
import { useStudioStore } from "@/stores/useStudioStore";

export default function Studio() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left — Ideas Vault */}
        <ResizablePanel defaultSize={22} minSize={16} maxSize={30}>
          <StudioVault />
        </ResizablePanel>

        <ResizableHandle className="bg-border" />

        {/* Center — Workbench */}
        <ResizablePanel defaultSize={48} minSize={30}>
          <StudioWorkbench />
        </ResizablePanel>

        <ResizableHandle className="bg-border" />

        {/* Right — Proximity Map */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
          <StudioMap />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
