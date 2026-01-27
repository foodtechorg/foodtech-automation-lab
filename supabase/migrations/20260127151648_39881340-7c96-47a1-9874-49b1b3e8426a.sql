-- Add UPDATE RLS policy for notification_rules table
-- Allows admin and COO to update notification rules (e.g., toggle is_enabled)

CREATE POLICY "Admin and COO can update notification_rules"
ON public.notification_rules
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coo'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coo'::app_role)
);