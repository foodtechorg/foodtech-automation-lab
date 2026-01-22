-- Fix handoff_sample_to_testing to accept PilotDone status (since ReadyForHandoff is optional intermediate state)
CREATE OR REPLACE FUNCTION public.handoff_sample_to_testing(p_sample_id uuid, p_working_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sample development_samples%ROWTYPE;
  v_recipe development_recipes%ROWTYPE;
  v_testing_sample rd_request_testing_samples%ROWTYPE;
  v_display_name text;
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Check authorization - allow admin, coo, or rd_dev
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin'::app_role) 
       OR has_role(v_user_id, 'coo'::app_role)
       OR has_role(v_user_id, 'rd_dev'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: requires admin, coo, or rd_dev role';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM profiles
  WHERE id = v_user_id;

  -- Get sample
  SELECT * INTO v_sample
  FROM development_samples
  WHERE id = p_sample_id;

  IF v_sample IS NULL THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Verify sample is in PilotDone or ReadyForHandoff status (allow both)
  IF v_sample.status NOT IN ('PilotDone', 'ReadyForHandoff') THEN
    RAISE EXCEPTION 'Sample must be in PilotDone or ReadyForHandoff status. Current status: %', v_sample.status;
  END IF;

  -- Get recipe for the sample
  SELECT * INTO v_recipe
  FROM development_recipes
  WHERE id = v_sample.recipe_id;

  -- Generate display name: working_title (sample_code)
  v_display_name := p_working_title || ' (' || v_sample.sample_code || ')';

  -- Update sample status to HandedOff and set working_title
  UPDATE development_samples
  SET 
    status = 'HandedOff',
    working_title = p_working_title,
    updated_at = now()
  WHERE id = p_sample_id
  RETURNING * INTO v_sample;

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
  )
  VALUES (
    v_sample.request_id,
    v_sample.id,
    v_sample.sample_code,
    v_recipe.recipe_code,
    p_working_title,
    v_display_name,
    'pending',
    v_user_id,
    now()
  )
  RETURNING * INTO v_testing_sample;

  -- Log event
  PERFORM log_request_event(
    v_user_email,
    'SENT_FOR_TEST'::event_type,
    jsonb_build_object(
      'sample_id', v_sample.id,
      'sample_code', v_sample.sample_code,
      'working_title', p_working_title
    ),
    v_sample.request_id
  );

  -- Return result
  RETURN jsonb_build_object(
    'sample', jsonb_build_object(
      'id', v_sample.id,
      'sample_code', v_sample.sample_code,
      'status', v_sample.status,
      'working_title', v_sample.working_title
    ),
    'testing_sample', jsonb_build_object(
      'id', v_testing_sample.id,
      'display_name', v_testing_sample.display_name,
      'status', v_testing_sample.status
    )
  );
END;
$function$;