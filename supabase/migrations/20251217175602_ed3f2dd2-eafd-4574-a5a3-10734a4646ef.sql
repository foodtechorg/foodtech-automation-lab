-- Оновлюємо політику UPDATE для purchase_requests
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
    )
    WITH CHECK (
        -- Автор може:
        -- 1. Редагувати свою чернетку (status = DRAFT)
        -- 2. Відправити чернетку на погодження (status = PENDING_APPROVAL)
        (created_by = auth.uid() AND status IN ('DRAFT', 'PENDING_APPROVAL'))
        OR
        -- COO може змінювати статус заявки на IN_PROGRESS або REJECTED
        (has_role(auth.uid(), 'coo'::app_role) AND status IN ('IN_PROGRESS', 'REJECTED'))
        OR
        -- Admin має повний доступ
        has_role(auth.uid(), 'admin'::app_role)
        OR
        -- Procurement manager може оновлювати заявки в роботі
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status = 'IN_PROGRESS')
    );