-- ========================================
-- PROMPT #3: Samples (Зразки) Tables & Functions
-- ========================================

-- 1. Create enum for sample status
CREATE TYPE development_sample_status AS ENUM (
  'Draft',
  'Prepared',
  'Lab',
  'LabDone',
  'Pilot',
  'PilotDone',
  'ReadyForHandoff',
  'HandedOff',
  'Archived'
);

-- 2. Create development_samples table
CREATE TABLE public.development_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id),
  recipe_id uuid NOT NULL REFERENCES public.development_recipes(id),
  sample_seq integer NOT NULL CHECK (sample_seq >= 1 AND sample_seq <= 99),
  sample_code text NOT NULL,
  batch_weight_g numeric(12,3) NOT NULL CHECK (batch_weight_g > 0),
  status development_sample_status NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  
  -- Constraints
  CONSTRAINT unique_sample_seq_per_recipe UNIQUE (recipe_id, sample_seq),
  CONSTRAINT unique_sample_code_per_recipe UNIQUE (recipe_id, sample_code)
);

-- 3. Create development_sample_ingredients table
CREATE TABLE public.development_sample_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL REFERENCES public.development_samples(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  recipe_grams numeric(12,3) NOT NULL CHECK (recipe_grams > 0),
  required_grams numeric(12,3) NOT NULL CHECK (required_grams >= 0),
  lot_number text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.development_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_sample_ingredients ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for development_samples (Admin and COO access)
CREATE POLICY "Admin and COO can view development_samples"
  ON public.development_samples FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can create development_samples"
  ON public.development_samples FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can update development_samples"
  ON public.development_samples FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can delete development_samples"
  ON public.development_samples FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

-- 6. RLS Policies for development_sample_ingredients
CREATE POLICY "Admin and COO can view development_sample_ingredients"
  ON public.development_sample_ingredients FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can create development_sample_ingredients"
  ON public.development_sample_ingredients FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can update development_sample_ingredients"
  ON public.development_sample_ingredients FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

CREATE POLICY "Admin and COO can delete development_sample_ingredients"
  ON public.development_sample_ingredients FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coo'::app_role));

-- 7. Indexes
CREATE INDEX idx_samples_request ON public.development_samples(request_id);
CREATE INDEX idx_samples_recipe ON public.development_samples(recipe_id);
CREATE INDEX idx_samples_status ON public.development_samples(status);
CREATE INDEX idx_sample_ingredients_sample ON public.development_sample_ingredients(sample_id);

-- 8. Trigger for updated_at
CREATE TRIGGER update_development_samples_updated_at
  BEFORE UPDATE ON public.development_samples
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_development_sample_ingredients_updated_at
  BEFORE UPDATE ON public.development_sample_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- 9. RPC: create_development_sample
-- Creates sample with correct seq, code, and copies ingredients with calculations
-- ========================================
CREATE OR REPLACE FUNCTION public.create_development_sample(
  p_recipe_id uuid,
  p_batch_weight_g numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Check authorization
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'coo'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: requires admin or coo role';
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
$$;

-- ========================================
-- 10. RPC: recalculate_sample_ingredients
-- Recalculates required_grams when batch_weight_g changes (only for Draft samples)
-- ========================================
CREATE OR REPLACE FUNCTION public.recalculate_sample_ingredients(
  p_sample_id uuid,
  p_new_batch_weight_g numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sample public.development_samples;
  v_user_id UUID;
  v_total_recipe_grams NUMERIC;
  v_scale_factor NUMERIC;
  v_result JSONB;
BEGIN
  -- Check authorization
  v_user_id := auth.uid();
  IF NOT (has_role(v_user_id, 'admin'::app_role) OR has_role(v_user_id, 'coo'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: requires admin or coo role';
  END IF;

  -- Validate batch_weight_g
  IF p_new_batch_weight_g IS NULL OR p_new_batch_weight_g <= 0 THEN
    RAISE EXCEPTION 'batch_weight_g must be greater than 0';
  END IF;

  -- Get sample
  SELECT * INTO v_sample
  FROM public.development_samples
  WHERE id = p_sample_id;

  IF v_sample IS NULL THEN
    RAISE EXCEPTION 'Sample not found';
  END IF;

  -- Only allow recalculation for Draft samples
  IF v_sample.status != 'Draft' THEN
    RAISE EXCEPTION 'Cannot recalculate: sample must be in Draft status. Current status: %', v_sample.status;
  END IF;

  -- Calculate total recipe grams from sample ingredients
  SELECT COALESCE(SUM(recipe_grams), 0) INTO v_total_recipe_grams
  FROM public.development_sample_ingredients
  WHERE sample_id = p_sample_id;

  IF v_total_recipe_grams <= 0 THEN
    RAISE EXCEPTION 'Sample has no ingredients';
  END IF;

  -- Calculate new scale factor
  v_scale_factor := p_new_batch_weight_g / v_total_recipe_grams;

  -- Update sample batch_weight_g
  UPDATE public.development_samples
  SET batch_weight_g = p_new_batch_weight_g
  WHERE id = p_sample_id;

  -- Recalculate required_grams for all ingredients
  UPDATE public.development_sample_ingredients
  SET required_grams = ROUND(recipe_grams * v_scale_factor, 3)
  WHERE sample_id = p_sample_id;

  -- Build result
  SELECT jsonb_build_object(
    'sample', jsonb_build_object(
      'id', s.id,
      'request_id', s.request_id,
      'recipe_id', s.recipe_id,
      'sample_seq', s.sample_seq,
      'sample_code', s.sample_code,
      'batch_weight_g', s.batch_weight_g,
      'status', s.status,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'created_by', s.created_by
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
      WHERE si.sample_id = p_sample_id
    )
  ) INTO v_result
  FROM public.development_samples s
  WHERE s.id = p_sample_id;

  RETURN v_result;
END;
$$;