-- ============================================================================
-- PROCUREMENT MODULE (Закупівля ТМЦ) - STAGING ONLY SQL SCHEMA
-- ============================================================================
-- 
-- ⚠️  УВАГА! ЦЕЙ СКРИПТ ПРИЗНАЧЕНИЙ ТІЛЬКИ ДЛЯ STAGING!
-- 
-- Проект: foodtech_rd
-- Гілка Supabase: staging
-- Дата створення: 2025-01-XX
-- 
-- ❌ НЕ ЗАПУСКАЙТЕ ЦЕЙ СКРИПТ НА PRODUCTION!
-- ❌ Перед запуском на production потрібне окреме рішення та ревью.
-- 
-- Цей скрипт створює:
-- - Нові ENUM-типи для модуля закупівель
-- - Нові ролі (додаються до існуючого app_role)
-- - Таблиці: purchase_requests, purchase_request_items, purchase_invoices, 
--            purchase_invoice_items, purchase_logs
-- - Функції: generate_purchase_request_number(), generate_purchase_invoice_number(),
--            log_purchase_event()
-- - RLS-політики для всіх нових таблиць
-- 
-- Цей скрипт НЕ змінює:
-- - Таблиці R&D: requests, request_events, test_results
-- - Таблиці profiles, user_roles (крім додавання нових значень до app_role)
-- - Існуючі RLS-політики R&D-таблиць
-- 
-- Інструкція запуску:
-- 1. Зайдіть у Supabase Dashboard → проект foodtech_rd
-- 2. Переконайтесь, що ви на гілці STAGING
-- 3. Відкрийте SQL Editor
-- 4. Вставте цей скрипт
-- 5. Виконайте (Run)
-- 
-- ============================================================================


-- ============================================================================
-- ЧАСТИНА 1: ENUM-ТИПИ
-- ============================================================================

-- Тип закупівлі: ТМЦ або Послуга
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_type') THEN
        CREATE TYPE public.purchase_type AS ENUM ('TMC', 'SERVICE');
    END IF;
END $$;

-- Статус заявки на закупівлю
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_request_status') THEN
        CREATE TYPE public.purchase_request_status AS ENUM (
            'DRAFT',              -- Чернетка (можна редагувати)
            'PENDING_APPROVAL',   -- На погодженні COO
            'IN_PROGRESS',        -- В роботі (погоджено, можна створювати рахунки)
            'REJECTED'            -- Відхилено COO
        );
    END IF;
END $$;

-- Статус рахунку на оплату
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_invoice_status') THEN
        CREATE TYPE public.purchase_invoice_status AS ENUM (
            'DRAFT',              -- Чернетка
            'PENDING_COO',        -- На погодженні COO
            'PENDING_CEO',        -- На погодженні CEO
            'TO_PAY',             -- До оплати (погоджено, очікує оплати)
            'PAID',               -- Оплачено
            'DELIVERED',          -- Отримано (товар/послугу отримано)
            'REJECTED'            -- Відхилено
        );
    END IF;
END $$;

-- Статус окремої позиції закупівлі
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_item_status') THEN
        CREATE TYPE public.purchase_item_status AS ENUM (
            'PENDING',            -- Очікує обробки
            'IN_PROGRESS',        -- В роботі
            'ORDERED',            -- Замовлено
            'DELIVERED',          -- Отримано
            'REJECTED'            -- Відхилено/Скасовано
        );
    END IF;
END $$;

-- Умови оплати
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_terms') THEN
        CREATE TYPE public.payment_terms AS ENUM (
            'PREPAYMENT',         -- Передоплата
            'POSTPAYMENT'         -- Післяоплата
        );
    END IF;
END $$;

-- Рішення погодження
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_decision') THEN
        CREATE TYPE public.approval_decision AS ENUM (
            'PENDING',            -- Очікує рішення
            'APPROVED',           -- Погоджено
            'REJECTED'            -- Відхилено
        );
    END IF;
