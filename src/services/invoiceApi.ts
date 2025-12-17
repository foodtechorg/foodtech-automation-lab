import { supabase } from '@/integrations/supabase/client';
import type {
  PurchaseInvoice,
  PurchaseInvoiceItem,
  CreatePurchaseInvoicePayload,
  CreatePurchaseInvoiceItemPayload,
  PurchaseLog,
} from '@/types/purchase';

// Get all invoices ordered by creation date
export async function getPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching purchase invoices:', error);
    throw error;
  }

  return (data || []) as PurchaseInvoice[];
}

// Get invoice by ID
export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice | null> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching purchase invoice:', error);
    throw error;
  }

  return data as PurchaseInvoice | null;
}

// Get invoices by request ID
export async function getPurchaseInvoicesByRequestId(requestId: string): Promise<PurchaseInvoice[]> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices for request:', error);
    throw error;
  }

  return (data || []) as PurchaseInvoice[];
}

// Get invoice items
export async function getPurchaseInvoiceItems(invoiceId: string): Promise<PurchaseInvoiceItem[]> {
  const { data, error } = await supabase
    .from('purchase_invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching purchase invoice items:', error);
    throw error;
  }

  return (data || []) as PurchaseInvoiceItem[];
}

// Create a new invoice
export async function createPurchaseInvoice(
  payload: CreatePurchaseInvoicePayload
): Promise<PurchaseInvoice> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .insert({
      request_id: payload.request_id,
      supplier_name: payload.supplier_name,
      supplier_contact: payload.supplier_contact || null,
      description: payload.description || null,
      payment_terms: payload.payment_terms,
      invoice_date: payload.invoice_date || null,
      expected_date: payload.expected_date || null,
      planned_payment_date: payload.planned_payment_date || null,
      currency: payload.currency || 'UAH',
      created_by: payload.created_by,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating purchase invoice:', error);
    throw error;
  }

  return data as PurchaseInvoice;
}

// Create invoice items
export async function createPurchaseInvoiceItems(
  items: CreatePurchaseInvoiceItemPayload[]
): Promise<PurchaseInvoiceItem[]> {
  if (items.length === 0) return [];

  const { data, error } = await supabase
    .from('purchase_invoice_items')
    .insert(
      items.map((item, index) => ({
        invoice_id: item.invoice_id,
        request_item_id: item.request_item_id || null,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        amount: item.quantity * item.price,
        sort_order: index,
        status: 'PENDING' as const,
      }))
    )
    .select();

  if (error) {
    console.error('Error creating purchase invoice items:', error);
    throw error;
  }

  return (data || []) as PurchaseInvoiceItem[];
}

// Update invoice
export async function updatePurchaseInvoice(
  id: string,
  updates: Partial<Omit<PurchaseInvoice, 'id' | 'number' | 'created_by' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('purchase_invoices')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating purchase invoice:', error);
    throw error;
  }
}

// Update invoice status
export async function updatePurchaseInvoiceStatus(
  id: string,
  status: PurchaseInvoice['status']
): Promise<void> {
  const { error } = await supabase
    .from('purchase_invoices')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating purchase invoice status:', error);
    throw error;
  }
}

// Update invoice item
export async function updatePurchaseInvoiceItem(
  id: string,
  updates: Partial<Omit<PurchaseInvoiceItem, 'id' | 'invoice_id' | 'created_at'>>
): Promise<void> {
  const { error } = await supabase
    .from('purchase_invoice_items')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating purchase invoice item:', error);
    throw error;
  }
}

// Delete invoice (only drafts)
export async function deletePurchaseInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_invoices')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting purchase invoice:', error);
    throw error;
  }
}

// Delete invoice item
export async function deletePurchaseInvoiceItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_invoice_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting purchase invoice item:', error);
    throw error;
  }
}

// Log purchase event
export async function logPurchaseEvent(
  entityType: 'REQUEST' | 'INVOICE',
  entityId: string,
  action: string,
  comment?: string,
  payload?: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase.rpc('log_purchase_event', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_action: action,
    p_comment: comment || null,
    p_payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
  });

  if (error) {
    console.error('Error logging purchase event:', error);
    throw error;
  }

  return data as string;
}

// Get purchase logs for entity
export async function getPurchaseLogs(
  entityType: 'REQUEST' | 'INVOICE',
  entityId: string
): Promise<PurchaseLog[]> {
  const { data, error } = await supabase
    .from('purchase_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching purchase logs:', error);
    throw error;
  }

  return (data || []) as PurchaseLog[];
}

// Recalculate invoice total from items
export async function recalculateInvoiceTotal(invoiceId: string): Promise<number> {
  const items = await getPurchaseInvoiceItems(invoiceId);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  
  await updatePurchaseInvoice(invoiceId, { amount: total });
  
  return total;
}
