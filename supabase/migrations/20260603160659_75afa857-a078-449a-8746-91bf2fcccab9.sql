
-- 1. Add display currency + FX rates to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS display_currency TEXT,
  ADD COLUMN IF NOT EXISTS fx_rates JSONB;

-- 2. Packing items
CREATE TABLE IF NOT EXISTS public.trip_packing_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  is_packed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_packing_items TO authenticated;
GRANT ALL ON public.trip_packing_items TO service_role;

ALTER TABLE public.trip_packing_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own packing items" ON public.trip_packing_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own packing items" ON public.trip_packing_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own packing items" ON public.trip_packing_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own packing items" ON public.trip_packing_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trip_packing_items_updated_at
  BEFORE UPDATE ON public.trip_packing_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS trip_packing_items_trip_idx ON public.trip_packing_items (trip_id);

-- 3. Trip documents (metadata only; binary in storage bucket)
CREATE TABLE IF NOT EXISTS public.trip_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL,
  user_id UUID NOT NULL,
  path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  kind TEXT NOT NULL DEFAULT 'other',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_documents TO authenticated;
GRANT ALL ON public.trip_documents TO service_role;

ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own documents" ON public.trip_documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own documents" ON public.trip_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own documents" ON public.trip_documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own documents" ON public.trip_documents
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trip_documents_updated_at
  BEFORE UPDATE ON public.trip_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS trip_documents_trip_idx ON public.trip_documents (trip_id);
