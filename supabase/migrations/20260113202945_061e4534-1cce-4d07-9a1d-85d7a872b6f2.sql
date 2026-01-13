-- Clear kb_vector_documents table
DELETE FROM public.kb_vector_documents;

-- Reset pending documents to not_indexed
UPDATE public.kb_documents
SET index_status = 'not_indexed',
    indexed_at = NULL,
    index_error = NULL
WHERE index_status = 'pending';