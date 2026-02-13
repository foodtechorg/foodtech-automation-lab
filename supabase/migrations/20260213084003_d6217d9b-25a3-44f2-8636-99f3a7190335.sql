
-- Step 1: Add business_analyst to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'business_analyst';
