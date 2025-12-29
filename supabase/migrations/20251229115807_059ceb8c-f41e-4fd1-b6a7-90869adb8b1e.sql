-- Створення ENUM типу для рівня складності
CREATE TYPE complexity_level AS ENUM ('EASY', 'MEDIUM', 'COMPLEX', 'EXPERT');

-- Додавання поля complexity_level до таблиці requests
ALTER TABLE public.requests 
ADD COLUMN complexity_level complexity_level;