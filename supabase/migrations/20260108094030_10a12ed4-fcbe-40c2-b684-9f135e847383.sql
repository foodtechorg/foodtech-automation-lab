-- Add event_id column to rd_request_attachments for linking files to comments
ALTER TABLE rd_request_attachments 
ADD COLUMN event_id UUID REFERENCES request_events(id) ON DELETE SET NULL;

-- Index for efficient lookup by event_id
CREATE INDEX idx_rd_attachments_event ON rd_request_attachments(event_id);

-- Drop existing INSERT policy and create a new one that allows R&D team to insert attachments
DROP POLICY IF EXISTS "Authors can insert attachments" ON rd_request_attachments;

CREATE POLICY "Authors and RD team can insert attachments"
  ON rd_request_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requests r 
      WHERE r.id = request_id 
      AND (
        -- Author can always add attachments (at creation)
        r.author_email = auth.jwt() ->> 'email'
        OR (
          -- R&D team can add attachments to IN_PROGRESS requests
          r.status = 'IN_PROGRESS' 
          AND EXISTS (
            SELECT 1 FROM profiles p 
            WHERE p.id = auth.uid() 
            AND p.role IN ('rd_dev', 'rd_manager', 'admin')
          )
        )
      )
    )
  );