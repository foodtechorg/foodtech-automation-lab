-- Оновлення RLS-політики для purchase_invoice_attachments
DROP POLICY IF EXISTS "Users can view invoice attachments" ON purchase_invoice_attachments;

CREATE POLICY "Users can view invoice attachments"
  ON purchase_invoice_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_invoices pi
      WHERE pi.id = purchase_invoice_attachments.invoice_id
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

-- Оновлення RLS-політики для purchase_request_attachments
DROP POLICY IF EXISTS "Users can view request attachments" ON purchase_request_attachments;

CREATE POLICY "Users can view request attachments"
  ON purchase_request_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_requests pr
      WHERE pr.id = purchase_request_attachments.request_id
      AND (
        pr.created_by = auth.uid()
        OR (
          pr.status != 'DRAFT'
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