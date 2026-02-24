import { supabase } from '@/integrations/supabase/client';
import type { Supplier1cCache, RawMaterial1cCache } from '@/types/rawMaterial';

// ─── Suppliers ───────────────────────────────────────

export async function searchSuppliers(query: string, limit = 20): Promise<Supplier1cCache[]> {
  let q = supabase
    .from('suppliers_1c_cache')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  if (query.trim()) {
    // Use ilike for trigram-backed search
    q = q.or(`name.ilike.%${query}%,tax_id.ilike.%${query}%`);
  }

  const { data, error } = await q;

  if (error) {
    console.error('Error searching suppliers:', error);
    throw error;
  }
  return (data || []) as Supplier1cCache[];
}

export async function getSupplierById(supplier1cId: string): Promise<Supplier1cCache | null> {
  const { data, error } = await supabase
    .from('suppliers_1c_cache')
    .select('*')
    .eq('supplier_1c_id', supplier1cId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching supplier:', error);
    throw error;
  }
  return data as Supplier1cCache | null;
}

// ─── Raw Materials ───────────────────────────────────

export async function searchRawMaterials(query: string, limit = 20): Promise<RawMaterial1cCache[]> {
  let q = supabase
    .from('raw_materials_1c_cache')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  if (query.trim()) {
    q = q.ilike('name', `%${query}%`);
  }

  const { data, error } = await q;

  if (error) {
    console.error('Error searching raw materials:', error);
    throw error;
  }
  return (data || []) as RawMaterial1cCache[];
}

export async function getRawMaterialById(rawMaterial1cId: string): Promise<RawMaterial1cCache | null> {
  const { data, error } = await supabase
    .from('raw_materials_1c_cache')
    .select('*')
    .eq('raw_material_1c_id', rawMaterial1cId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching raw material:', error);
    throw error;
  }
  return data as RawMaterial1cCache | null;
}
