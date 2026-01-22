-- =============================================
-- PART 2: Handoff to Testing - RPC Functions
-- =============================================

-- B1. RPC: handoff_sample_to_testing
-- Transfers a sample from PilotDone status to Testing
CREATE OR REPLACE FUNCTION public.handoff_sample_to_testing(
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
  v_request requests%ROWTYPE;
  v_recipe development_recipes%ROWTYPE;
  v_testing_sample rd_request_testing_samples%ROWTYPE;
  v_display_name text;
  v_working_title_trimmed text;
BEGIN
  -- Trim working title
  v_working_title_trimmed := trim(p_working_title);
  
  -- Validate working_title is not empty
  IF v_working_title_trimmed IS NULL OR length(v_working_title_trimmed) = 0 THEN
    RAISE EXCEPTION 'Робоча назва не може бути порожньою';
  END IF;

  -- Get sample and lock it
  SELECT * INTO v_sample 
  FROM development_samples 
  WHERE id = p_sample_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Зразок не знайдено';
  END IF;
  
  -- Validate sample status is PilotDone
  IF v_sample.status != 'PilotDone' THEN
    RAISE EXCEPTION 'Зразок повинен мати статус "Пілот завершено" для передачі на тестування. Поточний статус: %', v_sample.status;
  END IF;
  
  -- Check sample hasn't been sent before
  IF EXISTS (SELECT 1 FROM rd_request_testing_samples WHERE sample_id = p_sample_id) THEN
    RAISE EXCEPTION 'Цей зразок вже був відправлений на тестування';
  END IF;
  
  -- Get request and validate status
  SELECT * INTO v_request 
  FROM requests 
  WHERE id = v_sample.request_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'R&D заявку не знайдено';
  END IF;
  
  -- Check request is not already closed
  IF v_request.status IN ('APPROVED_FOR_PRODUCTION', 'REJECTED_BY_CLIENT', 'CANCELLED') THEN
    RAISE EXCEPTION 'Неможливо відправити зразок на тестування - заявка вже закрита зі статусом: %', v_request.status;
  END IF;
  
  -- Get recipe for recipe_code
  SELECT * INTO v_recipe 
  FROM development_recipes 
  WHERE id = v_sample.recipe_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Рецепт не знайдено';
  END IF;
  
  -- Build display name
  v_display_name := v_working_title_trimmed || ' (' || v_sample.sample_code || ')';
  
  -- Update sample with working_title and status
  UPDATE development_samples 
  SET 
    working_title = v_working_title_trimmed,
    status = 'Testing',
    updated_at = now()
  WHERE id = p_sample_id;
  
  -- Insert testing sample record
  INSERT INTO rd_request_testing_samples (
    request_id,
    sample_id,
    sample_code,
    recipe_code,
    working_title,
    display_name,
    status,
    sent_by
  ) VALUES (
    v_sample.request_id,
    p_sample_id,
    v_sample.sample_code,
    v_recipe.recipe_code,
    v_working_title_trimmed,
    v_display_name,
    'Sent',
    auth.uid()
  )
  RETURNING * INTO v_testing_sample;
  
  -- Update request status to SENT_FOR_TEST if currently IN_PROGRESS
  IF v_request.status = 'IN_PROGRESS' THEN
    UPDATE requests 
    SET 
      status = 'SENT_FOR_TEST',
      date_sent_for_test = now(),
      updated_at = now()
    WHERE id = v_sample.request_id;
  END IF;
  
  -- Return the created testing sample
  RETURN jsonb_build_object(
    'testing_sample', row_to_json(v_testing_sample),
    'sample_code', v_sample.sample_code,
    'display_name', v_display_name
  );
END;
$$;

-- B2. RPC: set_sample_testing_result
-- Manager sets the testing result for a sample
CREATE OR REPLACE FUNCTION public.set_sample_testing_result(
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
  v_request requests%ROWTYPE;
  v_remaining_sent_count integer;
BEGIN
  -- Validate result value
  IF p_result NOT IN ('Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Результат повинен бути "Approved" або "Rejected"';
  END IF;

  -- Get testing sample and lock it
  SELECT * INTO v_testing_sample 
  FROM rd_request_testing_samples 
  WHERE id = p_testing_sample_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Запис тестування не знайдено';
  END IF;
  
  -- Check if already reviewed
  IF v_testing_sample.status != 'Sent' THEN
    RAISE EXCEPTION 'Цей зразок вже оцінено зі статусом: %', v_testing_sample.status;
  END IF;
  
  -- Get request and lock it
  SELECT * INTO v_request 
  FROM requests 
  WHERE id = v_testing_sample.request_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'R&D заявку не знайдено';
  END IF;
  
  -- Check request is not already approved (another sample won)
  IF v_request.status = 'APPROVED_FOR_PRODUCTION' THEN
    RAISE EXCEPTION 'Заявка вже закрита з успішним зразком';
  END IF;

  -- Update the testing sample record
  UPDATE rd_request_testing_samples 
  SET 
    status = p_result,
    manager_comment = p_comment,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  WHERE id = p_testing_sample_id;
  
  IF p_result = 'Approved' THEN
    -- Update development sample status to Approved
    UPDATE development_samples 
    SET 
      status = 'Approved',
      updated_at = now()
    WHERE id = v_testing_sample.sample_id;
    
    -- Update request to APPROVED_FOR_PRODUCTION
    UPDATE requests 
    SET 
      status = 'APPROVED_FOR_PRODUCTION',
      successful_sample_id = v_testing_sample.sample_id,
      successful_sample_display = v_testing_sample.display_name,
      updated_at = now()
    WHERE id = v_testing_sample.request_id;
    
    -- Reject all other Sent samples for this request
    UPDATE rd_request_testing_samples 
    SET 
      status = 'Rejected',
      manager_comment = COALESCE(manager_comment || E'\n', '') || 'Заявку закрито іншим зразком',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
    WHERE request_id = v_testing_sample.request_id 
      AND id != p_testing_sample_id
      AND status = 'Sent';
    
    -- Update those samples' statuses to Rejected
    UPDATE development_samples 
    SET 
      status = 'Rejected',
      updated_at = now()
    WHERE id IN (
      SELECT sample_id 
      FROM rd_request_testing_samples 
      WHERE request_id = v_testing_sample.request_id 
        AND id != p_testing_sample_id
        AND status = 'Rejected'
    )
    AND status = 'Testing';
    
  ELSE
    -- Result is Rejected
    -- Update development sample status to Rejected
    UPDATE development_samples 
    SET 
      status = 'Rejected',
      updated_at = now()
    WHERE id = v_testing_sample.sample_id;
    
    -- Count remaining Sent samples for this request
    SELECT COUNT(*) INTO v_remaining_sent_count
    FROM rd_request_testing_samples
    WHERE request_id = v_testing_sample.request_id
      AND status = 'Sent';
    
    -- If no more Sent samples, return request to IN_PROGRESS
    IF v_remaining_sent_count = 0 THEN
      UPDATE requests 
      SET 
        status = 'IN_PROGRESS',
        updated_at = now()
      WHERE id = v_testing_sample.request_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'result', p_result,
    'request_status', (SELECT status FROM requests WHERE id = v_testing_sample.request_id)
  );
END;
$$;

-- B3. RPC: decline_request_from_testing
-- Manager completely declines the request from testing stage
CREATE OR REPLACE FUNCTION public.decline_request_from_testing(
  p_request_id uuid,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request requests%ROWTYPE;
BEGIN
  -- Get request and lock it
  SELECT * INTO v_request 
  FROM requests 
  WHERE id = p_request_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'R&D заявку не знайдено';
  END IF;
  
  -- Check request is in testing status
  IF v_request.status != 'SENT_FOR_TEST' THEN
    RAISE EXCEPTION 'Заявка повинна бути в статусі "Тестування" для відмови. Поточний статус: %', v_request.status;
  END IF;
  
  -- Update request to REJECTED_BY_CLIENT
  UPDATE requests 
  SET 
    status = 'REJECTED_BY_CLIENT',
    customer_feedback = COALESCE(customer_feedback || E'\n', '') || 'Відмова від розробки: ' || COALESCE(p_comment, 'Без коментаря'),
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Reject all Sent testing samples
  UPDATE rd_request_testing_samples 
  SET 
    status = 'Rejected',
    manager_comment = COALESCE(manager_comment || E'\n', '') || 'Клієнт відмовився від розробки',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  WHERE request_id = p_request_id
    AND status = 'Sent';
  
  -- Update those samples' statuses to Rejected
  UPDATE development_samples 
  SET 
    status = 'Rejected',
    updated_at = now()
  WHERE id IN (
    SELECT sample_id 
    FROM rd_request_testing_samples 
    WHERE request_id = p_request_id
  )
  AND status = 'Testing';
  
  RETURN jsonb_build_object(
    'success', true,
    'request_status', 'REJECTED_BY_CLIENT'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.handoff_sample_to_testing(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sample_testing_result(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_request_from_testing(uuid, text) TO authenticated;