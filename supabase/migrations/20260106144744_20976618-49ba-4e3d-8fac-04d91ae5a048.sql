-- Оновлення RLS політик для нових ролей в модулі R&D

-- 1. Оновлення політики SELECT для таблиці requests
DROP POLICY IF EXISTS "Sales managers can view own requests" ON requests;

CREATE POLICY "Users can view requests" ON requests
FOR SELECT USING (
  -- Sales manager бачить тільки свої заявки
  (has_role(auth.uid(), 'sales_manager'::app_role) AND (author_email = (
    SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
  )))
  -- R&D та адміни бачать все
  OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'rd_manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  -- Нові ролі з правами rd_manager
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
  OR has_role(auth.uid(), 'admin_director'::app_role)
);

-- 2. Оновлення політики SELECT для таблиці request_events
DROP POLICY IF EXISTS "Users can view events for accessible requests" ON request_events;

CREATE POLICY "Users can view events for accessible requests" ON request_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_events.request_id
    AND (
      has_role(auth.uid(), 'rd_dev'::app_role)
      OR has_role(auth.uid(), 'rd_manager'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'quality_manager'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
      OR (has_role(auth.uid(), 'sales_manager'::app_role) AND r.author_email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      ))
    )
  )
);

-- 3. Оновлення політики SELECT для таблиці test_results
DROP POLICY IF EXISTS "Users can view test results for accessible requests" ON test_results;

CREATE POLICY "Users can view test results for accessible requests" ON test_results
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = test_results.request_id
    AND (
      has_role(auth.uid(), 'rd_dev'::app_role)
      OR has_role(auth.uid(), 'rd_manager'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'quality_manager'::app_role)
      OR has_role(auth.uid(), 'admin_director'::app_role)
      OR (has_role(auth.uid(), 'sales_manager'::app_role) AND r.author_email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      ))
    )
  )
);