END $$;

-- Тип сутності для логування
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'purchase_log_entity_type') THEN
        CREATE TYPE public.purchase_log_entity_type AS ENUM (
            'REQUEST',            -- Заявка на закупівлю
            'INVOICE'             -- Рахунок
        );
    END IF;
END $$;


-- ============================================================================
-- ЧАСТИНА 2: НОВІ РОЛІ (додавання до існуючого app_role)
-- ============================================================================

-- Додаємо нові значення до існуючого enum app_role
-- Використовуємо DO блок для безпечного додавання (якщо значення вже є - пропускаємо)

DO $$ 
BEGIN
    -- procurement_manager - менеджер закупівель
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'procurement_manager' 
                   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'procurement_manager';
    END IF;
END $$;

DO $$ 
BEGIN
    -- coo - Chief Operating Officer (погоджує заявки та рахунки)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'coo' 
                   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'coo';
    END IF;
END $$;

DO $$ 
BEGIN
    -- ceo - Chief Executive Officer (фінальне погодження великих рахунків)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ceo' 
                   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'ceo';
    END IF;
END $$;

DO $$ 
BEGIN
    -- treasurer - казначей (виконує оплати)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'treasurer' 
                   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'treasurer';
    END IF;
END $$;

DO $$ 
BEGIN
    -- accountant - бухгалтер (фіксує отримання товарів)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accountant' 
                   AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
        ALTER TYPE public.app_role ADD VALUE 'accountant';
    END IF;
END $$;


-- ============================================================================
-- ЧАСТИНА 3: ТАБЛИЦІ
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Таблиця: purchase_requests (Заявки на закупівлю)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Номер заявки (генерується автоматично: ZK-0001, ZK-0002, ...)
    number TEXT UNIQUE NOT NULL,
    
    -- Тип закупівлі
    purchase_type public.purchase_type NOT NULL DEFAULT 'TMC',
    
    -- Статус заявки
    status public.purchase_request_status NOT NULL DEFAULT 'DRAFT',
    
    -- Загальний опис/коментар до заявки
    description TEXT,
    
    -- Бажана дата поставки
    desired_date TIMESTAMPTZ,
    
    -- Валюта (UAH, EUR, USD)
    currency TEXT NOT NULL DEFAULT 'UAH',
    
    -- Погодження COO
    coo_decision public.approval_decision DEFAULT 'PENDING',
    coo_comment TEXT,
    coo_decided_by UUID REFERENCES public.profiles(id),
    coo_decided_at TIMESTAMPTZ,
    
    -- Автор заявки
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    
    -- Службові поля
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Індекси для purchase_requests
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON public.purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_by ON public.purchase_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON public.purchase_requests(created_at DESC);

-- Тригер для оновлення updated_at
DROP TRIGGER IF EXISTS update_purchase_requests_updated_at ON public.purchase_requests;
CREATE TRIGGER update_purchase_requests_updated_at
    BEFORE UPDATE ON public.purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Таблиця: purchase_request_items (Позиції заявок на закупівлю)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_request_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Зв'язок із заявкою
    request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
    
    -- Найменування товару/послуги
    name TEXT NOT NULL,
    
    -- Одиниця виміру
    unit TEXT NOT NULL DEFAULT 'шт',
    
    -- Кількість
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 1,
    
    -- Статус позиції
    status public.purchase_item_status NOT NULL DEFAULT 'PENDING',
    
    -- Примітка до позиції
    note TEXT,
    
    -- Порядок сортування
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Службові поля
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Індекси для purchase_request_items
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request_id ON public.purchase_request_items(request_id);

