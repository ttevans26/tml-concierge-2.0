
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.itinerary_category AS ENUM ('stays', 'logistics', 'dining', 'agenda');
CREATE TYPE public.approval_status AS ENUM ('draft', 'confirmed', 'cancelled');
CREATE TYPE public.access_request_status AS ENUM ('pending', 'approved', 'denied');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
