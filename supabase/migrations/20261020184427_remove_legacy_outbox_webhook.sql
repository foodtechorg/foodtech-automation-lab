-- The n8n trigger now points to private.notify_outbox_webhook(). Remove the
-- obsolete public SECURITY DEFINER function so it cannot remain an RPC surface.
DROP FUNCTION IF EXISTS public.notify_outbox_webhook();

