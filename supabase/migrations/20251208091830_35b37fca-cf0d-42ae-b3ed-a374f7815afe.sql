-- Migrate existing rd_comment values to FEEDBACK_ADDED events
-- This ensures all R&D comments appear in the chronological comment feed

INSERT INTO public.request_events (request_id, actor_email, event_type, payload)
SELECT 
  r.id,
  COALESCE(r.responsible_email, r.author_email),
  'FEEDBACK_ADDED'::event_type,
  jsonb_build_object('comment', r.rd_comment, 'migrated_from', 'rd_comment')
FROM public.requests r
WHERE r.rd_comment IS NOT NULL 
  AND r.rd_comment != ''
  -- Avoid duplicates: check if this comment wasn't already migrated
  AND NOT EXISTS (
    SELECT 1 FROM public.request_events e 
    WHERE e.request_id = r.id 
      AND e.event_type = 'FEEDBACK_ADDED' 
      AND (e.payload->>'migrated_from') = 'rd_comment'
  );