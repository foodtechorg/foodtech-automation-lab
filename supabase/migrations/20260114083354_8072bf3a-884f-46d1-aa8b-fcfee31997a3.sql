-- Увімкнути REPLICA IDENTITY FULL для повних даних в realtime
ALTER TABLE kb_documents REPLICA IDENTITY FULL;

-- Додати таблицю до realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE kb_documents;