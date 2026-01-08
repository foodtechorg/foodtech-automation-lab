-- Create table for n8n Supabase Vector Store compatibility
CREATE TABLE public.kb_vector_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kb_vector_documents IS 'Vector store for KB documents, compatible with n8n Supabase Vector Store node';
COMMENT ON COLUMN public.kb_vector_documents.content IS 'Text content of the chunk';
COMMENT ON COLUMN public.kb_vector_documents.metadata IS 'JSON metadata: document_id, title, category, version, chunk_index, etc.';
COMMENT ON COLUMN public.kb_vector_documents.embedding IS 'OpenAI embedding vector (1536 dimensions)';

-- Add trigger for updated_at using existing function
CREATE TRIGGER set_kb_vector_documents_updated_at
  BEFORE UPDATE ON public.kb_vector_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Index on created_at for sorting/filtering
CREATE INDEX kb_vector_documents_created_at_idx 
  ON public.kb_vector_documents (created_at);

-- GIN index on metadata for fast JSON queries
CREATE INDEX kb_vector_documents_metadata_gin_idx 
  ON public.kb_vector_documents USING gin (metadata jsonb_path_ops);

-- IVFFLAT index for vector similarity search (cosine)
CREATE INDEX kb_vector_documents_embedding_ivfflat_idx 
  ON public.kb_vector_documents USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.kb_vector_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for COO and admin access
CREATE POLICY "COO can view kb_vector_documents"
  ON public.kb_vector_documents
  FOR SELECT
  USING (is_coo() OR has_role('admin'::text));

CREATE POLICY "COO can insert kb_vector_documents"
  ON public.kb_vector_documents
  FOR INSERT
  WITH CHECK (is_coo() OR has_role('admin'::text));

CREATE POLICY "COO can update kb_vector_documents"
  ON public.kb_vector_documents
  FOR UPDATE
  USING (is_coo() OR has_role('admin'::text));

CREATE POLICY "COO can delete kb_vector_documents"
  ON public.kb_vector_documents
  FOR DELETE
  USING (is_coo() OR has_role('admin'::text));