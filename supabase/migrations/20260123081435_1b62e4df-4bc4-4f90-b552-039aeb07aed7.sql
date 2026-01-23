-- 1. Update RLS policy for viewing testing samples (add quality_manager, admin_director for authors)
DROP POLICY IF EXISTS "Users can view testing samples" ON rd_request_testing_samples;
CREATE POLICY "Users can view testing samples" ON rd_request_testing_samples
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coo'::app_role) OR 
  has_role(auth.uid(), 'ceo'::app_role) OR 
  has_role(auth.uid(), 'rd_dev'::app_role) OR 
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  -- Authors with any role can view their own testing samples
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = rd_request_testing_samples.request_id
      AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- 2. Update RLS policy for updating testing samples (add quality_manager for authors)
DROP POLICY IF EXISTS "Users can update testing samples" ON rd_request_testing_samples;
CREATE POLICY "Users can update testing samples" ON rd_request_testing_samples
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coo'::app_role) OR 
  -- Authors can update their own testing samples (any role)
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = rd_request_testing_samples.request_id
      AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- 3. Add new event type for sample handoff
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'SAMPLE_SENT_FOR_TESTING';

-- 4. Update handoff_sample_to_testing RPC to log event
CREATE OR REPLACE FUNCTION handoff_sample_to_testing(
  p_sample_id uuid,
  p_working_title text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample RECORD;
  v_recipe RECORD;
  v_display_name text;
  v_actor_email text;
  v_existing_testing_sample uuid;
BEGIN
  -- Get sample details
  SELECT s.*, r.recipe_code, r.status as recipe_status
  INTO v_sample
  FROM development_samples s
  JOIN development_recipes r ON r.id = s.recipe_id
  WHERE s.id = p_sample_id;

  IF v_sample IS NULL THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Check sample is in PilotDone status
  IF v_sample.status != 'PilotDone' THEN
    RAISE EXCEPTION 'Sample must be in PilotDone status to handoff. Current status: %', v_sample.status;
  END IF;

  -- Check recipe doesn't already have a sample in Testing or Approved status
  IF v_sample.recipe_status IN ('Testing', 'Approved') THEN
    RAISE EXCEPTION 'Recipe already has a sample in testing or approved. Cannot send another sample from this recipe.';
  END IF;

  -- Validate working title
  IF p_working_title IS NULL OR trim(p_working_title) = '' THEN
    RAISE EXCEPTION 'Working title is required';
  END IF;

  -- Build display name
  v_display_name := p_working_title || ' (' || v_sample.sample_code || ')';

  -- Get actor email
  SELECT email INTO v_actor_email FROM profiles WHERE id = auth.uid();

  -- Update sample
  UPDATE development_samples
  SET 
    status = 'Testing',
    working_title = p_working_title,
    updated_at = now()
  WHERE id = p_sample_id;

  -- Update recipe status to Testing
  UPDATE development_recipes
  SET 
    status = 'Testing',
    updated_at = now()
  WHERE id = v_sample.recipe_id;

  -- Update request status to SENT_FOR_TEST
  UPDATE requests
  SET 
    status = 'SENT_FOR_TEST',
    date_sent_for_test = now(),
    updated_at = now()
  WHERE id = v_sample.request_id;

  -- Create testing sample record
  INSERT INTO rd_request_testing_samples (
    request_id,
    sample_id,
    sample_code,
    recipe_code,
    working_title,
    display_name,
    status,
    sent_by,
    sent_at
  ) VALUES (
    v_sample.request_id,
    p_sample_id,
    v_sample.sample_code,
    v_sample.recipe_code,
    p_working_title,
    v_display_name,
    'Sent',
    auth.uid(),
    now()
  );

  -- Log event to request chronology
  INSERT INTO request_events (request_id, actor_email, event_type, payload)
  VALUES (
    v_sample.request_id,
    v_actor_email,
    'SAMPLE_SENT_FOR_TESTING',
    jsonb_build_object(
      'sample_id', p_sample_id,
      'sample_code', v_sample.sample_code,
      'display_name', v_display_name,
      'working_title', p_working_title
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'sample_status', 'Testing',
    'request_status', 'SENT_FOR_TEST',
    'display_name', v_display_name
  );
END;
$$;