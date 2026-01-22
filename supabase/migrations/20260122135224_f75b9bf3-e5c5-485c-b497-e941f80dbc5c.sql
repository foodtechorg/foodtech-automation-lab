-- Fix RPC functions to allow rd_dev role access for development module

-- 1. Update create_development_recipe to allow rd_dev
CREATE OR REPLACE FUNCTION public.create_development_recipe(p_request_id uuid)
 RETURNS development_recipes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_request_code TEXT;
    v_next_seq INTEGER;
    v_recipe_code TEXT;
    v_user_id UUID;
    v_new_recipe public.development_recipes;
BEGIN
    -- Check authorization - allow admin, coo, or rd_dev
    v_user_id := auth.uid();
    IF NOT (has_role(v_user_id, 'admin'::app_role) 
         OR has_role(v_user_id, 'coo'::app_role)
         OR has_role(v_user_id, 'rd_dev'::app_role)) THEN
        RAISE EXCEPTION 'Access denied: requires admin, coo, or rd_dev role';
    END IF;

    -- Get advisory lock on request_id to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_request_id::text));

    -- Get request code from requests table
    SELECT code INTO v_request_code
    FROM public.requests
    WHERE id = p_request_id AND status = 'IN_PROGRESS';

    IF v_request_code IS NULL THEN
        RAISE EXCEPTION 'Request not found or not in IN_PROGRESS status';
    END IF;

    -- Calculate next recipe_seq (max + 1, including archived)
    SELECT COALESCE(MAX(recipe_seq), 0) + 1 INTO v_next_seq
    FROM public.development_recipes
    WHERE request_id = p_request_id;

    -- Validate seq limit
    IF v_next_seq > 99 THEN
        RAISE EXCEPTION 'Maximum number of recipes (99) reached for this request';
    END IF;

    -- Generate recipe_code: RD-0004/01
    v_recipe_code := v_request_code || '/' || LPAD(v_next_seq::TEXT, 2, '0');

    -- Insert new recipe
    INSERT INTO public.development_recipes (
        request_id,
        recipe_seq,
        recipe_code,
        status,
        created_by
    ) VALUES (
        p_request_id,
        v_next_seq,
        v_recipe_code,
        'Draft',
        v_user_id
    )
    RETURNING * INTO v_new_recipe;

    RETURN v_new_recipe;
END;
$function$;

-- 2. Update copy_development_recipe to allow rd_dev
CREATE OR REPLACE FUNCTION public.copy_development_recipe(p_recipe_id uuid)
 RETURNS development_recipes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_source_recipe public.development_recipes;
    v_new_recipe public.development_recipes;
    v_request_code TEXT;
    v_next_seq INTEGER;
    v_recipe_code TEXT;
    v_user_id UUID;
    v_new_name TEXT;
BEGIN
    -- Check authorization - allow admin, coo, or rd_dev
    v_user_id := auth.uid();
    IF NOT (has_role(v_user_id, 'admin'::app_role) 
         OR has_role(v_user_id, 'coo'::app_role)
         OR has_role(v_user_id, 'rd_dev'::app_role)) THEN
        RAISE EXCEPTION 'Access denied: requires admin, coo, or rd_dev role';
    END IF;

    -- Get source recipe
    SELECT * INTO v_source_recipe
    FROM public.development_recipes
    WHERE id = p_recipe_id;

    IF v_source_recipe IS NULL THEN
        RAISE EXCEPTION 'Source recipe not found';
    END IF;

    -- Get advisory lock on request_id
    PERFORM pg_advisory_xact_lock(hashtext(v_source_recipe.request_id::text));

    -- Get request code
    SELECT code INTO v_request_code
    FROM public.requests
    WHERE id = v_source_recipe.request_id;

    -- Calculate next recipe_seq
    SELECT COALESCE(MAX(recipe_seq), 0) + 1 INTO v_next_seq
    FROM public.development_recipes
    WHERE request_id = v_source_recipe.request_id;

    IF v_next_seq > 99 THEN
        RAISE EXCEPTION 'Maximum number of recipes (99) reached for this request';
    END IF;

    -- Generate new recipe_code
    v_recipe_code := v_request_code || '/' || LPAD(v_next_seq::TEXT, 2, '0');

    -- Generate new name
    IF v_source_recipe.name IS NOT NULL AND v_source_recipe.name != '' THEN
        v_new_name := v_source_recipe.name || ' (копія)';
    ELSE
        v_new_name := NULL;
    END IF;

    -- Insert new recipe
    INSERT INTO public.development_recipes (
        request_id,
        recipe_seq,
        recipe_code,
        name,
        status,
        created_by
    ) VALUES (
        v_source_recipe.request_id,
        v_next_seq,
        v_recipe_code,
        v_new_name,
        'Draft',
        v_user_id
    )
    RETURNING * INTO v_new_recipe;

    -- Copy ingredients
    INSERT INTO public.development_recipe_ingredients (
        recipe_id,
        ingredient_name,
        grams,
        sort_order
    )
    SELECT
        v_new_recipe.id,
        ingredient_name,
        grams,
        sort_order
    FROM public.development_recipe_ingredients
    WHERE recipe_id = p_recipe_id
    ORDER BY sort_order;

    RETURN v_new_recipe;