-- Тригер для оновлення updated_at
DROP TRIGGER IF EXISTS update_purchase_request_items_updated_at ON public.purchase_request_items;
CREATE TRIGGER update_purchase_request_items_updated_at
    BEFORE UPDATE ON public.purchase_request_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Таблиця: purchase_invoices (Рахунки на оплату)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Номер рахунку (генерується автоматично: INV-0001, INV-0002, ...)
    number TEXT UNIQUE NOT NULL,
    
    -- Зв'язок із заявкою (опціонально - рахунок може бути без заявки)
    request_id UUID REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
    
    -- Статус рахунку
    status public.purchase_invoice_status NOT NULL DEFAULT 'DRAFT',
    
    -- Постачальник
    supplier_name TEXT NOT NULL,
    supplier_contact TEXT,
    
    -- Сума та валюта
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'UAH',
    
    -- Умови оплати
    payment_terms public.payment_terms NOT NULL DEFAULT 'PREPAYMENT',
    
    -- Дати
    invoice_date TIMESTAMPTZ,           -- Дата рахунку
    expected_date TIMESTAMPTZ,          -- Очікувана дата поставки
    planned_payment_date TIMESTAMPTZ,   -- Планова дата оплати
    
    -- Дані про оплату
    paid_date TIMESTAMPTZ,              -- Фактична дата оплати
    payment_doc_no TEXT,                -- Номер платіжного документа
    
    -- Дані про отримання
    delivered_date TIMESTAMPTZ,         -- Дата отримання товару/послуги
    delivery_note TEXT,                 -- Примітка про отримання
    
    -- Погодження COO
    coo_decision public.approval_decision DEFAULT 'PENDING',
    coo_comment TEXT,
    coo_decided_by UUID REFERENCES public.profiles(id),
    coo_decided_at TIMESTAMPTZ,
    
    -- Погодження CEO
    ceo_decision public.approval_decision DEFAULT 'PENDING',
    ceo_comment TEXT,
    ceo_decided_by UUID REFERENCES public.profiles(id),
    ceo_decided_at TIMESTAMPTZ,
    
    -- Загальний коментар
    description TEXT,
    
    -- Автор рахунку
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    
    -- Службові поля
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Індекси для purchase_invoices
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON public.purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_request_id ON public.purchase_invoices(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_by ON public.purchase_invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_at ON public.purchase_invoices(created_at DESC);

-- Тригер для оновлення updated_at
DROP TRIGGER IF EXISTS update_purchase_invoices_updated_at ON public.purchase_invoices;
CREATE TRIGGER update_purchase_invoices_updated_at
    BEFORE UPDATE ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Таблиця: purchase_invoice_items (Позиції рахунків)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Зв'язок із рахунком
    invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
    
    -- Зв'язок з позицією заявки (опціонально)
    request_item_id UUID REFERENCES public.purchase_request_items(id) ON DELETE SET NULL,
    
    -- Найменування
    name TEXT NOT NULL,
    
    -- Одиниця виміру
    unit TEXT NOT NULL DEFAULT 'шт',
    
    -- Кількість
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 1,
    
    -- Ціна за одиницю
    price NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- Сума (quantity * price)
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    
    -- Статус позиції
    status public.purchase_item_status NOT NULL DEFAULT 'PENDING',
    
    -- Примітка
    note TEXT,
    
    -- Порядок сортування
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Службові поля
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Індекси для purchase_invoice_items
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON public.purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_request_item_id ON public.purchase_invoice_items(request_item_id);

-- Тригер для оновлення updated_at
DROP TRIGGER IF EXISTS update_purchase_invoice_items_updated_at ON public.purchase_invoice_items;
CREATE TRIGGER update_purchase_invoice_items_updated_at
    BEFORE UPDATE ON public.purchase_invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Таблиця: purchase_logs (Історія змін/подій)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Тип сутності (заявка чи рахунок)
    entity_type public.purchase_log_entity_type NOT NULL,
    
    -- ID сутності
    entity_id UUID NOT NULL,
    
    -- Тип дії (CREATED, SUBMITTED, APPROVED, REJECTED, PAID, DELIVERED, COMMENT, etc.)
    action TEXT NOT NULL,
    
    -- Хто виконав дію
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    user_email TEXT NOT NULL,
    
    -- Коментар до дії
    comment TEXT,
    
    -- Додаткові дані (JSON)
    payload JSONB,
    
    -- Час події
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Індекси для purchase_logs
CREATE INDEX IF NOT EXISTS idx_purchase_logs_entity ON public.purchase_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_user_id ON public.purchase_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_logs_created_at ON public.purchase_logs(created_at DESC);


-- ============================================================================
-- ЧАСТИНА 4: ФУНКЦІЇ
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Функція: generate_purchase_request_number()
-- Генерує унікальний номер заявки у форматі ZK-0001
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_purchase_request_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_number INTEGER;
    new_number TEXT;
BEGIN
    -- Знаходимо максимальний номер і додаємо 1
    SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 4) AS INTEGER)), 0) + 1
    INTO next_number 
    FROM public.purchase_requests;
    
    -- Формуємо номер з лідируючими нулями
    new_number := 'ZK-' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$;

