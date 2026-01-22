-- Drop and recreate handoff_sample_to_testing function to use 'Sent' status instead of 'Testing'
-- The rd_request_testing_samples table has a CHECK constraint that only allows: 'Sent', 'Approved', 'Rejected'

DROP FUNCTION IF EXISTS public.handoff_sample_to_testing(UUID, TEXT);

CREATE FUNCTION public.handoff_sample_to_testing(
  p_sample_id UUID,
  p_working_title TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample RECORD;
  v_recipe RECORD;
  v_request RECORD;
  v_testing_sample_id UUID;
  v_display_name TEXT;
BEGIN
  -- Get sample with recipe info
  SELECT s.*, r.code as recipe_code, r.request_id
  INTO v_sample
  FROM development_samples s
  JOIN development_recipes r ON s.recipe_id = r.id
  WHERE s.id = p_sample_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Check sample status - allow both PilotDone and ReadyForHandoff
  IF v_sample.status NOT IN ('PilotDone', 'ReadyForHandoff') THEN
    RAISE EXCEPTION 'Sample must be in PilotDone or ReadyForHandoff status. Current status: %', v_sample.status;
  END IF;

  -- Get request
  SELECT * INTO v_request
  FROM requests
  WHERE id = v_sample.request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Build display name
  v_display_name := p_working_title || ' (' || v_sample.code || ')';

  -- Create testing sample record with 'Sent' status (matches CHECK constraint)
  INSERT INTO rd_request_testing_samples (
    request_id,
    sample_id,
    sample_code,
    recipe_code,
    working_title,
    display_name,
    status,
    sent_at,
    sent_by
  ) VALUES (
    v_sample.request_id,
    p_sample_id,
    v_sample.code,
    v_sample.recipe_code,
    p_working_title,
    v_display_name,
    'Sent',
    NOW(),
    auth.uid()
  )
  RETURNING id INTO v_testing_sample_id;

  -- Update sample status to Testing
  UPDATE development_samples
  SET status = 'Testing', updated_at = NOW()
  WHERE id = p_sample_id;

  -- Update request status to SENT_FOR_TEST if not already
  IF v_request.status != 'SENT_FOR_TEST' THEN
    UPDATE requests
    SET status = 'SENT_FOR_TEST', updated_at = NOW()
    WHERE id = v_sample.request_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'testing_sample_id', v_testing_sample_id,
    'display_name', v_display_name
  );
END;
$$;