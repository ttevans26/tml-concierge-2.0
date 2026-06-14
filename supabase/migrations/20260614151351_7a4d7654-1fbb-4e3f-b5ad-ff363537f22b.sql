
-- Drop public RLS policy that exposes all columns of itinerary_items to anon
DROP POLICY IF EXISTS "Public can view items of published trips" ON public.itinerary_items;

-- Switch redaction views to SECURITY DEFINER (bypass RLS on base tables) so
-- anon can read them while base tables remain locked down.
ALTER VIEW public.itinerary_items_public SET (security_invoker = false);
ALTER VIEW public.trips_public SET (security_invoker = false);

-- Ensure anon/authenticated can read the safe views
GRANT SELECT ON public.itinerary_items_public TO anon, authenticated;
GRANT SELECT ON public.trips_public TO anon, authenticated;

-- Revoke anon EXECUTE on is_trip_published; it is no longer needed by any
-- public RLS policy now that the views handle public access directly.
REVOKE EXECUTE ON FUNCTION public.is_trip_published(uuid) FROM anon, public;
