// TypeScript types for Raw Material Invoice module
// Based on raw_material_invoices, raw_material_invoice_items, suppliers_1c_cache, raw_materials_1c_cache

export type RawMaterialInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SENDING_TO_1C'
  | 'PO_CREATED_1C'
  | 'INTEGRATION_ERROR'
  | 'CANCELLED';

export type PayerEntity = 'FOODTECH' | 'FOP' | 'MAKROS' | 'FOODTECH_PLUS';

export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RawMaterialInvoice {
  id: string;
  number: string;
  status: RawMaterialInvoiceStatus;
  approval_round: number;
  invoice_date: string;
  supplier_1c_id: string;
  supplier_name: string;
  supplier_tax_id: string | null;
  payer_entity: PayerEntity;
  expected_delivery_date: string | null;
  planned_payment_date: string | null;
  comment: string | null;
  total_amount: number;
  currency: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Approval: admin_director
  admin_director_decision: ApprovalDecision | null;
  admin_director_comment: string | null;
  admin_director_decided_by: string | null;
  admin_director_decided_at: string | null;
  // Approval: COO
  coo_decision: ApprovalDecision | null;
  coo_comment: string | null;
  coo_decided_by: string | null;
  coo_decided_at: string | null;
  // Approval: CEO
  ceo_decision: ApprovalDecision | null;
  ceo_comment: string | null;
  ceo_decided_by: string | null;
  ceo_decided_at: string | null;
  // 1C integration
  one_c_po_id: string | null;
  one_c_po_number: string | null;
  one_c_po_date: string | null;
  integration_status: string | null;
  integration_error_message: string | null;
  integration_idempotency_key: string | null;
}

export interface RawMaterialInvoiceItem {
  id: string;
  invoice_id: string;
  raw_material_1c_id: string;
  raw_material_name: string;
  uom: string;
  qty: number;
  price: number;
  line_amount: number | null; // generated column
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface RawMaterialInvoiceAttachment {
  id: string;
  invoice_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  is_supplier_invoice: boolean;
  uploaded_by: string;
  created_at: string;
}

// 1C cache types
export interface Supplier1cCache {
  supplier_1c_id: string;
  name: string;
  tax_id: string | null;
  is_active: boolean;
  synced_at: string;
}

export interface RawMaterial1cCache {
  raw_material_1c_id: string;
  name: string;
  default_uom: string;
  is_active: boolean;
  synced_at: string;
}

// Payload types
export interface CreateRawMaterialInvoicePayload {
  supplier_1c_id: string;
  supplier_name: string;
  supplier_tax_id?: string;
  payer_entity: PayerEntity;
  expected_delivery_date?: string;
  planned_payment_date?: string;
  comment?: string;
  currency?: string;
  created_by: string;
}

export interface CreateRawMaterialInvoiceItemPayload {
  invoice_id: string;
  raw_material_1c_id: string;
  raw_material_name: string;
  uom: string;
  qty: number;
  price: number;
}
