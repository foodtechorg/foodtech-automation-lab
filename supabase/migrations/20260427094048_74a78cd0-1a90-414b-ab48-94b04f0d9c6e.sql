ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS is_fixed_asset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_asset_mvo text NULL;

ALTER TABLE public.purchase_invoices
  ADD COLUMN IF NOT EXISTS is_fixed_asset boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_asset_mvo text NULL;

ALTER TABLE public.purchase_requests
  DROP CONSTRAINT IF EXISTS purchase_requests_fixed_asset_mvo_check;
ALTER TABLE public.purchase_requests
  ADD CONSTRAINT purchase_requests_fixed_asset_mvo_check
  CHECK (
    is_fixed_asset = false
    OR (fixed_asset_mvo IS NOT NULL AND length(btrim(fixed_asset_mvo)) > 0)
  );

ALTER TABLE public.purchase_invoices
  DROP CONSTRAINT IF EXISTS purchase_invoices_fixed_asset_mvo_check;
ALTER TABLE public.purchase_invoices
  ADD CONSTRAINT purchase_invoices_fixed_asset_mvo_check
  CHECK (
    is_fixed_asset = false
    OR (fixed_asset_mvo IS NOT NULL AND length(btrim(fixed_asset_mvo)) > 0)
  );