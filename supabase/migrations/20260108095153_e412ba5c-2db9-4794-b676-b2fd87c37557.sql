-- Додати нову роль 'economist' до enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'economist';