-- Add new values to development_recipe_status enum
ALTER TYPE development_recipe_status ADD VALUE IF NOT EXISTS 'Testing' AFTER 'Locked';
ALTER TYPE development_recipe_status ADD VALUE IF NOT EXISTS 'Approved' AFTER 'Testing';

-- Drop and recreate handoff_sample_to_testing function
DROP FUNCTION IF EXISTS public.handoff_sample_to_testing(uuid, text);

CREATE FUNCTION public.handoff_sample_to_testing(
  p_sample_id uuid,
  p_working_title text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample development_samples%ROWTYPE;
  v_recipe development_recipes%ROWTYPE;
  v_request requests%ROWTYPE;
  v_testing_sample rd_request_testing_samples%ROWTYPE;
  v_display_name text;
BEGIN
  -- Get sample with lock
  SELECT * INTO v_sample
  FROM development_samples
  WHERE id = p_sample_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;
  
  -- Check if sample is in correct status
  IF v_sample.status != 'PilotDone' THEN
    RAISE EXCEPTION 'Sample must be in PilotDone status to handoff. Current status: %', v_sample.status;
  END IF;
  
  -- Check if working title is provided
  IF p_working_title IS NULL OR trim(p_working_title) = '' THEN
    RAISE EXCEPTION 'Working title is required for handoff';
  END IF;
  
  -- Get recipe
  SELECT * INTO v_recipe
  FROM development_recipes
  WHERE id = v_sample.recipe_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;
  
  -- Check if recipe already has a sample in testing or approved
  IF EXISTS (
    SELECT 1 FROM development_samples 
    WHERE recipe_id = v_sample.recipe_id 
      AND status IN ('Testing', 'Approved')
      AND id != p_sample_id
  ) THEN
    RAISE EXCEPTION 'Recipe already has a sample in testing or approved. Create a new recipe to send another sample.';
  END IF;
  
  -- Get request
  SELECT * INTO v_request
  FROM requests
  WHERE id = v_sample.request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Build display name
  v_display_name := p_working_title || ' (' || v_sample.sample_code || ')';
  
  -- Update sample status and working_title
  UPDATE development_samples
  SET 
    status = 'Testing',
    working_title = p_working_title,
    updated_at = NOW()
  WHERE id = p_sample_id;
  
  -- Update recipe status to Testing
  UPDATE development_recipes
  SET 
    status = 'Testing',
    updated_at = NOW()
  WHERE id = v_sample.recipe_id;
  
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
    v_recipe.recipe_code,
    p_working_title,
    v_display_name,
    'Sent',
    auth.uid(),
    NOW()
  )
  RETURNING * INTO v_testing_sample;
  
  -- Update request status to SENT_FOR_TEST if not already
  IF v_request.status = 'IN_PROGRESS' THEN
    UPDATE requests
    SET 
      status = 'SENT_FOR_TEST',
      date_sent_for_test = NOW(),
      updated_at = NOW()
    WHERE id = v_sample.request_id;
  END IF;
  
  -- Return result
  RETURN jsonb_build_object(
    'testing_sample', row_to_json(v_testing_sample),
    'sample_code', v_sample.sample_code,
    'display_name', v_display_name
  );
END;
$$;

-- Drop and recreate set_sample_testing_result function
DROP FUNCTION IF EXISTS public.set_sample_testing_result(uuid, text, text);

CREATE FUNCTION public.set_sample_testing_result(
  p_testing_sample_id uuid,
  p_result text,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_testing_sample rd_request_testing_samples%ROWTYPE;
  v_sample development_samples%ROWTYPE;
  v_request requests%ROWTYPE;
  v_new_request_status status;
BEGIN
  -- Validate result
  IF p_result NOT IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid result. Must be Approved or Rejected';
  END IF;
  
  -- Get testing sample with lock
  SELECT * INTO v_testing_sample
  FROM rd_request_testing_samples
  WHERE id = p_testing_sample_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Testing sample not found';
  END IF;
  
  -- Check if already reviewed
  IF v_testing_sample.status != 'Sent' THEN
    RAISE EXCEPTION 'Testing sample already reviewed with status: %', v_testing_sample.status;
  END IF;
  
  -- Get the development sample
  SELECT * INTO v_sample
  FROM development_samples
  WHERE id = v_testing_sample.sample_id;
  
  -- Update testing sample
  UPDATE rd_request_testing_samples
  SET 
    status = p_result,
    manager_comment = p_comment,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_testing_sample_id
  RETURNING * INTO v_testing_sample;
  
  -- Update development sample status
  UPDATE development_samples
  SET 
    status = p_result::development_sample_status,
    updated_at = NOW()
  WHERE id = v_testing_sample.sample_id;
  
  -- Update recipe status based on result
  IF p_result = 'Approved' THEN
    UPDATE development_recipes
    SET 
      status = 'Approved',
      updated_at = NOW()
    WHERE id = v_sample.recipe_id;
  ELSE
    -- Rejected: return recipe to Locked so new samples can be created
    UPDATE development_recipes
    SET 
      status = 'Locked',
      updated_at = NOW()
    WHERE id = v_sample.recipe_id;
  END IF;
  
  -- Get request to check other samples
  SELECT * INTO v_request
  FROM requests
  WHERE id = v_testing_sample.request_id;
  
  -- Determine new request status
  IF p_result = 'Approved' THEN
    v_new_request_status := 'APPROVED_FOR_PRODUCTION';
    
    -- Update request with successful sample info
    UPDATE requests
    SET 
      status = v_new_request_status,
      successful_sample_id = v_testing_sample.sample_id,
      successful_sample_display = v_testing_sample.display_name,
      updated_at = NOW()
    WHERE id = v_testing_sample.request_id;
  ELSE
    -- Rejected - check if there are other samples still in testing
    IF EXISTS (
      SELECT 1 FROM rd_request_testing_samples
      WHERE request_id = v_testing_sample.request_id
        AND status = 'Sent'
        AND id != p_testing_sample_id
    ) THEN
      v_new_request_status := 'SENT_FOR_TEST';
    ELSE
      v_new_request_status := 'IN_PROGRESS';
      
      UPDATE requests
      SET 
        status = v_new_request_status,
        updated_at = NOW()
      WHERE id = v_testing_sample.request_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'result', p_result,
    'request_status', v_new_request_status::text
  );
END;
$$;