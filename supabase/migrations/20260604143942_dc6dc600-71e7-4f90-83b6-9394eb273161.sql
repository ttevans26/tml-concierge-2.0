
-- 1. Drop the permissive anon policy that exposed all trip columns
DROP POLICY IF EXISTS "Public can read published trips (non-financial)" ON public.trips;

-- 2. Revoke direct SELECT on trips from anon
REVOKE SELECT ON public.trips FROM anon;

-- 3. Ensure trips_public view is readable by anon (safe columns only)
GRANT SELECT ON public.trips_public TO anon, authenticated;

-- 4. Helper function so itinerary_items policy can check publication
--    without granting anon direct read access to trips.
CREATE OR REPLACE FUNCTION public.is_trip_published(_trip_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = _trip_id AND is_published = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_published(uuid) TO anon, authenticated;

-- 5. Replace itinerary_items public policy to use the helper function
DROP POLICY IF EXISTS "Public can view items of published trips" ON public.itinerary_items;
CREATE POLICY "Public can view items of published trips"
  ON public.itinerary_items
  FOR SELECT
  TO anon, authenticated
  USING (public.is_trip_published(trip_id));