END;
$function$;

-- 3. Update create_development_sample to allow rd_dev
CREATE OR REPLACE FUNCTION public.create_development_sample(p_recipe_id uuid, p_batch_weight_g numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recipe public.development_recipes;
  v_request_code TEXT;
  v_next_seq INTEGER;
  v_sample_code TEXT;
  v_user_id UUID;
  v_new_sample public.development_samples;
  v_total_recipe_grams NUMERIC;
  v_scale_factor NUMERIC;
  v_result JSONB;
BEGIN
  -- Check authorization - allow admin, coo, or rd_dev
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin'::app_role) 
       OR has_role(v_user_id, 'coo'::app_role)
       OR has_role(v_user_id, 'rd_dev'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: requires admin, coo, or rd_dev role';
  END IF;

  -- Validate batch_weight_g
  IF p_batch_weight_g IS NULL OR p_batch_weight_g <= 0 THEN
    RAISE EXCEPTION 'batch_weight_g must be greater than 0';
  END IF;

  -- Get advisory lock on recipe_id to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext(p_recipe_id::text));

  -- Get recipe and verify it's locked (status = 'Locked')
  SELECT * INTO v_recipe
  FROM public.development_recipes
  WHERE id = p_recipe_id;

  IF v_recipe IS NULL THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;

  IF v_recipe.status != 'Locked' THEN
    RAISE EXCEPTION 'Cannot create sample: recipe must be in "В роботі" (Locked) status. Current status: %', v_recipe.status;
  END IF;

  -- Get request code
  SELECT code INTO v_request_code
  FROM public.requests
  WHERE id = v_recipe.request_id;

  IF v_request_code IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- Calculate next sample_seq (max + 1, including archived)
  SELECT COALESCE(MAX(sample_seq), 0) + 1 INTO v_next_seq
  FROM public.development_samples
  WHERE recipe_id = p_recipe_id;

  -- Validate seq limit
  IF v_next_seq > 99 THEN
    RAISE EXCEPTION 'Maximum number of samples (99) reached for this recipe';
  END IF;

  -- Generate sample_code: RD-0004/01/01
  -- recipe_code already has format RD-xxxx/NN, we add /MM
  v_sample_code := v_recipe.recipe_code || '/' || LPAD(v_next_seq::TEXT, 2, '0');

  -- Calculate total recipe grams
  SELECT COALESCE(SUM(grams), 0) INTO v_total_recipe_grams
  FROM public.development_recipe_ingredients
  WHERE recipe_id = p_recipe_id;

  IF v_total_recipe_grams <= 0 THEN
    RAISE EXCEPTION 'Recipe has no ingredients or total grams is 0';
  END IF;

  -- Calculate scale factor
  v_scale_factor := p_batch_weight_g / v_total_recipe_grams;

  -- Insert new sample
  INSERT INTO public.development_samples (
    request_id,
    recipe_id,
    sample_seq,
    sample_code,
    batch_weight_g,
    status,
    created_by
  ) VALUES (
    v_recipe.request_id,
    p_recipe_id,
    v_next_seq,
    v_sample_code,
    p_batch_weight_g,
    'Draft',
    v_user_id
  )
  RETURNING * INTO v_new_sample;

  -- Copy ingredients from recipe to sample with calculations
  INSERT INTO public.development_sample_ingredients (
    sample_id,
    ingredient_name,
    recipe_grams,
    required_grams,
    lot_number,
    sort_order
  )
  SELECT
    v_new_sample.id,
    ingredient_name,
    grams,
    ROUND(grams * v_scale_factor, 3),
    NULL,
    sort_order
  FROM public.development_recipe_ingredients
  WHERE recipe_id = p_recipe_id
  ORDER BY sort_order;

  -- Build result with sample and ingredients
  SELECT jsonb_build_object(
    'sample', jsonb_build_object(
      'id', v_new_sample.id,
      'request_id', v_new_sample.request_id,
      'recipe_id', v_new_sample.recipe_id,
      'sample_seq', v_new_sample.sample_seq,
      'sample_code', v_new_sample.sample_code,
      'batch_weight_g', v_new_sample.batch_weight_g,
      'status', v_new_sample.status,
      'created_at', v_new_sample.created_at,
      'updated_at', v_new_sample.updated_at,
      'created_by', v_new_sample.created_by
    ),
    'ingredients', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'sample_id', si.sample_id,
          'ingredient_name', si.ingredient_name,
          'recipe_grams', si.recipe_grams,
          'required_grams', si.required_grams,
          'lot_number', si.lot_number,
          'sort_order', si.sort_order
        ) ORDER BY si.sort_order
      )
      FROM public.development_sample_ingredients si
      WHERE si.sample_id = v_new_sample.id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 4. Update copy_development_sample to add authorization check for rd_dev
