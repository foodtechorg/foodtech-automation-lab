
-- Fix INV-0059 stuck in PENDING_COO despite both approvals
UPDATE purchase_invoices
SET status = 'TO_PAY'
WHERE number = 'INV-0059'
  AND coo_decision = 'APPROVED'
  AND ceo_decision = 'APPROVED'
  AND status = 'PENDING_COO';

-- Create function to auto-set TO_PAY when both sides approve
CREATE OR REPLACE FUNCTION fn_auto_approve_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.coo_decision = 'APPROVED'
     AND NEW.ceo_decision = 'APPROVED'
     AND NEW.status NOT IN ('TO_PAY', 'PAID', 'DELIVERED', 'REJECTED')
  THEN
    NEW.status := 'TO_PAY';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to prevent future race conditions
DROP TRIGGER IF EXISTS trg_auto_approve_invoice ON purchase_invoices;
CREATE TRIGGER trg_auto_approve_invoice
BEFORE UPDATE ON purchase_invoices
FOR EACH ROW EXECUTE FUNCTION fn_auto_approve_invoice();
