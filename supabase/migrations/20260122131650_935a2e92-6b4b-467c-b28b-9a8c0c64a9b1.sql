-- ============================================
-- PART 2: Update RLS policies for Development module
-- Expand SELECT to all 6 roles, restrict MODIFY to admin + rd_dev
-- ============================================

-- 1. development_recipes - Update policies
DROP POLICY IF EXISTS "Admin and COO can view development_recipes" ON development_recipes;
DROP POLICY IF EXISTS "Admin and COO can create development_recipes" ON development_recipes;
DROP POLICY IF EXISTS "Admin and COO can update development_recipes" ON development_recipes;
DROP POLICY IF EXISTS "Admin and COO can delete development_recipes" ON development_recipes;

CREATE POLICY "View development_recipes"
  ON development_recipes FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_dev'::app_role) OR
    has_role(auth.uid(), 'coo'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'quality_manager'::app_role) OR
    has_role(auth.uid(), 'admin_director'::app_role)
  );

CREATE POLICY "Create development_recipes"
  ON development_recipes FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Update development_recipes"
  ON development_recipes FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Delete development_recipes"
  ON development_recipes FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

-- 2. development_recipe_ingredients - Update policies
DROP POLICY IF EXISTS "Admin and COO can view development_recipe_ingredients" ON development_recipe_ingredients;
DROP POLICY IF EXISTS "Admin and COO can create development_recipe_ingredients" ON development_recipe_ingredients;
DROP POLICY IF EXISTS "Admin and COO can update development_recipe_ingredients" ON development_recipe_ingredients;
DROP POLICY IF EXISTS "Admin and COO can delete development_recipe_ingredients" ON development_recipe_ingredients;

CREATE POLICY "View development_recipe_ingredients"
  ON development_recipe_ingredients FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_dev'::app_role) OR
    has_role(auth.uid(), 'coo'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'quality_manager'::app_role) OR
    has_role(auth.uid(), 'admin_director'::app_role)
  );

CREATE POLICY "Create development_recipe_ingredients"
  ON development_recipe_ingredients FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Update development_recipe_ingredients"
  ON development_recipe_ingredients FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Delete development_recipe_ingredients"
  ON development_recipe_ingredients FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

-- 3. development_samples - Update policies
DROP POLICY IF EXISTS "Admin and COO can view development_samples" ON development_samples;
DROP POLICY IF EXISTS "Admin and COO can create development_samples" ON development_samples;
DROP POLICY IF EXISTS "Admin and COO can update development_samples" ON development_samples;
DROP POLICY IF EXISTS "Admin and COO can delete development_samples" ON development_samples;

CREATE POLICY "View development_samples"
  ON development_samples FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_dev'::app_role) OR
    has_role(auth.uid(), 'coo'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'quality_manager'::app_role) OR
    has_role(auth.uid(), 'admin_director'::app_role)
  );

CREATE POLICY "Create development_samples"
  ON development_samples FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Update development_samples"
  ON development_samples FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Delete development_samples"
  ON development_samples FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

-- 4. development_sample_ingredients - Update policies
DROP POLICY IF EXISTS "Admin and COO can view development_sample_ingredients" ON development_sample_ingredients;
DROP POLICY IF EXISTS "Admin and COO can create development_sample_ingredients" ON development_sample_ingredients;
DROP POLICY IF EXISTS "Admin and COO can update development_sample_ingredients" ON development_sample_ingredients;
DROP POLICY IF EXISTS "Admin and COO can delete development_sample_ingredients" ON development_sample_ingredients;

CREATE POLICY "View development_sample_ingredients"
  ON development_sample_ingredients FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_dev'::app_role) OR
    has_role(auth.uid(), 'coo'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'quality_manager'::app_role) OR
    has_role(auth.uid(), 'admin_director'::app_role)
  );