CREATE OR REPLACE FUNCTION public.copy_development_sample(p_sample_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source_sample development_samples%ROWTYPE;
  v_new_sample development_samples%ROWTYPE;
  v_new_sample_seq integer;
  v_new_sample_code text;
  v_recipe_code text;
  v_ingredients jsonb;
  v_user_id UUID;
BEGIN
  -- Check authorization - allow admin, coo, or rd_dev
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin'::app_role) 
       OR has_role(v_user_id, 'coo'::app_role)
       OR has_role(v_user_id, 'rd_dev'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: requires admin, coo, or rd_dev role';
  END IF;

  -- Get source sample
  SELECT * INTO v_source_sample
  FROM development_samples
  WHERE id = p_sample_id;

  IF v_source_sample IS NULL THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Allow copying from all statuses except Draft and Archived
  IF v_source_sample.status IN ('Draft', 'Archived') THEN
    RAISE EXCEPTION 'Cannot copy samples in Draft or Archived status';
  END IF;

  -- Get recipe code for sample code generation
  SELECT recipe_code INTO v_recipe_code
  FROM development_recipes
  WHERE id = v_source_sample.recipe_id;

  -- Get next sample sequence within the recipe (use advisory lock)
  PERFORM pg_advisory_xact_lock(hashtext('sample_seq_' || v_source_sample.recipe_id::text));
  
  SELECT COALESCE(MAX(sample_seq), 0) + 1 INTO v_new_sample_seq
  FROM development_samples
  WHERE recipe_id = v_source_sample.recipe_id;

  -- Generate sample code: {RecipeCode}/{SampleSeq:02}
  v_new_sample_code := v_recipe_code || '/' || LPAD(v_new_sample_seq::text, 2, '0');

  -- Create new sample in Draft status with same batch_weight_g
  INSERT INTO development_samples (
    request_id,
    recipe_id,
    sample_seq,
    sample_code,
    batch_weight_g,
    status,
    created_by
  )
  VALUES (
    v_source_sample.request_id,
    v_source_sample.recipe_id,
    v_new_sample_seq,
    v_new_sample_code,
    v_source_sample.batch_weight_g,
    'Draft',
    v_user_id
  )
  RETURNING * INTO v_new_sample;

  -- Copy ingredients with lot numbers (but not lab results or pilot data)
  INSERT INTO development_sample_ingredients (
    sample_id,
    ingredient_name,
    recipe_grams,
    required_grams,
    lot_number,
    sort_order
  )
  SELECT
    v_new_sample.id,
    ingredient_name,
    recipe_grams,
    required_grams,
    lot_number,
    sort_order
  FROM development_sample_ingredients
  WHERE sample_id = p_sample_id
  ORDER BY sort_order;

  -- Get ingredients for the new sample
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'sample_id', sample_id,
      'ingredient_name', ingredient_name,
      'recipe_grams', recipe_grams,
      'required_grams', required_grams,
      'lot_number', lot_number,
      'sort_order', sort_order,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY sort_order
  ) INTO v_ingredients
  FROM development_sample_ingredients
  WHERE sample_id = v_new_sample.id;

  -- Return the new sample and ingredients as JSON
  RETURN jsonb_build_object(
    'sample', jsonb_build_object(
      'id', v_new_sample.id,
      'request_id', v_new_sample.request_id,
      'recipe_id', v_new_sample.recipe_id,
      'sample_seq', v_new_sample.sample_seq,
      'sample_code', v_new_sample.sample_code,
      'batch_weight_g', v_new_sample.batch_weight_g,
      'status', v_new_sample.status,
      'created_at', v_new_sample.created_at,
      'updated_at', v_new_sample.updated_at,
      'created_by', v_new_sample.created_by
    ),
    'ingredients', COALESCE(v_ingredients, '[]'::jsonb)
  );
END;
$function$;

-- 5. Update recalculate_sample_ingredients to allow rd_dev
CREATE OR REPLACE FUNCTION public.recalculate_sample_ingredients(p_sample_id uuid, p_new_batch_weight_g numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sample development_samples%ROWTYPE;
  v_total_recipe_grams numeric;
  v_scale_factor numeric;
  v_updated_sample development_samples%ROWTYPE;
  v_ingredients jsonb;
  v_user_id UUID;
BEGIN
  -- Check authorization - allow admin, coo, or rd_dev
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin'::app_role) 
       OR has_role(v_user_id, 'coo'::app_role)
       OR has_role(v_user_id, 'rd_dev'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: requires admin, coo, or rd_dev role';
  END IF;

  -- Validate batch weight
  IF p_new_batch_weight_g IS NULL OR p_new_batch_weight_g <= 0 THEN
    RAISE EXCEPTION 'Batch weight must be greater than 0';
  END IF;

  -- Get sample
  SELECT * INTO v_sample
  FROM development_samples
  WHERE id = p_sample_id;

  IF v_sample IS NULL THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Only allow recalculation for Draft samples
  IF v_sample.status != 'Draft' THEN
    RAISE EXCEPTION 'Can only recalculate ingredients for Draft samples';
  END IF;

  -- Calculate total recipe grams from sample ingredients
  SELECT COALESCE(SUM(recipe_grams), 0) INTO v_total_recipe_grams
  FROM development_sample_ingredients
  WHERE sample_id = p_sample_id;

  IF v_total_recipe_grams <= 0 THEN
    RAISE EXCEPTION 'Sample has no ingredients or total recipe grams is 0';
  END IF;

  -- Calculate scale factor
  v_scale_factor := p_new_batch_weight_g / v_total_recipe_grams;

  -- Update sample batch weight
  UPDATE development_samples
  SET 
    batch_weight_g = p_new_batch_weight_g,
    updated_at = now()
  WHERE id = p_sample_id
  RETURNING * INTO v_updated_sample;

  -- Update all ingredient required_grams (preserve lot_number)
  UPDATE development_sample_ingredients
  SET 
    required_grams = ROUND(recipe_grams * v_scale_factor, 3),
    updated_at = now()
  WHERE sample_id = p_sample_id;

  -- Get updated ingredients
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'sample_id', sample_id,
      'ingredient_name', ingredient_name,
      'recipe_grams', recipe_grams,
      'required_grams', required_grams,
      'lot_number', lot_number,
      'sort_order', sort_order,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY sort_order
  ) INTO v_ingredients
  FROM development_sample_ingredients
  WHERE sample_id = p_sample_id;

  -- Return updated sample and ingredients
  RETURN jsonb_build_object(
    'sample', jsonb_build_object(
      'id', v_updated_sample.id,
      'request_id', v_updated_sample.request_id,
      'recipe_id', v_updated_sample.recipe_id,
      'sample_seq', v_updated_sample.sample_seq,
      'sample_code', v_updated_sample.sample_code,
      'batch_weight_g', v_updated_sample.batch_weight_g,
      'status', v_updated_sample.status,
      'created_at', v_updated_sample.created_at,
      'updated_at', v_updated_sample.updated_at,
      'created_by', v_updated_sample.created_by
    ),
    'ingredients', COALESCE(v_ingredients, '[]'::jsonb)
  );
END;
$function$;

-- 6. Update handoff_sample_to_testing to allow rd_dev
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

  -- Verify sample is in ReadyForHandoff status
  IF v_sample.status != 'ReadyForHandoff' THEN
    RAISE EXCEPTION 'Sample must be in ReadyForHandoff status. Current status: %', v_sample.status;
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