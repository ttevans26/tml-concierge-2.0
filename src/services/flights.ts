import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { wrapError } from "./errors";

export type Flight = Tables<"flight_tracking">;

export const FLIGHT_COLUMNS =
  "id,trip_id,user_id,airline,flight_number,departure_airport,arrival_airport,departure_time,arrival_time,gate,terminal,status,delay_minutes,raw_data,created_at,updated_at";

export async function listForTrip(tripId: string): Promise<Flight[]> {
  const { data, error } = await supabase
    .from("flight_tracking")
    .select(FLIGHT_COLUMNS)
    .eq("trip_id", tripId)
    .order("departure_time");
  if (error) wrapError("flights.listForTrip", error);
  return (data ?? []) as unknown as Flight[];
}