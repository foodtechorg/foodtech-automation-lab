-- Update existing PENDING_APPROVAL requests to IN_PROGRESS
UPDATE purchase_requests 
SET status = 'IN_PROGRESS', updated_at = now() 
WHERE status = 'PENDING_APPROVAL';