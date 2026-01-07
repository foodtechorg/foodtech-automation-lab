-- ============================================
-- Таблиця telegram_links для прив'язки Telegram до profiles
-- ============================================

-- 1. Створення таблиці
CREATE TABLE IF NOT EXISTS public.telegram_links (
    telegram_user_id BIGINT PRIMARY KEY,
    profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    phone TEXT NULL,
    role app_role NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraint для валідації status
    CONSTRAINT telegram_links_status_check CHECK (status IN ('active', 'blocked'))
);

-- 2. Індекси
CREATE INDEX IF NOT EXISTS idx_telegram_links_phone 
    ON public.telegram_links(phone);

CREATE INDEX IF NOT EXISTS idx_telegram_links_profile_id 
    ON public.telegram_links(profile_id);

-- 3. Тригер для автооновлення updated_at
DROP TRIGGER IF EXISTS update_telegram_links_updated_at ON public.telegram_links;

CREATE TRIGGER update_telegram_links_updated_at
    BEFORE UPDATE ON public.telegram_links
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Увімкнення RLS (без політик - доступ тільки через service_role)
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- 5. Коментарі для документації
COMMENT ON TABLE public.telegram_links IS 'Прив''язка Telegram користувачів до профілів Supabase для чат-бота';
COMMENT ON COLUMN public.telegram_links.telegram_user_id IS 'Telegram user ID (унікальний ідентифікатор користувача в Telegram)';
COMMENT ON COLUMN public.telegram_links.profile_id IS 'Посилання на профіль в Supabase';
COMMENT ON COLUMN public.telegram_links.phone IS 'Номер телефону у форматі E.164 (+380...)';
COMMENT ON COLUMN public.telegram_links.role IS 'Копія ролі з profiles для швидких перевірок';
COMMENT ON COLUMN public.telegram_links.status IS 'Статус: active або blocked';