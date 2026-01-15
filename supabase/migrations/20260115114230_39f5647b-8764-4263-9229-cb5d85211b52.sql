-- Видаляємо стару політику
DROP POLICY IF EXISTS "Users can update purchase invoices" ON public.purchase_invoices;

-- Створюємо нову політику з WITH CHECK для переходів статусу
CREATE POLICY "Users can update purchase invoices" ON public.purchase_invoices
    FOR UPDATE
    USING (
        -- Автор може редагувати свої чернетки
        (created_by = auth.uid() AND status = 'DRAFT')
        OR
        -- COO може погоджувати/відхиляти рахунки, що очікують на COO
        (has_role(auth.uid(), 'coo'::app_role) AND status = 'PENDING_COO')
        OR
        -- CEO може погоджувати/відхиляти рахунки, що очікують на CEO або паралельно
        (has_role(auth.uid(), 'ceo'::app_role) AND status IN ('PENDING_CEO', 'PENDING_COO'))
        OR
        -- Treasurer може оновлювати рахунки TO_PAY
        (has_role(auth.uid(), 'treasurer'::app_role) AND status = 'TO_PAY')
        OR
        -- Chief accountant може оновлювати рахунки TO_PAY
        (has_role(auth.uid(), 'chief_accountant'::app_role) AND status = 'TO_PAY')
        OR
        -- Accountant може оновлювати оплачені рахунки
        (has_role(auth.uid(), 'accountant'::app_role) AND status = 'PAID')
        OR
        -- Procurement manager може оновлювати чернетки та рахунки на погодженні
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- Admin має повний доступ
        has_role(auth.uid(), 'admin'::app_role)
    )
    WITH CHECK (
        -- Автор: може зберігати як DRAFT або відправляти на погодження
        (created_by = auth.uid() AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- COO: може встановлювати DRAFT (відхилення), PENDING_CEO або TO_PAY (погодження)
        (has_role(auth.uid(), 'coo'::app_role) AND status IN ('DRAFT', 'PENDING_CEO', 'TO_PAY'))
        OR
        -- CEO: може встановлювати DRAFT (відхилення), PENDING_COO або TO_PAY (погодження)
        (has_role(auth.uid(), 'ceo'::app_role) AND status IN ('DRAFT', 'PENDING_COO', 'TO_PAY'))
        OR
        -- Treasurer/Chief Accountant: може встановлювати PAID
        ((has_role(auth.uid(), 'treasurer'::app_role) OR has_role(auth.uid(), 'chief_accountant'::app_role)) 
         AND status IN ('TO_PAY', 'PAID'))
        OR
        -- Accountant: може встановлювати DELIVERED
        (has_role(auth.uid(), 'accountant'::app_role) AND status IN ('PAID', 'DELIVERED'))
        OR
        -- Procurement manager: може оновлювати DRAFT або відправляти на погодження
        (has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- Admin: без обмежень
        has_role(auth.uid(), 'admin'::app_role)
    );