-- -----------------------------------------------------------------------------
-- Функція: generate_purchase_invoice_number()
-- Генерує унікальний номер рахунку у форматі INV-0001
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_purchase_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_number INTEGER;
    new_number TEXT;
BEGIN
    -- Знаходимо максимальний номер і додаємо 1
    SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 5) AS INTEGER)), 0) + 1
    INTO next_number 
    FROM public.purchase_invoices;
    
    -- Формуємо номер з лідируючими нулями
    new_number := 'INV-' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$;

-- -----------------------------------------------------------------------------
-- Функція: log_purchase_event()
-- Логує подію для заявки або рахунку
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_purchase_event(
    p_entity_type public.purchase_log_entity_type,
    p_entity_id UUID,
    p_action TEXT,
    p_comment TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_log_id UUID;
BEGIN
    -- Отримуємо дані поточного користувача
    SELECT id, email INTO v_user_id, v_user_email
    FROM public.profiles
    WHERE id = auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated or profile not found';
    END IF;
    
    -- Створюємо запис в логах
    INSERT INTO public.purchase_logs (
        entity_type, 
        entity_id, 
        action, 
        user_id, 
        user_email, 
        comment, 
        payload
    )
    VALUES (
        p_entity_type, 
        p_entity_id, 
        p_action, 
        v_user_id, 
        v_user_email, 
        p_comment, 
        p_payload
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


-- ============================================================================
-- ЧАСТИНА 5: RLS-ПОЛІТИКИ
-- ============================================================================

-- Вмикаємо RLS для всіх таблиць
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS для purchase_requests
-- -----------------------------------------------------------------------------

-- SELECT: Автор бачить свої заявки у всіх статусах
-- procurement_manager, coo, ceo, treasurer, admin бачать заявки не в DRAFT (або свої)
DROP POLICY IF EXISTS "Users can view purchase requests" ON public.purchase_requests;
CREATE POLICY "Users can view purchase requests" ON public.purchase_requests
    FOR SELECT
    USING (
        -- Автор бачить свої заявки
        (created_by = auth.uid())
        OR
        -- Менеджери та керівники бачать не-чернетки
        (
            status != 'DRAFT' 
            AND (
                has_role(auth.uid(), 'procurement_manager'::app_role)
                OR has_role(auth.uid(), 'coo'::app_role)
                OR has_role(auth.uid(), 'ceo'::app_role)
                OR has_role(auth.uid(), 'treasurer'::app_role)
                OR has_role(auth.uid(), 'accountant'::app_role)
                OR has_role(auth.uid(), 'admin'::app_role)
            )
        )
    );

-- INSERT: Усі авторизовані користувачі можуть створювати заявки
DROP POLICY IF EXISTS "Users can create purchase requests" ON public.purchase_requests;
CREATE POLICY "Users can create purchase requests" ON public.purchase_requests
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND created_by = auth.uid()
    );

-- UPDATE: Автор може редагувати свої чернетки, менеджери/керівники - відповідно до ролей
DROP POLICY IF EXISTS "Users can update purchase requests" ON public.purchase_requests;
CREATE POLICY "Users can update purchase requests" ON public.purchase_requests
    FOR UPDATE
    USING (
        -- Автор може редагувати свої чернетки
        (created_by = auth.uid() AND status = 'DRAFT')
        OR
        -- COO може погоджувати заявки на погодженні
        (has_role(auth.uid(), 'coo'::app_role) AND status = 'PENDING_APPROVAL')
        OR
        -- Admin має повний доступ
        has_role(auth.uid(), 'admin'::app_role)
        OR
        -- Procurement manager може оновлювати заявки в роботі
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status = 'IN_PROGRESS')
    );

