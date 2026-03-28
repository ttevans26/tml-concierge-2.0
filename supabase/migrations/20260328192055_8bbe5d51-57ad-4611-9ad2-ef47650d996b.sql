
-- Add 'sites_of_interest' to itinerary_category enum
ALTER TYPE public.itinerary_category ADD VALUE IF NOT EXISTS 'sites_of_interest';

-- Add source_reference to studio_items (other columns already exist)
ALTER TABLE public.studio_items ADD COLUMN IF NOT EXISTS source_reference text;
