-- Maintenance: Clean up kb_vector_documents and reset indexing statuses
-- This allows for full re-indexing of all documents

-- Step 1: Delete all records from kb_vector_documents
DELETE FROM public.kb_vector_documents;

-- Step 2: Reset index_status in kb_documents to allow re-indexing
UPDATE public.kb_documents 
SET 
    index_status = 'not_indexed', 
    indexed_at = NULL, 
    index_error = NULL
WHERE index_status IN ('pending', 'indexed', 'error');