-- DELETE: Тільки автор може видаляти свої чернетки
DROP POLICY IF EXISTS "Users can delete own draft requests" ON public.purchase_requests;
CREATE POLICY "Users can delete own draft requests" ON public.purchase_requests
    FOR DELETE
    USING (
        created_by = auth.uid() AND status = 'DRAFT'
    );

-- -----------------------------------------------------------------------------
-- RLS для purchase_request_items
-- -----------------------------------------------------------------------------

-- SELECT: Користувач бачить позиції своїх заявок або заявок, до яких має доступ
DROP POLICY IF EXISTS "Users can view purchase request items" ON public.purchase_request_items;
CREATE POLICY "Users can view purchase request items" ON public.purchase_request_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_requests pr
            WHERE pr.id = request_id
            AND (
                pr.created_by = auth.uid()
                OR (
                    pr.status != 'DRAFT'
                    AND (
                        has_role(auth.uid(), 'procurement_manager'::app_role)
                        OR has_role(auth.uid(), 'coo'::app_role)
                        OR has_role(auth.uid(), 'ceo'::app_role)
                        OR has_role(auth.uid(), 'treasurer'::app_role)
                        OR has_role(auth.uid(), 'accountant'::app_role)
                        OR has_role(auth.uid(), 'admin'::app_role)
                    )
                )
            )
        )
    );

-- INSERT: Користувач може додавати позиції до своїх чернеток
DROP POLICY IF EXISTS "Users can create purchase request items" ON public.purchase_request_items;
CREATE POLICY "Users can create purchase request items" ON public.purchase_request_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.purchase_requests pr
            WHERE pr.id = request_id
            AND pr.created_by = auth.uid()
            AND pr.status = 'DRAFT'
        )
    );

-- UPDATE: Користувач може оновлювати позиції своїх чернеток
DROP POLICY IF EXISTS "Users can update purchase request items" ON public.purchase_request_items;
CREATE POLICY "Users can update purchase request items" ON public.purchase_request_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_requests pr
            WHERE pr.id = request_id
            AND (
                (pr.created_by = auth.uid() AND pr.status = 'DRAFT')
                OR has_role(auth.uid(), 'admin'::app_role)
                OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND pr.status = 'IN_PROGRESS')
            )
        )
    );

-- DELETE: Користувач може видаляти позиції своїх чернеток
DROP POLICY IF EXISTS "Users can delete purchase request items" ON public.purchase_request_items;
CREATE POLICY "Users can delete purchase request items" ON public.purchase_request_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_requests pr
            WHERE pr.id = request_id
            AND pr.created_by = auth.uid()
            AND pr.status = 'DRAFT'
        )
    );

-- -----------------------------------------------------------------------------
-- RLS для purchase_invoices
-- -----------------------------------------------------------------------------

