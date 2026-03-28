import { useState } from "react";
import { Search, Plus, FolderOpen, Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudioStore, StudioFolder } from "@/stores/useStudioStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function StudioVault() {
  const { folders, activeFolder, setActiveFolder, addFolder, deleteFolder } = useStudioStore();
  const [search, setSearch] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderLocation, setFolderLocation] = useState("");

  const filtered = folders.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateFolder = () => {
    if (!folderName.trim()) return;
    addFolder(folderName.trim(), folderLocation.trim() || "Unspecified");
    setFolderName("");
    setFolderLocation("");
    setNewFolderOpen(false);
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h2 className="font-playfair text-sm font-semibold text-foreground">
          Ideas Vault
        </h2>
        <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-accent">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[380px]">
            <DialogHeader>
              <DialogTitle className="font-playfair">New Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="font-inter text-xs">Collection Name</Label>
                <Input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., South of France 2026"
                  className="mt-1 border-thin font-inter text-sm"
                />
              </div>
              <div>
                <Label className="font-inter text-xs">General Location</Label>
                <Input
                  value={folderLocation}
                  onChange={(e) => setFolderLocation(e.target.value)}
                  placeholder="e.g., Provence, France"
                  className="mt-1 border-thin font-inter text-sm"
                />
              </div>
              <Button onClick={handleCreateFolder} className="w-full font-inter text-xs" size="sm">
                Create Collection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections…"
            className="border-thin pl-8 font-inter text-xs h-8"
          />
        </div>
      </div>

      {/* Folder list */}
      <div className="flex-1 overflow-y-auto px-2">
        {filtered.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            isActive={activeFolder?.id === folder.id}
            onSelect={() => setActiveFolder(activeFolder?.id === folder.id ? null : folder)}
            onDelete={() => !folder.is_global && deleteFolder(folder.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-6 text-center font-inter text-xs text-muted-foreground">
            No collections found.
          </p>
        )}
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  isActive,
  onSelect,
  onDelete,
}: {
  folder: StudioFolder;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      onDoubleClick={onSelect}
      onClick={onSelect}
      className={`group flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors ${
        isActive
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border-thin border-border bg-background">
        {folder.is_global ? (
          <Bookmark className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate font-inter text-xs font-medium">{folder.name}</p>
        <p className="truncate font-inter text-[10px] text-muted-foreground">
          {folder.location} · {folder.items.length} items
        </p>
      </div>
      {!folder.is_global && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </button>
  );
}
