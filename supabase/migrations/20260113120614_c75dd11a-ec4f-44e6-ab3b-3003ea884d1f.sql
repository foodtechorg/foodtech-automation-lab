-- Виправлення RLS UPDATE політики для purchase_invoices
-- Додаємо WITH CHECK clause для дозволу переходів статусів

DROP POLICY IF EXISTS "Users can update purchase invoices" ON public.purchase_invoices;

CREATE POLICY "Users can update purchase invoices" ON public.purchase_invoices
    FOR UPDATE
    USING (
        -- Хто може редагувати (поточний стан)
        (created_by = auth.uid() AND status = 'DRAFT')
        OR (has_role(auth.uid(), 'coo'::app_role) AND status = 'PENDING_COO')
        OR (has_role(auth.uid(), 'ceo'::app_role) AND status IN ('PENDING_COO', 'PENDING_CEO'))
        OR (has_role(auth.uid(), 'treasurer'::app_role) AND status = 'TO_PAY')
        OR (has_role(auth.uid(), 'accountant'::app_role) AND status = 'PAID')
        OR (has_role(auth.uid(), 'chief_accountant'::app_role) AND status IN ('TO_PAY', 'PAID'))
        OR (has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR has_role(auth.uid(), 'admin'::app_role)
    )
    WITH CHECK (
        -- На які стани можна перейти
        -- Автор чернетки може оновлювати та надсилати на погодження
        (created_by = auth.uid() AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- COO може погоджувати -> PENDING_COO/PENDING_CEO/TO_PAY або відхиляти -> REJECTED
        (has_role(auth.uid(), 'coo'::app_role) AND status IN ('PENDING_COO', 'PENDING_CEO', 'TO_PAY', 'REJECTED'))
        OR
        -- CEO може погоджувати -> PENDING_COO/PENDING_CEO/TO_PAY або відхиляти -> REJECTED
        (has_role(auth.uid(), 'ceo'::app_role) AND status IN ('PENDING_COO', 'PENDING_CEO', 'TO_PAY', 'REJECTED'))
        OR
        -- Treasurer може позначати як оплачено
        (has_role(auth.uid(), 'treasurer'::app_role) AND status IN ('TO_PAY', 'PAID'))
        OR
        -- Accountant / Chief Accountant може позначати як доставлено
        ((has_role(auth.uid(), 'accountant'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role)) 
         AND status IN ('PAID', 'DELIVERED'))
        OR
        -- Procurement manager
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- Admin має повний доступ
        has_role(auth.uid(), 'admin'::app_role)
    );