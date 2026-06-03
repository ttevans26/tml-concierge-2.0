import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nativeStorage } from "@/lib/persistStorage";
import { supabase } from "@/integrations/supabase/client";
import { MOCK_NETWORK_USERS } from "@/data/mockNetworkUsers";
import { MOCK_NETWORK_TRIPS, MOCK_NETWORK_TRIP_ITEMS } from "@/data/mockNetworkTrips";

/* ------------------------------------------------------------------ */
/*  Explicit column lists (A2 data-layer audit)                       */
/*  Avoid SELECT * so wire payloads stay tight and predictable.       */
/* ------------------------------------------------------------------ */

const TRIP_COLUMNS =
  "id,user_id,name,description,destination,start_date,end_date,is_published,share_token,target_nightly_budget,total_trip_budget,cover_image_url,display_currency,fx_rates,created_at,updated_at";

const ITINERARY_COLUMNS =
  "id,trip_id,user_id,category,title,description,date,start_time,end_time,cost,currency,points_used,confirmation_code,cancellation_deadline,approval_status,source_reference,location_name,location_lat,location_lng,sort_order,metadata,google_place_id,source_url,api_metadata,created_at,updated_at";

const FLIGHT_COLUMNS =
  "id,trip_id,user_id,airline,flight_number,departure_airport,arrival_airport,departure_time,arrival_time,gate,terminal,status,delay_minutes,raw_data,created_at,updated_at";

const PROFILE_COLUMNS =
  "id,user_id,display_name,avatar_url,preferences,active_cards,loyalty_memberships,notification_preferences,created_at,updated_at";

const PAGE_SOFT_LIMIT = 500;

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
  share_token: string | null;
  target_nightly_budget: number | null;
  total_trip_budget: number | null;
  cover_image_url: string | null;
  display_currency: string | null;
  fx_rates: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  user_id: string;
  category: "stays" | "logistics" | "dining" | "activity" | "sites_of_interest";
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
  google_place_id: string | null;
  source_url: string | null;
  api_metadata: Record<string, unknown>;
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

export interface ChecklistTask {
  id: string;
  trip_id: string;
  task_text: string;
  is_completed: boolean;
  is_ai_generated: boolean;
  context_trigger?: string;
  detail?: string;
  dismissed?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Travel Network                                                    */
/* ------------------------------------------------------------------ */

export type ConnectionStatus = "none" | "pending" | "connected";

export interface NetworkUser {
  id: string;
  name: string;
  avatar_url: string | null;
  trips_planned: number;
  is_public: boolean;
  status: ConnectionStatus;
}

export interface NetworkTripSummary {
  id: string;
  owner_id: string;
  name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  item_counts: { stays: number; dining: number; activity: number; logistics: number };
}

/** Redacted itinerary item — by design contains NO cost / points / confirmation fields. */
export interface NetworkTripItem {
  id: string;
  trip_id: string;
  category: "stays" | "logistics" | "dining" | "activity";
  title: string;
  description: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
}

export interface ConciergeAppointment {
  id: string;
  date: string;            // yyyy-MM-dd
  slot: string;            // "10:30 AM"
  timezone_label: string;  // "PST"
  trip_id: string | null;
  trip_name: string | null;
  agenda: string;
  created_at: string;
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

  /* undo/redo */
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  /* anchor */
  activeAnchor: ItineraryItem | null;
  setActiveAnchor: (item: ItineraryItem | null) => void;

  /* checklist (client-side, sandbox-ready) */
  checklistTasks: ChecklistTask[];
  addChecklistTask: (input: { trip_id: string; task_text: string }) => void;
  toggleChecklistTask: (id: string) => void;
  updateChecklistTask: (id: string, patch: Partial<ChecklistTask>) => void;
  deleteChecklistTask: (id: string) => void;
  acceptAiTask: (id: string) => void;
  dismissAiTask: (id: string) => void;

  /* travel network (client-side) */
  networkProfile: { isPublic: boolean };
  setProfileVisibility: (isPublic: boolean) => void;
  networkUsers: NetworkUser[];
  networkQuery: string;
  setNetworkQuery: (q: string) => void;
  followUser: (id: string) => void;
  requestAccess: (id: string) => void;
  networkUserTrips: Record<string, NetworkTripSummary[]>;
  networkTripItems: Record<string, NetworkTripItem[]>;

  /* concierge appointments (client-side) */
  appointments: ConciergeAppointment[];
  addAppointment: (input: Omit<ConciergeAppointment, "id" | "created_at">) => void;
  cancelAppointment: (id: string) => void;

  /* concierge panel cross-component messaging */
  pendingConciergePrompt: string | null;
  askConcierge: (prompt: string) => void;
  consumeConciergePrompt: () => string | null;

