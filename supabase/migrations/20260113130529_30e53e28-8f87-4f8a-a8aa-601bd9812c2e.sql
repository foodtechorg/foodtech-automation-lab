-- Оновлення RLS-політики для purchase_invoice_items
DROP POLICY IF EXISTS "Users can view purchase invoice items" ON purchase_invoice_items;

CREATE POLICY "Users can view purchase invoice items"
  ON purchase_invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_invoices pi
      WHERE pi.id = purchase_invoice_items.invoice_id
      AND (
        pi.created_by = auth.uid()
        OR (
          pi.status != 'DRAFT'
          AND (
            has_role(auth.uid(), 'procurement_manager') OR
            has_role(auth.uid(), 'coo') OR
            has_role(auth.uid(), 'ceo') OR
            has_role(auth.uid(), 'treasurer') OR
            has_role(auth.uid(), 'chief_accountant') OR
            has_role(auth.uid(), 'accountant') OR
            has_role(auth.uid(), 'admin')
          )
        )
      )
    )
  );