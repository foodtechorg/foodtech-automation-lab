-- Видаляємо стару політику
DROP POLICY IF EXISTS "Users can update purchase invoices" ON public.purchase_invoices;

-- Створюємо нову політику з розширеним WITH CHECK
CREATE POLICY "Users can update purchase invoices" ON public.purchase_invoices
    FOR UPDATE
    USING (
        -- Автор може редагувати свої чернетки
        (created_by = auth.uid() AND status = 'DRAFT')
        OR
        -- COO може оновлювати рахунки на погодженні (паралельне погодження)
        (public.has_role(auth.uid(), 'coo'::app_role) AND status IN ('PENDING_COO', 'PENDING_CEO'))
        OR
        -- CEO може оновлювати рахунки на погодженні (паралельне погодження)
        (public.has_role(auth.uid(), 'ceo'::app_role) AND status IN ('PENDING_COO', 'PENDING_CEO'))
        OR
        -- Treasurer може оновлювати рахунки TO_PAY
        (public.has_role(auth.uid(), 'treasurer'::app_role) AND status = 'TO_PAY')
        OR
        -- Chief accountant може оновлювати рахунки TO_PAY
        (public.has_role(auth.uid(), 'chief_accountant'::app_role) AND status = 'TO_PAY')
        OR
        -- Accountant може оновлювати оплачені рахунки
        (public.has_role(auth.uid(), 'accountant'::app_role) AND status = 'PAID')
        OR
        -- Procurement manager може оновлювати чернетки та рахунки на погодженні
        (public.has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- Admin має повний доступ
        public.has_role(auth.uid(), 'admin'::app_role)
    )
    WITH CHECK (
        -- Автор: може зберігати як DRAFT або відправляти на погодження
        (created_by = auth.uid() AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- COO: може встановлювати DRAFT (відхилення), PENDING_COO (після свого схвалення), PENDING_CEO або TO_PAY
        (public.has_role(auth.uid(), 'coo'::app_role) AND status IN ('DRAFT', 'PENDING_COO', 'PENDING_CEO', 'TO_PAY'))
        OR
        -- CEO: може встановлювати DRAFT (відхилення), PENDING_COO (залишається при схваленні), PENDING_CEO або TO_PAY
        (public.has_role(auth.uid(), 'ceo'::app_role) AND status IN ('DRAFT', 'PENDING_COO', 'PENDING_CEO', 'TO_PAY'))
        OR
        -- Treasurer/Chief Accountant: може встановлювати PAID
        ((public.has_role(auth.uid(), 'treasurer'::app_role) OR public.has_role(auth.uid(), 'chief_accountant'::app_role)) 
         AND status IN ('TO_PAY', 'PAID'))
        OR
        -- Accountant: може встановлювати DELIVERED
        (public.has_role(auth.uid(), 'accountant'::app_role) AND status IN ('PAID', 'DELIVERED'))
        OR
        -- Procurement manager: може оновлювати DRAFT або відправляти на погодження
        (public.has_role(auth.uid(), 'procurement_manager'::app_role) AND status IN ('DRAFT', 'PENDING_COO'))
        OR
        -- Admin: без обмежень
        public.has_role(auth.uid(), 'admin'::app_role)
    );