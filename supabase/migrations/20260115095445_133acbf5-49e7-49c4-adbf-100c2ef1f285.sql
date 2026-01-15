-- Add new status values to purchase_request_status ENUM
ALTER TYPE public.purchase_request_status ADD VALUE IF NOT EXISTS 'INVOICE_PENDING' AFTER 'IN_PROGRESS';
ALTER TYPE public.purchase_request_status ADD VALUE IF NOT EXISTS 'DELIVERING' AFTER 'INVOICE_PENDING';
ALTER TYPE public.purchase_request_status ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'DELIVERING';