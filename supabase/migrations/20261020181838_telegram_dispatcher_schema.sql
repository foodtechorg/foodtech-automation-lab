-- Durable Telegram delivery state used by the Supabase-native dispatcher.
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_worker_id text,
  ADD COLUMN IF NOT EXISTS telegram_message_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_response jsonb,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notification_outbox_due_telegram
  ON public.notification_outbox (next_retry_at, created_at)
  WHERE channel = 'telegram'
    AND status IN ('pending', 'failed');

COMMENT ON COLUMN public.notification_outbox.processing_started_at IS
  'Start time of the current delivery lease. Leases older than five minutes may be reclaimed.';
COMMENT ON COLUMN public.notification_outbox.processing_worker_id IS
  'Opaque Edge Function execution identifier holding the current delivery lease.';
COMMENT ON COLUMN public.notification_outbox.telegram_message_id IS
  'Telegram Bot API message_id returned after successful delivery.';
COMMENT ON COLUMN public.notification_outbox.telegram_response IS
  'Sanitized Telegram Bot API outcome for delivery diagnostics.';

CREATE OR REPLACE FUNCTION public.claim_notification_outbox(
  p_outbox_id uuid DEFAULT NULL,
  p_batch_size integer DEFAULT 10,
  p_worker_id text DEFAULT NULL
)
RETURNS SETOF public.notification_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT o.id
    FROM public.notification_outbox AS o
    WHERE o.channel = 'telegram'
      AND o.attempts < 5
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

CREATE OR REPLACE FUNCTION public.complete_notification_outbox(
  p_outbox_id uuid,
  p_telegram_message_id bigint,
  p_telegram_response jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.notification_outbox
  SET status = 'sent',
      sent_at = now(),
      telegram_message_id = p_telegram_message_id,
      telegram_response = p_telegram_response,
      last_error = NULL,
      next_retry_at = NULL,
      processing_started_at = NULL,
      processing_worker_id = NULL,
      failed_at = NULL,
      updated_at = now()
  WHERE id = p_outbox_id
    AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_notification_outbox(
  p_outbox_id uuid,
  p_error text,
  p_telegram_response jsonb DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT NULL,
  p_permanent boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.notification_outbox
  SET status = CASE
        WHEN p_permanent OR attempts >= 5 THEN 'failed'::public.notification_status
        ELSE 'pending'::public.notification_status
      END,
      last_error = left(COALESCE(p_error, 'Unknown Telegram delivery error'), 2000),
      telegram_response = p_telegram_response,
      next_retry_at = CASE
        WHEN p_permanent OR attempts >= 5 THEN NULL
        ELSE now() + make_interval(
          secs => LEAST(GREATEST(COALESCE(p_retry_after_seconds, 60), 1), 3600)
        )
      END,
      processing_started_at = NULL,
      processing_worker_id = NULL,
      failed_at = CASE
        WHEN p_permanent OR attempts >= 5 THEN now()
        ELSE NULL
      END,
      updated_at = now()
  WHERE id = p_outbox_id
    AND status = 'processing';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_outbox(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_outbox(uuid, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_notification_outbox(uuid, text, jsonb, integer, boolean) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_notification_outbox(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_outbox(uuid, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_notification_outbox(uuid, text, jsonb, integer, boolean) TO service_role;

-- The browser legitimately invokes this RPC, but anonymous callers must not be able
-- to manufacture notification events.
REVOKE ALL ON FUNCTION public.enqueue_notification_event(text, jsonb, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_event(text, jsonb, text, uuid[]) TO authenticated, service_role;