-- SELECT: Подібна логіка до заявок
DROP POLICY IF EXISTS "Users can view purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users can view purchase invoices" ON public.purchase_invoices
    FOR SELECT
    USING (
        -- Автор бачить свої рахунки
        (created_by = auth.uid())
        OR
        -- Менеджери та керівники бачать не-чернетки
        (
            status != 'DRAFT'
            AND (
                has_role(auth.uid(), 'procurement_manager'::app_role)
                OR has_role(auth.uid(), 'coo'::app_role)
                OR has_role(auth.uid(), 'ceo'::app_role)
                OR has_role(auth.uid(), 'treasurer'::app_role)
                OR has_role(auth.uid(), 'accountant'::app_role)
                OR has_role(auth.uid(), 'admin'::app_role)
            )
        )
    );

-- INSERT: procurement_manager та admin можуть створювати рахунки
DROP POLICY IF EXISTS "Users can create purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users can create purchase invoices" ON public.purchase_invoices
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND created_by = auth.uid()
        AND (
            has_role(auth.uid(), 'procurement_manager'::app_role)
            OR has_role(auth.uid(), 'admin'::app_role)
        )
    );

-- UPDATE: Різні ролі мають різні права на оновлення
DROP POLICY IF EXISTS "Users can update purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Users can update purchase invoices" ON public.purchase_invoices
    FOR UPDATE
    USING (
        -- Автор може редагувати свої чернетки
        (created_by = auth.uid() AND status = 'DRAFT')
        OR
        -- COO може погоджувати рахунки, що очікують на COO
        (has_role(auth.uid(), 'coo'::app_role) AND status = 'PENDING_COO')
        OR
        -- CEO може погоджувати рахунки, що очікують на CEO
        (has_role(auth.uid(), 'ceo'::app_role) AND status = 'PENDING_CEO')
        OR
        -- Treasurer може оновлювати рахунки TO_PAY (фіксувати оплату)
        (has_role(auth.uid(), 'treasurer'::app_role) AND status = 'TO_PAY')
        OR
        -- Accountant може оновлювати оплачені рахунки (фіксувати отримання)
        (has_role(auth.uid(), 'accountant'::app_role) AND status = 'PAID')
        OR
        -- Procurement manager може оновлювати рахунки в процесі
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- Admin має повний доступ
        has_role(auth.uid(), 'admin'::app_role)
    );

-- DELETE: Тільки автор може видаляти свої чернетки
DROP POLICY IF EXISTS "Users can delete own draft invoices" ON public.purchase_invoices;
CREATE POLICY "Users can delete own draft invoices" ON public.purchase_invoices
    FOR DELETE
    USING (
        created_by = auth.uid() AND status = 'DRAFT'
    );

-- -----------------------------------------------------------------------------
-- RLS для purchase_invoice_items
-- -----------------------------------------------------------------------------

-- SELECT: Доступ через батьківський рахунок
DROP POLICY IF EXISTS "Users can view purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users can view purchase invoice items" ON public.purchase_invoice_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_invoices pi
            WHERE pi.id = invoice_id
            AND (
                pi.created_by = auth.uid()
                OR (
                    pi.status != 'DRAFT'
                    AND (
                        has_role(auth.uid(), 'procurement_manager'::app_role)
                        OR has_role(auth.uid(), 'coo'::app_role)
                        OR has_role(auth.uid(), 'ceo'::app_role)
                        OR has_role(auth.uid(), 'treasurer'::app_role)
                        OR has_role(auth.uid(), 'accountant'::app_role)
                        OR has_role(auth.uid(), 'admin'::app_role)
                    )
                )
            )
        )
    );

-- INSERT: Через права на батьківський рахунок
DROP POLICY IF EXISTS "Users can create purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users can create purchase invoice items" ON public.purchase_invoice_items
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.purchase_invoices pi
            WHERE pi.id = invoice_id
            AND pi.created_by = auth.uid()
            AND pi.status = 'DRAFT'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
    );

