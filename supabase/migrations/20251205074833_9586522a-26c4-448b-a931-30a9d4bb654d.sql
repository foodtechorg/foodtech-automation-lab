-- Fix security issue: Restrict INSERT on request_events to only allow users to create events as themselves
-- and only for requests they have access to

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can create events" ON public.request_events;

-- Create new secure INSERT policy
CREATE POLICY "Users can create events for accessible requests as themselves"
ON public.request_events
FOR INSERT
WITH CHECK (
  -- Actor email must match the authenticated user's email
  actor_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  AND
  -- User must have access to the request
  EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = request_id
    AND (
      -- R&D roles can create events for any request
      has_role(auth.uid(), 'rd_dev'::app_role) OR
      has_role(auth.uid(), 'rd_manager'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      -- Sales manager can only create events for their own requests
      (has_role(auth.uid(), 'sales_manager'::app_role) AND r.author_email = (SELECT email FROM public.profiles WHERE id = auth.uid()))
    )
  )
);