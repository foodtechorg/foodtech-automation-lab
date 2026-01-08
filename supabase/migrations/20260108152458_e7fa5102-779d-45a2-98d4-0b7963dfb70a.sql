-- Повторне очищення тестових даних індексації

-- Крок 1: Видалити всі записи з kb_vector_documents
TRUNCATE TABLE public.kb_vector_documents;

-- Крок 2: Скинути статус індексації документів з 'pending' на 'not_indexed'
UPDATE public.kb_documents 
SET 
  index_status = 'not_indexed',
  index_error = NULL,
  indexed_at = NULL,
  updated_at = now()
WHERE index_status = 'pending';