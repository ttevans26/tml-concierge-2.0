
-- 1. Trips: restrict public reads, redact via view
DROP POLICY IF EXISTS "Anyone can view published trips by share_token" ON public.trips;
DROP POLICY IF EXISTS "Users can view published trips" ON public.trips;

CREATE OR REPLACE VIEW public.trips_public
WITH (security_invoker = true) AS
SELECT id, name, destination, start_date, end_date, cover_image_url, share_token, is_published
FROM public.trips
WHERE is_published = true;

-- Allow anyone to read published trips through the redacted view ONLY
CREATE POLICY "Public can read published trips (non-financial)"
ON public.trips
FOR SELECT
TO anon, authenticated
USING (is_published = true);

-- Note: financial columns (total_trip_budget, target_nightly_budget) remain selectable
-- by the base table policy, but clients are directed to use trips_public view.
-- To truly hide them, we revoke direct anon column access by switching to view-only:
REVOKE SELECT ON public.trips FROM anon;
GRANT SELECT (id, name, destination, start_date, end_date, cover_image_url, share_token, is_published)
  ON public.trips TO anon;

GRANT SELECT ON public.trips_public TO anon, authenticated;

-- 2. Itinerary items: allow public read for items belonging to published trips
CREATE POLICY "Public can view items of published trips"
ON public.itinerary_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = itinerary_items.trip_id AND t.is_published = true
  )
);

-- Restrict anon to non-financial columns at the column-grant level
REVOKE SELECT ON public.itinerary_items FROM anon;
GRANT SELECT (id, trip_id, user_id, category, title, description, date,
              start_time, end_time, points_used, approval_status, source_reference,
              location_name, location_lat, location_lng, sort_order, metadata,
              google_place_id, source_url, created_at, updated_at)
  ON public.itinerary_items TO anon;

-- 3. user_roles: explicit deny of self-insert/update/delete for non-admins
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Lock down SECURITY DEFINER functions from anon execution
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;