CREATE POLICY "Create development_sample_ingredients"
  ON development_sample_ingredients FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Update development_sample_ingredients"
  ON development_sample_ingredients FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Delete development_sample_ingredients"
  ON development_sample_ingredients FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

-- 5. development_sample_lab_results - Update policies
DROP POLICY IF EXISTS "Admin and COO can view development_sample_lab_results" ON development_sample_lab_results;
DROP POLICY IF EXISTS "Admin and COO can create development_sample_lab_results" ON development_sample_lab_results;
DROP POLICY IF EXISTS "Admin and COO can update development_sample_lab_results" ON development_sample_lab_results;
DROP POLICY IF EXISTS "Admin and COO can delete development_sample_lab_results" ON development_sample_lab_results;

CREATE POLICY "View development_sample_lab_results"
  ON development_sample_lab_results FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_dev'::app_role) OR
    has_role(auth.uid(), 'coo'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'quality_manager'::app_role) OR
    has_role(auth.uid(), 'admin_director'::app_role)
  );

CREATE POLICY "Create development_sample_lab_results"
  ON development_sample_lab_results FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Update development_sample_lab_results"
  ON development_sample_lab_results FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Delete development_sample_lab_results"
  ON development_sample_lab_results FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

-- 6. development_sample_pilot - Update policies
DROP POLICY IF EXISTS "Allow admin and coo full access to pilot results" ON development_sample_pilot;

CREATE POLICY "View development_sample_pilot"
  ON development_sample_pilot FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'rd_dev'::app_role) OR
    has_role(auth.uid(), 'coo'::app_role) OR
    has_role(auth.uid(), 'ceo'::app_role) OR
    has_role(auth.uid(), 'quality_manager'::app_role) OR
    has_role(auth.uid(), 'admin_director'::app_role)
  );

CREATE POLICY "Create development_sample_pilot"
  ON development_sample_pilot FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Update development_sample_pilot"
  ON development_sample_pilot FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

CREATE POLICY "Delete development_sample_pilot"
  ON development_sample_pilot FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rd_dev'::app_role));

-- ============================================
-- PART 4: Delete test data for requests
-- RD-0004, RD-0009, RD-0014, RD-0015
-- ============================================

-- Request IDs based on codes from the screenshot:
-- We need to find the IDs by codes first, then delete related data

-- Delete pilot results
DELETE FROM development_sample_pilot 
WHERE sample_id IN (
  SELECT id FROM development_samples 
  WHERE request_id IN (
    SELECT id FROM requests WHERE code IN ('RD-0004', 'RD-0009', 'RD-0014', 'RD-0015')
  )
);

-- Delete lab results
DELETE FROM development_sample_lab_results 
WHERE sample_id IN (
  SELECT id FROM development_samples 
  WHERE request_id IN (
    SELECT id FROM requests WHERE code IN ('RD-0004', 'RD-0009', 'RD-0014', 'RD-0015')
  )
);

-- Delete sample ingredients
DELETE FROM development_sample_ingredients 
WHERE sample_id IN (
  SELECT id FROM development_samples 
  WHERE request_id IN (
    SELECT id FROM requests WHERE code IN ('RD-0004', 'RD-0009', 'RD-0014', 'RD-0015')
  )
);

-- Delete samples
DELETE FROM development_samples 
WHERE request_id IN (
  SELECT id FROM requests WHERE code IN ('RD-0004', 'RD-0009', 'RD-0014', 'RD-0015')
);

-- Delete recipe ingredients
DELETE FROM development_recipe_ingredients 
WHERE recipe_id IN (
  SELECT id FROM development_recipes 
  WHERE request_id IN (
    SELECT id FROM requests WHERE code IN ('RD-0004', 'RD-0009', 'RD-0014', 'RD-0015')
  )
);

-- Delete recipes
DELETE FROM development_recipes 
WHERE request_id IN (
  SELECT id FROM requests WHERE code IN ('RD-0004', 'RD-0009', 'RD-0014', 'RD-0015')
);