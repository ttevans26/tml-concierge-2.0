import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import StudioVault from "./StudioVault";
import { useStudioStore } from "@/stores/useStudioStore";
import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Slide-in overlay listing all Studio folders so the user can switch
 * collections while a folder is active. Auto-closes when the active
 * folder changes.
 */
export default function FolderSwitcherDrawer({ open, onOpenChange }: Props) {
  const activeFolderId = useStudioStore((s) => s.activeFolder?.id);
  const lastIdRef = useRef<string | undefined>(activeFolderId);

  useEffect(() => {
    if (!open) {
      lastIdRef.current = activeFolderId;
      return;
    }
    if (activeFolderId !== lastIdRef.current) {
      lastIdRef.current = activeFolderId;
      onOpenChange(false);
    }
  }, [activeFolderId, open, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] p-0 sm:w-[340px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-left font-playfair text-sm">
            Collections
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-3rem)]">
          <StudioVault />
        </div>
      </SheetContent>
    </Sheet>
  );
}