-- Крок 1: Тільки додати нові ролі до app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chief_accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lawyer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'office_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'foreign_trade_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_deputy';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financial_analyst';