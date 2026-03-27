import { Plus, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IdeasVault() {
  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Ideas Vault
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-accent"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border-thin border-border bg-secondary">
          <Bookmark className="h-4 w-4 text-accent" strokeWidth={1.5} />
        </div>
        <p className="font-inter text-xs text-muted-foreground leading-relaxed">
          Save inspiration links, notes, and ideas here.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-thin border-border font-inter text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Idea
        </Button>
      </div>
    </div>
  );
}
