
-- 1) Tighten anon SELECT: revoke from auth-only tables, grant on the two public-readable ones.
REVOKE SELECT ON public.concierge_conversations, public.concierge_messages, public.flight_tracking,
                  public.notifications, public.profiles, public.studio_folders, public.studio_items,
                  public.studio_social_imports, public.tml_core_tenets, public.trip_access_requests,
                  public.trip_documents, public.trip_packing_items, public.user_roles
  FROM anon;

GRANT SELECT ON public.trips TO anon;
GRANT SELECT ON public.itinerary_items TO anon;

-- 2) Ensure service_role + authenticated have full access where policies allow.
GRANT ALL ON public.concierge_conversations, public.concierge_messages, public.flight_tracking,
             public.itinerary_items, public.notifications, public.profiles, public.studio_folders,
             public.studio_items, public.studio_social_imports, public.tml_core_tenets,
             public.trip_access_requests, public.trip_documents, public.trip_packing_items,
             public.trips, public.user_roles
  TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_conversations, public.concierge_messages,
       public.flight_tracking, public.itinerary_items, public.notifications, public.profiles,
       public.studio_folders, public.studio_items, public.studio_social_imports,
       public.trip_access_requests, public.trip_documents, public.trip_packing_items, public.trips
  TO authenticated;
GRANT SELECT ON public.tml_core_tenets, public.user_roles TO authenticated;

-- 3) Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_date           ON public.itinerary_items (trip_id, date);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_sort           ON public.itinerary_items (trip_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_user_date           ON public.itinerary_items (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_itinerary_items_trip_category       ON public.itinerary_items (trip_id, category);
CREATE INDEX IF NOT EXISTS idx_trips_user_created                  ON public.trips (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_share_token_published         ON public.trips (share_token) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_flight_tracking_trip_departure      ON public.flight_tracking (trip_id, departure_time);
CREATE INDEX IF NOT EXISTS idx_notifications_user_active           ON public.notifications (user_id, is_dismissed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_packing_items_trip_sort        ON public.trip_packing_items (trip_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_trip_documents_trip_created         ON public.trip_documents (trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concierge_messages_conv_created     ON public.concierge_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_concierge_conversations_user_upd    ON public.concierge_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_items_user_folder            ON public.studio_items (user_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_studio_social_imports_user_status   ON public.studio_social_imports (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_access_requests_owner_status   ON public.trip_access_requests (owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_trip_access_requests_requester      ON public.trip_access_requests (requester_user_id);

-- 4) Batched date update RPC (RLS still applies; SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.bulk_update_item_dates(patches jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.itinerary_items i
     SET date = (p->>'date')::date,
         updated_at = now()
    FROM jsonb_array_elements(patches) p
   WHERE i.id = (p->>'id')::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_update_item_dates(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_item_dates(jsonb) FROM anon, public;
