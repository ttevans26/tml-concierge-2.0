import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { wrapError } from "./errors";

export type Profile = Tables<"profiles">;

export const PROFILE_COLUMNS =
  "id,user_id,display_name,avatar_url,preferences,active_cards,loyalty_memberships,notification_preferences,created_at,updated_at";

export async function getMine(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) wrapError("profile.getMine", error);
  return (data as unknown as Profile) ?? null;
}

export async function updateMine(userId: string, patch: TablesUpdate<"profiles">): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
  if (error) wrapError("profile.updateMine", error);
}