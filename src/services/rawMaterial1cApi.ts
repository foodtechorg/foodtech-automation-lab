import { supabase } from '@/integrations/supabase/client';
import type { RawMaterial1cCache, Supplier1cCache } from '@/types/rawMaterial';

// ─── Raw Materials (via 1C API) ──────────────────────

export async function search1cRawMaterials(query: string, limit = 20): Promise<RawMaterial1cCache[]> {
  if (query.trim().length < 2) return [];

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=search-raw-materials&q=${encodeURIComponent(query)}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('search1cRawMaterials error:', res.status, errText);
    if (res.status === 401) {
      throw new Error('Помилка авторизації 1С (401). Перевірте налаштування API ключа.');
    }
    throw new Error(`Помилка 1С API: ${res.status}`);
  }

  const json = await res.json();
  const items: any[] = json.items || [];

  return items.map((item) => ({
    raw_material_1c_id: item.id,
    name: item.name,
    default_uom: item.defaultUom || 'кг',
    is_active: true,
    synced_at: new Date().toISOString(),
  }));
}

export async function get1cRawMaterial(id: string): Promise<RawMaterial1cCache | null> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=get-raw-material&id=${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('get1cRawMaterial error:', errText);
    return null;
  }

  const item = await res.json();
  return {
    raw_material_1c_id: item.id,
    name: item.name,
    default_uom: item.defaultUom || 'кг',
    is_active: true,
    synced_at: new Date().toISOString(),
  };
}

// ─── Contractors (via 1C API) ────────────────────────

export async function search1cContractors(query: string, limit = 20): Promise<Supplier1cCache[]> {
  if (query.trim().length < 2) return [];

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=search-contractors&q=${encodeURIComponent(query)}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('search1cContractors error:', res.status, errText);
    if (res.status === 401) {
      throw new Error('Помилка авторизації 1С (401). Перевірте налаштування API ключа.');
    }
    throw new Error(`Помилка 1С API: ${res.status}`);
  }

  const json = await res.json();
  const items: any[] = json.items || [];

  return items.map((item) => ({
    supplier_1c_id: item.id,
    name: item.name,
    tax_id: item.taxId || null,
    is_active: true,
    synced_at: new Date().toISOString(),
  }));
}

export async function get1cContractor(id: string): Promise<Supplier1cCache | null> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const session = (await supabase.auth.getSession()).data.session;

  const url = `https://${projectId}.supabase.co/functions/v1/proxy-1c?action=get-contractor&id=${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || anonKey}`,
      'apikey': anonKey,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('get1cContractor error:', errText);
    return null;
  }

  const item = await res.json();
  return {
    supplier_1c_id: item.id,
    name: item.name,
    tax_id: item.taxId || null,
    is_active: true,
    synced_at: new Date().toISOString(),
  };
}
