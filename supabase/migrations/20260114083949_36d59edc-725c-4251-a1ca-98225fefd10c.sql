-- Оновлюємо функцію set_updated_at для kb_documents,
-- яка НЕ змінює updated_at при оновленні полів індексації

CREATE OR REPLACE FUNCTION public.set_kb_documents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Перевіряємо, чи змінились "змістові" поля документа
  -- Якщо змінились ТІЛЬКИ поля індексації - НЕ оновлюємо updated_at
  IF (
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.category IS DISTINCT FROM NEW.category OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.access_level IS DISTINCT FROM NEW.access_level OR
    OLD.version IS DISTINCT FROM NEW.version OR
    OLD.raw_text IS DISTINCT FROM NEW.raw_text OR
    OLD.storage_bucket IS DISTINCT FROM NEW.storage_bucket OR
    OLD.storage_path IS DISTINCT FROM NEW.storage_path OR
    OLD.original_filename IS DISTINCT FROM NEW.original_filename OR
    OLD.file_type IS DISTINCT FROM NEW.file_type OR
    OLD.tags IS DISTINCT FROM NEW.tags OR
    OLD.author_id IS DISTINCT FROM NEW.author_id
  ) THEN
    NEW.updated_at := now();
  ELSE
    -- Для полів індексації (index_status, index_error, index_text, indexed_at)
    -- зберігаємо попереднє значення updated_at
    NEW.updated_at := OLD.updated_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Видаляємо старий тригер
DROP TRIGGER IF EXISTS set_kb_documents_updated_at ON public.kb_documents;

-- Створюємо новий тригер з оновленою логікою
CREATE TRIGGER set_kb_documents_updated_at
    BEFORE UPDATE ON public.kb_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_kb_documents_updated_at();