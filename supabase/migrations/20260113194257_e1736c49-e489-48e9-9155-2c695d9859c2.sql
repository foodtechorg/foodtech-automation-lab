-- Reset pending document to not_indexed for re-indexing
UPDATE public.kb_documents 
SET 
    index_status = 'not_indexed', 
    indexed_at = NULL, 
    index_error = NULL
WHERE index_status = 'pending';