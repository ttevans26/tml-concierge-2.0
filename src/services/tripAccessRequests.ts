/**
 * Owner-side trip access request service.
 * Requesters create rows via the `request_trip_access` RPC (handled by
 * PublicTripView). This module handles the owner's approve / deny actions.
 */
import { supabase } from "@/integrations/supabase/client";
import { wrapError } from "./errors";

export interface PendingAccessRequest {
  id: string;
  trip_id: string;
  requester_user_id: string;
  owner_user_id: string;
  status: "pending" | "approved" | "denied";
  message: string | null;
  created_at: string;
  trip_name: string | null;
  requester_email: string | null;
}

/** Fetch pending requests for trips owned by the current user. */
export async function listPendingForOwner(): Promise<PendingAccessRequest[]> {
  const { data, error } = await supabase
    .from("trip_access_requests")
    .select("id, trip_id, requester_user_id, owner_user_id, status, message, created_at, trips!inner(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) wrapError("tripAccessRequests.listPendingForOwner", error);
  return ((data ?? []) as unknown as Array<{
    id: string;
    trip_id: string;
    requester_user_id: string;
    owner_user_id: string;
    status: "pending" | "approved" | "denied";
    message: string | null;
    created_at: string;
    trips: { name: string | null } | null;
  }>).map((r) => ({
    id: r.id,
    trip_id: r.trip_id,
    requester_user_id: r.requester_user_id,
    owner_user_id: r.owner_user_id,
    status: r.status,
    message: r.message,
    created_at: r.created_at,
    trip_name: r.trips?.name ?? null,
    requester_email: null,
  }));
}

export async function approveRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("trip_access_requests")
    .update({ status: "approved" })
    .eq("id", id);
  if (error) wrapError("tripAccessRequests.approveRequest", error);
}

export async function denyRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("trip_access_requests")
    .update({ status: "denied" })
    .eq("id", id);
  if (error) wrapError("tripAccessRequests.denyRequest", error);
}