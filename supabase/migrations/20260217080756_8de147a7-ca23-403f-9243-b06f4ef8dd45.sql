-- Drop the 3-argument overload so PostgREST always resolves to the 4-argument version
-- which correctly handles both role-based and direct recipient notifications
DROP FUNCTION IF EXISTS public.enqueue_notification_event(text, jsonb, text);