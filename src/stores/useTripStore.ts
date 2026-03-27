import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/*  Types (mirrors DB schema)                                         */
/* ------------------------------------------------------------------ */

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
  target_nightly_budget: number | null;
  total_trip_budget: number | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  user_id: string;
  category: "stays" | "logistics" | "dining" | "agenda";
  title: string;
  description: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  cost: number | null;
  currency: string;
  points_used: number;
  confirmation_code: string | null;
  cancellation_deadline: string | null;
  approval_status: "draft" | "confirmed" | "cancelled";
  source_reference: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FlightTracking {
  id: string;
  trip_id: string;
  user_id: string;
  airline: string | null;
  flight_number: string;
  departure_airport: string | null;
  arrival_airport: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  gate: string | null;
  terminal: string | null;
  status: string | null;
  delay_minutes: number;
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  active_cards: unknown[];
  loyalty_memberships: unknown[];
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Store shape                                                       */
/* ------------------------------------------------------------------ */

interface TripStore {
  /* data */
  trips: Trip[];
  activeTrip: Trip | null;
  itineraryItems: ItineraryItem[];
  flights: FlightTracking[];
  profile: Profile | null;
  loading: boolean;

  /* actions */
  fetchTrips: () => Promise<void>;
  fetchItineraryItems: (tripId: string) => Promise<void>;
  fetchFlights: (tripId: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  setActiveTrip: (trip: Trip | null) => void;

  createTrip: (data: Partial<Trip>) => Promise<Trip | null>;
  updateTrip: (id: string, data: Partial<Trip>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;

  createItineraryItem: (data: Partial<ItineraryItem>) => Promise<ItineraryItem | null>;
  updateItineraryItem: (id: string, data: Partial<ItineraryItem>) => Promise<void>;
  deleteItineraryItem: (id: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Store implementation                                              */
/* ------------------------------------------------------------------ */

export const useTripStore = create<TripStore>((set, get) => ({
  trips: [],
  activeTrip: null,
  itineraryItems: [],
  flights: [],
  profile: null,
  loading: false,

  /* ---- Fetch ---- */

  fetchTrips: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase fetchTrips error:", error);
    } else {
      console.log("Fetched Trips:", data);
      set({ trips: (data as Trip[]) || [] });
    }
    set({ loading: false });
  },

  fetchItineraryItems: async (tripId) => {
    const { data, error } = await supabase
      .from("itinerary_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order");
    if (!error && data) set({ itineraryItems: data as ItineraryItem[] });
  },

  fetchFlights: async (tripId) => {
    const { data, error } = await supabase
      .from("flight_tracking")
      .select("*")
      .eq("trip_id", tripId)
      .order("departure_time");
    if (!error && data) set({ flights: data as FlightTracking[] });
  },

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!error && data) set({ profile: data as Profile });
  },

  setActiveTrip: (trip) => set({ activeTrip: trip }),

  /* ---- Create ---- */

  createTrip: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: trip, error } = await supabase
      .from("trips")
      .insert({ ...data, user_id: user.id, name: data.name || "Untitled Trip" } as any)
      .select()
      .single();
    if (!error && trip) {
      set({ trips: [trip as Trip, ...get().trips] });
      return trip as Trip;
    }
    return null;
  },

  updateTrip: async (id, data) => {
    const { error } = await supabase.from("trips").update(data as any).eq("id", id);
    if (!error) {
      set({
        trips: get().trips.map((t) => (t.id === id ? { ...t, ...data } : t)),
        activeTrip: get().activeTrip?.id === id ? { ...get().activeTrip!, ...data } : get().activeTrip,
      });
    }
  },

  deleteTrip: async (id) => {
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (!error) {
      set({
        trips: get().trips.filter((t) => t.id !== id),
        activeTrip: get().activeTrip?.id === id ? null : get().activeTrip,
      });
    }
  },

  /* ---- Itinerary items ---- */

  createItineraryItem: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: item, error } = await supabase
      .from("itinerary_items")
      .insert({ ...data, user_id: user.id, title: data.title || "Untitled", category: data.category || "agenda" } as any)
      .select()
      .single();
    if (!error && item) {
      set({ itineraryItems: [...get().itineraryItems, item as ItineraryItem] });
      return item as ItineraryItem;
    }
    return null;
  },

  updateItineraryItem: async (id, data) => {
    const { error } = await supabase.from("itinerary_items").update(data as any).eq("id", id);
    if (!error) {
      set({
        itineraryItems: get().itineraryItems.map((i) => (i.id === id ? { ...i, ...data } : i)),
      });
    }
  },

  deleteItineraryItem: async (id) => {
    const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
    if (!error) {
      set({ itineraryItems: get().itineraryItems.filter((i) => i.id !== id) });
    }
  },
}));
