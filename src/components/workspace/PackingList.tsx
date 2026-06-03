import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, ListChecks, MoreHorizontal, CheckCheck, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useTripStore } from "@/stores/useTripStore";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PackItem {
  id: string;
  trip_id: string;
  category: string;
  name: string;
  qty: number;
  is_packed: boolean;
  notes: string | null;
}

const DEFAULT_CATEGORIES = [
  "Documents",
  "Clothing",
  "Toiletries",
  "Electronics",
  "Other",
];

const SEED_PER_CATEGORY: Record<string, string[]> = {
  Documents: ["Passport", "Driver's license", "Travel insurance card"],
  Clothing: ["Underwear ×7", "Socks ×7", "T-shirts ×5", "Outerwear"],
  Toiletries: ["Toothbrush", "Toothpaste", "Sunscreen"],
  Electronics: ["Phone charger", "Adapter", "Headphones"],
  Other: [],
};

export default function PackingList() {
  const activeTrip = useTripStore((s) => s.activeTrip);
  const tripId = activeTrip?.id ?? null;
  const [items, setItems] = useState<PackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCat, setAddCat] = useState("Documents");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("trip_packing_items")
      .select("id, trip_id, category, name, qty, is_packed, notes")
      .eq("trip_id", tripId)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data) setItems(data as PackItem[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, PackItem[]>();
    for (const c of DEFAULT_CATEGORIES) map.set(c, []);
    for (const i of items) {
      if (!map.has(i.category)) map.set(i.category, []);
      map.get(i.category)!.push(i);
    }
    return Array.from(map.entries());
  }, [items]);

  const total = items.length;
  const packed = items.filter((i) => i.is_packed).length;
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;

  async function addItem(category: string, name: string) {
    if (!tripId || !name.trim()) return;
    setAdding(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAdding(false);
      return;
    }
    const { data, error } = await supabase
      .from("trip_packing_items")
      .insert({ trip_id: tripId, user_id: user.id, category, name: name.trim() })
      .select("id, trip_id, category, name, qty, is_packed, notes")
      .single();
    setAdding(false);
    if (error) {
      toast({ title: "Could not add", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setItems((prev) => [...prev, data as PackItem]);
    setAddName("");
  }

  async function toggle(item: PackItem) {
    const next = !item.is_packed;
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, is_packed: next } : p)));
    const { error } = await supabase
      .from("trip_packing_items")
      .update({ is_packed: next })
      .eq("id", item.id);
    if (error) {
      // revert
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, is_packed: !next } : p)),
      );
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  }

  async function remove(id: string) {
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id));
    const { error } = await supabase.from("trip_packing_items").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  }

  async function setAllPacked(value: boolean) {
    if (!tripId || items.length === 0) return;
    const prev = items;
    setItems((p) => p.map((i) => ({ ...i, is_packed: value })));
    const { error } = await supabase
      .from("trip_packing_items")
      .update({ is_packed: value })
      .eq("trip_id", tripId);
    if (error) {
      setItems(prev);
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  }

  async function resetList() {
    if (!tripId || items.length === 0) return;
    if (!confirm("Delete every item from this packing list?")) return;
    const prev = items;
    setItems([]);
    const { error } = await supabase
      .from("trip_packing_items")
      .delete()
      .eq("trip_id", tripId);
    if (error) {
      setItems(prev);
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    }
  }

  async function seedDefaults() {
    if (!tripId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const rows = DEFAULT_CATEGORIES.flatMap((cat) =>
      (SEED_PER_CATEGORY[cat] || []).map((name) => ({
        trip_id: tripId,
        user_id: user.id,
        category: cat,
        name,
      })),
    );
    if (rows.length === 0) return;
    const { data, error } = await supabase
      .from("trip_packing_items")
      .insert(rows)
      .select("id, trip_id, category, name, qty, is_packed, notes");
    if (error) {
      toast({ title: "Seed failed", description: error.message, variant: "destructive" });
      return;
    }
    if (data) setItems((p) => [...p, ...(data as PackItem[])]);
  }

  if (!activeTrip) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center font-inter text-xs text-muted-foreground">
        Select a trip to build a packing list.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
          <h2 className="font-playfair text-sm font-semibold text-foreground">Packing</h2>
          <span className="ml-auto font-inter text-[11px] text-muted-foreground">
            {packed}/{total}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={total === 0}
                title="List actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-inter text-[11px]">
              <DropdownMenuItem onClick={() => setAllPacked(true)}>
                <CheckCheck className="mr-2 h-3 w-3" /> Mark all packed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAllPacked(false)}>
                <XCircle className="mr-2 h-3 w-3" /> Unpack all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={resetList}
                className="text-destructive focus:text-destructive"
              >
                <RotateCcw className="mr-2 h-3 w-3" /> Reset list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Progress value={pct} className="mt-2 h-1.5 bg-secondary" />
      </div>

      {/* Add row */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
        <Select value={addCat} onValueChange={setAddCat}>
          <SelectTrigger className="h-8 w-[120px] rounded-[2px] font-inter text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c} className="font-inter text-[11px]">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="Add item…"
          className="h-8 flex-1 rounded-[2px] font-inter text-[11px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addItem(addCat, addName);
            }
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={adding || !addName.trim()}
          onClick={() => addItem(addCat, addName)}
          title="Add"
        >
          {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="flex items-center gap-1.5 px-1 py-3 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-inter text-[11px]">Loading…</span>
          </div>
        ) : total === 0 ? (
          <div className="space-y-2 py-4 text-center">
            <p className="font-inter text-[11px] text-muted-foreground">No items yet.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={seedDefaults}
              className="h-7 rounded-[2px] font-inter text-[11px]"
            >
              Start with essentials
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([cat, list]) =>
              list.length === 0 ? null : (
                <div key={cat}>
                  <p className="mb-1 font-inter text-[10px] uppercase tracking-widest text-muted-foreground">
                    {cat}
                  </p>
                  <ul className="space-y-0.5">
                    {list.map((i) => (
                      <li
                        key={i.id}
                        className="group flex items-center gap-2 rounded-[2px] px-1 py-1 hover:bg-muted/40"
                      >
                        <Checkbox
                          checked={i.is_packed}
                          onCheckedChange={() => toggle(i)}
                          className="h-3.5 w-3.5"
                        />
                        <span
                          className={cn(
                            "flex-1 truncate font-inter text-[11px] text-foreground",
                            i.is_packed && "line-through text-muted-foreground",
                          )}
                        >
                          {i.name}
                        </span>
                        <button
                          onClick={() => remove(i.id)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}