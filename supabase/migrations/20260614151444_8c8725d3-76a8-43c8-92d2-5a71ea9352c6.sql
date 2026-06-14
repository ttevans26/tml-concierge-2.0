
ALTER VIEW public.itinerary_items_public SET (security_invoker = true);
ALTER VIEW public.trips_public SET (security_invoker = true);

CREATE POLICY "Public can view items of published trips"
  ON public.itinerary_items
  FOR SELECT
  TO anon, authenticated
  USING (public.is_trip_published(trip_id));

GRANT EXECUTE ON FUNCTION public.is_trip_published(uuid) TO anon, authenticated;

REVOKE SELECT ON public.itinerary_items FROM anon, authenticated;

-- Non-sensitive columns visible to anon + authenticated (RLS still filters rows).
GRANT SELECT (
  id, trip_id, user_id, category, title, description,
  date, start_time, end_time, approval_status, source_reference,
  location_name, location_lat, location_lng, sort_order,
  metadata, created_at, updated_at, google_place_id, source_url, api_metadata
) ON public.itinerary_items TO anon, authenticated;

-- Sensitive columns: only authenticated may select; RLS restricts to the owner row.
GRANT SELECT (cost, currency, points_used, confirmation_code, cancellation_deadline)
  ON public.itinerary_items TO authenticated;
