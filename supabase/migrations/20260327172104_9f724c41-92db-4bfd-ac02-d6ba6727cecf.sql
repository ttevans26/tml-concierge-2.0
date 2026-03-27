
DROP VIEW IF EXISTS public.itinerary_items_public;
CREATE VIEW public.itinerary_items_public WITH (security_invoker = true) AS
SELECT
  id, trip_id, user_id, category, title, description,
  date, start_time, end_time,
  points_used, approval_status, source_reference,
  location_name, location_lat, location_lng,
  sort_order, metadata, created_at, updated_at
FROM public.itinerary_items;

CREATE TABLE public.flight_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  airline TEXT,
  flight_number TEXT NOT NULL,
  departure_airport TEXT,
  arrival_airport TEXT,
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  gate TEXT,
  terminal TEXT,
  status TEXT,
  delay_minutes INTEGER DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flights" ON public.flight_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own flights" ON public.flight_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own flights" ON public.flight_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own flights" ON public.flight_tracking FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_flight_tracking_updated_at BEFORE UPDATE ON public.flight_tracking FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trip_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status access_request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, requester_user_id)
);

ALTER TABLE public.trip_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can view their own requests" ON public.trip_access_requests FOR SELECT USING (auth.uid() = requester_user_id);
CREATE POLICY "Owners can view requests for their trips" ON public.trip_access_requests FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Authenticated users can request access" ON public.trip_access_requests FOR INSERT WITH CHECK (auth.uid() = requester_user_id);
CREATE POLICY "Owners can update request status" ON public.trip_access_requests FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE TRIGGER update_trip_access_requests_updated_at BEFORE UPDATE ON public.trip_access_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tml_core_tenets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenet_key TEXT NOT NULL UNIQUE,
  tenet_value TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tml_core_tenets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active tenets" ON public.tml_core_tenets FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage tenets" ON public.tml_core_tenets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tml_core_tenets_updated_at BEFORE UPDATE ON public.tml_core_tenets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
