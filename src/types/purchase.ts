// TypeScript types for Purchase module
// Based on supabase/experiments/procurement_staging.sql schema

export type PurchaseType = 'TMC' | 'SERVICE';

export type PurchaseRequestStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'IN_PROGRESS' | 'REJECTED';

export type PurchaseInvoiceStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'TO_PAY' | 'PAID' | 'DELIVERED' | 'REJECTED';

export type PurchaseItemStatus = 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'TO_PAY' | 'PAID' | 'DELIVERED' | 'REJECTED';

export type PaymentTerms = 'PREPAYMENT' | 'POSTPAYMENT';

export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PurchaseLogEntityType = 'REQUEST' | 'INVOICE';

export interface PurchaseRequest {
  id: string;
  number: string;
  purchase_type: PurchaseType;
  status: PurchaseRequestStatus;
  description: string | null;
  desired_date: string | null;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequestItem {
  id: string;
  request_id: string;
  name: string;
  unit: string;
  quantity: number;
  status: PurchaseItemStatus;
  created_at: string;
}

export interface PurchaseInvoice {
  id: string;
  number: string;
  request_id: string | null;
  supplier_name: string;
  amount: number;
  currency: string;
  payment_terms: PaymentTerms;
  expected_date: string | null;
  planned_payment_date: string | null;
  paid_date: string | null;
  payment_doc_no: string | null;
  status: PurchaseInvoiceStatus;
  coo_decision: ApprovalDecision;
  coo_comment: string | null;
  coo_decided_by: string | null;
  coo_decided_at: string | null;
  ceo_decision: ApprovalDecision;
  ceo_comment: string | null;
  ceo_decided_by: string | null;
  ceo_decided_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  invoice_id: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  status: PurchaseItemStatus;
  created_at: string;
}

export interface PurchaseLog {
  id: string;
  entity_type: PurchaseLogEntityType;
  entity_id: string;
  action: string;
  user_id: string;
  user_email: string;
  comment: string | null;
  timestamp: string;
}

// Payload types for creating records
export interface CreatePurchaseRequestPayload {
  purchase_type: PurchaseType;
  description?: string;
  desired_date?: string;
  created_by: string;
}

export interface CreatePurchaseRequestItemPayload {
  request_id: string;
  name: string;
  unit: string;
  quantity: number;
}
