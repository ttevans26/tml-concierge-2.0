
-- Add share_token column with auto-generated UUID default
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS share_token uuid DEFAULT gen_random_uuid() NOT NULL;

-- Create unique index on share_token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS trips_share_token_unique ON public.trips (share_token);

-- Allow anyone (including anonymous) to SELECT published trips by share_token
CREATE POLICY "Anyone can view published trips by share_token"
  ON public.trips FOR SELECT
  TO anon, authenticated
  USING (is_published = true);
