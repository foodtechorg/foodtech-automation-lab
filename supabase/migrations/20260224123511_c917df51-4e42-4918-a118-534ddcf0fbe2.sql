
-- ============================================================
-- Migration 2: Raw Material tables, triggers, RLS
-- ============================================================

-- 1. New enums
CREATE TYPE public.raw_material_invoice_status AS ENUM (
  'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED',
  'SENDING_TO_1C', 'PO_CREATED_1C', 'INTEGRATION_ERROR', 'CANCELLED'
);

CREATE TYPE public.payer_entity AS ENUM ('FOODTECH', 'FOP');

-- 2. Enable pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================
-- 3. Cache tables
-- ============================================================

CREATE TABLE public.suppliers_1c_cache (
  supplier_1c_id text PRIMARY KEY,
  name text NOT NULL,
  tax_id text,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_1c_cache_name_trgm ON public.suppliers_1c_cache USING gin (name extensions.gin_trgm_ops);
CREATE INDEX idx_suppliers_1c_cache_tax_id ON public.suppliers_1c_cache USING btree (tax_id);

CREATE TABLE public.raw_materials_1c_cache (
  raw_material_1c_id text PRIMARY KEY,
  name text NOT NULL,
  default_uom text NOT NULL DEFAULT 'кг',
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_raw_materials_1c_cache_name_trgm ON public.raw_materials_1c_cache USING gin (name extensions.gin_trgm_ops);

-- ============================================================
-- 4. Main table: raw_material_invoices
-- ============================================================

CREATE TABLE public.raw_material_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL DEFAULT '',
  status public.raw_material_invoice_status NOT NULL DEFAULT 'DRAFT',
  approval_round integer NOT NULL DEFAULT 1,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,

  supplier_1c_id text NOT NULL,
  supplier_name text NOT NULL,
  supplier_tax_id text,

  payer_entity public.payer_entity NOT NULL,

  expected_delivery_date date,
  planned_payment_date date,

  comment text,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UAH',

  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  admin_director_decision public.approval_decision,
  admin_director_comment text,
  admin_director_decided_by uuid REFERENCES public.profiles(id),
  admin_director_decided_at timestamptz,

  coo_decision public.approval_decision,
  coo_comment text,
  coo_decided_by uuid REFERENCES public.profiles(id),
  coo_decided_at timestamptz,

  ceo_decision public.approval_decision,
  ceo_comment text,
  ceo_decided_by uuid REFERENCES public.profiles(id),
  ceo_decided_at timestamptz,

  one_c_po_id text,
  one_c_po_number text,
  one_c_po_date date,
  integration_error_message text,
  integration_status text,
  integration_idempotency_key text UNIQUE
);

-- ============================================================
-- 5. Items table
-- ============================================================

CREATE TABLE public.raw_material_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.raw_material_invoices(id) ON DELETE CASCADE,
  raw_material_1c_id text NOT NULL,
  raw_material_name text NOT NULL,
  uom text NOT NULL DEFAULT 'кг',
  qty numeric NOT NULL CHECK (qty > 0),
  price numeric NOT NULL CHECK (price >= 0),
  line_amount numeric GENERATED ALWAYS AS (qty * price) STORED,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Attachments table
-- ============================================================

CREATE TABLE public.raw_material_invoice_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.raw_material_invoices(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  is_supplier_invoice boolean NOT NULL DEFAULT false,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. Auto-numbering trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_raw_material_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_seq integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(number, '^RAW-', ''), '') AS integer)
  ), 0) + 1
  INTO next_seq
  FROM public.raw_material_invoices;

  NEW.number := 'RAW-' || LPAD(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_raw_material_invoice_auto_number
  BEFORE INSERT ON public.raw_material_invoices
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION public.generate_raw_material_invoice_number();

-- ============================================================
-- 8. Parallel approval trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.raw_material_invoice_approval_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'SUBMITTED' THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_director_decision = 'REJECTED'
     OR NEW.coo_decision = 'REJECTED'
     OR NEW.ceo_decision = 'REJECTED'
  THEN
    NEW.status := 'REJECTED';
    RETURN NEW;
  END IF;

  IF NEW.admin_director_decision = 'APPROVED'
     AND NEW.coo_decision = 'APPROVED'
     AND NEW.ceo_decision = 'APPROVED'
  THEN
    NEW.status := 'APPROVED';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_raw_material_invoice_approval
  BEFORE UPDATE ON public.raw_material_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.raw_material_invoice_approval_check();

-- ============================================================
-- 9. updated_at triggers
-- ============================================================

CREATE TRIGGER update_raw_material_invoice_items_updated_at
  BEFORE UPDATE ON public.raw_material_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_raw_material_invoices_updated_at
  BEFORE UPDATE ON public.raw_material_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 10. RLS
-- ============================================================

-- raw_material_invoices
ALTER TABLE public.raw_material_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raw_inv_select" ON public.raw_material_invoices FOR SELECT USING (
  created_by = auth.uid()
  OR (
    status <> 'DRAFT'
    AND (
      has_role(auth.uid(), 'admin_director'::app_role)
      OR has_role(auth.uid(), 'coo'::app_role)
      OR has_role(auth.uid(), 'ceo'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'business_analyst'::app_role)
      OR has_role(auth.uid(), 'treasurer'::app_role)
      OR has_role(auth.uid(), 'chief_accountant'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
      OR has_role(auth.uid(), 'financial_analyst'::app_role)
    )
  )
);

CREATE POLICY "raw_inv_insert" ON public.raw_material_invoices FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND (
    has_role(auth.uid(), 'foreign_trade_manager'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "raw_inv_update" ON public.raw_material_invoices FOR UPDATE USING (
  (created_by = auth.uid() AND status IN ('DRAFT', 'REJECTED'))
  OR (has_role(auth.uid(), 'admin_director'::app_role) AND status = 'SUBMITTED')
  OR (has_role(auth.uid(), 'coo'::app_role) AND status = 'SUBMITTED')
  OR (has_role(auth.uid(), 'ceo'::app_role) AND status = 'SUBMITTED')
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "raw_inv_delete" ON public.raw_material_invoices FOR DELETE USING (
  created_by = auth.uid() AND status = 'DRAFT'
);

-- raw_material_invoice_items
ALTER TABLE public.raw_material_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raw_inv_items_select" ON public.raw_material_invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.raw_material_invoices ri WHERE ri.id = invoice_id)
);

CREATE POLICY "raw_inv_items_insert" ON public.raw_material_invoice_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.raw_material_invoices ri
    WHERE ri.id = invoice_id AND ri.created_by = auth.uid() AND ri.status IN ('DRAFT', 'REJECTED')
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "raw_inv_items_update" ON public.raw_material_invoice_items FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.raw_material_invoices ri
    WHERE ri.id = invoice_id
      AND ((ri.created_by = auth.uid() AND ri.status IN ('DRAFT', 'REJECTED')) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "raw_inv_items_delete" ON public.raw_material_invoice_items FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.raw_material_invoices ri
    WHERE ri.id = invoice_id AND ri.created_by = auth.uid() AND ri.status IN ('DRAFT', 'REJECTED')
  )
);

-- raw_material_invoice_attachments
ALTER TABLE public.raw_material_invoice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raw_inv_attach_select" ON public.raw_material_invoice_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.raw_material_invoices ri WHERE ri.id = invoice_id)
);

CREATE POLICY "raw_inv_attach_insert" ON public.raw_material_invoice_attachments FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.raw_material_invoices ri
    WHERE ri.id = invoice_id AND ri.created_by = auth.uid() AND ri.status IN ('DRAFT', 'REJECTED')
  )
);

CREATE POLICY "raw_inv_attach_delete" ON public.raw_material_invoice_attachments FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.raw_material_invoices ri
    WHERE ri.id = invoice_id AND ri.created_by = auth.uid() AND ri.status IN ('DRAFT', 'REJECTED')
  )
);

-- Cache tables — read only for authenticated
ALTER TABLE public.suppliers_1c_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_cache_select" ON public.suppliers_1c_cache FOR SELECT USING (auth.uid() IS NOT NULL);

ALTER TABLE public.raw_materials_1c_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_materials_cache_select" ON public.raw_materials_1c_cache FOR SELECT USING (auth.uid() IS NOT NULL);

-- purchase_logs — extend for RAW_INVOICE
CREATE POLICY "Users can view raw invoice logs" ON public.purchase_logs FOR SELECT USING (
  entity_type = 'RAW_INVOICE'
  AND EXISTS (
    SELECT 1 FROM public.raw_material_invoices ri
    WHERE ri.id = purchase_logs.entity_id
      AND (
        ri.created_by = auth.uid()
        OR (ri.status <> 'DRAFT' AND (
          has_role(auth.uid(), 'admin_director'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'business_analyst'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'chief_accountant'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
        ))
      )
  )
);
