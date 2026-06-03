import { useState } from "react";
import { Loader2, Instagram, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
}

export default function PasteSocialDialog({ open, onOpenChange, onImported }: Props) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setUrl("");
    setNote("");
    setLoading(false);
  };

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-social-post", {
        body: { url: trimmed, note: note.trim() || null },
      });
      if (error) throw error;
      const status = data?.import?.status;
      if (status === "failed") {
        toast.warning("We couldn't read that post automatically — open it in the tray to add caption manually.");
      } else {
        const count = data?.import?.extracted_items?.length ?? 0;
        toast.success(
          count > 0
            ? `Imported ${count} place${count === 1 ? "" : "s"} — review in the tray.`
            : "Post staged for review.",
        );
      }
      onImported?.();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      console.error("ingest-social-post error", err);
      toast.error(err?.message ?? "Failed to ingest post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md border-thin">
        <DialogHeader>
          <DialogTitle className="font-playfair text-base flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            Paste Social Link
          </DialogTitle>
          <DialogDescription className="font-inter text-xs text-muted-foreground">
            Drop an Instagram or TikTok travel post — we'll extract the destination and places into a review tray.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
              Post URL
            </Label>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://instagram.com/p/... or https://tiktok.com/@.../video/..."
              className="border-thin font-inter text-xs h-9 mt-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && url.trim()) handleSubmit();
              }}
            />
          </div>

          <div>
            <Label className="font-inter text-[10px] uppercase tracking-wider text-muted-foreground">
              Note (optional)
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any context to help the concierge…"
              className="border-thin font-inter text-xs mt-1 min-h-[60px]"
            />
          </div>

          <p className="font-inter text-[10px] text-muted-foreground flex items-start gap-1.5 pt-1">
            <Instagram className="h-3 w-3 mt-[1px] shrink-0" />
            Instagram's public preview is limited — if a post doesn't auto-parse, you can paste the caption inside the review tray.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="border-thin font-inter text-xs"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="font-inter text-xs gap-1"
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? "Ingesting…" : "Ingest Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}