  /* actions */
  fetchTrips: () => Promise<void>;
  fetchItineraryItems: (tripId: string) => Promise<void>;
  fetchFlights: (tripId: string) => Promise<void>;
  fetchProfile: () => Promise<void>;
  setActiveTrip: (trip: Trip | null) => void;

  createTrip: (data: Partial<Trip>) => Promise<Trip | null>;
  updateTrip: (id: string, data: Partial<Trip>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  duplicateTrip: (id: string) => Promise<Trip | null>;

  createItineraryItem: (data: Partial<ItineraryItem>) => Promise<ItineraryItem | null>;
  updateItineraryItem: (id: string, data: Partial<ItineraryItem>) => Promise<void>;
  updateItemStatus: (id: string, status: ItineraryItem["approval_status"]) => Promise<void>;
  deleteItineraryItem: (id: string) => Promise<void>;
  moveItineraryItem: (id: string, patch: { date?: string | null; category?: ItineraryItem["category"] }) => Promise<void>;
  /** Apply a batch of `{id, date}` updates in a single round-trip (used by trip-editor). */
  bulkUpdateItemDates: (patches: { id: string; date: string }[]) => Promise<void>;
  /** Shift trip window + every item by deltaDays. Returns true on success. */
  shiftTripDates: (id: string, deltaDays: number) => Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/*  Derived selectors (use outside store)                             */
/* ------------------------------------------------------------------ */

export const selectTotalReservedCost = (state: TripStore) =>
  state.itineraryItems.reduce((sum, i) => sum + (i.cost ? Number(i.cost) : 0), 0);

export const selectRemainingBudget = (state: TripStore) => {
  const budget = state.activeTrip?.total_trip_budget ?? 0;
  return Math.max(Number(budget) - selectTotalReservedCost(state), 0);
};

/* ------------------------------------------------------------------ */
/*  Store implementation                                              */
/* ------------------------------------------------------------------ */

export const useTripStore = create<TripStore>()(
  persist(
    (set, get) => ({
  /* ---- Undo/Redo (in-memory, not persisted) ---- */
  // History entries are not declared in the interface; kept as internal state.
  // We use plain refs on the closure via a module-level WeakMap fallback.

  trips: [],
  activeTrip: null,
  itineraryItems: [],
  flights: [],
  profile: null,
  loading: false,
  activeAnchor: null,

  setActiveAnchor: (item) => set({ activeAnchor: item }),

  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,

  undo: async () => {
    const op = undoStack.pop();
    if (!op) return;
    redoStack.push(op);
    await applyOp(op, "undo", get, set);
  },
  redo: async () => {
    const op = redoStack.pop();
    if (!op) return;
    undoStack.push(op);
    await applyOp(op, "redo", get, set);
  },

  /* ---- Checklist (client-side) ---- */
  checklistTasks: [],
  addChecklistTask: ({ trip_id, task_text }) => {
    const task: ChecklistTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      trip_id,
      task_text,
      is_completed: false,
      is_ai_generated: false,
    };
    set({ checklistTasks: [...get().checklistTasks, task] });
  },
  toggleChecklistTask: (id) =>
    set({
      checklistTasks: get().checklistTasks.map((t) =>
        t.id === id ? { ...t, is_completed: !t.is_completed } : t,
      ),
    }),
  updateChecklistTask: (id, patch) =>
    set({
      checklistTasks: get().checklistTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }),
  deleteChecklistTask: (id) =>
    set({ checklistTasks: get().checklistTasks.filter((t) => t.id !== id) }),
  acceptAiTask: (id) =>
    set({
      checklistTasks: get().checklistTasks.map((t) =>
        t.id === id ? { ...t, is_ai_generated: false } : t,
      ),
    }),
  dismissAiTask: (id) =>
    set({
      checklistTasks: get().checklistTasks.map((t) =>
        t.id === id ? { ...t, dismissed: true } : t,
      ),
    }),

  /* ---- Travel Network (client-side) ---- */
  networkProfile: { isPublic: true },
  setProfileVisibility: (isPublic) => set({ networkProfile: { isPublic } }),
  networkUsers: MOCK_NETWORK_USERS,
  networkQuery: "",
  setNetworkQuery: (q) => set({ networkQuery: q }),
  followUser: (id) =>
    set({
      networkUsers: get().networkUsers.map((u) =>
        u.id === id ? { ...u, status: "connected" } : u,
      ),
    }),
  requestAccess: (id) =>
    set({
      networkUsers: get().networkUsers.map((u) =>
        u.id === id ? { ...u, status: "pending" } : u,
      ),
    }),
  networkUserTrips: MOCK_NETWORK_TRIPS,
  networkTripItems: MOCK_NETWORK_TRIP_ITEMS,

  /* ---- Concierge Appointments (client-side demo) ---- */
  appointments: [
    {
      id: "appt-seed-1",
      date: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 4);
        return d.toISOString().slice(0, 10);
      })(),
      slot: "10:30 AM",
      timezone_label: "PST",
      trip_id: null,
      trip_name: null,
      agenda: "Initial scoping for late-summer Japan itinerary — Tokyo + Kyoto split, ryokan recommendations.",
      created_at: new Date().toISOString(),
    },
  ],
  addAppointment: (input) => {
    const appt: ConciergeAppointment = {
      ...input,
      id: `appt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    set({ appointments: [...get().appointments, appt] });
  },
  cancelAppointment: (id) =>
    set({ appointments: get().appointments.filter((a) => a.id !== id) }),

  /* ---- Concierge cross-component bus ---- */
  pendingConciergePrompt: null,
  askConcierge: (prompt) => set({ pendingConciergePrompt: prompt }),
  consumeConciergePrompt: () => {
    const p = get().pendingConciergePrompt;
    if (p) set({ pendingConciergePrompt: null });
    return p;
  },

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

  duplicateTrip: async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const source = get().trips.find((t) => t.id === id);
    if (!source) return null;
    const { data: newTrip, error } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        name: `${source.name} (Copy)`,
        description: source.description,
        destination: source.destination,
        start_date: source.start_date,
        end_date: source.end_date,
        target_nightly_budget: source.target_nightly_budget,
        total_trip_budget: source.total_trip_budget,
        cover_image_url: source.cover_image_url,
        is_published: false,
      } as any)
      .select()
      .single();
    if (error || !newTrip) return null;
    // Clone itinerary items (as drafts)
    const { data: items } = await supabase
      .from("itinerary_items")
      .select("*")
      .eq("trip_id", id);
    if (items && items.length) {
      const clones = (items as any[]).map((i) => {
        const { id: _id, created_at, updated_at, ...rest } = i;
        return { ...rest, trip_id: newTrip.id, user_id: user.id, approval_status: "draft", confirmation_code: null };
      });
      await supabase.from("itinerary_items").insert(clones);
    }
    set({ trips: [newTrip as Trip, ...get().trips] });
    return newTrip as Trip;
  },

  /* ---- Itinerary items ---- */

  createItineraryItem: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: item, error } = await supabase
      .from("itinerary_items")
      .insert({ ...data, user_id: user.id, title: data.title || "Untitled", category: data.category || "activity" } as any)
      .select()
      .single();
    if (!error && item) {
      set({ itineraryItems: [...get().itineraryItems, item as ItineraryItem] });
      return item as ItineraryItem;
    }
    return null;
  },

  updateItineraryItem: async (id, data) => {
    const before = get().itineraryItems.find((i) => i.id === id);
    const { error } = await supabase.from("itinerary_items").update(data as any).eq("id", id);
    if (!error) {
      set({
        itineraryItems: get().itineraryItems.map((i) => (i.id === id ? { ...i, ...data } : i)),
      });
      if (before) pushHistory({ kind: "update", id, before: snapshot(before), after: { ...snapshot(before), ...data } });
    }
  },

  updateItemStatus: async (id, status) => {
    const before = get().itineraryItems.find((i) => i.id === id);
    const { error } = await supabase.from("itinerary_items").update({ approval_status: status } as any).eq("id", id);
    if (!error) {
      set({
        itineraryItems: get().itineraryItems.map((i) => (i.id === id ? { ...i, approval_status: status } : i)),
      });
      if (before) pushHistory({ kind: "update", id, before: snapshot(before), after: { ...snapshot(before), approval_status: status } });
    }
  },

  deleteItineraryItem: async (id) => {
    const before = get().itineraryItems.find((i) => i.id === id);
    const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
    if (!error) {
      set({ itineraryItems: get().itineraryItems.filter((i) => i.id !== id) });
      if (before) pushHistory({ kind: "delete", id, before: snapshot(before) });
    }
  },

  moveItineraryItem: async (id, patch) => {
    const before = get().itineraryItems.find((i) => i.id === id);
    if (!before) return;
    const updateData: Partial<ItineraryItem> = {};
    if (patch.date !== undefined) updateData.date = patch.date;
    if (patch.category !== undefined) updateData.category = patch.category;
    const { error } = await supabase.from("itinerary_items").update(updateData as any).eq("id", id);
    if (!error) {
      set({
        itineraryItems: get().itineraryItems.map((i) => (i.id === id ? { ...i, ...updateData } : i)),
      });
      pushHistory({ kind: "move", id, before: { date: before.date, category: before.category }, after: { date: updateData.date ?? before.date, category: updateData.category ?? before.category } });
    }
  },

  bulkUpdateItemDates: async (patches) => {
    if (!patches.length) return;
    // Optimistic update
    const byId = new Map(patches.map((p) => [p.id, p.date]));
    set({
      itineraryItems: get().itineraryItems.map((i) =>
        byId.has(i.id) ? { ...i, date: byId.get(i.id)! } : i,
      ),
    });
    // Issue updates in parallel (Supabase has no native multi-row UPDATE on disparate values)
    const results = await Promise.all(
      patches.map((p) =>
        supabase.from("itinerary_items").update({ date: p.date } as any).eq("id", p.id),
      ),
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error("bulkUpdateItemDates partial failure:", firstError);
    }
  },

  shiftTripDates: async (id, deltaDays) => {
    const trip = get().trips.find((t) => t.id === id) ?? get().activeTrip;
    if (!trip || !trip.start_date || !trip.end_date || deltaDays === 0) return false;
    const newStart = (() => {
      const d = new Date(trip.start_date + "T00:00:00");
      d.setUTCDate(d.getUTCDate() + deltaDays);
      return d.toISOString().slice(0, 10);
    })();
    const newEnd = (() => {
      const d = new Date(trip.end_date + "T00:00:00");
      d.setUTCDate(d.getUTCDate() + deltaDays);
      return d.toISOString().slice(0, 10);
    })();
    const tripItems = get().itineraryItems.filter((i) => i.trip_id === id && i.date);
    const patches = tripItems.map((i) => {
      const d = new Date(i.date! + "T00:00:00");
      d.setUTCDate(d.getUTCDate() + deltaDays);
      return { id: i.id, date: d.toISOString().slice(0, 10) };
    });
    await get().updateTrip(id, { start_date: newStart, end_date: newEnd });
    await get().bulkUpdateItemDates(patches);
    return true;
  },
}),
    {
      name: "tml-trip-store-v1",
      storage: createJSONStorage(() => nativeStorage),
      // Only persist data slices — never persist `loading` or action functions.
      partialize: (s) => ({
        trips: s.trips,
        activeTrip: s.activeTrip,
        itineraryItems: s.itineraryItems,
        flights: s.flights,
        profile: s.profile,
        checklistTasks: s.checklistTasks,
        appointments: s.appointments,
        networkProfile: s.networkProfile,
      }),
    },
  ),
);

/* ------------------------------------------------------------------ */
/*  Undo/Redo internals                                               */
/* ------------------------------------------------------------------ */

type HistoryOp =
  | { kind: "update"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }
  | { kind: "delete"; id: string; before: Record<string, unknown> }
  | { kind: "move"; id: string; before: { date: string | null; category: ItineraryItem["category"] }; after: { date: string | null; category: ItineraryItem["category"] } };

const MAX_HISTORY = 50;
const undoStack: HistoryOp[] = [];
const redoStack: HistoryOp[] = [];

function snapshot(item: ItineraryItem): Record<string, unknown> {
  // Return a plain object copy used for restoring values via UPDATE.
  // We deliberately omit server-managed fields.
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = item;
  return JSON.parse(JSON.stringify(rest));
}

function pushHistory(op: HistoryOp) {
  undoStack.push(op);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  // New action invalidates redo
  redoStack.length = 0;
}

async function applyOp(
  op: HistoryOp,
  dir: "undo" | "redo",
  get: () => TripStore,
  set: (partial: Partial<TripStore>) => void
) {
  if (op.kind === "move") {
    const target = dir === "undo" ? op.before : op.after;
    await supabase.from("itinerary_items").update(target as any).eq("id", op.id);
    set({
      itineraryItems: get().itineraryItems.map((i) =>
        i.id === op.id ? { ...i, ...target } : i,
      ),
    });
    return;
  }
  if (op.kind === "update") {
    const target = dir === "undo" ? op.before : op.after;
    await supabase.from("itinerary_items").update(target as any).eq("id", op.id);
    set({
      itineraryItems: get().itineraryItems.map((i) =>
        i.id === op.id ? ({ ...i, ...target } as ItineraryItem) : i,
      ),
    });
    return;
  }
  if (op.kind === "delete") {
    if (dir === "undo") {
      // Re-insert the deleted item
      const restored = { id: op.id, ...op.before } as any;
      await supabase.from("itinerary_items").insert(restored);
      set({ itineraryItems: [...get().itineraryItems, restored as ItineraryItem] });
    } else {
      await supabase.from("itinerary_items").delete().eq("id", op.id);
      set({ itineraryItems: get().itineraryItems.filter((i) => i.id !== op.id) });
    }
  }
}
