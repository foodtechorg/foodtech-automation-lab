-- Update kb_documents access_level: remove old check constraint and set new valid values
-- Two access levels: 'open' (відкритий) and 'restricted' (обмежений)

-- Step 1: Drop the existing check constraint
ALTER TABLE public.kb_documents DROP CONSTRAINT IF EXISTS kb_documents_access_level_check;

-- Step 2: Change default value for access_level to 'open'
ALTER TABLE public.kb_documents ALTER COLUMN access_level SET DEFAULT 'open';

-- Step 3: Update all existing documents to 'open' access
UPDATE public.kb_documents SET access_level = 'open';

-- Step 4: Add new check constraint for valid values
ALTER TABLE public.kb_documents 
  ADD CONSTRAINT kb_documents_access_level_check 
  CHECK (access_level IN ('open', 'restricted'));