
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  target_nightly_budget NUMERIC(10,2),
  total_trip_budget NUMERIC(10,2),
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view published trips"
  ON public.trips FOR SELECT
  USING (is_published = true);

CREATE POLICY "Users can insert their own trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category itinerary_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  date DATE,
  start_time TIME,
  end_time TIME,
  cost NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  points_used INTEGER DEFAULT 0,
  confirmation_code TEXT,
  cancellation_deadline TIMESTAMPTZ,
  approval_status approval_status NOT NULL DEFAULT 'draft',
  source_reference TEXT,
  location_name TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own itinerary items"
  ON public.itinerary_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own itinerary items"
  ON public.itinerary_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itinerary items"
  ON public.itinerary_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itinerary items"
  ON public.itinerary_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_itinerary_items_trip ON public.itinerary_items(trip_id);
CREATE INDEX idx_itinerary_items_date ON public.itinerary_items(date);

CREATE TRIGGER update_itinerary_items_updated_at
  BEFORE UPDATE ON public.itinerary_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE VIEW public.itinerary_items_public AS
SELECT
  id, trip_id, user_id, category, title, description,
  date, start_time, end_time,
  points_used, approval_status, source_reference,
  location_name, location_lat, location_lng,
  sort_order, metadata, created_at, updated_at
FROM public.itinerary_items;
