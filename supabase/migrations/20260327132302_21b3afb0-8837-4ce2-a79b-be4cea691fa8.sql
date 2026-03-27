
-- Add new values to payer_entity enum
ALTER TYPE payer_entity ADD VALUE IF NOT EXISTS 'MAKROS';
ALTER TYPE payer_entity ADD VALUE IF NOT EXISTS 'FOODTECH_PLUS';

-- Add payer_entity column to purchase_invoices (nullable for existing records)
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS payer_entity payer_entity;
