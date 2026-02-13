-- Add business_analyst to the SELECT policy on requests table
DROP POLICY IF EXISTS "Users can view requests" ON public.requests;
CREATE POLICY "Users can view requests" ON public.requests
FOR SELECT USING (
  (has_role(auth.uid(), 'sales_manager'::app_role) AND (author_email = (SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid())))
  OR has_role(auth.uid(), 'rd_dev'::app_role)
  OR has_role(auth.uid(), 'rd_manager'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'ceo'::app_role)
  OR has_role(auth.uid(), 'coo'::app_role)
  OR has_role(auth.uid(), 'quality_manager'::app_role)
  OR has_role(auth.uid(), 'admin_director'::app_role)
  OR has_role(auth.uid(), 'financial_analyst'::app_role)
  OR has_role(auth.uid(), 'business_analyst'::app_role)
);