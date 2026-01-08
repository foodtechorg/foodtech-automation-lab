-- 1. Add new SNACKS value to domain enum
ALTER TYPE domain ADD VALUE 'SNACKS';

-- 2. Create table for R&D request attachments
CREATE TABLE rd_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE rd_request_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments for requests they can access
CREATE POLICY "Users can view rd attachments"
  ON rd_request_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = rd_request_attachments.request_id 
      AND (
        r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
        OR has_role(auth.uid(), 'rd_dev')
        OR has_role(auth.uid(), 'rd_manager')
        OR has_role(auth.uid(), 'admin')
        OR has_role(auth.uid(), 'coo')
        OR has_role(auth.uid(), 'ceo')
        OR has_role(auth.uid(), 'quality_manager')
        OR has_role(auth.uid(), 'admin_director')
      )
    )
  );

-- Policy: Authors can insert attachments to their own requests
CREATE POLICY "Authors can insert rd attachments"
  ON rd_request_attachments FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = rd_request_attachments.request_id 
      AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );

-- Policy: Authors can delete attachments from their own requests
CREATE POLICY "Authors can delete rd attachments"
  ON rd_request_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = rd_request_attachments.request_id 
      AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
    )
  );