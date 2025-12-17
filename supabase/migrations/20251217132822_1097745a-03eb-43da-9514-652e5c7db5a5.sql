-- Add is_supplier_invoice column to distinguish supplier invoice files
ALTER TABLE public.purchase_invoice_attachments 
ADD COLUMN IF NOT EXISTS is_supplier_invoice BOOLEAN NOT NULL DEFAULT false;