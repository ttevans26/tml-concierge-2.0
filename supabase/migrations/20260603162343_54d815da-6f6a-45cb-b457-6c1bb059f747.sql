
CREATE OR REPLACE FUNCTION public.request_trip_access(
  p_share_token TEXT,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id UUID;
  v_owner UUID;
  v_request_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id, user_id INTO v_trip_id, v_owner
  FROM public.trips
  WHERE share_token = p_share_token AND is_published = true
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Trip not found or not published' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner = v_uid THEN
    RAISE EXCEPTION 'You already own this trip' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.trip_access_requests (trip_id, requester_user_id, owner_user_id, status, message)
  VALUES (v_trip_id, v_uid, v_owner, 'pending', p_message)
  ON CONFLICT (trip_id, requester_user_id)
  DO UPDATE SET message = EXCLUDED.message, updated_at = now()
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_trip_access(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_trip_access(TEXT, TEXT) TO authenticated, service_role;
