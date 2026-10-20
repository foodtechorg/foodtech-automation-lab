-- Switch outbox delivery from n8n to the authenticated Supabase Telegram dispatcher.
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.telegram_dispatcher_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  cutover_at timestamptz NOT NULL
);
REVOKE ALL ON TABLE private.telegram_dispatcher_config FROM PUBLIC, anon, authenticated;

INSERT INTO private.telegram_dispatcher_config (singleton, cutover_at)
VALUES (true, transaction_timestamp())
ON CONFLICT (singleton) DO NOTHING;

-- Stop the old n8n trigger before changing delivery ownership. Existing unsent
-- rows remain untouched but are quarantined by cutover_at, so months of stale
-- approvals and payment updates cannot be replayed by the new dispatcher.
DROP TRIGGER IF EXISTS trg_outbox_notify ON public.notification_outbox;
DROP FUNCTION IF EXISTS public.notify_outbox_webhook();

-- The Edge Function calls these RPCs only with the service role. They do not
-- need SECURITY DEFINER and therefore retain the caller's permissions.
CREATE OR REPLACE FUNCTION public.claim_notification_outbox(
  p_outbox_id uuid DEFAULT NULL,
  p_batch_size integer DEFAULT 10,
  p_worker_id text DEFAULT NULL
)
RETURNS SETOF public.notification_outbox
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT o.id
    FROM public.notification_outbox AS o
    WHERE o.channel = 'telegram'
      AND o.attempts < 5
      AND o.created_at >= (
        SELECT c.cutover_at
        FROM private.telegram_dispatcher_config AS c
        WHERE c.singleton = true
      )
      AND (p_outbox_id IS NULL OR o.id = p_outbox_id)
      AND (
        (
          o.status IN ('pending', 'failed')
          AND (o.next_retry_at IS NULL OR o.next_retry_at <= now())
        )
        OR (
          o.status = 'processing'
          AND o.processing_started_at < now() - interval '5 minutes'
        )
      )
    ORDER BY o.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 10), 1), 20)
  )
  UPDATE public.notification_outbox AS o
  SET status = 'processing',
      attempts = o.attempts + 1,
      processing_started_at = now(),
      processing_worker_id = left(COALESCE(p_worker_id, 'unknown'), 200),
      next_retry_at = NULL,
      failed_at = NULL,
      updated_at = now()
  FROM candidates
  WHERE o.id = candidates.id
  RETURNING o.*;
$$;

ALTER FUNCTION public.complete_notification_outbox(uuid, bigint, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.fail_notification_outbox(uuid, text, jsonb, integer, boolean) SECURITY INVOKER;

CREATE OR REPLACE FUNCTION private.invoke_telegram_dispatcher(p_outbox_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_url text;
  v_anon_key text;
  v_dispatch_secret text;
  v_request_id bigint;
BEGIN
  IF p_outbox_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret
  INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_dispatch_project_url'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_dispatch_anon_key'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_dispatch_secret
  FROM vault.decrypted_secrets
  WHERE name = 'outbox_dispatch_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF nullif(v_project_url, '') IS NULL
     OR nullif(v_anon_key, '') IS NULL
     OR nullif(v_dispatch_secret, '') IS NULL THEN
    RAISE WARNING 'Telegram dispatcher Vault configuration is incomplete';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/telegram-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key,
      'x-dispatch-secret', v_dispatch_secret
    ),
    body := jsonb_build_object('outboxId', p_outbox_id::text),
    timeout_milliseconds := 10000
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.dispatch_due_notification_outbox(p_batch_size integer DEFAULT 10)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row record;
  v_dispatched integer := 0;
BEGIN
  FOR v_row IN
    SELECT id
    FROM public.notification_outbox
    WHERE channel = 'telegram'
      AND attempts < 5
      AND created_at >= (
        SELECT c.cutover_at
        FROM private.telegram_dispatcher_config AS c
        WHERE c.singleton = true
      )
      AND (
        (
          status IN ('pending', 'failed')
          AND (next_retry_at IS NULL OR next_retry_at <= now())
        )
        OR (
          status = 'processing'
          AND processing_started_at < now() - interval '5 minutes'
        )
      )
    ORDER BY created_at
    LIMIT LEAST(GREATEST(COALESCE(p_batch_size, 10), 1), 20)
  LOOP
    PERFORM private.invoke_telegram_dispatcher(v_row.id);
    v_dispatched := v_dispatched + 1;
  END LOOP;

  RETURN v_dispatched;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_outbox_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.channel = 'telegram' THEN
    PERFORM private.invoke_telegram_dispatcher(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_telegram_dispatcher(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.dispatch_due_notification_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_outbox_webhook() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT ON TABLE private.telegram_dispatcher_config TO service_role;
GRANT EXECUTE ON FUNCTION private.invoke_telegram_dispatcher(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.dispatch_due_notification_outbox(integer) TO service_role;

CREATE TRIGGER trg_outbox_notify
  AFTER INSERT ON public.notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_outbox_webhook();

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'telegram-dispatcher-recovery';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'telegram-dispatcher-recovery',
  '* * * * *',
  $job$SELECT private.dispatch_due_notification_outbox(10);$job$
);

