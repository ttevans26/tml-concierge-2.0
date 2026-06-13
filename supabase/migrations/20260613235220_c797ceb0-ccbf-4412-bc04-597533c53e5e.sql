-- Rebuild itinerary_items_public to strip financial-adjacent fields (points_used, metadata)
DROP VIEW IF EXISTS public.itinerary_items_public CASCADE;

CREATE VIEW public.itinerary_items_public
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.trip_id,
  i.user_id,
  i.category,
  i.title,
  i.description,
  i.date,
  i.start_time,
  i.end_time,
  i.approval_status,
  i.source_reference,
  i.location_name,
  i.location_lat,
  i.location_lng,
  i.sort_order,
  i.created_at,
  i.updated_at
FROM public.itinerary_items i
WHERE EXISTS (
  SELECT 1 FROM public.trips t
  WHERE t.id = i.trip_id AND t.is_published = true
);

GRANT SELECT ON public.itinerary_items_public TO anon, authenticated;
