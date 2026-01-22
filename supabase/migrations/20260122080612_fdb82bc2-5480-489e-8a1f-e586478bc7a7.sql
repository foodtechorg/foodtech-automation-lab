-- Update copy_development_sample function to allow copying from all statuses except Draft and Archived
CREATE OR REPLACE FUNCTION public.copy_development_sample(p_sample_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_sample development_samples%ROWTYPE;
  v_new_sample development_samples%ROWTYPE;
  v_new_sample_seq integer;
  v_new_sample_code text;
  v_recipe_code text;
  v_ingredients jsonb;
BEGIN
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
    auth.uid()
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
$$;