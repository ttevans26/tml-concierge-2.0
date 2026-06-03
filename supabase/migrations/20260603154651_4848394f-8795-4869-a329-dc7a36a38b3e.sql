
CREATE TABLE public.studio_social_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_url text NOT NULL,
  platform text NOT NULL,
  caption text,
  thumbnail_url text,
  author text,
  detected_destination text,
  suggested_folder_id uuid,
  extracted_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_social_imports TO authenticated;
GRANT ALL ON public.studio_social_imports TO service_role;

ALTER TABLE public.studio_social_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own social imports"
  ON public.studio_social_imports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own social imports"
  ON public.studio_social_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own social imports"
  ON public.studio_social_imports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own social imports"
  ON public.studio_social_imports FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_studio_social_imports_updated_at
  BEFORE UPDATE ON public.studio_social_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_studio_social_imports_user_status
  ON public.studio_social_imports(user_id, status, created_at DESC);
