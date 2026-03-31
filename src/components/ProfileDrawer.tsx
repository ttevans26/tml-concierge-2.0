import { LogOut, Settings, Users, ChevronLeft, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface TravelPreferences {
  hotelStarRating: string;
  minReviewScore: string;
  loyaltyPrograms: string[];
  amenities: string[];
  innerCity: boolean;
  coastal: boolean;
}

const DEFAULT_PREFS: TravelPreferences = {
  hotelStarRating: "5",
  minReviewScore: "4.5",
  loyaltyPrograms: [],
  amenities: [],
  innerCity: true,
  coastal: true,
};

const LOYALTY_OPTIONS = [
  "Marriott Bonvoy",
  "World of Hyatt",
  "Hilton Honors",
  "Accor",
  "Four Seasons",
  "Aman",
  "Rosewood",
];

const AMENITY_OPTIONS = ["Spa", "Pool", "Gym", "AC"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({ open, onOpenChange }: Props) {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<"menu" | "preferences">("menu");
  const [prefs, setPrefs] = useState<TravelPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.preferences && typeof data.preferences === "object") {
      const p = data.preferences as Record<string, unknown>;
      setPrefs({
        hotelStarRating: (p.hotelStarRating as string) ?? DEFAULT_PREFS.hotelStarRating,
        minReviewScore: (p.minReviewScore as string) ?? DEFAULT_PREFS.minReviewScore,
        loyaltyPrograms: (p.loyaltyPrograms as string[]) ?? [],
        amenities: (p.amenities as string[]) ?? [],
        innerCity: p.innerCity !== undefined ? Boolean(p.innerCity) : true,
        coastal: p.coastal !== undefined ? Boolean(p.coastal) : true,
      });
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (open && user && !loaded) loadPrefs();
  }, [open, user, loaded, loadPrefs]);

  useEffect(() => {
    if (!open) {
      setView("menu");
      setLoaded(false);
    }
  }, [open]);

  const savePrefs = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ preferences: JSON.parse(JSON.stringify(prefs)) })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save preferences");
    } else {
      toast.success("Preferences saved");
    }
  };

  const toggleLoyalty = (program: string) => {
    setPrefs((p) => ({
      ...p,
      loyaltyPrograms: p.loyaltyPrograms.includes(program)
        ? p.loyaltyPrograms.filter((l) => l !== program)
        : [...p.loyaltyPrograms, program],
    }));
  };

  const toggleAmenity = (amenity: string) => {
    setPrefs((p) => ({
      ...p,
      amenities: p.amenities.includes(amenity)
        ? p.amenities.filter((a) => a !== amenity)
        : [...p.amenities, amenity],
    }));
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 bg-background p-6 overflow-y-auto">
        {view === "menu" ? (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="font-playfair text-lg font-semibold text-foreground">
                Profile
              </SheetTitle>
              <SheetDescription className="font-inter text-xs text-muted-foreground">
                {user?.email ?? "—"}
              </SheetDescription>
            </SheetHeader>

            <Separator className="my-5" />

            <nav className="flex flex-col gap-1">
              <Button
                variant="ghost"
                onClick={() => setView("preferences")}
                className="justify-start gap-2.5 font-inter text-sm text-foreground"
              >
                <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                Travel Preferences
              </Button>

              <Button
                variant="ghost"
                className="justify-start gap-2.5 font-inter text-sm text-foreground"
              >
                <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                Travel Network
              </Button>
            </nav>

            <Separator className="my-5" />

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-2.5 font-inter text-sm text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("menu")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-playfair text-base font-semibold text-foreground">
                Travel Preferences
              </h2>
            </div>

            <SheetHeader className="sr-only">
              <SheetTitle>Travel Preferences</SheetTitle>
              <SheetDescription>Configure your global travel quality standards</SheetDescription>
            </SheetHeader>

            <div className="space-y-5">
              {/* Quality Benchmarks */}
              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Quality Benchmarks
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-inter text-sm text-foreground">Hotel Star Rating</span>
                    <Select value={prefs.hotelStarRating} onValueChange={(v) => setPrefs((p) => ({ ...p, hotelStarRating: v }))}>
                      <SelectTrigger className="w-20 h-8 text-xs border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4★</SelectItem>
                        <SelectItem value="5">5★</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-inter text-sm text-foreground">Min Review Score</span>
                    <Select value={prefs.minReviewScore} onValueChange={(v) => setPrefs((p) => ({ ...p, minReviewScore: v }))}>
                      <SelectTrigger className="w-20 h-8 text-xs border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4.0">4.0</SelectItem>
                        <SelectItem value="4.2">4.2</SelectItem>
                        <SelectItem value="4.5">4.5</SelectItem>
                        <SelectItem value="4.8">4.8</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <Separator />

              {/* Loyalty Ecosystem */}
              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Loyalty Ecosystem
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {LOYALTY_OPTIONS.map((program) => (
                    <label key={program} className="flex items-center gap-2.5 cursor-pointer group">
                      <Checkbox
                        checked={prefs.loyaltyPrograms.includes(program)}
                        onCheckedChange={() => toggleLoyalty(program)}
                        className="border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                      />
                      <span className="font-inter text-sm text-foreground group-hover:text-foreground/80 transition-colors">
                        {program}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <Separator />

              {/* Mandatory Amenities */}
              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Mandatory Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((amenity) => {
                    const active = prefs.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        onClick={() => toggleAmenity(amenity)}
                        className={`px-3 py-1.5 rounded-sm border font-inter text-xs transition-colors ${
                          active
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent text-foreground border-border hover:border-foreground/50"
                        }`}
                      >
                        {amenity}
                      </button>
                    );
                  })}
                </div>
              </section>

              <Separator />

              {/* Environment Selection */}
              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Environment
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-inter text-xs text-muted-foreground">Outskirt</span>
                    <Switch
                      checked={prefs.innerCity}
                      onCheckedChange={(v) => setPrefs((p) => ({ ...p, innerCity: v }))}
                    />
                    <span className="font-inter text-xs text-muted-foreground">Inner City</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-inter text-xs text-muted-foreground">Alpine</span>
                    <Switch
                      checked={prefs.coastal}
                      onCheckedChange={(v) => setPrefs((p) => ({ ...p, coastal: v }))}
                    />
                    <span className="font-inter text-xs text-muted-foreground">Coastal</span>
                  </div>
                </div>
              </section>

              <Separator />

              <Button
                onClick={savePrefs}
                disabled={saving}
                className="w-full h-9 font-inter text-sm bg-foreground text-background hover:bg-foreground/90"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Preferences
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
