-- Event-scoped Telegram opt-outs. Kept in the private schema so the table is
-- not exposed through the Data API and personal preferences stay server-side.
CREATE TABLE IF NOT EXISTS private.telegram_notification_exclusions (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, event_type)
);

REVOKE ALL ON TABLE private.telegram_notification_exclusions
  FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE private.telegram_notification_exclusions IS
  'Profiles excluded from specific Telegram notification event types.';

CREATE OR REPLACE FUNCTION public.enqueue_notification_event(
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_event_id text DEFAULT NULL,
  p_recipient_profile_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id text;
  v_rule record;
  v_recipient record;
  v_message_text text;
  v_rules_matched int := 0;
  v_recipients_enqueued int := 0;
  v_duplicates_skipped int := 0;
  v_key text;
  v_value text;
BEGIN
  v_event_id := COALESCE(p_event_id, gen_random_uuid()::text);

  FOR v_rule IN
    SELECT *
    FROM public.notification_rules
    WHERE is_enabled = true
      AND channel = 'telegram'
      AND event_type = p_event_type
  LOOP
    v_rules_matched := v_rules_matched + 1;

    IF p_recipient_profile_ids IS NOT NULL
       AND array_length(p_recipient_profile_ids, 1) > 0 THEN
      FOR v_recipient IN
        SELECT tl.telegram_user_id, tl.profile_id
        FROM public.telegram_links AS tl
        WHERE tl.status = 'active'
          AND tl.profile_id = ANY(p_recipient_profile_ids)
          AND NOT EXISTS (
            SELECT 1
            FROM private.telegram_notification_exclusions AS exclusion
            WHERE exclusion.profile_id = tl.profile_id
              AND exclusion.event_type = p_event_type
          )
      LOOP
        v_message_text := v_rule.template_text;
        FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_payload)
        LOOP
          v_message_text := replace(
            v_message_text,
            '{{' || v_key || '}}',
            COALESCE(v_value, '')
          );
        END LOOP;

        BEGIN
          INSERT INTO public.notification_outbox (
            event_id,
            event_type,
            rule_id,
            channel,
            telegram_user_id,
            profile_id,
            message_text,
            payload,
            status
          ) VALUES (
            v_event_id,
            p_event_type,
            v_rule.id,
            'telegram',
            v_recipient.telegram_user_id,
            v_recipient.profile_id,
            v_message_text,
            p_payload,
            'pending'
          );
          v_recipients_enqueued := v_recipients_enqueued + 1;
        EXCEPTION WHEN unique_violation THEN
          v_duplicates_skipped := v_duplicates_skipped + 1;
        END;
      END LOOP;
    ELSE
      FOR v_recipient IN
        SELECT tl.telegram_user_id, tl.profile_id
        FROM public.telegram_links AS tl
        WHERE tl.status = 'active'
          AND tl.role = ANY(v_rule.recipient_roles)
          AND NOT EXISTS (
            SELECT 1
            FROM private.telegram_notification_exclusions AS exclusion
            WHERE exclusion.profile_id = tl.profile_id
              AND exclusion.event_type = p_event_type
          )
      LOOP
        v_message_text := v_rule.template_text;
        FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_payload)
        LOOP
          v_message_text := replace(
            v_message_text,
            '{{' || v_key || '}}',
            COALESCE(v_value, '')
          );
        END LOOP;

        BEGIN
          INSERT INTO public.notification_outbox (
            event_id,
            event_type,
            rule_id,
            channel,
            telegram_user_id,
            profile_id,
            message_text,
            payload,
            status
          ) VALUES (
            v_event_id,
            p_event_type,
            v_rule.id,
            'telegram',
            v_recipient.telegram_user_id,
            v_recipient.profile_id,
            v_message_text,
            p_payload,
            'pending'
          );
          v_recipients_enqueued := v_recipients_enqueued + 1;
        EXCEPTION WHEN unique_violation THEN
          v_duplicates_skipped := v_duplicates_skipped + 1;
        END;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'rules_matched', v_rules_matched,
    'recipients_enqueued', v_recipients_enqueued,
    'duplicates_skipped', v_duplicates_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification_event(text, jsonb, text, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_event(text, jsonb, text, uuid[])
  TO authenticated, service_role;

