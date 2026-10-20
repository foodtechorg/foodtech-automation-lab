-- pg_net exposes http_post through the net schema in this production project.
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

REVOKE ALL ON FUNCTION private.invoke_telegram_dispatcher(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.invoke_telegram_dispatcher(uuid) TO service_role;

