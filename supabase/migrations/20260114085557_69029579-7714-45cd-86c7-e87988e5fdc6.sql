-- Виправляємо функцію set_kb_documents_updated_at
-- Видаляємо посилання на неіснуючі колонки (description, original_filename, file_type, tags, author_id)

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
    OLD.category IS DISTINCT FROM NEW.category OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.access_level IS DISTINCT FROM NEW.access_level OR
    OLD.version IS DISTINCT FROM NEW.version OR
    OLD.raw_text IS DISTINCT FROM NEW.raw_text OR
    OLD.storage_bucket IS DISTINCT FROM NEW.storage_bucket OR
    OLD.storage_path IS DISTINCT FROM NEW.storage_path OR
    OLD.mime_type IS DISTINCT FROM NEW.mime_type
  ) THEN
    NEW.updated_at := now();
  ELSE
    -- Для полів індексації (index_status, index_error, indexed_at)
    -- зберігаємо попереднє значення updated_at
    NEW.updated_at := OLD.updated_at;
  END IF;
  
  RETURN NEW;
END;
$$;