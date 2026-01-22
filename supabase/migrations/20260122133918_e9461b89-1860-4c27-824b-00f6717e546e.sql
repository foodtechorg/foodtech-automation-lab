-- Drop the old INSERT policy and create a new one that includes quality_manager
DROP POLICY IF EXISTS "Sales managers can create requests" ON public.requests;

CREATE POLICY "Sales and quality managers can create requests" 
ON public.requests 
FOR INSERT 
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'sales_manager'::app_role) OR has_role(auth.uid(), 'quality_manager'::app_role))
  AND author_email = (SELECT email FROM profiles WHERE id = auth.uid())
);