import { supabase } from '@/integrations/supabase/client';
import type {
  RawMaterialInvoice,
  RawMaterialInvoiceItem,
  RawMaterialInvoiceAttachment,
  CreateRawMaterialInvoicePayload,
  CreateRawMaterialInvoiceItemPayload,
} from '@/types/rawMaterial';
import type { PurchaseLog } from '@/types/purchase';

// ─── Invoices ────────────────────────────────────────

export async function getRawMaterialInvoices(): Promise<RawMaterialInvoice[]> {
  const { data, error } = await supabase
    .from('raw_material_invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching raw material invoices:', error);
    throw error;
  }
  return (data || []) as RawMaterialInvoice[];
}

export async function getRawMaterialInvoiceById(id: string): Promise<RawMaterialInvoice | null> {
  const { data, error } = await supabase
    .from('raw_material_invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching raw material invoice:', error);
    throw error;
  }
  return data as RawMaterialInvoice | null;
}

export async function createRawMaterialInvoice(
  payload: CreateRawMaterialInvoicePayload
): Promise<RawMaterialInvoice> {
  const { data, error } = await supabase
    .from('raw_material_invoices')
    .insert({
      supplier_1c_id: payload.supplier_1c_id,
      supplier_name: payload.supplier_name,
      supplier_tax_id: payload.supplier_tax_id || null,
      payer_entity: payload.payer_entity,
      expected_delivery_date: payload.expected_delivery_date || null,
      planned_payment_date: payload.planned_payment_date || null,
      comment: payload.comment || null,
      currency: payload.currency || 'UAH',
      created_by: payload.created_by,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating raw material invoice:', error);
    throw error;
  }
  return data as RawMaterialInvoice;
}

export async function updateRawMaterialInvoice(
  id: string,
  updates: Partial<Omit<RawMaterialInvoice, 'id' | 'number' | 'created_by' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('raw_material_invoices')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating raw material invoice:', error);
    throw error;
  }
}

export async function updateRawMaterialInvoiceStatus(
  id: string,
  status: RawMaterialInvoice['status']
): Promise<void> {
  const { error } = await supabase
    .from('raw_material_invoices')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating raw material invoice status:', error);
    throw error;
  }
}

export async function deleteRawMaterialInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from('raw_material_invoices')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting raw material invoice:', error);
    throw error;
  }
}

// ─── Invoice Items ───────────────────────────────────

export async function getRawMaterialInvoiceItems(invoiceId: string): Promise<RawMaterialInvoiceItem[]> {
  const { data, error } = await supabase
    .from('raw_material_invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching raw material invoice items:', error);
    throw error;
  }
  return (data || []) as RawMaterialInvoiceItem[];
}

export async function createRawMaterialInvoiceItems(
  items: CreateRawMaterialInvoiceItemPayload[]
): Promise<RawMaterialInvoiceItem[]> {
  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('raw_material_invoice_items')
    .insert(
      items.map((item, index) => ({
        invoice_id: item.invoice_id,
        raw_material_1c_id: item.raw_material_1c_id,
        raw_material_name: item.raw_material_name,
        uom: item.uom,
        qty: item.qty,
        price: item.price,
        sort_order: index,
      }))
    )
    .select();

  if (error) {
    console.error('Error creating raw material invoice items:', error);
    throw error;
  }
  return (data || []) as RawMaterialInvoiceItem[];
}

export async function deleteRawMaterialInvoiceItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('raw_material_invoice_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting raw material invoice item:', error);
    throw error;
  }
}

// ─── Attachments ─────────────────────────────────────

export async function getRawMaterialInvoiceAttachments(
  invoiceId: string
): Promise<RawMaterialInvoiceAttachment[]> {
  const { data, error } = await supabase
    .from('raw_material_invoice_attachments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching raw material invoice attachments:', error);
    throw error;
  }
  return (data || []) as RawMaterialInvoiceAttachment[];
}

export async function uploadRawMaterialAttachment(
  file: File,
  invoiceId: string,
  uploadedBy: string,
  isSupplierInvoice = false
): Promise<RawMaterialInvoiceAttachment> {
  const fileExt = file.name.split('.').pop();
  const filePath = `raw-material-invoices/${invoiceId}/${crypto.randomUUID()}.${fileExt}`;

  // Upload to storage
  const { error: storageError } = await supabase.storage
    .from('purchase-attachments')
    .upload(filePath, file);

  if (storageError) {
    console.error('Error uploading file:', storageError);
    throw storageError;
  }

  // Create attachment record
  const { data, error } = await supabase
    .from('raw_material_invoice_attachments')
    .insert({
      invoice_id: invoiceId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type || 'application/octet-stream',
      is_supplier_invoice: isSupplierInvoice,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating attachment record:', error);
    throw error;
  }

  return data as RawMaterialInvoiceAttachment;
}

export async function deleteRawMaterialAttachment(
  id: string,
  filePath: string
): Promise<void> {
  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('purchase-attachments')
    .remove([filePath]);

  if (storageError) {
    console.error('Error deleting file from storage:', storageError);
  }

  // Delete record
  const { error } = await supabase
    .from('raw_material_invoice_attachments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting attachment record:', error);
    throw error;
  }
}

// ─── Total recalculation ─────────────────────────────

export async function recalculateRawMaterialInvoiceTotal(invoiceId: string): Promise<number> {
  const items = await getRawMaterialInvoiceItems(invoiceId);
  const total = items.reduce((sum, item) => sum + (item.line_amount ?? item.qty * item.price), 0);

  await updateRawMaterialInvoice(invoiceId, { total_amount: total });
  return total;
}

// ─── Logs ────────────────────────────────────────────

export async function logRawMaterialEvent(
  entityId: string,
  action: string,
  comment?: string,
  payload?: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase.rpc('log_purchase_event', {
    p_entity_type: 'RAW_INVOICE',
    p_entity_id: entityId,
    p_action: action,
    p_comment: comment || null,
    p_payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
  });

  if (error) {
    console.error('Error logging raw material event:', error);
    throw error;
  }
  return data as string;
}

export async function getRawMaterialLogs(entityId: string): Promise<PurchaseLog[]> {
  const { data, error } = await supabase
    .from('purchase_logs')
    .select(`
      *,
      profiles:user_id (name)
    `)
    .eq('entity_type', 'RAW_INVOICE')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching raw material logs:', error);
    throw error;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((log: any) => {
    const { profiles, ...rest } = log;
    return { ...rest, user_name: profiles?.name || null };
  }) as PurchaseLog[];
}
