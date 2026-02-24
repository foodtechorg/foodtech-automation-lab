
-- ============================================================
-- Migration 1: Add new enum values to existing enums
-- (must be committed before use)
-- ============================================================
ALTER TYPE public.purchase_type ADD VALUE IF NOT EXISTS 'RAW_MATERIAL';
ALTER TYPE public.purchase_log_entity_type ADD VALUE IF NOT EXISTS 'RAW_INVOICE';
