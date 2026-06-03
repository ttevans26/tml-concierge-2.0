import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  ExternalLink,
  Download,
  Image as ImageIcon,
  FileArchive,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface Doc {
  id: string;
  trip_id: string;
  path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  notes: string | null;
  created_at: string;
}

const DOC_KINDS = ["passport", "visa", "insurance", "voucher", "ticket", "other"];

function iconForMime(mime?: string | null) {
  if (!mime) return FileText;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.includes("zip") || mime.includes("compressed")) return FileArchive;
  return FileText;
}

function fmtSize(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function TripDocuments() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const tripId = activeTrip?.id ?? null;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<string>("other");
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trip_documents")
      .select("id, trip_id, path, original_name, mime_type, size_bytes, kind, notes, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (!error && data) setDocs(data as Doc[]);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !tripId) return;
    setUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${tripId}/${crypto.randomUUID()}-${safeName}`;
    const up = await supabase.storage.from("trip-documents").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (up.error) {
      setUploading(false);
      toast({ title: "Upload failed", description: up.error.message, variant: "destructive" });
      return;
    }
    const ins = await supabase
      .from("trip_documents")
      .insert({
        trip_id: tripId,
        user_id: user.id,
        path,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        kind,
      })
      .select("id, trip_id, path, original_name, mime_type, size_bytes, kind, notes, created_at")
      .single();
    setUploading(false);
    if (ins.error) {
      toast({ title: "Save failed", description: ins.error.message, variant: "destructive" });
      // Best-effort cleanup
      await supabase.storage.from("trip-documents").remove([path]);
      return;
    }
    if (ins.data) {
      setDocs((d) => [ins.data as Doc, ...d]);
      toast({ title: "Uploaded", description: file.name });
    }
  }

  async function openDoc(doc: Doc) {
    const { data, error } = await supabase.storage
      .from("trip-documents")
      .createSignedUrl(doc.path, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: "Open failed", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadDoc(doc: Doc) {
    const { data, error } = await supabase.storage
      .from("trip-documents")
      .createSignedUrl(doc.path, 3600, { download: doc.original_name });
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    window.location.href = data.signedUrl;
  }

  async function removeDoc(doc: Doc) {
    if (!confirm(`Delete ${doc.original_name}?`)) return;
    const prev = docs;
    setDocs((d) => d.filter((x) => x.id !== doc.id));
    const r1 = await supabase.storage.from("trip-documents").remove([doc.path]);
    const r2 = await supabase.from("trip_documents").delete().eq("id", doc.id);
    if (r1.error || r2.error) {
      setDocs(prev);
      toast({
        title: "Delete failed",
        description: r1.error?.message || r2.error?.message,
        variant: "destructive",
      });
    }
  }

  async function renameDoc(doc: Doc) {
    const next = prompt("Rename document", doc.original_name)?.trim();
    if (!next || next === doc.original_name) return;
    const prev = docs;
    setDocs((d) => d.map((x) => (x.id === doc.id ? { ...x, original_name: next } : x)));
    const { error } = await supabase
      .from("trip_documents")
      .update({ original_name: next })
      .eq("id", doc.id);
    if (error) {
      setDocs(prev);
      toast({ title: "Rename failed", description: error.message, variant: "destructive" });
    }
  }

  async function updateDocKind(doc: Doc, nextKind: string) {
    const prev = docs;
    setDocs((d) => d.map((x) => (x.id === doc.id ? { ...x, kind: nextKind } : x)));
    const { error } = await supabase
      .from("trip_documents")
      .update({ kind: nextKind })
      .eq("id", doc.id);
    if (error) {
      setDocs(prev);
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  }

  function triggerReplace(docId: string) {
    setReplaceTargetId(docId);
    replaceRef.current?.click();
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const targetId = replaceTargetId;
    setReplaceTargetId(null);
    if (!file || !targetId || !tripId) return;
    const target = docs.find((x) => x.id === targetId);
    if (!target) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${tripId}/${crypto.randomUUID()}-${safeName}`;
    const up = await supabase.storage.from("trip-documents").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (up.error) {
      setUploading(false);
      toast({ title: "Replace failed", description: up.error.message, variant: "destructive" });
      return;
    }
    const updated = await supabase
      .from("trip_documents")
      .update({
        path,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      })
      .eq("id", targetId)
      .select("id, trip_id, path, original_name, mime_type, size_bytes, kind, notes, created_at")
      .single();
    setUploading(false);
    if (updated.error) {
      await supabase.storage.from("trip-documents").remove([path]);
      toast({ title: "Replace failed", description: updated.error.message, variant: "destructive" });
      return;
    }
    // Best-effort cleanup of old file
    await supabase.storage.from("trip-documents").remove([target.path]);
    if (updated.data) {
      setDocs((d) => d.map((x) => (x.id === targetId ? (updated.data as Doc) : x)));
      toast({ title: "Replaced", description: file.name });
    }
  }

  if (!activeTrip) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center font-inter text-xs text-muted-foreground">
        Select a trip to upload documents.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <h2 className="font-playfair text-sm font-semibold text-foreground">Documents</h2>
          <span className="ml-auto font-inter text-[11px] text-muted-foreground">
            {docs.length}
          </span>
        </div>
        <p className="mt-1 font-inter text-[10px] text-muted-foreground">
          Private to you. Signed URLs expire in 1 hour.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-8 w-[120px] rounded-[2px] font-inter text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_KINDS.map((k) => (
              <SelectItem key={k} value={k} className="font-inter text-[11px] capitalize">
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={handleFile}
          accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
        />
        <input
          ref={replaceRef}
          type="file"
          hidden
          onChange={handleReplaceFile}
          accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
        />
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-8 rounded-[2px] font-inter text-[11px]"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="mr-1 h-3.5 w-3.5" />
              Upload
            </>
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex items-center gap-1.5 px-1 py-3 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-inter text-[11px]">Loading…</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-6 text-center font-inter text-[11px] text-muted-foreground">
            No documents yet. Upload passport scans, insurance, vouchers, or any PDF.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {docs.map((d) => {
              const Icon = iconForMime(d.mime_type);
              return (
                <li
                  key={d.id}
                  className="group flex items-start gap-2 rounded-[2px] border border-border bg-background px-2 py-2"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-inter text-[11px] font-medium text-foreground">
                      {d.original_name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Select value={d.kind} onValueChange={(v) => updateDocKind(d, v)}>
                        <SelectTrigger className="h-5 w-[88px] rounded-[2px] border-none bg-transparent px-1 py-0 font-inter text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-muted">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DOC_KINDS.map((k) => (
                            <SelectItem key={k} value={k} className="font-inter text-[11px] capitalize">
                              {k}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
                        · {fmtSize(d.size_bytes)} · {format(parseISO(d.created_at), "MMM d")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openDoc(d)}
                      className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Open"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => downloadDoc(d)}
                      className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => renameDoc(d)}
                      className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Rename"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => triggerReplace(d.id)}
                      className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Replace file"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeDoc(d)}
                      className="rounded-[2px] p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}