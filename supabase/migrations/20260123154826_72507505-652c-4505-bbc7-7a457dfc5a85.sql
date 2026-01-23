-- ============================================================
-- FTA Telegram Notifications via Outbox (MVP)
-- ============================================================

-- 1. Create ENUMs
-- ============================================================

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM ('telegram');

-- Notification outbox status enum
CREATE TYPE notification_outbox_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'canceled');


-- 2. Create notification_rules table
-- ============================================================
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  event_type text NOT NULL,
  channel notification_channel NOT NULL DEFAULT 'telegram',
  is_enabled boolean NOT NULL DEFAULT true,
  recipient_roles app_role[] NOT NULL,
  template_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.notification_rules IS 'Stores notification rules that define which events trigger notifications and to whom';
COMMENT ON COLUMN public.notification_rules.code IS 'Unique rule identifier (e.g., INVOICE_SENT_FOR_APPROVAL)';
COMMENT ON COLUMN public.notification_rules.template_text IS 'Message template with {{key}} placeholders replaced from payload';


-- 3. Create notification_outbox table
-- ============================================================
CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_type text NOT NULL,
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  channel notification_channel NOT NULL DEFAULT 'telegram',
  telegram_user_id bigint NOT NULL,
  profile_id uuid NULL,
  message_text text NOT NULL,
  parse_mode text NULL DEFAULT 'HTML',
  payload jsonb NULL,
  status notification_outbox_status NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_retry_at timestamptz NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  
  -- Unique constraint for idempotency (prevent duplicate notifications)
  CONSTRAINT notification_outbox_unique_event UNIQUE(event_id, channel, telegram_user_id)
);

-- Add comment for documentation
COMMENT ON TABLE public.notification_outbox IS 'Outbox table for pending Telegram notifications. n8n dispatcher reads pending records and sends them.';

-- Create index for efficient pending message queries
CREATE INDEX idx_notification_outbox_pending 
ON public.notification_outbox (status, channel, next_retry_at, created_at)
WHERE status IN ('pending', 'processing', 'failed');


-- 4. Add updated_at triggers
-- ============================================================

-- Trigger for notification_rules
CREATE TRIGGER update_notification_rules_updated_at
BEFORE UPDATE ON public.notification_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for notification_outbox
CREATE TRIGGER update_notification_outbox_updated_at
BEFORE UPDATE ON public.notification_outbox
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- 5. Enable RLS
-- ============================================================
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;


-- 6. RLS Policies for notification_rules
-- ============================================================

-- Only admin and coo can view rules
CREATE POLICY "Admin and COO can view notification_rules"
ON public.notification_rules
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'coo'::app_role)
);

-- No INSERT/UPDATE/DELETE for regular users (service role bypasses RLS)


-- 7. RLS Policies for notification_outbox
-- ============================================================

-- Only admin and coo can view outbox
CREATE POLICY "Admin and COO can view notification_outbox"
ON public.notification_outbox
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'coo'::app_role)
);

-- INSERT policy for the RPC function (authenticated users can create via RPC)
CREATE POLICY "Authenticated users can create notification_outbox via RPC"
ON public.notification_outbox
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE/DELETE for regular users (service role bypasses RLS)


-- 8. Create RPC: enqueue_notification_event
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_notification_event(
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_event_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id text;
  v_rule RECORD;
  v_recipient RECORD;
  v_message_text text;
  v_rules_matched int := 0;
  v_recipients_enqueued int := 0;
  v_duplicates_skipped int := 0;
  v_key text;
  v_value text;
BEGIN
  -- Generate event_id if not provided
  v_event_id := COALESCE(p_event_id, gen_random_uuid()::text);

  -- Loop through all active rules for this event type
  FOR v_rule IN
    SELECT id, recipient_roles, template_text
    FROM notification_rules
    WHERE is_enabled = true
      AND channel = 'telegram'
      AND event_type = p_event_type
  LOOP
    v_rules_matched := v_rules_matched + 1;

    -- Loop through all active telegram_links matching the recipient roles
    FOR v_recipient IN
      SELECT telegram_user_id, profile_id
      FROM telegram_links
      WHERE status = 'active'
        AND role = ANY(v_rule.recipient_roles)
    LOOP
      -- Build message text by replacing placeholders
      v_message_text := v_rule.template_text;
      
      -- Replace all {{key}} placeholders with values from payload
      FOR v_key, v_value IN
        SELECT key, COALESCE(value::text, '')
        FROM jsonb_each_text(p_payload)
      LOOP
        v_message_text := replace(v_message_text, '{{' || v_key || '}}', v_value);
      END LOOP;
      
      -- Remove any remaining unreplaced placeholders
      v_message_text := regexp_replace(v_message_text, '\{\{[^}]+\}\}', '', 'g');

      -- Insert into outbox with ON CONFLICT DO NOTHING for idempotency
      INSERT INTO notification_outbox (
        event_id,
        event_type,
        rule_id,
        channel,
        telegram_user_id,
        profile_id,
        message_text,
        parse_mode,
        payload,
        status
      )
      VALUES (
        v_event_id,
        p_event_type,
        v_rule.id,
        'telegram',
        v_recipient.telegram_user_id,
        v_recipient.profile_id,
        v_message_text,
        'HTML',
        p_payload,
        'pending'
      )
      ON CONFLICT (event_id, channel, telegram_user_id) DO NOTHING;

      -- Check if row was inserted or skipped
      IF FOUND THEN
        v_recipients_enqueued := v_recipients_enqueued + 1;
      ELSE
        v_duplicates_skipped := v_duplicates_skipped + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'rules_matched', v_rules_matched,
    'recipients_enqueued', v_recipients_enqueued,
    'duplicates_skipped', v_duplicates_skipped
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.enqueue_notification_event TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.enqueue_notification_event IS 'Creates outbox records for all recipients matching active notification rules for the given event type';


-- 9. Seed: INVOICE_SENT_FOR_APPROVAL rule
-- ============================================================
INSERT INTO public.notification_rules (code, event_type, channel, is_enabled, recipient_roles, template_text)
VALUES (
  'INVOICE_SENT_FOR_APPROVAL',
  'INVOICE_SENT_FOR_APPROVAL',
  'telegram',
  true,
  ARRAY['coo'::app_role, 'ceo'::app_role],
  'На погодження надійшов рахунок {{invoice_number}}, на суму {{invoice_amount}}. Замовник {{customer_name}}. Перейдіть за посиланням {{invoice_url}}.'
);