-- Очищення таблиці kb_vector_documents (видалення неякісних даних)
TRUNCATE TABLE kb_vector_documents;

-- Скидання статусу індексації для всіх документів, щоб їх можна було переіндексувати
UPDATE kb_documents 
SET index_status = 'not_indexed' 
WHERE index_status IN ('pending', 'indexed', 'error');