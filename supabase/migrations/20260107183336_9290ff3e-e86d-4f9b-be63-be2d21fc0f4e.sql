-- ============================================
-- Модуль "Бібліотека знань" для RAG Telegram-бота
-- is_coo() використовує існуючу has_role('coo')
-- ============================================

-- 1. Увімкнути pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Функція is_coo() через існуючу has_role
-- Зв'язок: profiles.id = auth.uid() (підтверджено в useAuth.tsx)
CREATE OR REPLACE FUNCTION public.is_coo()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.has_role('coo'::text)
$$;

COMMENT ON FUNCTION public.is_coo() IS 'Перевіряє чи поточний користувач має роль COO. Використовує has_role(text).';

-- 3. Хелпер set_updated_at (якщо не існує)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4. Таблиця kb_documents
CREATE TABLE IF NOT EXISTS public.kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    version TEXT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    access_level TEXT NOT NULL DEFAULT 'coo_only',
    storage_bucket TEXT NULL,
    storage_path TEXT NULL,
    mime_type TEXT NULL,
    raw_text TEXT NULL,
    index_status TEXT NOT NULL DEFAULT 'not_indexed',
    indexed_at TIMESTAMPTZ NULL,
    index_error TEXT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT kb_documents_category_check CHECK (
        category IN ('SOP', 'OrgStructure', 'Policy', 'Instructions', 'BusinessProcess_BPMN', 'BusinessProcess_Text')
    ),
    CONSTRAINT kb_documents_status_check CHECK (status IN ('active', 'archived')),
    CONSTRAINT kb_documents_access_level_check CHECK (access_level IN ('coo_only')),
    CONSTRAINT kb_documents_index_status_check CHECK (
        index_status IN ('not_indexed', 'pending', 'indexed', 'error')
    )
);

-- Тригер updated_at для kb_documents
DROP TRIGGER IF EXISTS set_kb_documents_updated_at ON public.kb_documents;
CREATE TRIGGER set_kb_documents_updated_at
    BEFORE UPDATE ON public.kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Індекси для kb_documents
CREATE INDEX IF NOT EXISTS idx_kb_documents_category ON public.kb_documents(category);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON public.kb_documents(status);
CREATE INDEX IF NOT EXISTS idx_kb_documents_index_status ON public.kb_documents(index_status);

-- 5. Таблиця kb_chunks (для RAG)
CREATE TABLE IF NOT EXISTS public.kb_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Індекси для kb_chunks
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_id ON public.kb_chunks(document_id);

-- IVFFlat індекс для embedding (буде працювати після наповнення даними)
-- Для малої кількості даних спочатку буде seq scan, що нормально
CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding 
    ON public.kb_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 6. RPC для similarity search
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

COMMENT ON FUNCTION public.kb_match_chunks IS 'Пошук найближчих чанків для RAG. Використовується n8n з service_role.';

-- 7. RLS для kb_documents
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "COO can view kb_documents"
    ON public.kb_documents FOR SELECT
    USING (public.is_coo() OR public.has_role('admin'::text));

CREATE POLICY "COO can create kb_documents"
    ON public.kb_documents FOR INSERT
    WITH CHECK ((public.is_coo() OR public.has_role('admin'::text)) AND created_by = auth.uid());

CREATE POLICY "COO can update kb_documents"
    ON public.kb_documents FOR UPDATE
    USING (public.is_coo() OR public.has_role('admin'::text));

CREATE POLICY "COO can delete kb_documents"
    ON public.kb_documents FOR DELETE
    USING (public.is_coo() OR public.has_role('admin'::text));

-- 8. RLS для kb_chunks
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "COO can view kb_chunks"
    ON public.kb_chunks FOR SELECT
    USING (public.is_coo() OR public.has_role('admin'::text));

CREATE POLICY "COO can create kb_chunks"
    ON public.kb_chunks FOR INSERT
    WITH CHECK (public.is_coo() OR public.has_role('admin'::text));

CREATE POLICY "COO can update kb_chunks"
    ON public.kb_chunks FOR UPDATE
    USING (public.is_coo() OR public.has_role('admin'::text));

CREATE POLICY "COO can delete kb_chunks"
    ON public.kb_chunks FOR DELETE
    USING (public.is_coo() OR public.has_role('admin'::text));

-- 9. Storage bucket kb (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'kb', 
    'kb', 
    false, 
    52428800, -- 50MB
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/xml', 'text/xml', 'image/png', 'image/jpeg', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "COO can upload to kb bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'kb' 
        AND (public.is_coo() OR public.has_role('admin'::text))
    );

CREATE POLICY "COO can view kb bucket files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'kb' 
        AND (public.is_coo() OR public.has_role('admin'::text))
    );

CREATE POLICY "COO can update kb bucket files"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'kb' 
        AND (public.is_coo() OR public.has_role('admin'::text))
    );

CREATE POLICY "COO can delete kb bucket files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'kb' 
        AND (public.is_coo() OR public.has_role('admin'::text))
    );

-- 10. Коментарі
COMMENT ON TABLE public.kb_documents IS 'Документи бібліотеки знань для RAG Telegram-бота';
COMMENT ON TABLE public.kb_chunks IS 'Чанки документів з embeddings для similarity search';
COMMENT ON COLUMN public.kb_documents.raw_text IS 'Текст документа для індексації. На MVP заповнюється вручну.';