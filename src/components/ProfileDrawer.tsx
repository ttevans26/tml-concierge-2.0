import { LogOut, Settings, Users, ChevronLeft, Save, Loader2, Lock, Globe, CalendarClock, ShieldCheck, KeyRound, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useTripStore } from "@/stores/useTripStore";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useCallback } from "react";
import { suppressDevAutoAuth } from "@/lib/devAutoAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  creditCards: string[];
  innerCity: boolean;
  coastal: boolean;
}

const DEFAULT_PREFS: TravelPreferences = {
  hotelStarRating: "5",
  minReviewScore: "4.5",
  loyaltyPrograms: [],
  amenities: [],
  creditCards: [],
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

const CREDIT_CARD_OPTIONS = [
  "Chase Sapphire Reserve",
  "Amex Platinum",
  "Amex Gold",
  "Capital One Venture X",
  "Citi Prestige",
  "US Bank Altitude Reserve",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({ open, onOpenChange }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isPublic = useTripStore((s) => s.networkProfile.isPublic);
  const setProfileVisibility = useTripStore((s) => s.setProfileVisibility);
  const appointments = useTripStore((s) => s.appointments);
  const upcomingCount = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return appointments.filter((a) => a.date >= today).length;
  })();
  const [view, setView] = useState<"menu" | "preferences" | "security">("menu");
  const [prefs, setPrefs] = useState<TravelPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("preferences, display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.display_name) setDisplayName(data.display_name);
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    if (data?.preferences && typeof data.preferences === "object") {
      const p = data.preferences as Record<string, unknown>;
      setPrefs({
        hotelStarRating: (p.hotelStarRating as string) ?? DEFAULT_PREFS.hotelStarRating,
        minReviewScore: (p.minReviewScore as string) ?? DEFAULT_PREFS.minReviewScore,
        loyaltyPrograms: (p.loyaltyPrograms as string[]) ?? [],
        amenities: (p.amenities as string[]) ?? [],
        creditCards: (p.creditCards as string[]) ?? [],
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

  const toggleCreditCard = (card: string) => {
    setPrefs((p) => ({
      ...p,
      creditCards: p.creditCards.includes(card)
        ? p.creditCards.filter((c) => c !== card)
        : [...p.creditCards, card],
    }));
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
    // Hard-navigate so route + in-memory state fully reset.
    window.location.href = "/login";
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) toast.error("Failed to save profile");
    else toast.success("Profile updated");
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) toast.error("Could not send reset email");
    else toast.success("Password reset email sent");
  };

  const signOutAllDevices = async () => {
    suppressDevAutoAuth();
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Sign-out failed");
    else {
      toast.success("Signed out of all devices");
      onOpenChange(false);
      window.location.href = "/login";
    }
  };

  const deleteAccount = async () => {
    if (confirmDeleteText !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) {
        toast.error("Could not delete account");
        setDeletingAccount(false);
        return;
      }
      await supabase.auth.signOut();
      toast.success("Account deleted");
      window.location.href = "/login";
    } catch {
      toast.error("Could not delete account");
      setDeletingAccount(false);
    }
  };

  const initials = (() => {
    const src = displayName || user?.email || "";
    return src
      .replace(/@.*$/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "·";
  })();

  const headerName = displayName || user?.email?.split("@")[0] || "Traveler";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 bg-background p-6 overflow-y-auto">
        {view === "menu" ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Profile</SheetTitle>
              <SheetDescription>{user?.email ?? ""}</SheetDescription>
            </SheetHeader>

            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 rounded-full border-thin border-accent/40">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={headerName} /> : null}
                <AvatarFallback className="bg-accent/10 text-accent font-playfair text-base">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-playfair text-base font-semibold text-foreground truncate">
                  {headerName}
                </div>
                <div className="font-inter text-[11px] text-muted-foreground truncate">
                  {user?.email ?? "—"}
                </div>
              </div>
            </div>

            <Separator className="my-5" />

            <nav className="flex flex-col gap-1">
              <Button
                variant="ghost"
                onClick={() => setView("security")}
                className="justify-start gap-2.5 font-inter text-sm text-foreground"
              >
                <ShieldCheck className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="flex-1 text-left">Profile & Security</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </Button>

              <Button
                variant="ghost"
                onClick={() => setView("preferences")}
                className="justify-start gap-2.5 font-inter text-sm text-foreground"
              >
                <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="flex-1 text-left">Travel Preferences</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/tools");
                }}
                className="justify-start gap-2.5 font-inter text-sm text-foreground"
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="flex-1 text-left">Concierge Sessions</span>
                {upcomingCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-sm bg-accent/15 text-accent font-inter text-[10px] font-medium">
                    {upcomingCount}
                  </span>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/network");
                }}
                className="justify-start gap-2.5 font-inter text-sm text-foreground"
              >
                <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                Travel Network
              </Button>
            </nav>

            <Separator className="my-5" />

            <section>
              <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                Privacy
              </h3>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isPublic ? (
                      <Globe className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
                    )}
                    <span className="font-inter text-sm text-foreground">Public Profile</span>
                  </div>
                  <p className="mt-1 font-inter text-[11px] text-muted-foreground leading-relaxed">
                    {isPublic
                      ? "Anyone on the platform can follow you and see your public trips."
                      : "Other travelers must request access before viewing your trips."}
                  </p>
                </div>
                <Switch checked={isPublic} onCheckedChange={setProfileVisibility} />
              </div>
            </section>

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
        ) : view === "preferences" ? (
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

              {/* Credit Cards */}
              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Active Credit Cards
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {CREDIT_CARD_OPTIONS.map((card) => (
                    <label key={card} className="flex items-center gap-2.5 cursor-pointer group">
                      <Checkbox
                        checked={prefs.creditCards.includes(card)}
                        onCheckedChange={() => toggleCreditCard(card)}
                        className="border-border data-[state=checked]:bg-foreground data-[state=checked]:border-foreground"
                      />
                      <span className="font-inter text-sm text-foreground group-hover:text-foreground/80 transition-colors">
                        {card}
                      </span>
                    </label>
                  ))}
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
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("menu")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-playfair text-base font-semibold text-foreground">
                Profile & Security
              </h2>
            </div>

            <SheetHeader className="sr-only">
              <SheetTitle>Profile & Security</SheetTitle>
              <SheetDescription>Manage your personal details and account security</SheetDescription>
            </SheetHeader>

            <div className="space-y-5">
              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Personal Details
                </h3>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-14 w-14 rounded-full border-thin border-accent/40">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={headerName} /> : null}
                    <AvatarFallback className="bg-accent/10 text-accent font-playfair text-base">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-relaxed">
                    <p className="font-inter text-[11px] font-medium text-foreground">{headerName}</p>
                    <p className="font-inter text-[10px] text-muted-foreground">
                      Initials-based avatar
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="font-inter text-xs text-muted-foreground">Full Name</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      className="h-9 text-sm border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-inter text-xs text-muted-foreground">Email</Label>
                    <Input
                      value={user?.email ?? ""}
                      readOnly
                      disabled
                      className="h-9 text-sm border-border bg-muted/30"
                    />
                  </div>
                  <Button
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="w-full h-9 font-inter text-sm bg-foreground text-background hover:bg-foreground/90"
                  >
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Profile
                  </Button>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="font-inter text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  Security
                </h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={sendPasswordReset}
                    disabled={sendingReset || !user?.email}
                    className="w-full justify-start gap-2.5 h-9 font-inter text-sm border-border"
                  >
                    {sendingReset ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    )}
                    Change Password
                  </Button>
                  <p className="font-inter text-[11px] text-muted-foreground leading-relaxed px-1">
                    We'll email you a secure link to set a new password.
                  </p>
                </div>

                <div className="space-y-2 mt-4">
                  <Button
                    variant="ghost"
                    onClick={signOutAllDevices}
                    className="w-full justify-start gap-2.5 h-9 font-inter text-sm text-destructive hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.5} />
                    Sign Out of All Devices
                  </Button>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <h4 className="font-inter text-[11px] font-medium uppercase tracking-wider text-destructive">
                    Danger Zone
                  </h4>
                  {!showDeleteConfirm ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full justify-start gap-2.5 h-9 font-inter text-sm border-destructive/40 text-destructive hover:bg-destructive/5"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      Delete Account
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-sm border border-destructive/40 bg-destructive/5 p-3">
                      <p className="font-inter text-[11px] text-foreground leading-relaxed">
                        This will permanently delete your account, trips, itineraries, and Studio content. Type <span className="font-mono font-semibold">DELETE</span> to confirm.
                      </p>
                      <Input
                        value={confirmDeleteText}
                        onChange={(e) => setConfirmDeleteText(e.target.value)}
                        placeholder="DELETE"
                        className="h-8 text-sm border-destructive/40"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => { setShowDeleteConfirm(false); setConfirmDeleteText(""); }}
                          className="flex-1 h-8 text-xs"
                          disabled={deletingAccount}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={deleteAccount}
                          disabled={deletingAccount || confirmDeleteText !== "DELETE"}
                          className="flex-1 h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingAccount ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete forever"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
