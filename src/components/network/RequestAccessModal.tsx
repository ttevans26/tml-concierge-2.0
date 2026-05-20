import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface Props {
  open: boolean;
  name: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RequestAccessModal({ open, name, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm rounded-sm border-thin border-foreground/15">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <Lock className="h-4 w-4 text-accent" strokeWidth={1.5} />
          </div>
          <DialogTitle className="text-center font-playfair text-base font-semibold">
            Request access
          </DialogTitle>
          <DialogDescription className="text-center font-inter text-xs text-muted-foreground">
            {name
              ? `${name} keeps a private profile. We'll send a connection request — you'll be notified when they respond.`
              : "We'll send a connection request — you'll be notified when they respond."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel} className="font-inter text-xs">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="font-inter text-xs">
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}