import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "sonner";

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
];

export default function TripSettingsModal() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [nightlyBudget, setNightlyBudget] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeTrip) return;
    setCurrency((activeTrip as any).currency || "USD");
    setNightlyBudget(activeTrip.target_nightly_budget?.toString() || "");
    setTotalBudget(activeTrip.total_trip_budget?.toString() || "");
  }, [activeTrip, open]);

  const handleSave = async () => {
    if (!activeTrip) return;
    setSaving(true);
    await updateTrip(activeTrip.id, {
      target_nightly_budget: nightlyBudget ? Number(nightlyBudget) : null,
      total_trip_budget: totalBudget ? Number(totalBudget) : null,
    });
    setSaving(false);
    toast.success("Trip settings saved");
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 font-inter text-[11px] text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-3 w-3" />
        Settings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-playfair text-base">Trip Settings</DialogTitle>
            <DialogDescription className="font-inter text-xs text-muted-foreground">
              Set budget and currency for this trip.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Currency
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-8 font-inter text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="font-inter text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Nightly Budget Target
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 350"
                value={nightlyBudget}
                onChange={(e) => setNightlyBudget(e.target.value)}
                className="h-8 font-inter text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-inter text-[11px] uppercase tracking-widest text-muted-foreground">
                Total Trip Budget
              </Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 12000"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                className="h-8 font-inter text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              className="font-inter text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
