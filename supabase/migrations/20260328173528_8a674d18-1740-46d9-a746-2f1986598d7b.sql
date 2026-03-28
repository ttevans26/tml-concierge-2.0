
-- Studio folders table
CREATE TABLE public.studio_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own folders" ON public.studio_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own folders" ON public.studio_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own folders" ON public.studio_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own folders" ON public.studio_folders FOR DELETE USING (auth.uid() = user_id);

-- Studio items table
CREATE TABLE public.studio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  folder_id uuid NOT NULL REFERENCES public.studio_folders(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'activity',
  title text NOT NULL,
  description text,
  address text,
  url text,
  lat double precision,
  lng double precision,
  cost numeric,
  google_place_id text,
  source_url text,
  api_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.studio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own items" ON public.studio_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own items" ON public.studio_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own items" ON public.studio_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own items" ON public.studio_items FOR DELETE USING (auth.uid() = user_id);

-- Entity metadata columns on itinerary_items
ALTER TABLE public.itinerary_items ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.itinerary_items ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.itinerary_items ADD COLUMN IF NOT EXISTS api_metadata jsonb DEFAULT '{}'::jsonb;
