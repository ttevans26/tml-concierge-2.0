/**
 * Trips service — the reference implementation of the services pattern.
 *
 * Components and stores call these functions; nobody outside this file
 * (and other files in `src/services/`) should import the Supabase client
 * directly for trip data.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { wrapError } from "./errors";

export type Trip = Tables<"trips">;
export type TripInsert = TablesInsert<"trips">;
export type TripUpdate = TablesUpdate<"trips">;

/** Explicit column list — no `select *`. Tightens payload and unlocks future column-level grants. */
const TRIP_COLUMNS = [
  "id",
  "user_id",
  "title",
  "destination",
  "start_date",
  "end_date",
  "total_trip_budget",
  "target_nightly_budget",
  "currency",
  "is_published",
  "share_token",
  "cover_image_url",
  "created_at",
  "updated_at",
].join(",");

export async function listMyTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_COLUMNS)
    .order("start_date", { ascending: true });
  if (error) wrapError("listMyTrips", error);
  return (data ?? []) as unknown as Trip[];
}

export async function getTrip(id: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from("trips")
    .select(TRIP_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) wrapError("getTrip", error);
  return (data as unknown as Trip | null) ?? null;
}

export async function createTrip(input: TripInsert): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .insert(input)
    .select(TRIP_COLUMNS)
    .single();
  if (error) wrapError("createTrip", error);
  return data as unknown as Trip;
}

export async function updateTrip(id: string, patch: TripUpdate): Promise<Trip> {
  const { data, error } = await supabase
    .from("trips")
    .update(patch)
    .eq("id", id)
    .select(TRIP_COLUMNS)
    .single();
  if (error) wrapError("updateTrip", error);
  return data as unknown as Trip;
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) wrapError("deleteTrip", error);
}