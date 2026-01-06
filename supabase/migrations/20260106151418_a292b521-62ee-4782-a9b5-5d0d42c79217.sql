-- Оновлення UPDATE політики для таблиці requests - додавання нових ролей

DROP POLICY IF EXISTS "R&D can update requests" ON requests;

CREATE POLICY "R&D can update requests" ON requests
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'rd_manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
  OR has_role(auth.uid(), 'admin_director'::app_role)
  OR (has_role(auth.uid(), 'rd_dev'::app_role) AND (
    responsible_email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR responsible_email IS NULL
  ))
);