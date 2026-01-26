-- Delete testing samples for RD-0028
DELETE FROM rd_request_testing_samples 
WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1';

-- Delete sample-related data (lab results, pilot, ingredients)
DELETE FROM development_sample_lab_results 
WHERE sample_id IN (
  SELECT id FROM development_samples 
  WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1'
);

DELETE FROM development_sample_pilot 
WHERE sample_id IN (
  SELECT id FROM development_samples 
  WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1'
);

DELETE FROM development_sample_ingredients 
WHERE sample_id IN (
  SELECT id FROM development_samples 
  WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1'
);

-- Delete samples
DELETE FROM development_samples 
WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1';

-- Delete recipe ingredients
DELETE FROM development_recipe_ingredients 
WHERE recipe_id IN (
  SELECT id FROM development_recipes 
  WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1'
);

-- Delete recipes
DELETE FROM development_recipes 
WHERE request_id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1';

-- Reset request status to IN_PROGRESS and clear successful sample reference
UPDATE requests 
SET status = 'IN_PROGRESS',
    successful_sample_id = NULL,
    successful_sample_display = NULL,
    date_sent_for_test = NULL,
    customer_result = NULL,
    customer_feedback = NULL,
    production_start_date = NULL
WHERE id = 'fa3f61d7-991b-41ad-b996-4764fd48b8d1';