-- UPDATE: Через права на батьківський рахунок
DROP POLICY IF EXISTS "Users can update purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users can update purchase invoice items" ON public.purchase_invoice_items
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_invoices pi
            WHERE pi.id = invoice_id
            AND (
                (pi.created_by = auth.uid() AND pi.status = 'DRAFT')
                OR has_role(auth.uid(), 'admin'::app_role)
            )
        )
    );

-- DELETE: Через права на батьківський рахунок
DROP POLICY IF EXISTS "Users can delete purchase invoice items" ON public.purchase_invoice_items;
CREATE POLICY "Users can delete purchase invoice items" ON public.purchase_invoice_items
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.purchase_invoices pi
            WHERE pi.id = invoice_id
            AND pi.created_by = auth.uid()
            AND pi.status = 'DRAFT'
        )
    );

-- -----------------------------------------------------------------------------
-- RLS для purchase_logs
-- -----------------------------------------------------------------------------

-- SELECT: Доступ до логів через доступ до відповідної сутності
DROP POLICY IF EXISTS "Users can view purchase logs" ON public.purchase_logs;
CREATE POLICY "Users can view purchase logs" ON public.purchase_logs
    FOR SELECT
    USING (
        -- Для заявок
        (
            entity_type = 'REQUEST'
            AND EXISTS (
                SELECT 1 FROM public.purchase_requests pr
                WHERE pr.id = entity_id
                AND (
                    pr.created_by = auth.uid()
                    OR (
                        pr.status != 'DRAFT'
                        AND (
                            has_role(auth.uid(), 'procurement_manager'::app_role)
                            OR has_role(auth.uid(), 'coo'::app_role)
                            OR has_role(auth.uid(), 'ceo'::app_role)
                            OR has_role(auth.uid(), 'treasurer'::app_role)
                            OR has_role(auth.uid(), 'accountant'::app_role)
                            OR has_role(auth.uid(), 'admin'::app_role)
                        )
                    )
                )
            )
        )
        OR
        -- Для рахунків
        (
            entity_type = 'INVOICE'
            AND EXISTS (
                SELECT 1 FROM public.purchase_invoices pi
                WHERE pi.id = entity_id
                AND (
                    pi.created_by = auth.uid()
                    OR (
                        pi.status != 'DRAFT'
                        AND (
                            has_role(auth.uid(), 'procurement_manager'::app_role)
                            OR has_role(auth.uid(), 'coo'::app_role)
                            OR has_role(auth.uid(), 'ceo'::app_role)
                            OR has_role(auth.uid(), 'treasurer'::app_role)
                            OR has_role(auth.uid(), 'accountant'::app_role)
                            OR has_role(auth.uid(), 'admin'::app_role)
                        )
                    )
                )
            )
        )
    );

-- INSERT: Логи створюються через функцію log_purchase_event (SECURITY DEFINER)
-- Тому політика INSERT не потрібна для звичайних користувачів
DROP POLICY IF EXISTS "System can create purchase logs" ON public.purchase_logs;
CREATE POLICY "System can create purchase logs" ON public.purchase_logs
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
    );


-- ============================================================================
-- КІНЕЦЬ СКРИПТА
-- ============================================================================
-- 
-- Після успішного виконання цього скрипта на STAGING ви матимете:
-- 
-- ✅ 7 нових ENUM-типів для модуля закупівель
-- ✅ 5 нових ролей додано до app_role
-- ✅ 5 нових таблиць:
--    - purchase_requests (заявки на закупівлю)
--    - purchase_request_items (позиції заявок)
--    - purchase_invoices (рахунки)
--    - purchase_invoice_items (позиції рахунків)
--    - purchase_logs (історія змін)
-- ✅ 3 функції:
--    - generate_purchase_request_number()
--    - generate_purchase_invoice_number()
--    - log_purchase_event()
-- ✅ RLS-політики для всіх таблиць
-- 
-- R&D-таблиці (requests, request_events, test_results) НЕ ЗМІНЕНІ!
-- ============================================================================
