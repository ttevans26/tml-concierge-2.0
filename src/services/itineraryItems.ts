/**
 * Itinerary items service. Stores own optimistic state; this file owns transport.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { wrapError } from "./errors";

export type ItineraryItem = Tables<"itinerary_items">;
export type ItineraryItemInsert = TablesInsert<"itinerary_items">;
export type ItineraryItemUpdate = TablesUpdate<"itinerary_items">;

export const ITINERARY_COLUMNS =
  "id,trip_id,user_id,category,title,description,date,start_time,end_time,cost,currency,points_used,confirmation_code,cancellation_deadline,approval_status,source_reference,location_name,location_lat,location_lng,sort_order,metadata,google_place_id,source_url,api_metadata,created_at,updated_at";

export async function listForTrip(tripId: string, limit = 500): Promise<ItineraryItem[]> {
  const { data, error } = await supabase
    .from("itinerary_items")
    .select(ITINERARY_COLUMNS)
    .eq("trip_id", tripId)
    .order("sort_order")
    .limit(limit);
  if (error) wrapError("itineraryItems.listForTrip", error);
  return (data ?? []) as unknown as ItineraryItem[];
}

export async function createItem(input: ItineraryItemInsert): Promise<ItineraryItem> {
  const { data, error } = await supabase
    .from("itinerary_items")
    .insert(input)
    .select(ITINERARY_COLUMNS)
    .single();
  if (error) wrapError("itineraryItems.createItem", error);
  return data as unknown as ItineraryItem;
}

export async function updateItem(id: string, patch: ItineraryItemUpdate): Promise<void> {
  const { error } = await supabase.from("itinerary_items").update(patch).eq("id", id);
  if (error) wrapError("itineraryItems.updateItem", error);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
  if (error) wrapError("itineraryItems.deleteItem", error);
}

export async function bulkInsert(items: ItineraryItemInsert[]): Promise<void> {
  if (!items.length) return;
  const { error } = await supabase.from("itinerary_items").insert(items);
  if (error) wrapError("itineraryItems.bulkInsert", error);
}

/** Single RPC round-trip for drag-across-days. RLS still applies. */
export async function bulkUpdateDates(patches: { id: string; date: string }[]): Promise<void> {
  if (!patches.length) return;
  const { error } = await supabase.rpc("bulk_update_item_dates", {
    patches: patches as unknown as never,
  });
  if (error) wrapError("itineraryItems.bulkUpdateDates", error);
}