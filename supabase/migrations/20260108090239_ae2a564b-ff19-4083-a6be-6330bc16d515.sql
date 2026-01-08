-- Create storage bucket for R&D attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('rd-attachments', 'rd-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Users can view attachments for requests they can access
CREATE POLICY "Users can view rd attachments storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rd-attachments'
    AND (
      has_role(auth.uid(), 'rd_dev')
      OR has_role(auth.uid(), 'rd_manager')
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'coo')
      OR has_role(auth.uid(), 'ceo')
      OR has_role(auth.uid(), 'quality_manager')
      OR has_role(auth.uid(), 'admin_director')
      OR has_role(auth.uid(), 'sales_manager')
    )
  );

-- Storage policy: Authors can upload attachments
CREATE POLICY "Users can upload rd attachments storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rd-attachments'
    AND auth.uid() IS NOT NULL
  );

-- Storage policy: Authors can delete their attachments
CREATE POLICY "Users can delete rd attachments storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rd-attachments'
    AND auth.uid() IS NOT NULL
  );