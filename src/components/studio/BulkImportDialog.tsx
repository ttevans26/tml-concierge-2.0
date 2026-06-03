import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StudioCategory } from "@/stores/useStudioStore";

export interface ImportedPendingItem {
  id: string;
  title: string;
  address: string | null;
  url: string | null;
  category: StudioCategory;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: (items: ImportedPendingItem[]) => void;
}

const MAX_FILE_MB = 8;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeCategory(c: unknown): StudioCategory {
  return ["stays", "dining", "activity", "sites"].includes(c as string)
    ? (c as StudioCategory)
    : "activity";
}

export default function BulkImportDialog({ open, onOpenChange, onImported }: Props) {
  const [tab, setTab] = useState<"urls" | "files">("urls");
  const [urlsText, setUrlsText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const urls = urlsText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const ok: File[] = [];
    for (const f of Array.from(incoming)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} is over ${MAX_FILE_MB} MB`);
        continue;
      }
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok]);
  };

  const removeFile = (i: number) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleRun = async () => {
    if (urls.length === 0 && files.length === 0) {
      toast.error("Add URLs or files first.");
      return;
    }
    setBusy(true);
    try {
      const filePayload = await Promise.all(
        files.map(async (f) => ({
          filename: f.name,
          mime: f.type || "application/octet-stream",
          dataBase64: await readFileAsBase64(f),
        })),
      );

      const { data, error } = await supabase.functions.invoke("scrape-and-parse", {
        body: { urls, files: filePayload },
      });
      if (error) throw error;
      const items = (data?.items ?? []) as any[];
      const mapped: ImportedPendingItem[] = items.map((it) => ({
        id: crypto.randomUUID(),
        title: it.title || "Untitled",
        address: it.address || null,
        url: it.url || it.source_url || null,
        category: normalizeCategory(it.category),
        description: it.description || null,
      }));

      const failed = (data?.results ?? []).filter((r: any) => !r.ok);
      if (failed.length > 0) {
        toast.warning(`${failed.length} source${failed.length !== 1 ? "s" : ""} failed`);
      }

      if (mapped.length === 0) {
        toast.info("No items extracted.");
      } else {
        onImported(mapped);
        toast.success(`Imported ${mapped.length} item${mapped.length !== 1 ? "s" : ""} for review`);
        setUrlsText("");
        setFiles([]);
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Bulk import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-playfair">Bulk Import</DialogTitle>
          <DialogDescription className="font-inter text-xs">
            Paste multiple URLs or upload PDFs/screenshots. Extracted items land in the Review tray.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "urls" | "files")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="urls">URLs ({urls.length})</TabsTrigger>
            <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="urls" className="mt-3 space-y-2">
            <Textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={"One URL per line\nhttps://cntraveler.com/...\nhttps://example.com/..."}
              className="min-h-[180px] font-mono text-xs"
              disabled={busy}
            />
            <p className="font-inter text-[10px] text-muted-foreground">
              {urls.length} valid URL{urls.length !== 1 ? "s" : ""} detected
            </p>
          </TabsContent>

          <TabsContent value="files" className="mt-3 space-y-2">
            <label
              className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border bg-muted/20 transition-colors hover:border-accent hover:bg-accent/5"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="font-inter text-xs text-foreground">
                Click to upload PDFs or screenshots
              </span>
              <span className="font-inter text-[10px] text-muted-foreground">
                Up to {MAX_FILE_MB} MB each
              </span>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => addFiles(e.target.files)}
                disabled={busy}
              />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => {
                  const Icon = f.type.startsWith("image/") ? ImageIcon : FileText;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1.5"
                    >
                      <Icon className="h-3.5 w-3.5 text-accent" />
                      <span className="flex-1 truncate font-inter text-xs">
                        {f.name}
                      </span>
                      <span className="font-inter text-[10px] text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={busy}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleRun} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Parsing…" : "Extract"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}