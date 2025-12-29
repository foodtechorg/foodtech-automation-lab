-- Add new role values to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'quality_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'chief_engineer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'production_deputy';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_manager';