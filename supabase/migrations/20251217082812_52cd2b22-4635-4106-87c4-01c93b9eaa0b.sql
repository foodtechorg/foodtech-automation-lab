-- Create storage bucket for purchase attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-attachments', 
  'purchase-attachments', 
  false,
  5242880, -- 5MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png']
);

-- Create table for purchase request attachments
CREATE TABLE public.purchase_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for purchase invoice attachments
CREATE TABLE public.purchase_invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchase_request_attachments
CREATE POLICY "Users can view request attachments"
ON public.purchase_request_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requests pr
    WHERE pr.id = purchase_request_attachments.request_id
    AND (
      pr.created_by = auth.uid()
      OR (
        pr.status <> 'DRAFT'::purchase_request_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
        )
      )
    )
  )
);

CREATE POLICY "Users can create request attachments"
ON public.purchase_request_attachments FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.purchase_requests pr
    WHERE pr.id = purchase_request_attachments.request_id
    AND pr.created_by = auth.uid()
    AND pr.status = 'DRAFT'::purchase_request_status
  )
);

CREATE POLICY "Users can delete request attachments"
ON public.purchase_request_attachments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_requests pr
    WHERE pr.id = purchase_request_attachments.request_id
    AND pr.created_by = auth.uid()
    AND pr.status = 'DRAFT'::purchase_request_status
  )
);

-- RLS policies for purchase_invoice_attachments
CREATE POLICY "Users can view invoice attachments"
ON public.purchase_invoice_attachments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_invoices pi
    WHERE pi.id = purchase_invoice_attachments.invoice_id
    AND (
      pi.created_by = auth.uid()
      OR (
        pi.status <> 'DRAFT'::purchase_invoice_status
        AND (
          has_role(auth.uid(), 'procurement_manager'::app_role)
          OR has_role(auth.uid(), 'coo'::app_role)
          OR has_role(auth.uid(), 'ceo'::app_role)
          OR has_role(auth.uid(), 'treasurer'::app_role)
          OR has_role(auth.uid(), 'accountant'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
        )
      )
    )
  )
);

CREATE POLICY "Users can create invoice attachments"
ON public.purchase_invoice_attachments FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.purchase_invoices pi
    WHERE pi.id = purchase_invoice_attachments.invoice_id
    AND pi.created_by = auth.uid()
    AND pi.status = 'DRAFT'::purchase_invoice_status
  )
);

CREATE POLICY "Users can delete invoice attachments"
ON public.purchase_invoice_attachments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_invoices pi
    WHERE pi.id = purchase_invoice_attachments.invoice_id
    AND pi.created_by = auth.uid()
    AND pi.status = 'DRAFT'::purchase_invoice_status
  )
);

-- Storage policies for purchase-attachments bucket
CREATE POLICY "Users can upload purchase attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'purchase-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view purchase attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'purchase-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete purchase attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'purchase-attachments'
  AND auth.uid() IS NOT NULL
);