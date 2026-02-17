
-- 1. Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Add webhook tracking columns to notification_outbox
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS webhook_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_last_error text,
  ADD COLUMN IF NOT EXISTS webhook_last_attempt_at timestamptz;

-- 3. Create trigger function that fires Edge Function via pg_net
CREATE OR REPLACE FUNCTION public.notify_outbox_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _supabase_url text := current_setting('app.settings.supabase_url', true);
  _service_role_key text := current_setting('app.settings.service_role_key', true);
  _edge_url text;
BEGIN
  -- Only fire for pending telegram notifications
  IF NEW.status = 'pending' AND NEW.channel = 'telegram' THEN
    _edge_url := coalesce(_supabase_url, 'https://ehomuqefjuqktmdggltz.supabase.co')
                 || '/functions/v1/outbox-notify';

    PERFORM net.http_post(
      url := _edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(_service_role_key, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob211cWVmanVxa3RtZGdnbHR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDcyMzM0NiwiZXhwIjoyMDgwMjk5MzQ2fQ.placeholder')
      ),
      body := jsonb_build_object(
        'outboxId', NEW.id::text,
        'createdAt', NEW.created_at::text
      ),
      timeout_milliseconds := 5000
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Create trigger
DROP TRIGGER IF EXISTS trg_outbox_notify ON public.notification_outbox;
CREATE TRIGGER trg_outbox_notify
  AFTER INSERT ON public.notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_outbox_webhook();
