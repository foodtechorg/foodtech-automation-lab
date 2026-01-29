-- Allow NULL recipe_id for quick handoff samples
ALTER TABLE development_samples 
ALTER COLUMN recipe_id DROP NOT NULL;

-- Create RPC function for quick handoff to testing
CREATE OR REPLACE FUNCTION public.quick_handoff_to_testing(
  p_request_id uuid,
  p_product_name text,
  p_weight_g numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_sample_seq integer;
  v_sample_code text;
  v_display_name text;
  v_sample_id uuid;
  v_actor_email text;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Verify request complexity is EASY
  IF v_request.complexity_level != 'EASY' THEN
    RAISE EXCEPTION 'Quick handoff is only available for EASY complexity requests';
  END IF;
  
  -- Validate inputs
  IF p_product_name IS NULL OR trim(p_product_name) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  
  IF p_weight_g IS NULL OR p_weight_g <= 0 THEN
    RAISE EXCEPTION 'Weight must be positive';
  END IF;
  
  -- Get actor email
  SELECT email INTO v_actor_email FROM profiles WHERE id = auth.uid();
  
  -- Calculate next sample sequence (Q1, Q2, Q3...)
  SELECT COALESCE(MAX(sample_seq), 0) + 1 INTO v_sample_seq
  FROM development_samples
  WHERE request_id = p_request_id;
  
  -- Generate sample code: RD-XXXX/Q1, RD-XXXX/Q2
  v_sample_code := v_request.code || '/Q' || v_sample_seq;
  
  -- Build display name
  v_display_name := p_product_name || ' (' || v_sample_code || ')';
  
  -- Create quick sample (no recipe, no ingredients)
  INSERT INTO development_samples (
    id,
    request_id,
    recipe_id,
    sample_seq,
    sample_code,
    batch_weight_g,
    status,
    working_title,
    created_by
  ) VALUES (
    gen_random_uuid(),
    p_request_id,
    NULL,
    v_sample_seq,
    v_sample_code,
    p_weight_g,
    'Testing',
    p_product_name,
    auth.uid()
  )
  RETURNING id INTO v_sample_id;
  
  -- Update request status to SENT_FOR_TEST
  UPDATE requests
  SET 
    status = 'SENT_FOR_TEST',
    date_sent_for_test = COALESCE(date_sent_for_test, now()),
    updated_at = now()
  WHERE id = p_request_id;
  
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
    p_request_id,
    v_sample_id,
    v_sample_code,
    'Швидка передача',
    p_product_name,
    v_display_name,
    'Sent',
    auth.uid(),
    now()
  );
  
  -- Log event to request chronology
  INSERT INTO request_events (request_id, actor_email, event_type, payload)
  VALUES (
    p_request_id,
    v_actor_email,
    'SAMPLE_SENT_FOR_TESTING',
    jsonb_build_object(
      'sample_id', v_sample_id,
      'sample_code', v_sample_code,
      'display_name', v_display_name,
      'working_title', p_product_name,
      'weight_g', p_weight_g,
      'quick_handoff', true
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'sample_id', v_sample_id,
    'sample_code', v_sample_code,
    'display_name', v_display_name,
    'request_status', 'SENT_FOR_TEST',
    'testing_sample', jsonb_build_object(
      'sample_id', v_sample_id,
      'sample_code', v_sample_code,
      'request_id', p_request_id
    )
  );
END;
$$;