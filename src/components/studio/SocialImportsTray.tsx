import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Inbox, Trash2, Check, X, Loader2, ExternalLink, FolderPlus, Folder } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStudioStore, StudioCategory } from "@/stores/useStudioStore";

interface ExtractedItem {
  title: string;
  category: StudioCategory;
  address: string | null;
  note: string | null;
  keep: boolean;
}

interface SocialImport {
  id: string;
  source_url: string;
  platform: string;
  caption: string | null;
  thumbnail_url: string | null;
  author: string | null;
  detected_destination: string | null;
  suggested_folder_id: string | null;
  extracted_items: ExtractedItem[];
  status: string;
  error: string | null;
  note: string | null;
  created_at: string;
}

interface Props {
  refreshKey?: number;
}

const CATS: { value: StudioCategory; label: string }[] = [
  { value: "stays", label: "Stays" },
  { value: "dining", label: "Dining" },
  { value: "activity", label: "Activity" },
  { value: "sites", label: "Site" },
];

export default function SocialImportsTray({ refreshKey }: Props) {
  const { folders, addFolder, addItem, fetchFolders } = useStudioStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imports, setImports] = useState<SocialImport[]>([]);
  const [committing, setCommitting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("studio_social_imports")
      .select("*")
      .in("status", ["pending", "failed"])
      .order("created_at", { ascending: false });
    if (!error && data) setImports(data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Realtime updates — scoped to this user so we don't fan out
    // every other tenant's writes to this client.
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid || cancelled) return;
      ch = supabase
        .channel(`studio_social_imports:${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "studio_social_imports",
            filter: `user_id=eq.${uid}`,
          },
          () => load(),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const pendingCount = imports.length;

  const updateImport = (id: string, patch: Partial<SocialImport>) => {
    setImports((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const updateItem = (importId: string, idx: number, patch: Partial<ExtractedItem>) => {
    setImports((prev) =>
      prev.map((imp) =>
        imp.id === importId
          ? {
              ...imp,
              extracted_items: imp.extracted_items.map((it, i) =>
                i === idx ? { ...it, ...patch } : it,
              ),
            }
          : imp,
      ),
    );
  };

  const addBlankItem = (importId: string) => {
    setImports((prev) =>
      prev.map((imp) =>
        imp.id === importId
          ? {
              ...imp,
              extracted_items: [
                ...imp.extracted_items,
                { title: "", category: "activity", address: null, note: null, keep: true },
              ],
            }
          : imp,
      ),
    );
  };

  const discard = async (id: string) => {
    await supabase.from("studio_social_imports").update({ status: "discarded" }).eq("id", id);
    setImports((prev) => prev.filter((i) => i.id !== id));
    toast.message("Import discarded.");
  };

  const commit = async (imp: SocialImport, targetFolderId: string | null, newFolderName: string) => {
    const kept = imp.extracted_items.filter((i) => i.keep && i.title.trim());
    if (kept.length === 0) {
      toast.error("Mark at least one item to keep.");
      return;
    }

    setCommitting(imp.id);
    try {
      let folderId = targetFolderId;
      if (!folderId) {
        const name = newFolderName.trim() || imp.detected_destination?.trim() || "New Inspiration";
        const folder = await addFolder(name, imp.detected_destination?.trim() || name);
        if (!folder) throw new Error("Could not create folder.");
        folderId = folder.id;
      }

      for (const item of kept) {
        await addItem(folderId, {
          category: item.category,
          title: item.title.trim(),
          description: item.note ?? null,
          address: item.address ?? null,
          url: null,
          lat: null,
          lng: null,
          cost: null,
          google_place_id: null,
          source_url: imp.source_url,
          api_metadata: { social_platform: imp.platform, author: imp.author },
        });
      }

      await supabase
        .from("studio_social_imports")
        .update({ status: "committed", suggested_folder_id: folderId })
        .eq("id", imp.id);

      await fetchFolders();
      setImports((prev) => prev.filter((i) => i.id !== imp.id));
      toast.success(`Added ${kept.length} item${kept.length === 1 ? "" : "s"}.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Commit failed.");
    } finally {
      setCommitting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-thin font-inter text-xs h-8 gap-1 relative"
          title="Social imports review tray"
        >
          <Inbox className="h-3 w-3" />
          Social
          {pendingCount > 0 && (
            <Badge className="ml-1 h-4 min-w-[16px] px-1 text-[9px]" variant="default">
              {pendingCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-playfair text-base">Social Imports</SheetTitle>
          <p className="font-inter text-[11px] text-muted-foreground">
            Review posts shared into TML. Commit creates the folder if needed.
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 font-inter text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </div>
          )}
          {!loading && imports.length === 0 && (
            <p className="font-inter text-xs text-muted-foreground">
              Nothing pending. Use "Paste Social Link" to ingest an Instagram or TikTok post.
            </p>
          )}

          {imports.map((imp) => (
            <ImportCard
              key={imp.id}
              imp={imp}
              folders={folders}
              committing={committing === imp.id}
              onUpdate={(patch) => updateImport(imp.id, patch)}
              onUpdateItem={(idx, patch) => updateItem(imp.id, idx, patch)}
              onAddItem={() => addBlankItem(imp.id)}
              onDiscard={() => discard(imp.id)}
              onCommit={(folderId, newName) => commit(imp, folderId, newName)}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface CardProps {
  imp: SocialImport;
  folders: ReturnType<typeof useStudioStore.getState>["folders"];
  committing: boolean;
  onUpdate: (p: Partial<SocialImport>) => void;
  onUpdateItem: (idx: number, p: Partial<ExtractedItem>) => void;
  onAddItem: () => void;
  onDiscard: () => void;
  onCommit: (folderId: string | null, newFolderName: string) => void;
}

function ImportCard({
  imp, folders, committing, onUpdate, onUpdateItem, onAddItem, onDiscard, onCommit,
}: CardProps) {
  const [folderChoice, setFolderChoice] = useState<string>(
    imp.suggested_folder_id ?? "__new__",
  );
  const [newFolderName, setNewFolderName] = useState<string>(
    imp.detected_destination ?? "",
  );

  return (
    <div className="rounded-sm border-thin border-border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex gap-3">
        {imp.thumbnail_url ? (
          <img
            src={imp.thumbnail_url}
            alt=""
            className="h-16 w-16 rounded-sm object-cover border-thin border-border"
          />
        ) : (
          <div className="h-16 w-16 rounded-sm bg-muted flex items-center justify-center text-[10px] text-muted-foreground border-thin border-border">
            {imp.platform}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] capitalize">{imp.platform}</Badge>
            {imp.status === "failed" && (
              <Badge variant="destructive" className="text-[9px]">Parse failed</Badge>
            )}
            <a
              href={imp.source_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {imp.author && (
            <p className="font-inter text-[10px] text-muted-foreground mt-1">@{imp.author}</p>
          )}
          {imp.detected_destination && (
            <p className="font-inter text-[11px] font-medium text-accent mt-0.5">
              📍 {imp.detected_destination}
            </p>
          )}
        </div>
      </div>

      {/* Caption (editable for failed/empty) */}
      <div>
        <Textarea
          value={imp.caption ?? ""}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder={
            imp.status === "failed"
              ? "Paste the caption here to help the concierge extract places…"
              : "Caption…"
          }
          className="border-thin font-inter text-[11px] min-h-[60px]"
        />
      </div>

      {/* Folder target */}
      <div className="space-y-1.5">
        <p className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
          Target Folder
        </p>
        <Select value={folderChoice} onValueChange={setFolderChoice}>
          <SelectTrigger className="h-8 border-thin font-inter text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__new__">
              <span className="flex items-center gap-1.5">
                <FolderPlus className="h-3 w-3" /> Create new folder…
              </span>
            </SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span className="flex items-center gap-1.5">
                  <Folder className="h-3 w-3" /> {f.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {folderChoice === "__new__" && (
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name (e.g., Lisbon)"
            className="h-8 border-thin font-inter text-xs"
          />
        )}
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
            Items ({imp.extracted_items.filter((i) => i.keep).length}/{imp.extracted_items.length})
          </p>
          <button
            onClick={onAddItem}
            className="font-inter text-[10px] text-accent hover:underline"
          >
            + Add row
          </button>
        </div>
        <div className="space-y-1.5">
          {imp.extracted_items.length === 0 && (
            <p className="font-inter text-[10px] text-muted-foreground italic">
              No items extracted. Add manually or discard.
            </p>
          )}
          {imp.extracted_items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-1.5 rounded-sm border-thin border-border bg-secondary/30 px-2 py-1.5 ${
                !item.keep ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() => onUpdateItem(idx, { keep: !item.keep })}
                className={`h-5 w-5 shrink-0 rounded-sm border-thin flex items-center justify-center ${
                  item.keep ? "bg-accent border-accent text-accent-foreground" : "border-border"
                }`}
              >
                {item.keep && <Check className="h-3 w-3" />}
              </button>
              <Input
                value={item.title}
                onChange={(e) => onUpdateItem(idx, { title: e.target.value })}
                placeholder="Title"
                className="h-6 flex-1 border-0 bg-transparent font-inter text-[11px] px-1 focus-visible:ring-0"
              />
              <Select
                value={item.category}
                onValueChange={(v) => onUpdateItem(idx, { category: v as StudioCategory })}
              >
                <SelectTrigger className="h-6 w-20 border-thin font-inter text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-[11px]">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="font-inter text-xs h-7 gap-1 text-muted-foreground"
          onClick={onDiscard}
          disabled={committing}
        >
          <Trash2 className="h-3 w-3" /> Discard
        </Button>
        <Button
          size="sm"
          className="font-inter text-xs h-7 gap-1"
          disabled={committing}
          onClick={() =>
            onCommit(folderChoice === "__new__" ? null : folderChoice, newFolderName)
          }
        >
          {committing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {committing ? "Adding…" : "Add to Vault"}
        </Button>
      </div>
    </div>
  );
}