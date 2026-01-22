-- =============================================
-- PART 1: Handoff to Testing - Data Model
-- =============================================

-- A1. Add new status values to development_sample_status enum
ALTER TYPE development_sample_status ADD VALUE IF NOT EXISTS 'Testing' AFTER 'HandedOff';
ALTER TYPE development_sample_status ADD VALUE IF NOT EXISTS 'Approved' AFTER 'Testing';
ALTER TYPE development_sample_status ADD VALUE IF NOT EXISTS 'Rejected' AFTER 'Approved';

-- A2. Add working_title field to development_samples
ALTER TABLE development_samples 
ADD COLUMN IF NOT EXISTS working_title text NULL;

-- A4. Add successful_sample fields to requests table
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS successful_sample_id uuid NULL,
ADD COLUMN IF NOT EXISTS successful_sample_display text NULL;

-- A3. Create rd_request_testing_samples table
CREATE TABLE IF NOT EXISTS rd_request_testing_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests(id) ON DELETE RESTRICT,
  sample_id uuid NOT NULL UNIQUE REFERENCES development_samples(id) ON DELETE RESTRICT,
  sample_code text NOT NULL,
  recipe_code text NOT NULL,
  working_title text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'Sent' CHECK (status IN ('Sent', 'Approved', 'Rejected')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid NULL REFERENCES auth.users(id),
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id),
  manager_comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying by request and sent date
CREATE INDEX IF NOT EXISTS idx_testing_samples_request_sent 
ON rd_request_testing_samples(request_id, sent_at DESC);

-- Enable RLS
ALTER TABLE rd_request_testing_samples ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rd_request_testing_samples

-- SELECT: Admin, COO, CEO, RD team, and sales managers (for their own requests)
CREATE POLICY "Users can view testing samples"
ON rd_request_testing_samples
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'coo'::app_role) OR
  has_role(auth.uid(), 'ceo'::app_role) OR
  has_role(auth.uid(), 'rd_dev'::app_role) OR
  has_role(auth.uid(), 'rd_manager'::app_role) OR
  (has_role(auth.uid(), 'sales_manager'::app_role) AND EXISTS (
    SELECT 1 FROM requests r 
    WHERE r.id = rd_request_testing_samples.request_id 
    AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
  ))
);

-- INSERT: Admin and COO only (via RPC primarily)
CREATE POLICY "Admin and COO can create testing samples"
ON rd_request_testing_samples
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'coo'::app_role)
);

-- UPDATE: Admin, COO, and sales managers (for reviewing their own request's samples)
CREATE POLICY "Users can update testing samples"
ON rd_request_testing_samples
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'coo'::app_role) OR
  (has_role(auth.uid(), 'sales_manager'::app_role) AND EXISTS (
    SELECT 1 FROM requests r 
    WHERE r.id = rd_request_testing_samples.request_id 
    AND r.author_email = (SELECT email FROM profiles WHERE id = auth.uid())
  ))
);

-- DELETE: Admin only
CREATE POLICY "Admin can delete testing samples"
ON rd_request_testing_samples
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_rd_request_testing_samples_updated_at
BEFORE UPDATE ON rd_request_testing_samples
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();