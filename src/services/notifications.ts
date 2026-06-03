import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { wrapError } from "./errors";

export type Notification = Tables<"notifications">;

export const NOTIFICATION_COLUMNS =
  "id,kind,title,body,created_at,is_read,is_dismissed,trip_id,item_id,due_at,metadata";

export async function listActive(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) wrapError("notifications.listActive", error);
  return (data ?? []) as unknown as Notification[];
}

export async function markRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
  if (error) wrapError("notifications.markRead", error);
}

export async function dismiss(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_dismissed: true }).eq("id", id);
  if (error) wrapError("notifications.dismiss", error);
}

export async function markOneRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) wrapError("notifications.markOneRead", error);
}