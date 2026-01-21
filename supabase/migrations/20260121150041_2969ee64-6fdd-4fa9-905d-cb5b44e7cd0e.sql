-- RPC to copy a development sample with all lot numbers preserved
CREATE OR REPLACE FUNCTION copy_development_sample(p_sample_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_sample development_samples%ROWTYPE;
  v_new_sample_id uuid;
  v_next_seq int;
  v_new_code text;
  v_recipe_code text;
BEGIN
  -- Get source sample
  SELECT * INTO v_source_sample FROM development_samples WHERE id = p_sample_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Only allow copying Prepared samples
  IF v_source_sample.status != 'Prepared' THEN
    RAISE EXCEPTION 'Only Prepared samples can be copied';
  END IF;

  -- Get recipe code
  SELECT recipe_code INTO v_recipe_code 
  FROM development_recipes WHERE id = v_source_sample.recipe_id;

  -- Get next sequence number for this recipe (using advisory lock for concurrency)
  PERFORM pg_advisory_xact_lock(hashtext('sample_seq_' || v_source_sample.recipe_id::text));
  
  SELECT COALESCE(MAX(sample_seq), 0) + 1 INTO v_next_seq
  FROM development_samples WHERE recipe_id = v_source_sample.recipe_id;

  -- Generate new sample code
  v_new_code := v_recipe_code || '/' || LPAD(v_next_seq::text, 2, '0');

  -- Create new sample as Draft
  INSERT INTO development_samples (
    request_id, recipe_id, sample_seq, sample_code, 
    batch_weight_g, status, created_by
  ) VALUES (
    v_source_sample.request_id,
    v_source_sample.recipe_id,
    v_next_seq,
    v_new_code,
    v_source_sample.batch_weight_g,
    'Draft',
    auth.uid()
  ) RETURNING id INTO v_new_sample_id;

  -- Copy all ingredients with lot_number preserved
  INSERT INTO development_sample_ingredients (
    sample_id, ingredient_name, recipe_grams, 
    required_grams, lot_number, sort_order
  )
  SELECT 
    v_new_sample_id,
    ingredient_name,
    recipe_grams,
    required_grams,
    lot_number,
    sort_order
  FROM development_sample_ingredients
  WHERE sample_id = p_sample_id
  ORDER BY sort_order;

  -- Return result
  RETURN jsonb_build_object(
    'sample', (SELECT to_jsonb(s) FROM development_samples s WHERE s.id = v_new_sample_id),
    'ingredients', (SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.sort_order), '[]'::jsonb)
                    FROM development_sample_ingredients i WHERE i.sample_id = v_new_sample_id)
  );
END;
$$;