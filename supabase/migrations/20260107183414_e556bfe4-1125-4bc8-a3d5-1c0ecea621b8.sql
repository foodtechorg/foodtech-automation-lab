-- Виправлення security warnings: set search_path для нових функцій

-- 1. is_coo() - додати search_path
CREATE OR REPLACE FUNCTION public.is_coo()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  SELECT public.has_role('coo'::text)
$$;

-- 2. set_updated_at() - додати search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. kb_match_chunks() - додати search_path
CREATE OR REPLACE FUNCTION public.kb_match_chunks(
    query_embedding vector(1536),
    match_count INT DEFAULT 5,
    doc_status TEXT DEFAULT 'active'
)
RETURNS TABLE (
    document_id UUID,
    title TEXT,
    chunk_index INT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
    SELECT 
        c.document_id,
        d.title,
        c.chunk_index,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM public.kb_chunks c
    JOIN public.kb_documents d ON d.id = c.document_id
    WHERE d.status = doc_status
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$;